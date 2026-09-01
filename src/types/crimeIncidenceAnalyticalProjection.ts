import type {
  CrimeExpedientGeographyContext,
  CrimeIncidenceGeographicResolution,
} from "@/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryResolution } from "@/types/crimeIncidenceQueryGovernance";
import type {
  CrimeIncidenceDatasetCoverage,
  CrimeIncidenceDatasetProvenance,
  CrimeIncidenceQueryGeometry,
} from "@/types/crimeIncidenceWorkspace";
import type { CrimeCoverageStatus, CrimeQueryLineage } from "@/utils/crimeIncidenceCanonicalPipeline";

export interface CrimeIncidenceFrequencyBucket {
  value: string | null;
  count: number;
}

export interface CrimeIncidencePercentageBucket extends CrimeIncidenceFrequencyBucket {
  percentage: number;
}

export interface CrimeIncidenceDescriptiveMetrics {
  frequency: {
    totalRecords: number;
    byIncidentType: CrimeIncidenceFrequencyBucket[];
  };
  percentage: {
    basis: number;
    byIncidentType: CrimeIncidencePercentageBucket[];
  };
  distribution: {
    byMunicipality: CrimeIncidenceFrequencyBucket[];
    byOccurredDate: CrimeIncidenceFrequencyBucket[];
  };
  aggregation: {
    matchedRecords: number;
    excludedRecords: number;
    recordsWithCoordinates: number;
  };
}

export interface CrimeIncidenceGeographicReference {
  expediente: CrimeExpedientGeographyContext;
  geometryType: CrimeIncidenceGeographicResolution["geometryType"];
  geometry: CrimeIncidenceQueryGeometry;
  coverageStatus: CrimeCoverageStatus;
  coverageExplanation: string;
}

export interface CrimeIncidenceTemporalReference {
  query: CrimeIncidenceQueryResolution["request"]["temporalFilters"];
  dataset?: CrimeIncidenceDatasetCoverage["temporal"];
}

/** A descriptive projection summarizes governed data and carries no evidentiary or inferential status. */
export interface CrimeIncidenceAnalyticalProjection {
  projectionType: "DESCRIPTIVE_SUMMARY";
  analyticalLevel: "DESCRIPTIVE";
  sourceQuery: CrimeIncidenceQueryResolution;
  datasetReference: CrimeIncidenceDatasetProvenance;
  geographicReference: CrimeIncidenceGeographicReference;
  temporalReference: CrimeIncidenceTemporalReference;
  metrics: CrimeIncidenceDescriptiveMetrics;
  limitations: string[];
  lineage: CrimeQueryLineage;
}
