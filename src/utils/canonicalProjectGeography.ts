export type CanonicalGeographyType = "INDIVIDUAL" | "CORRIDOR" | "POLYGON";

export type CanonicalGeographySource =
  | "PROJECT_CREATION"
  | "MAP_VECTOR"
  | "LEGACY_PROJECT_FIELDS"
  | "LEGACY_GEOGRAPHIC_ENTITIES";

export type CanonicalGeographyValidationStatus = "VALID" | "PARTIAL" | "INVALID";

export type LatLngPoint = { lat: number; lng: number };
export type GeoJsonPosition = [number, number];

export type CanonicalGeometry =
  | { type: "Point"; coordinates: GeoJsonPosition }
  | { type: "LineString"; coordinates: GeoJsonPosition[] }
  | { type: "Polygon"; coordinates: GeoJsonPosition[][] };

export interface CanonicalProjectGeography {
  geographyId: string;
  type: CanonicalGeographyType;
  geometry: CanonicalGeometry;
  source: CanonicalGeographySource;
  validationStatus: CanonicalGeographyValidationStatus;
  createdAt: number;
  updatedAt: number;
  derived?: {
    centroid?: {
      lat: number;
      lng: number;
      derivation: "DERIVED_FROM_POINT" | "DERIVED_FROM_LINESTRING" | "DERIVED_FROM_POLYGON";
    };
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
      derivation: "DERIVED_FROM_GEOMETRY";
    };
    closedRing?: boolean;
  };
  limitations?: string[];
}

export type FirestoreSafeCanonicalGeometry =
  | { type: "Point"; point: LatLngPoint }
  | { type: "LineString"; points: LatLngPoint[] }
  | { type: "Polygon"; rings: Array<{ points: LatLngPoint[] }> };

export type FirestoreSafeCanonicalProjectGeography = Omit<CanonicalProjectGeography, "geometry"> & {
  geometry: FirestoreSafeCanonicalGeometry;
};

export interface SweepGeographyContext {
  geographyId: string;
  geographyType: CanonicalGeographyType;
  geometry: CanonicalGeometry;
  queryMode: "POINT_RADIUS" | "CORRIDOR_COVERAGE" | "POLYGON_BOUNDARY";
  radiusMeters?: number;
  bounds?: CanonicalProjectGeography["derived"] extends infer D
    ? D extends { bounds?: infer B }
      ? B
      : never
    : never;
  centroid?: { lat: number; lng: number; derived: true };
  approximations: string[];
}

export interface DraftProjectGeography {
  type: CanonicalGeographyType;
  points: LatLngPoint[];
  confirmed: boolean;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLatLng(point: unknown): point is LatLngPoint {
  const p = point as LatLngPoint;
  return isFiniteCoordinate(p?.lat) && isFiniteCoordinate(p?.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}

function fromPosition(position: GeoJsonPosition): LatLngPoint {
  return { lng: position[0], lat: position[1] };
}

function toPosition(point: LatLngPoint): GeoJsonPosition {
  return [point.lng, point.lat];
}

function normalizePoints(points: LatLngPoint[] | null | undefined): LatLngPoint[] {
  return (points || []).filter(isValidLatLng).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }));
}

function distinctPointKey(point: LatLngPoint): string {
  return `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`;
}

export function normalizeCanonicalGeographyType(type: string | null | undefined): CanonicalGeographyType {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "lineal" || normalized === "corredor" || normalized === "corridor") return "CORRIDOR";
  if (normalized === "poligono" || normalized === "polygon" || normalized === "polígono") return "POLYGON";
  return "INDIVIDUAL";
}

export function buildStableGeographyId(projectId: string, type: CanonicalGeographyType): string {
  const safeProjectId = String(projectId || "project").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `geo-${safeProjectId}-${type.toLowerCase()}`;
}

function closeLogicalRing(points: LatLngPoint[]): LatLngPoint[] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (distinctPointKey(first) === distinctPointKey(last)) return points;
  return [...points, first];
}

