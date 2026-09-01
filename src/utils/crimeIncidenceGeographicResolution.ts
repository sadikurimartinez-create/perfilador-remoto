import type {
  CrimeExpedientGeographyContext,
  CrimeIncidenceGeographicResolution,
} from "@/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryResolution } from "@/types/crimeIncidenceQueryGovernance";
import {
  CRIME_INCIDENCE_INSTITUTIONAL_BRANDING,
  type CanonicalCrimeIncident,
  type CrimeIncidenceQueryGeometry,
} from "@/types/crimeIncidenceWorkspace";

function authoritativeGeometry(context: CrimeExpedientGeographyContext): CrimeIncidenceQueryGeometry {
  if (context.geographyType === "INDIVIDUAL") return context.point;
  if (context.geographyType === "CORRIDOR") return context.corridor;
  return context.polygon;
}

function sameGeometry(left: CrimeIncidenceQueryGeometry, right: CrimeIncidenceQueryGeometry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function excludedRecords(
  sourceRecords: CanonicalCrimeIncident[],
  matchedRecords: CanonicalCrimeIncident[]
): CanonicalCrimeIncident[] {
  const matchedIds = new Set(matchedRecords.map((record) => record.id));
  return sourceRecords.filter((record) => !matchedIds.has(record.id));
}

function coverageExplanation(
  query: CrimeIncidenceQueryResolution,
  geometryMatches: boolean
): string {
  if (!geometryMatches) return "QUERY_GEOMETRY_DOES_NOT_MATCH_EXPEDIENT_AUTHORITY";
  if (query.status === "NO_COVERAGE") return "QUERY_OUT_OF_AUTHORIZED_TERRITORIAL_COVERAGE";
  if (query.status === "REJECTED") return "QUERY_REJECTED_BEFORE_GEOGRAPHIC_RESOLUTION";
  if (query.coverage.queryStatus === "UNKNOWN_COVERAGE") return "QUERY_COVERAGE_REMAINS_UNKNOWN";
  return "QUERY_RESOLVED_WITH_EXPEDIENT_GEOGRAPHY_AUTHORITY";
}

/** Resolves geography without relocating incidents or deriving replacement geometry. */
export function resolveCrimeIncidenceGeography(
  context: CrimeExpedientGeographyContext,
  query: CrimeIncidenceQueryResolution
): CrimeIncidenceGeographicResolution {
  const geometry = authoritativeGeometry(context);
  const geometryMatches = sameGeometry(geometry, query.request.queryGeometry);
  const matchedRecords = geometryMatches && query.executed ? query.resolvedIncidents : [];
  const sourceRecords = query.request.sourceEnvelope.records;

  return {
    geometryType: geometry.mode,
    geometry,
    coverageStatus: geometryMatches ? query.coverage.queryStatus : "UNKNOWN_COVERAGE",
    matchedRecords,
    excludedRecords: excludedRecords(sourceRecords, matchedRecords),
    coverageExplanation: coverageExplanation(query, geometryMatches),
    lineage: query.lineage,
    expedientGeography: context,
    queryResolution: query,
    datasetProvenance: query.datasetProvenance,
    institutionalMetadata: {
      watermark: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark,
      header: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.institutionHeader,
      footer: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.institutionFooter,
    },
  };
}
