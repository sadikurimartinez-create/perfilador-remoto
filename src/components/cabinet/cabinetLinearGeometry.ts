import type { LatLngPoint } from "@/utils/canonicalProjectGeography";

export interface NearestCorridorSegment {
  segmentIndex: number;
  distanceMeters: number;
}

const METERS_PER_DEGREE_LATITUDE = 110_540;
const METERS_PER_DEGREE_LONGITUDE = 111_320;

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
  const closestX = startX + projection * segmentX;
  const closestY = startY + projection * segmentY;
  return Math.hypot(closestX, closestY);
}

export function findNearestCorridorSegment(
  point: LatLngPoint,
  vertices: LatLngPoint[],
): NearestCorridorSegment | null {
  if (vertices.length < 2) return null;

  let nearest: NearestCorridorSegment | null = null;
  for (let segmentIndex = 0; segmentIndex < vertices.length - 1; segmentIndex += 1) {
    const distanceMeters = pointToSegmentDistanceMeters(
      point,
      vertices[segmentIndex],
      vertices[segmentIndex + 1],
    );
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { segmentIndex, distanceMeters };
    }
  }
  return nearest;
}
