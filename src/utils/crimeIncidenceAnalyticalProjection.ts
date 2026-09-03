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

export interface CrimeIncidenceAnalyticsView {
  projectionType: "DESCRIPTIVE_SUMMARY";
  analyticalLevel: "DESCRIPTIVE";
  datasetReference: {
    datasetId?: string;
  };
  geographicReference: {
    coverageStatus: string;
  };
  temporalReference: {
    query: {
      start?: string | null;
      end?: string | null;
    };
  };
  metrics: CrimeIncidenceAnalyticalProjection["metrics"];
  limitations: string[];
}

export interface StandaloneCrimeIncidenceAnalyticsInput {
  incidents: readonly CanonicalCrimeIncident[];
  datasetId: string;
  coverageStatus: string;
  temporalStart?: string | null;
  temporalEnd?: string | null;
  totalScanned?: number;
}

/**
 * Projects ADR-022 descriptive metrics for the autonomous Incidencia module
 * without introducing expediente or rector geography.
 */
export function projectStandaloneCrimeIncidenceAnalytics(
  input: StandaloneCrimeIncidenceAnalyticsInput
): CrimeIncidenceAnalyticsView {
  const incidentFrequency = frequency(
    input.incidents.map((record) => record.incidentType)
  );

  const totalRecords = input.incidents.length;
  const totalScanned = input.totalScanned ?? totalRecords;

  return {
    projectionType: "DESCRIPTIVE_SUMMARY",
    analyticalLevel: "DESCRIPTIVE",
    datasetReference: {
      datasetId: input.datasetId,
    },
    geographicReference: {
      coverageStatus: input.coverageStatus,
    },
    temporalReference: {
      query: {
        start: input.temporalStart ?? null,
        end: input.temporalEnd ?? null,
      },
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
          percentage:
            totalRecords === 0
              ? 0
              : Number(((bucket.count / totalRecords) * 100).toFixed(2)),
        })),
      },
      distribution: {
        byMunicipality: frequency(
          input.incidents.map(
            (record) => record.location.municipality ?? null
          )
        ),
        byOccurredDate: frequency(
          input.incidents.map((record) => record.occurredDate)
        ),
      },
      aggregation: {
        matchedRecords: totalRecords,
        excludedRecords: Math.max(0, totalScanned - totalRecords),
        recordsWithCoordinates: input.incidents.filter(
          (record) =>
            record.coordinates.lat !== null &&
            record.coordinates.lng !== null
        ).length,
      },
    },
    limitations: [
      "DESCRIPTIVE_PROJECTION_IS_NOT_EVIDENCE_FINDING_PROOF_CAUSALITY_OR_PREDICTION",
      "STANDALONE_CRIME_INCIDENCE_ANALYTICS_WITHOUT_EXPEDIENT_CONTEXT",
    ],
  };
}
