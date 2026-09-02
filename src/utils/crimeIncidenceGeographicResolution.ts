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

function pointOnSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): boolean {
  const squaredLength = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
  if (squaredLength === 0) return point[0] === start[0] && point[1] === start[1];
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > Number.EPSILON * 100) return false;
  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < 0) return false;
  return dot <= squaredLength;
}

function pointInPolygon(point: [number, number], ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]))
        / (previousPoint[1] - currentPoint[1]) + currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegmentMeters(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  const metersPerLatitudeDegree = 111_320;
  const metersPerLongitudeDegree = metersPerLatitudeDegree * Math.cos(point[1] * Math.PI / 180);
  const startX = (start[0] - point[0]) * metersPerLongitudeDegree;
  const startY = (start[1] - point[1]) * metersPerLatitudeDegree;
  const endX = (end[0] - point[0]) * metersPerLongitudeDegree;
  const endY = (end[1] - point[1]) * metersPerLatitudeDegree;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const squaredLength = segmentX ** 2 + segmentY ** 2;
  const position = squaredLength === 0 ? 0 : Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / squaredLength));
  return Math.hypot(startX + position * segmentX, startY + position * segmentY);
}

function incidentMatchesGeometry(
  incident: CanonicalCrimeIncident,
  geometry: CrimeIncidenceQueryGeometry
): boolean {
  const { lat, lng } = incident.coordinates;
  if (lat === null || lng === null) return false;
  if (geometry.mode === "POINT_RADIUS") return true;
  const point: [number, number] = [lng, lat];
  if (geometry.mode === "POLYGON_BOUNDARY") {
    const ring = geometry.geometry.coordinates[0] ?? [];
    return ring.length >= 3 && pointInPolygon(point, ring);
  }
  const width = geometry.corridorWidthMeters;
  if (!width || width <= 0) return false;
  const coordinates = geometry.geometry.coordinates;
  for (let index = 1; index < coordinates.length; index++) {
    if (distanceToSegmentMeters(point, coordinates[index - 1], coordinates[index]) <= width) return true;
  }
  return false;
}

function coverageExplanation(
  query: CrimeIncidenceQueryResolution,
  geometryMatches: boolean,
  geometry: CrimeIncidenceQueryGeometry
): string {
  if (!geometryMatches) return "QUERY_GEOMETRY_DOES_NOT_MATCH_EXPEDIENT_AUTHORITY";
  if (query.status === "NO_COVERAGE") return "QUERY_OUT_OF_AUTHORIZED_TERRITORIAL_COVERAGE";
  if (query.status === "REJECTED") return "QUERY_REJECTED_BEFORE_GEOGRAPHIC_RESOLUTION";
  if (query.coverage.queryStatus === "UNKNOWN_COVERAGE") return "QUERY_COVERAGE_REMAINS_UNKNOWN";
  if (geometry.mode === "CORRIDOR_COVERAGE" && !geometry.corridorWidthMeters) {
    return "CORRIDOR_WIDTH_REQUIRED_FOR_SPATIAL_MEMBERSHIP";
  }
  return "QUERY_RESOLVED_WITH_EXPEDIENT_GEOGRAPHY_AUTHORITY";
}

/** Resolves geography without relocating incidents or deriving replacement geometry. */
export function resolveCrimeIncidenceGeography(
  context: CrimeExpedientGeographyContext,
  query: CrimeIncidenceQueryResolution
): CrimeIncidenceGeographicResolution {
  const geometry = authoritativeGeometry(context);
  const geometryMatches = sameGeometry(geometry, query.request.queryGeometry);
  const sourceRecords = query.request.sourceEnvelope.records;
  const corridorAuthorized = geometry.mode !== "CORRIDOR_COVERAGE"
    || (typeof geometry.corridorWidthMeters === "number" && geometry.corridorWidthMeters > 0);
  const matchedRecords = geometryMatches && query.executed && corridorAuthorized
    ? query.resolvedIncidents.filter((record) => incidentMatchesGeometry(record, geometry))
    : [];

  return {
    geometryType: geometry.mode,
    geometry,
    coverageStatus: geometryMatches && corridorAuthorized ? query.coverage.queryStatus : "UNKNOWN_COVERAGE",
    matchedRecords,
    excludedRecords: excludedRecords(sourceRecords, matchedRecords),
    coverageExplanation: coverageExplanation(query, geometryMatches, geometry),
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
