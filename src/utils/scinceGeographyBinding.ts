import "server-only";
import { createHash } from "crypto";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";

export const CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION = "CANONICAL_GEOGRAPHY_FINGERPRINT_V1";

// This phase binds only validated individual Points; fixed key order is deterministic.
export function fingerprintScinceCanonicalPoint(geography: CanonicalProjectGeography): string {
  if (geography.type !== "INDIVIDUAL" || geography.geometry.type !== "Point" ||
      geography.geometry.coordinates.length !== 2 ||
      !geography.geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) ||
      Math.abs(geography.geometry.coordinates[0]) > 180 || Math.abs(geography.geometry.coordinates[1]) > 90) {
    throw new Error("SCINCE_CANONICAL_POINT_INVALID");
  }
  const territory = JSON.stringify({ type: geography.type,
    geometry: { type: "Point", coordinates: geography.geometry.coordinates } });
  return `${CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION}:${createHash("sha256").update(territory).digest("hex")}`;
}
