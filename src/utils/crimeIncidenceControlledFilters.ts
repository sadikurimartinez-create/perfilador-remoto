import type { CrimeIncidenceFilterQueryIntent, CrimeIncidenceFilterState } from "@/types/crimeIncidenceControlledFilters";
import type { CrimeIncidenceQueryRequest } from "@/types/crimeIncidenceQueryGovernance";

export function createCrimeIncidenceFilterState(request: CrimeIncidenceQueryRequest): CrimeIncidenceFilterState {
  return {
    temporal: { start: request.temporalFilters.start ?? null, end: request.temporalFilters.end ?? null },
    incidentTypes: [...(request.crimeFilters.incidentTypes ?? [])],
    geographicCoverage: request.sourceEnvelope.coverageStatus,
  };
}

function assertFilterState(filters: CrimeIncidenceFilterState): void {
  if (filters.temporal.start && filters.temporal.end && filters.temporal.start > filters.temporal.end) {
    throw new Error("CRIME_INCIDENCE_FILTER_INVALID_TEMPORAL_RANGE");
  }
  if (filters.incidentTypes.some((incidentType) => incidentType.trim() === "")) {
    throw new Error("CRIME_INCIDENCE_FILTER_INVALID_INCIDENT_TYPE");
  }
}

/** Builds a governed acquisition intent without filtering records or changing geometry. */
export function createCrimeIncidenceFilterQueryIntent(
  request: CrimeIncidenceQueryRequest,
  filters: CrimeIncidenceFilterState
): CrimeIncidenceFilterQueryIntent {
  assertFilterState(filters);
  return {
    filters: {
      temporal: { ...filters.temporal },
      incidentTypes: [...filters.incidentTypes],
      geographicCoverage: filters.geographicCoverage,
    },
    datasetIdentity: request.datasetIdentity,
    queryGeometry: request.queryGeometry,
    purpose: request.purpose,
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: request.requestProvenance,
    queryParameters: request.queryParameters,
  };
}
