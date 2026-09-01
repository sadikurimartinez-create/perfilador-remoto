import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CrimeIncidenceGeographicResolution } from "@/types/crimeIncidenceGeographicResolution";
import type { CanonicalCrimeIncident } from "@/types/crimeIncidenceWorkspace";

function frequency(values: Array<string | null>) {
  const counts = new Map<string | null, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => String(left.value ?? "").localeCompare(String(right.value ?? "")));
}

/** Projects descriptive metrics from records admitted by the authoritative geographic resolution. */
export function projectCrimeIncidenceAnalytics(
  incidents: readonly CanonicalCrimeIncident[],
  geography: CrimeIncidenceGeographicResolution
): CrimeIncidenceAnalyticalProjection {
  const admittedIds = new Set(geography.matchedRecords.map((record) => record.id));
  const admittedRecords = incidents.filter((record) => admittedIds.has(record.id));
  const incidentFrequency = frequency(admittedRecords.map((record) => record.incidentType));
  const totalRecords = admittedRecords.length;

  return {
    projectionType: "DESCRIPTIVE_SUMMARY",
    analyticalLevel: "DESCRIPTIVE",
    sourceQuery: geography.queryResolution,
    datasetReference: geography.datasetProvenance,
    geographicReference: {
      expediente: geography.expedientGeography,
      geometryType: geography.geometryType,
      geometry: geography.geometry,
      coverageStatus: geography.coverageStatus,
      coverageExplanation: geography.coverageExplanation,
    },
    temporalReference: {
      query: geography.queryResolution.request.temporalFilters,
      dataset: geography.datasetProvenance.coverage?.temporal,
    },
    metrics: {
      frequency: {
        totalRecords,
        byIncidentType: incidentFrequency,
      },
      percentage: {
        basis: totalRecords,
        byIncidentType: incidentFrequency.map((bucket) => ({
          ...bucket,
          percentage: totalRecords === 0 ? 0 : (bucket.count / totalRecords) * 100,
        })),
      },
      distribution: {
        byMunicipality: frequency(admittedRecords.map((record) => record.location.municipality ?? null)),
        byOccurredDate: frequency(admittedRecords.map((record) => record.occurredDate)),
      },
      aggregation: {
        matchedRecords: totalRecords,
        excludedRecords: incidents.length - totalRecords,
        recordsWithCoordinates: admittedRecords.filter(
          (record) => record.coordinates.lat !== null && record.coordinates.lng !== null
        ).length,
      },
    },
    limitations: [
      "DESCRIPTIVE_PROJECTION_IS_NOT_EVIDENCE_FINDING_PROOF_CAUSALITY_OR_PREDICTION",
      ...geography.queryResolution.limitations,
    ],
    lineage: geography.lineage,
  };
}
