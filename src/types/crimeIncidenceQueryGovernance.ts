import type { CrimeDatasetAdmissionResult, CrimeDatasetIdentity } from "@/types/crimeDatasetIdentity";
import type {
  CanonicalCrimeIncident,
  CrimeIncidenceAnalyticLevel,
  CrimeIncidenceDatasetCoverage,
  CrimeIncidenceDatasetProvenance,
  CrimeIncidenceQueryEnvelope,
  CrimeIncidenceQueryGeometry,
} from "@/types/crimeIncidenceWorkspace";
import type { CrimeCoverageStatus, CrimeQueryLineage } from "@/utils/crimeIncidenceCanonicalPipeline";

export type CrimeIncidenceQueryPurpose = "WORKSPACE" | "MAP" | "CHART" | "ANALYSIS" | "REPORT";

export interface CrimeIncidenceTemporalFilters {
  start?: string | null;
  end?: string | null;
}

export interface CrimeIncidenceCrimeFilters {
  incidentTypes?: string[];
  municipalities?: string[];
  neighborhoods?: string[];
}

export interface CrimeIncidenceRequestProvenance {
  requestedBy?: string;
  requestReference?: string;
  operationId?: string;
  sourceReference?: string;
}

export interface CrimeIncidenceQueryRequest {
  datasetIdentity: CrimeDatasetIdentity;
  queryGeometry: CrimeIncidenceQueryGeometry;
  temporalFilters: CrimeIncidenceTemporalFilters;
  crimeFilters: CrimeIncidenceCrimeFilters;
  purpose: CrimeIncidenceQueryPurpose;
  analyticLevel: CrimeIncidenceAnalyticLevel;
  requestProvenance: CrimeIncidenceRequestProvenance;
  queryParameters: Record<string, unknown>;
  sourceEnvelope: CrimeIncidenceQueryEnvelope;
}

export type CrimeIncidenceQueryResolutionStatus = "EXECUTED" | "REJECTED" | "NO_COVERAGE";

export interface CrimeIncidenceResolvedCoverage {
  queryStatus: CrimeCoverageStatus;
  datasetCoverage?: CrimeIncidenceDatasetCoverage;
}

/** A resolution certifies query governance only. Its incidents remain data, never evidence or findings. */
export interface CrimeIncidenceQueryResolution {
  status: CrimeIncidenceQueryResolutionStatus;
  executed: boolean;
  request: CrimeIncidenceQueryRequest;
  datasetIdentity: CrimeDatasetIdentity;
  admission: CrimeDatasetAdmissionResult;
  resolvedIncidents: CanonicalCrimeIncident[];
  coverage: CrimeIncidenceResolvedCoverage;
  lineage: CrimeQueryLineage;
  datasetProvenance: CrimeIncidenceDatasetProvenance;
  warnings: string[];
  limitations: string[];
  errors: string[];
}
