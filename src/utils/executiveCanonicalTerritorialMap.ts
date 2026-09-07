import {
  getCanonicalGeographyCoordinates,
  getCanonicalMapViewport,
  type CanonicalGeometry,
  type CanonicalProjectGeography,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";

export interface ExecutiveCanonicalTerritorialMapSpec {
  mapId: "principal-territorial-map";
  provider: "GOOGLE_STATIC_MAPS";
  imageUrl: string;
  viewport: ReturnType<typeof getCanonicalMapViewport>;
  geometryType: CanonicalGeometry["type"];
  paths: LatLngPoint[][];
  pathMetadata: Array<{
    componentIndex: number;
    ringIndex: number;
    role: "LINE" | "OUTER_RING" | "INTERIOR_RING";
    vertexCount: number;
  }>;
  markers: LatLngPoint[];
  coordinateCount: number;
  technicalMetadata: {
    geographyId: string;
    source: "CanonicalProjectGeography";
    syntheticGeometry: false;
    usedCanonicalViewport: true;
    externalAnalyticalCalls: false;
    aiCalls: false;
  };
}

const GOOGLE_STATIC_MAPS_URL_MAX_LENGTH = 16384;

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidPoint(point: LatLngPoint): boolean {
  return isFiniteCoordinate(point.lat) && isFiniteCoordinate(point.lng) && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}

function fromPosition(position: [number, number]): LatLngPoint {
  return { lat: position[1], lng: position[0] };
}

function samePoint(a: LatLngPoint, b: LatLngPoint): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

function closeRing(points: LatLngPoint[]): LatLngPoint[] {
  if (points.length === 0) return points;
  return samePoint(points[0], points[points.length - 1]) ? points : [...points, points[0]];
}

function geometryPaths(geometry: CanonicalGeometry): LatLngPoint[][] {
  if (geometry.type === "Point") return [];
  if (geometry.type === "LineString") return [geometry.coordinates.map(fromPosition)];
  if (geometry.type === "Polygon") return geometry.coordinates.map((ring) => closeRing(ring.map(fromPosition)));
  return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => closeRing(ring.map(fromPosition))));
}

function geometryPathMetadata(geometry: CanonicalGeometry, paths: LatLngPoint[][]): ExecutiveCanonicalTerritorialMapSpec["pathMetadata"] {
  if (geometry.type === "Point") return [];
  if (geometry.type === "LineString") {
    return paths.map((path) => ({
      componentIndex: 0,
      ringIndex: 0,
      role: "LINE" as const,
      vertexCount: path.length,
    }));
  }
  if (geometry.type === "Polygon") {
    return paths.map((path, ringIndex) => ({
      componentIndex: 0,
      ringIndex,
      role: ringIndex === 0 ? "OUTER_RING" as const : "INTERIOR_RING" as const,
      vertexCount: path.length,
    }));
  }
  return geometry.coordinates.flatMap((polygon, componentIndex) =>
    polygon.map((ring, ringIndex) => ({
      componentIndex,
      ringIndex,
      role: ringIndex === 0 ? "OUTER_RING" as const : "INTERIOR_RING" as const,
      vertexCount: closeRing(ring.map(fromPosition)).length,
    }))
  );
}

function hasInteriorRings(pathMetadata: ExecutiveCanonicalTerritorialMapSpec["pathMetadata"]): boolean {
  return pathMetadata.some((path) => path.role === "INTERIOR_RING");
}

