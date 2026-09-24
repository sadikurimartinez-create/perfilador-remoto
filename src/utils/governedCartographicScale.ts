import type { LatLngPoint } from "@/utils/canonicalProjectGeography";

export const CARTOGRAPHIC_SCALE_ALGORITHM_VERSION = "CARTOGRAPHIC_SCALE_WEB_MERCATOR_V1" as const;
export const CARTOGRAPHIC_LOGICAL_WIDTH = 640;
export const CARTOGRAPHIC_LOGICAL_HEIGHT = 480;
export const CARTOGRAPHIC_STATIC_MAP_SCALE = 2;
export const CARTOGRAPHIC_TILE_SIZE = 256;
export const CARTOGRAPHIC_PADDING_LOGICAL_PX = 40;
export const CARTOGRAPHIC_MIN_ZOOM = 0;
export const CARTOGRAPHIC_MAX_ZOOM = 21;
export const CARTOGRAPHIC_INDIVIDUAL_ZOOM = 16;
export const CARTOGRAPHIC_SCALE_BAR_MAX_LOGICAL_PX = 160;
export const CARTOGRAPHIC_SCALE_STRIP_LOGICAL_HEIGHT = 48;
export const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;

const WEB_MERCATOR_RADIUS_METERS = 6378137;
const FIT_EPSILON = 1e-9;

export interface GovernedCartographicScale {
  algorithmVersion: typeof CARTOGRAPHIC_SCALE_ALGORITHM_VERSION;
  distance: number;
  distanceMeters: number;
  unit: "m" | "km";
  label: string;
  logicalPixels: number;
  outputPixels: number;
  metersPerLogicalPixel: number;
  metersPerOutputPixel: number;
  referenceLatitude: number;
  zoom: number;
  paddingLogicalPx: typeof CARTOGRAPHIC_PADDING_LOGICAL_PX;
}

export interface GovernedCartographicViewport {
  center: LatLngPoint;
  zoom: number;
  fitMode: "CENTER" | "BOUNDS";
  logicalWidth: typeof CARTOGRAPHIC_LOGICAL_WIDTH;
  logicalHeight: typeof CARTOGRAPHIC_LOGICAL_HEIGHT;
  staticMapScale: typeof CARTOGRAPHIC_STATIC_MAP_SCALE;
  tileSize: typeof CARTOGRAPHIC_TILE_SIZE;
  paddingLogicalPx: typeof CARTOGRAPHIC_PADDING_LOGICAL_PX;
  allCoordinatesVisible: true;
}

export interface GovernedCartographicDecision {
  viewport: GovernedCartographicViewport;
  cartographicScale: GovernedCartographicScale;
}

export interface WebMercatorPoint {
  x: number;
  y: number;
}

function assertFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertCoordinate(point: LatLngPoint): void {
  assertFinite(point.lat, "CARTOGRAPHIC_SCALE_LATITUDE_NON_FINITE");
  assertFinite(point.lng, "CARTOGRAPHIC_SCALE_LONGITUDE_NON_FINITE");
  if (Math.abs(point.lat) > WEB_MERCATOR_MAX_LATITUDE) throw new Error("CARTOGRAPHIC_SCALE_LATITUDE_OUT_OF_RANGE");
  if (point.lng < -180 || point.lng > 180) throw new Error("CARTOGRAPHIC_SCALE_LONGITUDE_OUT_OF_RANGE");
}

export function projectWebMercator(point: LatLngPoint): WebMercatorPoint {
  assertCoordinate(point);
  const sinLatitude = Math.sin(point.lat * Math.PI / 180);
  const x = CARTOGRAPHIC_TILE_SIZE * (0.5 + point.lng / 360);
  const y = CARTOGRAPHIC_TILE_SIZE * (
    0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)
  );
  assertFinite(x, "CARTOGRAPHIC_SCALE_PROJECTED_X_NON_FINITE");
  assertFinite(y, "CARTOGRAPHIC_SCALE_PROJECTED_Y_NON_FINITE");
  return { x, y };
}

