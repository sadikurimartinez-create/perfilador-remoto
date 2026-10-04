import type { ScinceCanonicalContextResult } from "@/types/scinceCanonicalContext";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";

export const SCINCE_CANONICAL_SNAPSHOT_VERSION = "SCINCE_CANONICAL_SNAPSHOT_V1";
export type ScinceResolvedSnapshot = ScinceCanonicalSnapshot | import('./scinceCompactSnapshot').ScinceCompactSnapshotV2;
export type ScinceCanonicalSuccess = Extract<ScinceCanonicalContextResult, { success: true }>;

export interface ScinceCanonicalSnapshot {
  schemaVersion: typeof SCINCE_CANONICAL_SNAPSHOT_VERSION | "SCINCE_CANONICAL_SNAPSHOT_V2";
  multiunit?: import("./scinceMultiunit").ScinceMultiunitObservation;
  projectId: string;
  geographyBinding: {
    geographyId: string;
    geographyType: "INDIVIDUAL" | "CORRIDOR" | "POLYGON";
    geographyFingerprint: string;
    fingerprintVersion: string;
    spatialMode: "CANONICAL_POINT" | "CANONICAL_LINE" | "CANONICAL_AREA";
    queryCoordinate: { lat: number; lng: number } | null;
  };
  dataset: { datasetId: string | null; year: number | null; version: string | null };
  territorialResolution: Pick<ScinceCanonicalSuccess,
    "geographicLevel" | "demographicGeographicLevel" | "sourceRowKey">;
  demographics: ScinceCanonicalSuccess["demographics"];
  provenance: ScinceCanonicalSuccess["provenance"];
  limitations: string[];
  // The canonical result exposes no acquisition time. Import completion is not observation time.
  observedAt: null;
}

export type ScinceSnapshotFreshness = "CURRENT" | "STALE" | "INVALID" | "MISSING";
export interface ScinceSnapshotFreshnessInput {
  snapshot: unknown;
  currentNormalizationRelease?: import('./scinceCatalog').ScinceNormalizationRelease | null;
  expectedProjectId: string;
  currentCanonicalGeography: CanonicalProjectGeography | null | undefined;
}
export interface ScinceSnapshotFreshnessResult {
  territorialFreshness: ScinceSnapshotFreshness;
  datasetIdentity: ScinceCanonicalSnapshot["dataset"] | null;
  reason: string;
}
