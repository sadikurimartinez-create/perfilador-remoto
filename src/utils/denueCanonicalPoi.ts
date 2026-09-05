import { SpatialLayerEngine, type Coordinate } from "@/lib/providers/spatialLayerEngine";
import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";
import {
  buildDenueQueryContext,
  deserializeCanonicalGeographyFromFirestore,
  type CanonicalProjectGeography,
  type CanonicalGeometry,
} from "@/utils/canonicalProjectGeography";

export type DenueTerritorialStatus = "INSTITUTIONAL" | "CONTEXTUAL_ONLY" | "EXCLUDED";

export interface DenueCanonicalPoi {
  id: string;
  name: string;
  activityCode: string;
  address: string;
  lat: number;
  lng: number;
  coordinates: Coordinate;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  geographyType: CanonicalProjectGeography["type"];
  source: "DENUE";
  provider: "INEGI_DENUE";
  epistemicIntegrity: EpistemicIntegrityMetadata;
  observedAt?: string | null;
  acquiredAt?: string | null;
  rawSourceReference: string;
  sourceReference: string;
  territorialStatus: DenueTerritorialStatus;
  publicationRole: "TERRITORIAL_CONTEXT";
  semanticRole: "SOURCE_FACT";
  evidenceDomain: "TERRITORIAL_CONTEXT";
  isCriminalEvidence: false;
  raw: Record<string, any>;
}

export interface DenueCanonicalizationResult {
  institutionalPois: DenueCanonicalPoi[];
  contextualPois: Array<Partial<DenueCanonicalPoi> & { territorialStatus: DenueTerritorialStatus; exclusionReason?: string }>;
  excludedPois: Array<{ raw: unknown; territorialStatus: "EXCLUDED"; exclusionReason: string }>;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim().replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function normalizeDenueCoordinates(raw: unknown): Coordinate | null {
  if (!isRecord(raw)) return null;
  const nested = isRecord(raw.coordinates) ? raw.coordinates : {};
  const lat = readNumber({ ...raw, ...nested }, ["lat", "latitude", "Latitud", "latitud", "LATITUD"]);
  const lng = readNumber({ ...raw, ...nested }, ["lng", "lon", "long", "longitude", "Longitud", "longitud", "LONGITUD"]);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeTracePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "-");
}

function sourceEvidenceIdFrom(raw: Record<string, any>, coordinates: Coordinate): string {
  const stableId = readString(raw, [
    "sourceEvidenceId",
    "Id",
    "id",
    "denueId",
    "DENUE_ID",
    "CLEE",
    "clee",
    "Clee",
  ]);
  if (stableId) return `denue:${sanitizeTracePart(stableId)}`;

  const deterministicSeed = [
    readString(raw, ["Nombre", "name", "nombre"]) || "unknown-name",
    readString(raw, ["Clase_actividad", "activityCode", "giro", "activity"]) || "unknown-activity",
    coordinates.lat.toFixed(7),
    coordinates.lng.toFixed(7),
  ].join("|");
  return `denue:derived:${stableHash(deterministicSeed)}`;
}

function rawSourceReferenceFrom(raw: Record<string, any>, sourceEvidenceId: string): string {
  return (
    readString(raw, ["rawSourceReference", "sourceReference", "referenciaFuente"]) ||
    `denue:v1:consulta:Buscar:${sourceEvidenceId}`
  );
}

function baseDenueIntegrity(params: {
  raw: Record<string, any>;
  sourceEvidenceId: string;
  traceabilityId: string;
  rawSourceReference: string;
  sourceReference: string;
  query?: string | null;
  acquiredAt?: string | null;
}): EpistemicIntegrityMetadata {
  const existing = isRecord(params.raw.epistemicIntegrity) ? params.raw.epistemicIntegrity : {};
  const acquiredAt =
    readString(params.raw, ["acquiredAt"]) ||
    (typeof existing.acquiredAt === "string" ? existing.acquiredAt : null) ||
    params.acquiredAt ||
    new Date().toISOString();
  const observedAt =
    readString(params.raw, ["observedAt"]) ||
    (typeof existing.observedAt === "string" ? existing.observedAt : null) ||
    acquiredAt;

  return {
    ...existing,
    sourceId: "inegi-denue-api",
    providerId: "INEGI_DENUE",
    providerName: "INEGI DENUE API Publica",
    sourceType: "DENUE",
    acquisitionMode: "OBSERVED",
    acquisitionStatus: "ACQUIRED",
    semanticRole: "SOURCE_FACT",
    validationStatus: "UNREVIEWED",
    isSimulated: false,
    isDerived: false,
    isConnectivityOnly: false,
    observedAt,
    acquiredAt,
    generatedAt: typeof existing.generatedAt === "string" ? existing.generatedAt : null,
    sourceReference: params.sourceReference,
    sourceUrl: "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar",
    rawSourceReference: params.rawSourceReference,
    query: params.query ?? (typeof existing.query === "string" ? existing.query : null),
    resultCount: typeof existing.resultCount === "number" ? existing.resultCount : null,
    geolocationSource: "DENUE_SOURCE_COORDINATES",
    traceabilityId: params.traceabilityId,
    lineage: [
      {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        providerName: "INEGI DENUE API Publica",
        sourceType: "DENUE",
        sourceReference: params.sourceReference,
        sourceUrl: "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar",
        rawSourceReference: params.rawSourceReference,
        traceabilityId: params.traceabilityId,
        acquisitionMode: "OBSERVED",
      },
    ],
  };
}