export function wrappedWorldDeltaX(value: number, reference: number): number {
  assertFinite(value, "CARTOGRAPHIC_SCALE_PROJECTED_X_NON_FINITE");
  assertFinite(reference, "CARTOGRAPHIC_SCALE_PROJECTED_X_NON_FINITE");
  const halfWorld = CARTOGRAPHIC_TILE_SIZE / 2;
  let delta = value - reference;
  while (delta > halfWorld) delta -= CARTOGRAPHIC_TILE_SIZE;
  while (delta < -halfWorld) delta += CARTOGRAPHIC_TILE_SIZE;
  return delta;
}

function projectedExtents(center: LatLngPoint, points: LatLngPoint[]) {
  if (!points.length) throw new Error("CARTOGRAPHIC_SCALE_COORDINATES_REQUIRED");
  const projectedCenter = projectWebMercator(center);
  let maxDx = 0;
  let maxDy = 0;
  for (const point of points) {
    const projected = projectWebMercator(point);
    maxDx = Math.max(maxDx, Math.abs(wrappedWorldDeltaX(projected.x, projectedCenter.x)));
    maxDy = Math.max(maxDy, Math.abs(projected.y - projectedCenter.y));
  }
  return { maxDx, maxDy };
}

export function coordinatesFitGovernedViewport(center: LatLngPoint, points: LatLngPoint[], zoom: number): boolean {
  if (!Number.isInteger(zoom) || zoom < CARTOGRAPHIC_MIN_ZOOM || zoom > CARTOGRAPHIC_MAX_ZOOM) return false;
  const { maxDx, maxDy } = projectedExtents(center, points);
  const zoomScale = 2 ** zoom;
  const availableHalfWidth = CARTOGRAPHIC_LOGICAL_WIDTH / 2 - CARTOGRAPHIC_PADDING_LOGICAL_PX;
  const availableHalfHeight = CARTOGRAPHIC_LOGICAL_HEIGHT / 2 - CARTOGRAPHIC_PADDING_LOGICAL_PX;
  return maxDx * zoomScale <= availableHalfWidth + FIT_EPSILON
    && maxDy * zoomScale <= availableHalfHeight + FIT_EPSILON;
}

export function calculateGovernedZoom(center: LatLngPoint, points: LatLngPoint[]): number {
  const { maxDx, maxDy } = projectedExtents(center, points);
  const availableHalfWidth = CARTOGRAPHIC_LOGICAL_WIDTH / 2 - CARTOGRAPHIC_PADDING_LOGICAL_PX;
  const availableHalfHeight = CARTOGRAPHIC_LOGICAL_HEIGHT / 2 - CARTOGRAPHIC_PADDING_LOGICAL_PX;
  const zoomX = maxDx === 0 ? Number.POSITIVE_INFINITY : Math.log2(availableHalfWidth / maxDx);
  const zoomY = maxDy === 0 ? Number.POSITIVE_INFINITY : Math.log2(availableHalfHeight / maxDy);
  const candidate = Math.floor(Math.min(zoomX, zoomY));
  const initialZoom = Number.isFinite(candidate)
    ? Math.min(CARTOGRAPHIC_MAX_ZOOM, Math.max(CARTOGRAPHIC_MIN_ZOOM, candidate))
    : CARTOGRAPHIC_MAX_ZOOM;
  return validateAndDecreaseGovernedZoom(center, points, initialZoom);
}

export function validateAndDecreaseGovernedZoom(center: LatLngPoint, points: LatLngPoint[], initialZoom: number): number {
  if (!Number.isInteger(initialZoom) || initialZoom < CARTOGRAPHIC_MIN_ZOOM || initialZoom > CARTOGRAPHIC_MAX_ZOOM) {
    throw new Error("CARTOGRAPHIC_SCALE_ZOOM_INVALID");
  }
  let zoom = initialZoom;
  while (zoom >= CARTOGRAPHIC_MIN_ZOOM && !coordinatesFitGovernedViewport(center, points, zoom)) zoom -= 1;
  if (zoom < CARTOGRAPHIC_MIN_ZOOM) throw new Error("CARTOGRAPHIC_SCALE_VIEWPORT_UNRESOLVABLE");
  return zoom;
}