function buildGeometry(type: CanonicalGeographyType, points: LatLngPoint[]): CanonicalGeometry {
  if (type === "INDIVIDUAL") {
    return { type: "Point", coordinates: toPosition(points[0]) };
  }
  if (type === "CORRIDOR") {
    return { type: "LineString", coordinates: points.map(toPosition) };
  }
  return { type: "Polygon", coordinates: [closeLogicalRing(points).map(toPosition)] };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function hasLegacyCoordinates(geometry: unknown): geometry is CanonicalGeometry {
  return isRecord(geometry) && Array.isArray(geometry.coordinates);
}

function readFirestoreSafePoint(value: unknown): LatLngPoint | null {
  if (!isRecord(value)) return null;
  const point = { lat: Number(value.lat), lng: Number(value.lng) };
  return isValidLatLng(point) ? point : null;
}

export function serializeCanonicalGeographyForFirestore(
  geography: CanonicalProjectGeography | null | undefined
): FirestoreSafeCanonicalProjectGeography | null {
  if (!geography) return null;

  if (geography.geometry.type === "Point") {
    return {
      ...geography,
      geometry: {
        type: "Point",
        point: fromPosition(geography.geometry.coordinates),
      },
    };
  }

  if (geography.geometry.type === "LineString") {
    return {
      ...geography,
      geometry: {
        type: "LineString",
        points: geography.geometry.coordinates.map(fromPosition),
      },
    };
  }

  return {
    ...geography,
    geometry: {
      type: "Polygon",
      rings: geography.geometry.coordinates.map((ring) => ({
        points: ring.map(fromPosition),
      })),
    },
  };
}

export function deserializeCanonicalGeographyFromFirestore(
  geography: CanonicalProjectGeography | FirestoreSafeCanonicalProjectGeography | null | undefined
): CanonicalProjectGeography | null {
  if (!geography) return null;
  if (hasLegacyCoordinates(geography.geometry)) {
    return rehydrateCanonicalProjectGeography(geography as CanonicalProjectGeography);
  }

  const safeGeography = geography as FirestoreSafeCanonicalProjectGeography;
  const geometry = safeGeography.geometry;
  if (geometry.type === "Point") {
    const point = readFirestoreSafePoint(geometry.point);
    if (!point) return null;
    return rehydrateCanonicalProjectGeography({
      ...safeGeography,
      geometry: { type: "Point", coordinates: toPosition(point) },
    });
  }

  if (geometry.type === "LineString") {
    const points = Array.isArray(geometry.points) ? geometry.points.map(readFirestoreSafePoint).filter(Boolean) as LatLngPoint[] : [];
    return rehydrateCanonicalProjectGeography({
      ...safeGeography,
      geometry: { type: "LineString", coordinates: points.map(toPosition) },
    });
  }

  const rings = Array.isArray(geometry.rings)
    ? geometry.rings.map((ring) => ({
        points: Array.isArray(ring?.points) ? ring.points.map(readFirestoreSafePoint).filter(Boolean) as LatLngPoint[] : [],
      }))
    : [];
  return rehydrateCanonicalProjectGeography({
    ...safeGeography,
    geometry: { type: "Polygon", coordinates: rings.map((ring) => ring.points.map(toPosition)) },
  });
}

export function getCanonicalGeographyCoordinates(geography: CanonicalProjectGeography | null | undefined): LatLngPoint[] {
  if (!geography) return [];
  if (geography.geometry.type === "Point") return [fromPosition(geography.geometry.coordinates)];
  if (geography.geometry.type === "LineString") return geography.geometry.coordinates.map(fromPosition);
  const ring = geography.geometry.coordinates[0] || [];
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
    return ring.slice(0, -1).map(fromPosition);
  }
  return ring.map(fromPosition);
}

function deriveBounds(points: LatLngPoint[]) {
  if (points.length === 0) return undefined;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
    derivation: "DERIVED_FROM_GEOMETRY" as const,
  };
}

function deriveCentroid(type: CanonicalGeographyType, points: LatLngPoint[]) {
  if (points.length === 0) return undefined;
  const centroid = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
  return {
    ...centroid,
    derivation:
      type === "INDIVIDUAL"
        ? "DERIVED_FROM_POINT"
        : type === "CORRIDOR"
          ? "DERIVED_FROM_LINESTRING"
          : "DERIVED_FROM_POLYGON",
  } as const;
}

function validatePointCount(type: CanonicalGeographyType, points: LatLngPoint[]): CanonicalGeographyValidationStatus {
  if (type === "INDIVIDUAL") return points.length === 1 ? "VALID" : points.length > 0 ? "PARTIAL" : "INVALID";
  if (type === "CORRIDOR") return points.length >= 2 ? "VALID" : points.length > 0 ? "PARTIAL" : "INVALID";
  const distinctCount = new Set(points.map(distinctPointKey)).size;
  return distinctCount >= 3 ? "VALID" : points.length > 0 ? "PARTIAL" : "INVALID";
}

