import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type {
  IncidenceCanonicalSpatialQuery,
  IncidenceGeoJsonPosition,
  IncidenceLineStringGeometry,
  IncidencePointGeometry,
  IncidencePolygonGeometry,
} from "@/lib/incidenceSpatialTypes";

const DEFAULT_INDIVIDUAL_RADIUS_METERS = 1000;
const DEFAULT_CORRIDOR_WIDTH_METERS = 1000;

function isValidPosition(position: IncidenceGeoJsonPosition): boolean {
  const [lng, lat] = position;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90 &&
    !(lat === 0 && lng === 0)
  );
}

function positionKey(position: IncidenceGeoJsonPosition): string {
  return `${position[0].toFixed(7)},${position[1].toFixed(7)}`;
}

function samePosition(left: IncidenceGeoJsonPosition, right: IncidenceGeoJsonPosition): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function closeRing(ring: IncidenceGeoJsonPosition[]): IncidenceGeoJsonPosition[] {
  if (ring.length === 0 || samePosition(ring[0], ring[ring.length - 1])) return ring;
  return [...ring, ring[0]];
}

function assertProjectGeography(geography: CanonicalProjectGeography | null | undefined): CanonicalProjectGeography {
  if (!geography || geography.validationStatus !== "VALID") {
    throw new Error("INCIDENCE_CANONICAL_GEOGRAPHY_REQUIRED");
  }
  return geography;
}

function assertPointGeometry(geometry: CanonicalProjectGeography["geometry"]): IncidencePointGeometry {
  if (geometry.type !== "Point" || !isValidPosition(geometry.coordinates)) {
    throw new Error("INCIDENCE_POINT_RADIUS_REQUIRES_VALID_POINT");
  }
  return geometry;
}

function assertLineStringGeometry(geometry: CanonicalProjectGeography["geometry"]): IncidenceLineStringGeometry {
  if (geometry.type !== "LineString" || geometry.coordinates.length < 2 || geometry.coordinates.some((position) => !isValidPosition(position))) {
    throw new Error("INCIDENCE_CORRIDOR_COVERAGE_REQUIRES_VALID_LINESTRING");
  }
  return geometry;
}

function assertPolygonGeometry(geometry: CanonicalProjectGeography["geometry"]): IncidencePolygonGeometry {
  if (geometry.type !== "Polygon" || geometry.coordinates.length !== 1) {
    throw new Error("INCIDENCE_POLYGON_BOUNDARY_REQUIRES_VALID_POLYGON");
  }

  const ring = closeRing(geometry.coordinates[0] || []);
  if (ring.length < 4 || ring.some((position) => !isValidPosition(position)) || new Set(ring.map(positionKey)).size < 3) {
    throw new Error("INCIDENCE_POLYGON_BOUNDARY_REQUIRES_THREE_REAL_VERTICES");
  }

  return { type: "Polygon", coordinates: [ring] };
}

export function buildExpedientIncidenceCanonicalSpatialQuery(params: {
  expedienteId?: string | null;
  canonicalGeography: CanonicalProjectGeography | null | undefined;
  radiusMeters?: number | null;
  corridorWidthMeters?: number | null;
  now?: string;
}): IncidenceCanonicalSpatialQuery {
  const geography = assertProjectGeography(params.canonicalGeography);
  const resolvedAt = params.now || new Date().toISOString();
  const metadata = {
    queryId: `incidence-${geography.geographyId}`,
    expedienteId: params.expedienteId ?? null,
    sourceReference: geography.geographyId,
    sourceLabel: `Expediente ${geography.type}`,
    resolvedBy: "PhotoAlbum",
    resolvedAt,
    territoryType: geography.type,
  };

  if (geography.type === "INDIVIDUAL") {
    const geometry = assertPointGeometry(geography.geometry);
    return {
      geometry,
      mode: "POINT_RADIUS",
      source: "EXPEDIENT",
      metadata: {
        ...metadata,
        radiusMeters: params.radiusMeters ?? DEFAULT_INDIVIDUAL_RADIUS_METERS,
      },
    };
  }

  if (geography.type === "CORRIDOR") {
    return {
      geometry: assertLineStringGeometry(geography.geometry),
      mode: "CORRIDOR_COVERAGE",
      source: "EXPEDIENT",
      metadata: {
        ...metadata,
        corridorWidthMeters: params.corridorWidthMeters ?? DEFAULT_CORRIDOR_WIDTH_METERS,
      },
    };
  }

  return {
    geometry: assertPolygonGeometry(geography.geometry),
    mode: "POLYGON_BOUNDARY",
    source: "EXPEDIENT",
    metadata,
  };
}