export function metersPerLogicalPixel(referenceLatitude: number, zoom: number): number {
  assertCoordinate({ lat: referenceLatitude, lng: 0 });
  if (!Number.isInteger(zoom) || zoom < CARTOGRAPHIC_MIN_ZOOM || zoom > CARTOGRAPHIC_MAX_ZOOM) {
    throw new Error("CARTOGRAPHIC_SCALE_ZOOM_INVALID");
  }
  const resolution = Math.cos(referenceLatitude * Math.PI / 180) * 2 * Math.PI * WEB_MERCATOR_RADIUS_METERS
    / (CARTOGRAPHIC_TILE_SIZE * 2 ** zoom);
  if (!Number.isFinite(resolution) || resolution <= 0) throw new Error("CARTOGRAPHIC_SCALE_RESOLUTION_INVALID");
  return resolution;
}

export function selectNiceScaleDistance(maximumMeters: number): number {
  if (!Number.isFinite(maximumMeters) || maximumMeters <= 0) throw new Error("CARTOGRAPHIC_SCALE_MAXIMUM_DISTANCE_INVALID");
  const exponent = Math.floor(Math.log10(maximumMeters));
  let selected = 0;
  for (let currentExponent = exponent - 1; currentExponent <= exponent; currentExponent += 1) {
    for (const multiplier of [1, 2, 5]) {
      const candidate = multiplier * 10 ** currentExponent;
      if (candidate <= maximumMeters + FIT_EPSILON) selected = Math.max(selected, candidate);
    }
  }
  if (!(selected > 0)) throw new Error("CARTOGRAPHIC_SCALE_DISTANCE_UNRESOLVABLE");
  return selected;
}

export function formatCartographicScaleLabel(distanceMeters: number): { distance: number; unit: "m" | "km"; label: string } {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error("CARTOGRAPHIC_SCALE_DISTANCE_INVALID");
  const unit = distanceMeters >= 1000 ? "km" as const : "m" as const;
  const distance = unit === "km" ? distanceMeters / 1000 : distanceMeters;
  return { distance, unit, label: `${distance} ${unit}` };
}

export function buildGovernedCartographicDecision(input: {
  center: LatLngPoint;
  points: LatLngPoint[];
  fitMode: "CENTER" | "BOUNDS";
}): GovernedCartographicDecision {
  assertCoordinate(input.center);
  input.points.forEach(assertCoordinate);
  const zoom = input.fitMode === "CENTER"
    ? CARTOGRAPHIC_INDIVIDUAL_ZOOM
    : calculateGovernedZoom(input.center, input.points);
  if (!coordinatesFitGovernedViewport(input.center, input.points, zoom)) {
    throw new Error("CARTOGRAPHIC_SCALE_VIEWPORT_VALIDATION_FAILED");
  }
  const metersPerLogical = metersPerLogicalPixel(input.center.lat, zoom);
  const metersPerOutput = metersPerLogical / CARTOGRAPHIC_STATIC_MAP_SCALE;
  const distanceMeters = selectNiceScaleDistance(metersPerLogical * CARTOGRAPHIC_SCALE_BAR_MAX_LOGICAL_PX);
  const formatted = formatCartographicScaleLabel(distanceMeters);
  return {
    viewport: {
      center: { ...input.center },
      zoom,
      fitMode: input.fitMode,
      logicalWidth: CARTOGRAPHIC_LOGICAL_WIDTH,
      logicalHeight: CARTOGRAPHIC_LOGICAL_HEIGHT,
      staticMapScale: CARTOGRAPHIC_STATIC_MAP_SCALE,
      tileSize: CARTOGRAPHIC_TILE_SIZE,
      paddingLogicalPx: CARTOGRAPHIC_PADDING_LOGICAL_PX,
      allCoordinatesVisible: true,
    },
    cartographicScale: {
      algorithmVersion: CARTOGRAPHIC_SCALE_ALGORITHM_VERSION,
      distance: formatted.distance,
      distanceMeters,
      unit: formatted.unit,
      label: formatted.label,
      logicalPixels: distanceMeters / metersPerLogical,
      outputPixels: distanceMeters / metersPerOutput,
      metersPerLogicalPixel: metersPerLogical,
      metersPerOutputPixel: metersPerOutput,
      referenceLatitude: input.center.lat,
      zoom,
      paddingLogicalPx: CARTOGRAPHIC_PADDING_LOGICAL_PX,
    },
  };
}