function polygonContainsPoint(point: Coordinate, rings: number[][][]): boolean {
  const outer = rings[0]?.map(([lng, lat]) => ({ lat, lng })) || [];
  if (!SpatialLayerEngine.isPointInPolygon(point, outer)) return false;
  const holes = rings.slice(1);
  return !holes.some((ring) => SpatialLayerEngine.isPointInPolygon(point, ring.map(([lng, lat]) => ({ lat, lng }))));
}

function isSpatiallyCompatible(
  point: Coordinate,
  geography: CanonicalProjectGeography,
  radiusMeters?: number
): { compatible: boolean; contextualOnly: boolean; reason?: string } {
  if (geography.validationStatus !== "VALID") {
    return { compatible: false, contextualOnly: true, reason: "CANONICAL_GEOGRAPHY_NOT_VALID" };
  }

  const geometry: CanonicalGeometry = geography.geometry;
  if (geometry.type === "Point") {
    if (!Number.isFinite(radiusMeters) || Number(radiusMeters) <= 0) {
      return { compatible: false, contextualOnly: true, reason: "POINT_RADIUS_NOT_AVAILABLE" };
    }
    const center = { lat: geometry.coordinates[1], lng: geometry.coordinates[0] };
    const distanceMeters = SpatialLayerEngine.getDistance(center, point);
    return distanceMeters <= Number(radiusMeters)
      ? { compatible: true, contextualOnly: false }
      : { compatible: false, contextualOnly: false, reason: "OUTSIDE_CANONICAL_POINT_RADIUS" };
  }

  if (geometry.type === "LineString") {
    if (geometry.coordinates.length < 2 || !Number.isFinite(radiusMeters) || Number(radiusMeters) <= 0) {
      return { compatible: false, contextualOnly: true, reason: "CORRIDOR_BUFFER_NOT_AVAILABLE" };
    }
    const path = geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return SpatialLayerEngine.distToPolyline(point, path) <= Number(radiusMeters)
      ? { compatible: true, contextualOnly: false }
      : { compatible: false, contextualOnly: false, reason: "OUTSIDE_CANONICAL_CORRIDOR_BUFFER" };
  }

  if (geometry.type === "Polygon") {
    return polygonContainsPoint(point, geometry.coordinates)
      ? { compatible: true, contextualOnly: false }
      : { compatible: false, contextualOnly: false, reason: "OUTSIDE_CANONICAL_POLYGON" };
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => polygonContainsPoint(point, polygon))
      ? { compatible: true, contextualOnly: false }
      : { compatible: false, contextualOnly: false, reason: "OUTSIDE_CANONICAL_MULTIPOLYGON" };
  }

  return { compatible: false, contextualOnly: true, reason: "UNSUPPORTED_CANONICAL_GEOMETRY" };
}

export function prepareDenueAcquisitionPois(
  rawPois: unknown[],
  options: { query?: string | null; acquiredAt?: string | null } = {}
) {
  return rawPois.filter(isRecord).map((raw) => {
    const coordinates = normalizeDenueCoordinates(raw);
    const sourceEvidenceId = coordinates ? sourceEvidenceIdFrom(raw, coordinates) : `denue:invalid:${stableHash(JSON.stringify(raw))}`;
    const traceabilityId = `trace:denue:acquisition:${sourceEvidenceId}`;
    const sourceReference = "src/lib/osintActions.ts:getDenueData";
    const rawSourceReference = rawSourceReferenceFrom(raw, sourceEvidenceId);
    return {
      ...raw,
      id: readString(raw, ["id", "Id", "CLEE", "clee"]) || sourceEvidenceId,
      sourceEvidenceId,
      traceabilityId,
      coordinates: coordinates || null,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
      source: "DENUE",
      provider: "INEGI_DENUE",
      semanticRole: "SOURCE_FACT",
      epistemicIntegrity: baseDenueIntegrity({
        raw,
        sourceEvidenceId,
        traceabilityId,
        rawSourceReference,
        sourceReference,
        query: options.query,
        acquiredAt: options.acquiredAt,
      }),
      rawSourceReference,
      sourceReference,
    };
  });
}

