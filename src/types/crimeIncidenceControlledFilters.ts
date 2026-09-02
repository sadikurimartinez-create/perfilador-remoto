import type { CrimeIncidenceQueryRequest } from "@/types/crimeIncidenceQueryGovernance";
import type { CrimeCoverageStatus } from "@/utils/crimeIncidenceCanonicalPipeline";

export interface CrimeIncidenceFilterState {
  temporal: { start: string | null; end: string | null };
  incidentTypes: string[];
  geographicCoverage: CrimeCoverageStatus | null;
}

/** Stops before acquisition: the data layer must supply a new governed query envelope. */
export interface CrimeIncidenceFilterQueryIntent {
  filters: CrimeIncidenceFilterState;
  datasetIdentity: CrimeIncidenceQueryRequest["datasetIdentity"];
  queryGeometry: CrimeIncidenceQueryRequest["queryGeometry"];
  purpose: CrimeIncidenceQueryRequest["purpose"];
  analyticLevel: "DESCRIPTIVE";
  requestProvenance: CrimeIncidenceQueryRequest["requestProvenance"];
  queryParameters: CrimeIncidenceQueryRequest["queryParameters"];
}
