import type { CrimeQueryInput } from "./crimeIncidenceRepository";
import type {
  IncidenceCanonicalSpatialQuery,
  IncidenceGeoJsonPosition,
  IncidenceMultiPolygonGeometry,
  IncidencePointGeometry,
  IncidencePolygonGeometry,
} from "./incidenceSpatialTypes";

export type BuildCrimeQueryInputFromCanonicalSpatialQueryOptions = {
  allowLegacyFallback?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  requestedCoverage?: CrimeQueryInput["requestedCoverage"];
};

export type IncidenceSpatialQueryAdapterResult = {
  crimeQueryInput: CrimeQueryInput;
  metadata: IncidenceCanonicalSpatialQuery["metadata"] & {
    mode: IncidenceCanonicalSpatialQuery["mode"];
    source: IncidenceCanonicalSpatialQuery["source"];
  };
};

function isFinitePosition(position: IncidenceGeoJsonPosition): boolean {
  const [lng, lat] = position;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function positionKey(position: IncidenceGeoJsonPosition): string {
  return `${position[0]},${position[1]}`;
}

function samePosition(
  left: IncidenceGeoJsonPosition,
  right: IncidenceGeoJsonPosition
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function closeRing(ring: IncidenceGeoJsonPosition[]): IncidenceGeoJsonPosition[] {
  if (ring.length === 0) {
    return ring;
  }

  return samePosition(ring[0], ring[ring.length - 1])
    ? ring
    : [...ring, ring[0]];
}

function assertValidRing(ring: IncidenceGeoJsonPosition[], context: string): void {
  if (!Array.isArray(ring) || ring.some((position) => !isFinitePosition(position))) {
    throw new Error(`${context}_INVALID_COORDINATES`);
  }

  if (new Set(ring.map(positionKey)).size < 3) {
    throw new Error(`${context}_REQUIRES_THREE_DISTINCT_VERTICES`);
  }
}

function polygonExteriorRing(
  geometry: IncidencePolygonGeometry,
  context: string
): IncidenceGeoJsonPosition[] {
  if (geometry.coordinates.length !== 1) {
    throw new Error(`${context}_POLYGON_WITH_INTERIOR_RINGS_NOT_SUPPORTED_BY_CRIME_QUERY_INPUT`);
  }

  const ring = geometry.coordinates[0];
  assertValidRing(ring, context);
  return closeRing(ring);
}

function multipolygonExteriorRing(
  geometry: IncidenceMultiPolygonGeometry,
  context: string
): IncidenceGeoJsonPosition[] {
  if (geometry.coordinates.length !== 1) {
    throw new Error(`${context}_MULTIPOLYGON_MULTIPART_NOT_SUPPORTED_BY_CRIME_QUERY_INPUT`);
  }

  return polygonExteriorRing(
    {
      type: "Polygon",
      coordinates: geometry.coordinates[0],
    },
    context
  );
}

function polygonFilterCoordinates(
  query: IncidenceCanonicalSpatialQuery,
  context: string
): IncidenceGeoJsonPosition[] {
  if (query.geometry.type === "Polygon") {
    return polygonExteriorRing(query.geometry, context);
  }

  if (query.geometry.type === "MultiPolygon") {
    return multipolygonExteriorRing(query.geometry, context);
  }

  throw new Error(`${context}_REQUIRES_POLYGON_GEOMETRY`);
}

function pointRadiusInput(
  geometry: IncidencePointGeometry,
  query: IncidenceCanonicalSpatialQuery,
  options: BuildCrimeQueryInputFromCanonicalSpatialQueryOptions
): CrimeQueryInput {
  if (!isFinitePosition(geometry.coordinates)) {
    throw new Error("POINT_RADIUS_INVALID_POINT");
  }

  const radiusMeters = query.metadata.radiusMeters;
  if (!Number.isFinite(radiusMeters) || Number(radiusMeters) <= 0) {
    throw new Error("POINT_RADIUS_REQUIRES_POSITIVE_RADIUS_METERS");
  }

  const [lng, lat] = geometry.coordinates;
  return {
    lat,
    lng,
    radiusMeters: Number(radiusMeters),
    spatialFilter: {
      type: "RADIUS",
      lat,
      lng,
      radiusMeters: Number(radiusMeters),
    },
    allowLegacyFallback: options.allowLegacyFallback,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
    incidentTypes: options.incidentTypes,
    requestedCoverage: options.requestedCoverage ?? null,
  };
}

function polygonInput(
  query: IncidenceCanonicalSpatialQuery,
  options: BuildCrimeQueryInputFromCanonicalSpatialQueryOptions,
  context: string
): CrimeQueryInput {
  const coordinates = polygonFilterCoordinates(query, context);
  const [lng, lat] = coordinates[0];

  return {
    lat,
    lng,
    radiusMeters: query.metadata.radiusMeters ?? query.metadata.corridorWidthMeters ?? 0,
    spatialFilter: {
      type: "POLYGON",
      coordinates,
    },
    allowLegacyFallback: options.allowLegacyFallback,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
    incidentTypes: options.incidentTypes,
    requestedCoverage: options.requestedCoverage ?? null,
  };
}

export function buildCrimeQueryInputFromCanonicalSpatialQuery(
  query: IncidenceCanonicalSpatialQuery,
  options: BuildCrimeQueryInputFromCanonicalSpatialQueryOptions = {}
): IncidenceSpatialQueryAdapterResult {
  let crimeQueryInput: CrimeQueryInput;

  if (query.mode === "POINT_RADIUS") {
    if (query.geometry.type !== "Point") {
      throw new Error("POINT_RADIUS_REQUIRES_POINT_GEOMETRY");
    }

    crimeQueryInput = pointRadiusInput(query.geometry, query, options);
  } else if (query.mode === "CORRIDOR_COVERAGE") {
    crimeQueryInput = polygonInput(query, options, "CORRIDOR_COVERAGE");
  } else if (query.mode === "POLYGON_BOUNDARY") {
    if (query.geometry.type !== "Polygon") {
      throw new Error("POLYGON_BOUNDARY_REQUIRES_POLYGON_GEOMETRY");
    }

    crimeQueryInput = polygonInput(query, options, "POLYGON_BOUNDARY");
  } else if (query.mode === "STREET_SELECTION") {
    crimeQueryInput = polygonInput(query, options, "STREET_SELECTION");
  } else {
    crimeQueryInput = query.geometry.type === "Point"
      ? pointRadiusInput(query.geometry, query, options)
      : polygonInput(query, options, "VERSUS_SCENARIO");
  }

  return {
    crimeQueryInput,
    metadata: {
      ...query.metadata,
      mode: query.mode,
      source: query.source,
    },
  };
}
