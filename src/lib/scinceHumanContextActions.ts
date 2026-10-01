"use server";

import { cookies } from "next/headers";
import { isDeepStrictEqual } from "util";
import { getCanonicalScinceData } from "@/lib/osintActions";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography,
  type FirestoreSafeCanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { buildScinceCanonicalSnapshot, evaluateScinceSnapshotFreshness,
  isScinceSnapshotPublishable } from "@/utils/scinceCanonicalSnapshot";
import type { ScinceCanonicalSuccess, ScinceCanonicalSnapshot, ScinceSnapshotFreshnessResult } from "@/types/scinceCanonicalSnapshot";

export type ScinceIncorporationDecision = {
  decision: "INCORPORATED";
  incorporatedBy: { institutionalUserId: string; username: string };
  incorporatedAt: string;
};
export type ScincePreparationResult =
  | { success: true; snapshot: ScinceCanonicalSnapshot; incorporation: ScinceIncorporationDecision }
  | { success: false; code: "ACCESS_DENIED" | "REVIEW_CHANGED" | "NOT_CURRENT" | "UNAVAILABLE" };
export type ScinceFreshnessResponse =
  | { success: true; freshness: ScinceSnapshotFreshnessResult }
  | { success: false; code: "ACCESS_DENIED" | "UNAVAILABLE" };

function canonical(raw: unknown): CanonicalProjectGeography | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { geometry?: { type?: unknown; coordinates?: unknown; point?: { lat?: unknown; lng?: unknown } } };
  if (value.geometry?.type === "Point") {
    const coordinates = Array.isArray(value.geometry.coordinates) ? value.geometry.coordinates :
      [value.geometry.point?.lng, value.geometry.point?.lat];
    if (coordinates.length !== 2 || !coordinates.every(v => typeof v === "number" && Number.isFinite(v)) ||
      Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return null;
  }
  return deserializeCanonicalGeographyFromFirestore(raw as CanonicalProjectGeography | FirestoreSafeCanonicalProjectGeography | null);
}

/** Read-only preparation. The caller persists only after the explicit human action.
 * Reacquire the canonical observation so client-supplied demographics cannot become authoritative.
 * Any difference requires a new human review; never silently incorporate a changed observation.
 */
export async function prepareScinceContextIncorporation(projectId: string, reviewed: ScinceCanonicalSuccess): Promise<ScincePreparationResult> {
  try {
    const access = await authorizeInstitutionalProjectAccess({ projectId, action: "WRITE",
      sessionToken: cookies().get("ceipol_session")?.value });
    if (!access.allowed) return { success: false, code: "ACCESS_DENIED" };
    const fresh = await getCanonicalScinceData(access.projectId);
    if (!fresh.success) return { success: false, code: fresh.code === "SCINCE_CANONICAL_ACCESS_DENIED" ? "ACCESS_DENIED" : "UNAVAILABLE" };
    const snapshot = buildScinceCanonicalSnapshot(fresh);
    const reviewedSnapshot = buildScinceCanonicalSnapshot(reviewed);
    if (!isDeepStrictEqual(snapshot, reviewedSnapshot)) return { success: false, code: "REVIEW_CHANGED" };
    const input = { snapshot, expectedProjectId: access.projectId, currentCanonicalGeography: canonical(access.project.canonicalGeography) };
    if (!isScinceSnapshotPublishable(input)) return { success: false, code: "NOT_CURRENT" };
    return { success: true, snapshot, incorporation: { decision: "INCORPORATED",
      incorporatedBy: { institutionalUserId: access.actor.institutionalUserId, username: access.actor.username },
      incorporatedAt: new Date().toISOString() } };
  } catch {
    return { success: false, code: "UNAVAILABLE" };
  }
}

/** Evaluate against authorized persisted geography, never against a client-declared fingerprint. */
export async function getScinceContextFreshness(projectId: string, snapshot: unknown,
  localCanonicalGeography?: CanonicalProjectGeography | null): Promise<ScinceFreshnessResponse> {
  try {
    const access = await authorizeInstitutionalProjectAccess({ projectId, action: "READ",
      sessionToken: cookies().get("ceipol_session")?.value });
    if (!access.allowed) return { success: false, code: "ACCESS_DENIED" };
    const freshness = evaluateScinceSnapshotFreshness({ snapshot,
      expectedProjectId: access.projectId, currentCanonicalGeography: canonical(access.project.canonicalGeography) });
    // A pending local map edit can only lower freshness; it cannot override the persisted geography gate.
    if (freshness.territorialFreshness === "CURRENT" && localCanonicalGeography !== undefined) {
      return { success: true, freshness: evaluateScinceSnapshotFreshness({ snapshot,
        expectedProjectId: access.projectId, currentCanonicalGeography: localCanonicalGeography }) };
    }
    return { success: true, freshness };
  } catch {
    return { success: false, code: "UNAVAILABLE" };
  }
}
