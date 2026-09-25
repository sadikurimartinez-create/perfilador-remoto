import {
  canonicalCoordinateKey,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";

export interface NearestPolygonSegment {
  segmentIndex: number;
  distanceMeters: number;
}

export interface PolygonIntegrityAssessment {
  isValid: boolean;
  hasMinimumUniquePositions: boolean;
  hasSelfIntersection: boolean;
  hasConsecutiveDuplicates: boolean;
  isDegenerate: boolean;
  areaSquareMeters: number;
}

const METERS_PER_DEGREE_LATITUDE = 110_540;
const METERS_PER_DEGREE_LONGITUDE = 111_320;
const ORIENTATION_EPSILON = 1e-12;
const DEGENERATE_AREA_EPSILON_SQUARE_METERS = 0.01;

function pointToSegmentDistanceMeters(
  point: LatLngPoint,
  start: LatLngPoint,
  end: LatLngPoint,
): number {
  const latitudeRadians = (point.lat * Math.PI) / 180;
  const longitudeScale = METERS_PER_DEGREE_LONGITUDE * Math.cos(latitudeRadians);
  const startX = (start.lng - point.lng) * longitudeScale;
  const startY = (start.lat - point.lat) * METERS_PER_DEGREE_LATITUDE;
  const endX = (end.lng - point.lng) * longitudeScale;
  const endY = (end.lat - point.lat) * METERS_PER_DEGREE_LATITUDE;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) return Math.hypot(startX, startY);

  const projection = Math.max(
    0,
    Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared),
  );
  return Math.hypot(
    startX + projection * segmentX,
    startY + projection * segmentY,
  );
}

export function findNearestPolygonSegment(
  point: LatLngPoint,
  vertices: LatLngPoint[],
): NearestPolygonSegment | null {
  if (vertices.length < 2) return null;

  let nearest: NearestPolygonSegment | null = null;
  for (let segmentIndex = 0; segmentIndex < vertices.length; segmentIndex += 1) {
    const distanceMeters = pointToSegmentDistanceMeters(
      point,
      vertices[segmentIndex],
      vertices[(segmentIndex + 1) % vertices.length],
    );
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { segmentIndex, distanceMeters };
    }
  }
  return nearest;
}

function orientation(a: LatLngPoint, b: LatLngPoint, c: LatLngPoint): number {
  const cross = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  if (Math.abs(cross) <= ORIENTATION_EPSILON) return 0;
  return cross > 0 ? 1 : -1;
}

function isPointOnSegment(point: LatLngPoint, start: LatLngPoint, end: LatLngPoint): boolean {
  return point.lng <= Math.max(start.lng, end.lng) + ORIENTATION_EPSILON
    && point.lng >= Math.min(start.lng, end.lng) - ORIENTATION_EPSILON
    && point.lat <= Math.max(start.lat, end.lat) + ORIENTATION_EPSILON
    && point.lat >= Math.min(start.lat, end.lat) - ORIENTATION_EPSILON;
}

function segmentsIntersect(
  firstStart: LatLngPoint,
  firstEnd: LatLngPoint,
  secondStart: LatLngPoint,
  secondEnd: LatLngPoint,
): boolean {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (firstOrientation !== secondOrientation && thirdOrientation !== fourthOrientation) return true;
  if (firstOrientation === 0 && isPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (secondOrientation === 0 && isPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (thirdOrientation === 0 && isPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (fourthOrientation === 0 && isPointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return false;
}

function areAdjacentEdges(firstIndex: number, secondIndex: number, total: number): boolean {
  return firstIndex === secondIndex
    || (firstIndex + 1) % total === secondIndex
    || (secondIndex + 1) % total === firstIndex;
}

export function hasSelfIntersection(vertices: LatLngPoint[]): boolean {
  if (vertices.length < 4) return false;

  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < vertices.length; secondIndex += 1) {
      if (areAdjacentEdges(firstIndex, secondIndex, vertices.length)) continue;
      if (segmentsIntersect(
        vertices[firstIndex],
        vertices[(firstIndex + 1) % vertices.length],
        vertices[secondIndex],
        vertices[(secondIndex + 1) % vertices.length],
      )) return true;
    }
  }
  return false;
}

export function polygonAreaSquareMeters(vertices: LatLngPoint[]): number {
  if (vertices.length < 3) return 0;
  const referenceLatitude = vertices.reduce((sum, point) => sum + point.lat, 0) / vertices.length;
  const longitudeScale = METERS_PER_DEGREE_LONGITUDE * Math.cos((referenceLatitude * Math.PI) / 180);
  const origin = vertices[0];
  let doubledArea = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const currentX = (current.lng - origin.lng) * longitudeScale;
    const currentY = (current.lat - origin.lat) * METERS_PER_DEGREE_LATITUDE;
    const nextX = (next.lng - origin.lng) * longitudeScale;
    const nextY = (next.lat - origin.lat) * METERS_PER_DEGREE_LATITUDE;
    doubledArea += currentX * nextY - nextX * currentY;
  }
  return Math.abs(doubledArea) / 2;
}

export function hasConsecutivePolygonDuplicates(vertices: LatLngPoint[]): boolean {
  if (vertices.length < 2) return false;
  return vertices.some((point, index) => (
    canonicalCoordinateKey(point) === canonicalCoordinateKey(vertices[(index + 1) % vertices.length])
  ));
}

export function assessPolygonIntegrity(vertices: LatLngPoint[]): PolygonIntegrityAssessment {
  const uniquePositionCount = new Set(vertices.map(canonicalCoordinateKey)).size;
  const hasMinimumUniquePositions = vertices.length >= 3 && uniquePositionCount >= 3;
  const hasConsecutiveDuplicates = hasConsecutivePolygonDuplicates(vertices);
  const selfIntersection = hasSelfIntersection(vertices);
  const areaSquareMeters = polygonAreaSquareMeters(vertices);
  const isDegenerate = areaSquareMeters <= DEGENERATE_AREA_EPSILON_SQUARE_METERS;

  return {
    isValid: hasMinimumUniquePositions
      && !selfIntersection
      && !hasConsecutiveDuplicates
      && !isDegenerate,
    hasMinimumUniquePositions,
    hasSelfIntersection: selfIntersection,
    hasConsecutiveDuplicates,
    isDegenerate,
    areaSquareMeters,
  };
}
