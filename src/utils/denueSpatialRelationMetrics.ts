import { SpatialLayerEngine, type Coordinate } from "@/lib/providers/spatialLayerEngine";
import type { CanonicalProjectGeography, GeoJsonPosition } from "@/utils/canonicalProjectGeography";

export interface DenueSpatialRelationMeasurement {
  unit: "METERS";
  method: string;
  distanceToCanonicalPointMeters?: number;
  distanceToCorridorMeters?: number;
  insideCanonicalGeography?: boolean;
  distanceToBoundaryMeters?: number;
}

export type DenueSpatialMeasurementResult =
  | { status: "MEASURED"; measurement: DenueSpatialRelationMeasurement; reasons: [] }
  | { status: "REJECTED"; measurement: null; reasons: string[] };

export function isValidDenueRelationCoordinate(value: unknown): value is Coordinate {
  const point = value as Coordinate;
  return typeof point?.lat === "number" && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
    typeof point?.lng === "number" && Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180;
}

function coordinate(position: GeoJsonPosition): Coordinate {
  return { lng: position[0], lat: position[1] };
}

function closedRing(ring: GeoJsonPosition[]): Coordinate[] {
  const points = ring.map(coordinate);
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lng === last.lng ? points : [...points, first];
}

function finiteMetric(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function measureDenuePointDistance(left: Coordinate, right: Coordinate): number | null {
  if (!isValidDenueRelationCoordinate(left) || !isValidDenueRelationCoordinate(right)) return null;
  return finiteMetric(SpatialLayerEngine.getDistance(left, right));
}

export function measureDenueAgainstCanonicalGeography(
  point: Coordinate,
  geography: CanonicalProjectGeography
): DenueSpatialMeasurementResult {
  const reasons: string[] = [];
  if (!isValidDenueRelationCoordinate(point)) reasons.push("POINT_COORDINATES_INVALID");
  if (!geography?.geographyId) reasons.push("CANONICAL_GEOGRAPHY_ID_REQUIRED");
  if (geography?.validationStatus !== "VALID") reasons.push("CANONICAL_GEOGRAPHY_NOT_VALID");

  const geometryMatches =
    (geography?.type === "INDIVIDUAL" && geography.geometry?.type === "Point") ||
    (geography?.type === "CORRIDOR" && geography.geometry?.type === "LineString") ||
    (geography?.type === "POLYGON" && geography.geometry?.type === "Polygon");
  if (!geometryMatches) reasons.push("CANONICAL_GEOMETRY_TYPE_MISMATCH");
  if (reasons.length > 0) return { status: "REJECTED", measurement: null, reasons: Array.from(new Set(reasons)) };

  if (geography.type === "INDIVIDUAL" && geography.geometry.type === "Point") {
    const distance = measureDenuePointDistance(point, coordinate(geography.geometry.coordinates));
    if (distance === null) return { status: "REJECTED", measurement: null, reasons: ["CANONICAL_POINT_INVALID"] };
    return {
      status: "MEASURED",
      reasons: [],
      measurement: {
        unit: "METERS",
        method: "SpatialLayerEngine.getDistance:CANONICAL_POINT",
        distanceToCanonicalPointMeters: distance,
      },
    };
  }

  if (geography.type === "CORRIDOR" && geography.geometry.type === "LineString") {
    const path = geography.geometry.coordinates.map(coordinate);
    if (path.length < 2 || path.some((candidate) => !isValidDenueRelationCoordinate(candidate))) {
      return { status: "REJECTED", measurement: null, reasons: ["CANONICAL_CORRIDOR_INVALID"] };
    }
    const distance = finiteMetric(SpatialLayerEngine.distToPolyline(point, path));
    if (distance === null) return { status: "REJECTED", measurement: null, reasons: ["CORRIDOR_DISTANCE_INVALID"] };
    return {
      status: "MEASURED",
      reasons: [],
      measurement: {
        unit: "METERS",
        method: "SpatialLayerEngine.distToPolyline:CANONICAL_LINESTRING",
        distanceToCorridorMeters: distance,
      },
    };
  }

  if (geography.type === "POLYGON" && geography.geometry.type === "Polygon") {
    const rings = geography.geometry.coordinates.map(closedRing);
    if (rings.length === 0 || rings[0].length < 4 || rings.some((ring) => ring.some((candidate) => !isValidDenueRelationCoordinate(candidate)))) {
      return { status: "REJECTED", measurement: null, reasons: ["CANONICAL_POLYGON_INVALID"] };
    }
    const insideOuter = SpatialLayerEngine.isPointInPolygon(point, rings[0]);
    const insideHole = rings.slice(1).some((ring) => SpatialLayerEngine.isPointInPolygon(point, ring));
    const boundaryDistances = rings.map((ring) => SpatialLayerEngine.distToPolyline(point, ring));
    const distanceToBoundaryMeters = finiteMetric(Math.min(...boundaryDistances));
    if (distanceToBoundaryMeters === null) {
      return { status: "REJECTED", measurement: null, reasons: ["POLYGON_BOUNDARY_DISTANCE_INVALID"] };
    }
    return {
      status: "MEASURED",
      reasons: [],
      measurement: {
        unit: "METERS",
        method: "SpatialLayerEngine.isPointInPolygon+distToPolyline:CANONICAL_POLYGON",
        insideCanonicalGeography: insideOuter && !insideHole,
        distanceToBoundaryMeters,
      },
    };
  }

  return { status: "REJECTED", measurement: null, reasons: ["CANONICAL_GEOMETRY_UNSUPPORTED"] };
}