export function extractDenueRawPois(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];
  if (Array.isArray(input.pois)) return input.pois;
  if (Array.isArray(input.rawPois)) return input.rawPois;
  if (Array.isArray(input.data)) return input.data;
  if (Array.isArray(input.denue)) return input.denue;
  return [];
}

export function canonicalizeDenuePoisForInstitutionalAnalysis(
  rawInput: unknown,
  options: {
    expedienteId: string;
    canonicalGeography: CanonicalProjectGeography | unknown | null | undefined;
    radiusMeters?: number | null;
    query?: string | null;
    acquiredAt?: string | null;
  }
): DenueCanonicalizationResult {
  const rawPois = extractDenueRawPois(rawInput);
  const geography = deserializeCanonicalGeographyFromFirestore(options.canonicalGeography as any);
  const result: DenueCanonicalizationResult = {
    institutionalPois: [],
    contextualPois: [],
    excludedPois: [],
  };

  if (!geography?.geographyId) {
    for (const raw of rawPois) {
      result.contextualPois.push({ raw: isRecord(raw) ? raw : {}, territorialStatus: "CONTEXTUAL_ONLY", exclusionReason: "MISSING_CANONICAL_GEOGRAPHY" });
    }
    return result;
  }

  const queryContext = buildDenueQueryContext(geography, options.radiusMeters ?? undefined);

  for (const raw of rawPois) {
    if (!isRecord(raw)) {
      result.excludedPois.push({ raw, territorialStatus: "EXCLUDED", exclusionReason: "INVALID_POI_OBJECT" });
      continue;
    }

    const coordinates = normalizeDenueCoordinates(raw);
    if (!coordinates) {
      result.excludedPois.push({ raw, territorialStatus: "EXCLUDED", exclusionReason: "INVALID_DENUE_COORDINATES" });
      continue;
    }

    const spatial = isSpatiallyCompatible(coordinates, geography, queryContext.radiusMeters ?? options.radiusMeters ?? undefined);
    const sourceEvidenceId = sourceEvidenceIdFrom(raw, coordinates);
    const traceabilityId = `trace:denue:${sanitizeTracePart(options.expedienteId)}:${sanitizeTracePart(geography.geographyId)}:${sourceEvidenceId}`;
    const sourceReference = "src/utils/denueCanonicalPoi.ts:canonicalizeDenuePoisForInstitutionalAnalysis";
    const rawSourceReference = rawSourceReferenceFrom(raw, sourceEvidenceId);
    const epistemicIntegrity = baseDenueIntegrity({
      raw,
      sourceEvidenceId,
      traceabilityId,
      rawSourceReference,
      sourceReference,
      query: options.query,
      acquiredAt: options.acquiredAt,
    });

    const poi: DenueCanonicalPoi = {
      id: readString(raw, ["id", "Id", "CLEE", "clee"]) || sourceEvidenceId,
      name: readString(raw, ["name", "Nombre", "nombre"]) || "Establecimiento DENUE",
      activityCode: readString(raw, ["activityCode", "Clase_actividad", "codigoActividad", "giro", "activity"]) || "000000",
      address: readString(raw, ["address", "Domicilio", "domicilio", "direccion", "Ubicacion"]) || "Domicilio no especificado",
      lat: coordinates.lat,
      lng: coordinates.lng,
      coordinates,
      sourceEvidenceId,
      traceabilityId,
      expedienteId: options.expedienteId,
      geographyId: geography.geographyId,
      geographyType: geography.type,
      source: "DENUE",
      provider: "INEGI_DENUE",
      epistemicIntegrity,
      observedAt: epistemicIntegrity.observedAt ?? null,
      acquiredAt: epistemicIntegrity.acquiredAt ?? null,
      rawSourceReference,
      sourceReference,
      territorialStatus: spatial.compatible ? "INSTITUTIONAL" : spatial.contextualOnly ? "CONTEXTUAL_ONLY" : "EXCLUDED",
      publicationRole: "TERRITORIAL_CONTEXT",
      semanticRole: "SOURCE_FACT",
      evidenceDomain: "TERRITORIAL_CONTEXT",
      isCriminalEvidence: false,
      raw,
    };

    if (spatial.compatible) {
      result.institutionalPois.push(poi);
    } else if (spatial.contextualOnly) {
      result.contextualPois.push({ ...poi, territorialStatus: "CONTEXTUAL_ONLY", exclusionReason: spatial.reason });
    } else {
      result.excludedPois.push({ raw, territorialStatus: "EXCLUDED", exclusionReason: spatial.reason || "SPATIALLY_INCOMPATIBLE" });
    }
  }

  return result;
}
