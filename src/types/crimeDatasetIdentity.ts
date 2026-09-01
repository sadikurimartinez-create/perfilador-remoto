import type {
  CrimeCoverageStatus,
  CrimeDatasetValidationStatus,
  CrimeQueryLineage,
} from "@/utils/crimeIncidenceCanonicalPipeline";
import type { CrimeIncidenceDatasetCoverage } from "@/types/crimeIncidenceWorkspace";

export type CrimeDatasetAdmissionStatus =
  | "ADMITTED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "FAILED_VALIDATION"
  | "INCOMPLETE_PROVENANCE"
  | "OUT_OF_SCOPE";

export type CrimeDatasetScopeCompatibility = "IN_SCOPE" | "OUT_OF_SCOPE" | "UNKNOWN";

export interface CrimeDatasetGeographicCoverage {
  status: CrimeCoverageStatus;
  scopeCompatibility: CrimeDatasetScopeCompatibility;
  jurisdiction?: string;
  description?: string;
  geometryReference?: string;
}

export interface CrimeDatasetValidationSummary {
  status: CrimeDatasetValidationStatus;
  schemaValid: boolean;
  recordCount?: number;
  acceptedCount?: number;
  rejectedCount?: number;
  deduplicatedCount?: number;
  reasons?: string[];
  warnings?: string[];
}

export interface CrimeDatasetIdentity {
  datasetId: string | null;
  datasetName: string | null;
  datasetVersion: string | null;
  sourceType: string | null;
  sourceName: string | null;
  sourceOrganization: string | null;
  description?: string | null;
  temporalCoverage: CrimeIncidenceDatasetCoverage["temporal"] | null;
  geographicCoverage: CrimeDatasetGeographicCoverage | null;
  recordCount?: number | null;
  checksum?: {
    algorithm: string;
    value: string;
  } | null;
  createdAt?: string | null;
  ingestedAt?: string | null;
  reference?: string | null;
  license?: string | null;
  legalReference?: string | null;
  owner?: string | null;
  responsible?: string | null;
  lineage?: CrimeQueryLineage | null;
  validationSummary?: CrimeDatasetValidationSummary | null;
  reviewDecision?: "PENDING_REVIEW" | "REJECTED" | null;
  metadata?: Record<string, unknown>;
}

export interface CrimeDatasetAdmissionResult {
  dataset: CrimeDatasetIdentity;
  status: CrimeDatasetAdmissionStatus;
  accepted: boolean;
  reasons: string[];
  warnings: string[];
  validationSummary: CrimeDatasetValidationSummary | null;
  evaluatedAt?: string;
}