export function buildCanonicalProjectGeography(params: {
  projectId: string;
  type: CanonicalGeographyType | string;
  points: LatLngPoint[];
  source?: CanonicalGeographySource;
  now?: number;
  geographyId?: string;
}): CanonicalProjectGeography {
  const type = typeof params.type === "string" ? normalizeCanonicalGeographyType(params.type) : params.type;
  const points = normalizePoints(params.points);
  const validationStatus = validatePointCount(type, points);
  const usablePoints = points.length > 0 ? points : [{ lat: 0, lng: 0 }];
  const createdAt = params.now ?? Date.now();

  return {
    geographyId: params.geographyId || buildStableGeographyId(params.projectId, type),
    type,
    geometry: buildGeometry(type, usablePoints),
    source: params.source || "PROJECT_CREATION",
    validationStatus,
    createdAt,
    updatedAt: createdAt,
    derived: {
      centroid: deriveCentroid(type, points),
      bounds: deriveBounds(points),
      closedRing: type === "POLYGON" && points.length > 0,
    },
    limitations: validationStatus === "VALID" ? [] : ["INCOMPLETE_CANONICAL_GEOMETRY"],
  };
}

export function createDraftProjectGeography(type: CanonicalGeographyType | string): DraftProjectGeography {
  return {
    type: normalizeCanonicalGeographyType(type),
    points: [],
    confirmed: false,
  };
}

export function updateDraftProjectGeography(
  draft: DraftProjectGeography,
  points: LatLngPoint[]
): DraftProjectGeography {
  return {
    type: draft.type,
    points: normalizePoints(points),
    confirmed: false,
  };
}

export function resetDraftProjectGeography(type: CanonicalGeographyType | string): DraftProjectGeography {
  return createDraftProjectGeography(type);
}

export function buildDraftGeographyPreview(draft: DraftProjectGeography) {
  const preview = buildCanonicalProjectGeography({
    projectId: "DRAFT_PREVIEW",
    type: draft.type,
    points: draft.points,
    source: "PROJECT_CREATION",
    now: 0,
  });
  return {
    type: draft.type,
    points: getCanonicalGeographyCoordinates(preview),
    geometry: preview.geometry,
    validationStatus: preview.validationStatus,
    canConfirm: preview.validationStatus === "VALID",
    confirmed: draft.confirmed,
  };
}

export function confirmDraftProjectGeography(draft: DraftProjectGeography): DraftProjectGeography {
  const preview = buildDraftGeographyPreview(draft);
  if (!preview.canConfirm) {
    throw new Error("DRAFT_GEOGRAPHY_INVALID");
  }
  return {
    ...draft,
    confirmed: true,
  };
}

export function canonicalizeConfirmedDraftGeography(params: {
  projectId: string;
  draft: DraftProjectGeography;
  now?: number;
}): CanonicalProjectGeography {
  if (!params.draft.confirmed) {
    throw new Error("DRAFT_GEOGRAPHY_NOT_CONFIRMED");
  }
  const geography = buildCanonicalProjectGeography({
    projectId: params.projectId,
    type: params.draft.type,
    points: params.draft.points,
    source: "PROJECT_CREATION",
    now: params.now,
  });
  if (geography.validationStatus !== "VALID") {
    throw new Error("DRAFT_GEOGRAPHY_INVALID");
  }
  return geography;
}

export function rehydrateCanonicalProjectGeography(geography: CanonicalProjectGeography | null | undefined) {
  if (!geography) return null;
  const points = getCanonicalGeographyCoordinates(geography);
  return {
    ...geography,
    validationStatus: validatePointCount(geography.type, points),
    derived: geography.derived || {
      centroid: deriveCentroid(geography.type, points),
      bounds: deriveBounds(points),
      closedRing: geography.type === "POLYGON",
    },
  };
}

