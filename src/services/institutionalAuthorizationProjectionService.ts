import "server-only";
import { createHash } from "crypto";
import { PROJECT_ACCESS_ACTIONS, type InstitutionalActor, type ProjectAccessRelation } from "@/types/institutionalProjectAccess";

// PostgreSQL is authority. This document is only an expiring enforcement mirror.
export const AUTHORIZATION_POLICY = "EXPLICIT_ACTION_GRANT_V1";
export const AUTHORIZATION_LEASE_MS = 300_000;
export type AuthorizationProjection = {
  projectId: string; institutionalUserId: string; relation: "ASSIGNED";
  allowedActions: string[]; revoked: boolean; revokedAt: string | null;
  policyVersion: typeof AUTHORIZATION_POLICY; source: "POSTGRESQL";
  synchronizedAt: number; expiresAt: number; revision: string;
};
export interface AuthorizationAuthoritySnapshot {
  actor: InstitutionalActor; relations: ProjectAccessRelation[];
  source: "POSTGRESQL"; policyVersion: typeof AUTHORIZATION_POLICY;
}
export interface AuthorizationProjectionAdapter {
  // Must atomically replace the user's mirrors and append the audit. Missing
  // relations are tombstoned; never leave a formerly active mirror behind.
  commit(actor: InstitutionalActor, projections: AuthorizationProjection[], timestamp: number): Promise<void>;
}
export function validAuthorizationId(value: unknown, max = 1500): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= max && value !== "." && value !== ".." &&
    !/[\/\\\x00-\x1f\x7f]/.test(value);
}
export function validateAuthorizationSnapshot(snapshot: AuthorizationAuthoritySnapshot, now: number): AuthorizationProjection[] {
  const { actor } = snapshot;
  if (snapshot.source !== "POSTGRESQL" || snapshot.policyVersion !== AUTHORIZATION_POLICY ||
      !Number.isSafeInteger(now) || now < 0 || !actor || !validAuthorizationId(actor.institutionalUserId, 123) ||
      !["USER", "ADMIN", "SUPER_ADMIN"].includes(actor.role) || !Array.isArray(snapshot.relations)) {
    throw new Error("AUTHORIZATION_SNAPSHOT_INVALID");
  }
  const seen = new Set<string>();
  return snapshot.relations.map(relation => {
    if (!validAuthorizationId(relation.projectId) || relation.institutionalUserId !== actor.institutionalUserId ||
        relation.relation !== "ASSIGNED" || seen.has(relation.projectId) ||
        !Array.isArray(relation.allowedActions) || !relation.allowedActions.length ||
        relation.allowedActions.some(action => !PROJECT_ACCESS_ACTIONS.includes(action))) {
      throw new Error("AUTHORIZATION_RELATION_INVALID");
    }
    seen.add(relation.projectId);
    const date = relation.revokedAt === null ? null : new Date(relation.revokedAt);
    if (date && (!Number.isFinite(date.getTime()) || date.getTime() > now)) throw new Error("AUTHORIZATION_REVOCATION_INVALID");
    const value = {
      projectId: relation.projectId, institutionalUserId: actor.institutionalUserId,
      relation: "ASSIGNED" as const,
      allowedActions: PROJECT_ACCESS_ACTIONS.filter(action => relation.allowedActions.includes(action)),
      revoked: date !== null, revokedAt: date?.toISOString() ?? null,
      policyVersion: AUTHORIZATION_POLICY as typeof AUTHORIZATION_POLICY, source: "POSTGRESQL" as const,
    };
    return { ...value, synchronizedAt: now, expiresAt: now + AUTHORIZATION_LEASE_MS,
      revision: createHash("sha256").update(JSON.stringify(value)).digest("hex") };
  }).sort((a, b) => a.projectId.localeCompare(b.projectId));
}
export async function synchronizeInstitutionalAuthorization(
  resolveAuthority: () => Promise<AuthorizationAuthoritySnapshot>, adapter: AuthorizationProjectionAdapter,
  now: () => number = Date.now,
) {
  // Validate the entire snapshot before any persistence. No partial success.
  const snapshot = await resolveAuthority();
  const timestamp = now();
  const projections = validateAuthorizationSnapshot(snapshot, timestamp);
  await adapter.commit(snapshot.actor, projections, timestamp);
  return projections;
}