function validateGeography(geography: CanonicalProjectGeography) {
  if (!geography.geographyId || !geography.geographyId.trim()) throw new Error("CANONICAL_MAP_GEOGRAPHY_ID_REQUIRED");
  if (geography.validationStatus !== "VALID") throw new Error("CANONICAL_MAP_VALID_GEOGRAPHY_REQUIRED");
  const coordinates = getCanonicalGeographyCoordinates(geography);
  if (!coordinates.length || coordinates.some((point) => !isValidPoint(point))) throw new Error("CANONICAL_MAP_REAL_COORDINATES_REQUIRED");
  if (geography.geometry.type === "LineString" && geography.geometry.coordinates.length < 2) throw new Error("CANONICAL_MAP_LINESTRING_INVALID");
  if (geography.geometry.type === "Polygon" && geometryPaths(geography.geometry).some((ring) => ring.length < 4)) throw new Error("CANONICAL_MAP_POLYGON_INVALID");
  if (geography.geometry.type === "MultiPolygon" && geometryPaths(geography.geometry).some((ring) => ring.length < 4)) throw new Error("CANONICAL_MAP_MULTIPOLYGON_INVALID");
}

function pointParam(point: LatLngPoint): string {
  return `${point.lat},${point.lng}`;
}

function appendCanonicalShape(
  params: URLSearchParams,
  geography: CanonicalProjectGeography,
  paths: LatLngPoint[][],
  markers: LatLngPoint[],
  pathMetadata: ExecutiveCanonicalTerritorialMapSpec["pathMetadata"]
) {
  if (geography.geometry.type === "Point") {
    params.append("markers", `color:red|label:A|${pointParam(markers[0])}`);
    return;
  }
  const outlineOnly = hasInteriorRings(pathMetadata) || geography.geometry.type === "LineString";
  for (const path of paths) {
    const style = outlineOnly ? "color:0x0D2B52ff|weight:4" : "color:0x0D2B52ff|weight:4|fillcolor:0x0D2B5233";
    params.append("path", `${style}|${path.map(pointParam).join("|")}`);
  }
}

export function buildExecutiveCanonicalTerritorialMapSpec(
  geography: CanonicalProjectGeography,
  options: { apiKey?: string; size?: string; scale?: 1 | 2 } = {}
): ExecutiveCanonicalTerritorialMapSpec {
  const snapshot = JSON.stringify(geography);
  validateGeography(geography);
  const apiKey = options.apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) throw new Error("CANONICAL_MAP_GOOGLE_STATIC_MAPS_KEY_REQUIRED");
  const viewport = getCanonicalMapViewport(geography);
  const coordinates = getCanonicalGeographyCoordinates(geography);
  const paths = geometryPaths(geography.geometry);
  const pathMetadata = geometryPathMetadata(geography.geometry, paths);
  const markers = geography.geometry.type === "Point" ? coordinates : [];
  const params = new URLSearchParams();
  params.set("size", options.size || "800x600");
  params.set("scale", String(options.scale || 2));
  params.set("maptype", "roadmap");
  if (viewport.center) params.set("center", pointParam(viewport.center));
  if (viewport.fitMode === "CENTER") params.set("zoom", "16");
  if (viewport.bounds) {
    params.append("visible", pointParam({ lat: viewport.bounds.north, lng: viewport.bounds.east }));
    params.append("visible", pointParam({ lat: viewport.bounds.south, lng: viewport.bounds.west }));
  }
  appendCanonicalShape(params, geography, paths, markers, pathMetadata);
  params.set("key", apiKey);
  const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  if (imageUrl.length > GOOGLE_STATIC_MAPS_URL_MAX_LENGTH) throw new Error("CANONICAL_MAP_URL_TOO_LONG");
  if (JSON.stringify(geography) !== snapshot) throw new Error("CANONICAL_MAP_GEOGRAPHY_MUTATION_DETECTED");
  return {
    mapId: "principal-territorial-map",
    provider: "GOOGLE_STATIC_MAPS",
    imageUrl,
    viewport,
    geometryType: geography.geometry.type,
    paths,
    pathMetadata,
    markers,
    coordinateCount: paths.reduce((count, path) => count + path.length, markers.length),
    technicalMetadata: {
      geographyId: geography.geographyId,
      source: "CanonicalProjectGeography",
      syntheticGeometry: false,
      usedCanonicalViewport: true,
      externalAnalyticalCalls: false,
      aiCalls: false,
    },
  };
}