export function adaptLegacyProjectGeography(project: {
  id: string;
  geometryType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  canonicalGeography?: CanonicalProjectGeography | null;
}, options?: { geographicEntities?: any[]; now?: number }): CanonicalProjectGeography | null {
  const existing = rehydrateCanonicalProjectGeography(project.canonicalGeography);
  if (existing) return existing;

  const type = normalizeCanonicalGeographyType(project.geometryType);
  if (type === "INDIVIDUAL" && isValidLatLng({ lat: project.latitude, lng: project.longitude })) {
    return buildCanonicalProjectGeography({
      projectId: project.id,
      type,
      points: [{ lat: Number(project.latitude), lng: Number(project.longitude) }],
      source: "LEGACY_PROJECT_FIELDS",
      now: options?.now,
    });
  }

  const vertices = normalizePoints(
    (options?.geographicEntities || [])
      .filter((entity) => entity?.type === "VERTEX" || entity?.metadata?.isVertex === true)
      .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0))
      .map((entity) => ({ lat: Number(entity.lat), lng: Number(entity.lng) }))
  );

  if ((type === "CORRIDOR" || type === "POLYGON") && vertices.length > 0) {
    return buildCanonicalProjectGeography({
      projectId: project.id,
      type,
      points: vertices,
      source: "LEGACY_GEOGRAPHIC_ENTITIES",
      now: options?.now,
    });
  }

  return null;
}

export function getCanonicalMapViewport(geography: CanonicalProjectGeography | null | undefined) {
  const points = getCanonicalGeographyCoordinates(geography);
  const bounds = deriveBounds(points);
  const centroid = geography?.derived?.centroid || deriveCentroid(geography?.type || "INDIVIDUAL", points);
  return {
    center: centroid ? { lat: centroid.lat, lng: centroid.lng } : undefined,
    bounds,
    fitMode: points.length > 1 ? ("BOUNDS" as const) : ("CENTER" as const),
  };
}

export function buildSweepGeographyContext(
  geography: CanonicalProjectGeography,
  radiusMeters?: number
): SweepGeographyContext {
  const mode =
    geography.type === "INDIVIDUAL"
      ? "POINT_RADIUS"
      : geography.type === "CORRIDOR"
        ? "CORRIDOR_COVERAGE"
        : "POLYGON_BOUNDARY";

  return {
    geographyId: geography.geographyId,
    geographyType: geography.type,
    geometry: geography.geometry,
    queryMode: mode,
    radiusMeters: geography.type === "INDIVIDUAL" ? radiusMeters : undefined,
    bounds: geography.derived?.bounds,
    centroid: geography.derived?.centroid ? { lat: geography.derived.centroid.lat, lng: geography.derived.centroid.lng, derived: true } : undefined,
    approximations:
      geography.type === "INDIVIDUAL"
        ? []
        : geography.type === "CORRIDOR"
          ? ["Provider support may require segment-by-segment coverage queries."]
          : ["Provider support may require bounds query followed by polygon intersection filtering."],
  };
}

export function attachGeographyToEvidence<T extends Record<string, any>>(
  evidence: T,
  geography: CanonicalProjectGeography | null | undefined
): T & { geographyId?: string | null; geographyType?: CanonicalGeographyType | null } {
  if (!geography) return { ...evidence, geographyId: evidence.geographyId ?? null, geographyType: evidence.geographyType ?? null };
  return { ...evidence, geographyId: geography.geographyId, geographyType: geography.type };
}

export function attachGeographyToFinding<T extends Record<string, any>>(
  finding: T,
  geography: CanonicalProjectGeography | null | undefined
): T & { geographyId?: string | null; geographyType?: CanonicalGeographyType | null } {
  return attachGeographyToEvidence(finding, geography);
}

export function buildDenueQueryContext(geography: CanonicalProjectGeography, radiusMeters?: number) {
  const context = buildSweepGeographyContext(geography, radiusMeters);
  return {
    ...context,
    denueMode:
      context.queryMode === "POINT_RADIUS"
        ? "POINT_RADIUS"
        : context.queryMode === "CORRIDOR_COVERAGE"
          ? "CORRIDOR_SEGMENTS_IF_AVAILABLE"
          : "BOUNDS_THEN_INTERSECTION_FILTER_IF_AVAILABLE",
  };
}

export function buildCrimeIncidenceGeographyContext(geography: CanonicalProjectGeography) {
  return {
    geographyId: geography.geographyId,
    geographyType: geography.type,
    geometry: geography.geometry,
    boundaryMode: geography.type === "POLYGON" ? "POLYGON_BOUNDARY" : geography.type === "CORRIDOR" ? "CORRIDOR_BOUNDS" : "POINT_DISTANCE",
    doesNotRelocateIncidentCoordinates: true,
  };
}
