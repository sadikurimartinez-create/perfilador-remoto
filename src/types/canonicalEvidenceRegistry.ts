export type CanonicalReferenceCompleteness =
  | "COMPLETE"
  | "PARTIAL"
  | "LEGACY_PARTIAL"
  | "UNAVAILABLE";

export type CanonicalRegistryEntityType = "EVIDENCE" | "FINDING";

export type CanonicalNativeType =
  | "STREET_VIEW_EVIDENCE"
  | "STREET_VIEW_FINDING"
  | "TEMPORAL_EVIDENCE"
  | "TEMPORAL_COMPARISON_FINDING"
  | "FIELD_PHOTO_EVIDENCE";

interface CanonicalReferenceBase {
  registryRefId: string;
  expedienteId?: string;
  nativeType: CanonicalNativeType;
  sourceType: "STREET_VIEW" | "TEMPORAL_COMPARISON" | "FIELD_PHOTO";
  sourceId?: string;
  sweepId?: string;
  operationId?: string;
  eventId?: string;
  traceabilityId?: string;
  geographyId?: string;
  lineageStatus: CanonicalReferenceCompleteness;
}

export interface CanonicalEvidenceRef extends CanonicalReferenceBase {
  entityType: "EVIDENCE";
  nativeEvidenceId?: string;
}

export interface CanonicalFindingRef extends CanonicalReferenceBase {
  entityType: "FINDING";
  nativeFindingId?: string;
  sourceFindingId?: string;
  supportingEvidenceRefs: CanonicalEvidenceRef[];
}

export interface CanonicalReferenceSet {
  evidenceRefs: CanonicalEvidenceRef[];
  findingRef: CanonicalFindingRef | null;
}
