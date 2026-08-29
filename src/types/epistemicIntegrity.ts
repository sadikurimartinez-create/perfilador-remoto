export type AcquisitionMode =
  | "OBSERVED"
  | "DERIVED"
  | "AI_GENERATED"
  | "SIMULATED"
  | "MOCK"
  | "CONNECTIVITY_ONLY"
  | "TEST"
  | "LEGACY"
  | "UNKNOWN";

export type AcquisitionStatus =
  | "ACQUIRED"
  | "NO_DATA"
  | "FAILED"
  | "NOT_CONFIGURED"
  | "PARTIAL"
  | "UNAVAILABLE";

export type EpistemicValidationStatus =
  | "UNREVIEWED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "LEGACY_UNCLASSIFIED";

export type IntelligenceSemanticRole =
  | "SOURCE_FACT"
  | "INFERENCE"
  | "SYNTHESIS"
  | "ANALYTICAL_SUGGESTION"
  | "DIAGNOSTIC"
  | "UNKNOWN";

export interface EpistemicSourceLineage {
  sourceId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  sourceType?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  rawSourceReference?: string | null;
  traceabilityId?: string | null;
  acquisitionMode?: AcquisitionMode;
}

export interface EpistemicIntegrityMetadata {
  sourceId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  sourceType?: string | null;
  acquisitionMode: AcquisitionMode;
  acquisitionStatus?: AcquisitionStatus;
  semanticRole?: IntelligenceSemanticRole;
  validationStatus?: EpistemicValidationStatus;
  isSimulated?: boolean;
  isDerived?: boolean;
  isConnectivityOnly?: boolean;
  observedAt?: string | null;
  acquiredAt?: string | null;
  generatedAt?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  rawSourceReference?: string | null;
  query?: string | null;
  resultCount?: number | null;
  geolocationSource?: string | null;
  traceabilityId?: string | null;
  lineage?: EpistemicSourceLineage[];
}

export interface EpistemicIntegrityCarrier {
  epistemic?: Partial<EpistemicIntegrityMetadata> | null;
  epistemicIntegrity?: Partial<EpistemicIntegrityMetadata> | null;
  acquisitionMode?: AcquisitionMode | string | null;
  acquisitionStatus?: AcquisitionStatus | string | null;
  validationStatus?: EpistemicValidationStatus | string | null;
  sourceId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  sourceType?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  rawSourceReference?: string | null;
  query?: string | null;
  resultCount?: number | null;
  geolocationSource?: string | null;
  traceabilityId?: string | null;
  lineage?: EpistemicSourceLineage[] | null;
  isSimulated?: boolean;
  isDerived?: boolean;
  isConnectivityOnly?: boolean;
  observedAt?: string | null;
  acquiredAt?: string | null;
  generatedAt?: string | null;
  status?: string | null;
  estado?: string | null;
  estado_revision?: string | null;
  analystValidationStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
