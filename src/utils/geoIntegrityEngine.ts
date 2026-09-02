/**
 * SSPE-CEIPOL - NÚCLEO DE INTEGRIDAD GEOGRÁFICA (GEOINT Integrity Engine)
 * Centraliza y valida toda decisión geográfica del Perfilador Remoto (ADR-013).
 */

export interface GeoIntegrityResult {
  latitude: number | null;
  longitude: number | null;
  confidence: "VERIFIED" | "DERIVED" | "UNKNOWN";
  source: GeoIntegritySource;
  status?: "LOCATION_PENDING" | "VERIFIED" | "DESELECTED";
  geolocationStatus?: "VALID_GEOLOCATION" | "NOT_GEOREFERENCED" | "INVALID" | "PRESERVED_UNVERIFIED";
  precision?: number | null;
  observedAt?: string | null;
  sourceReference?: string | null;
  isSynthetic?: boolean;
  reportableAsObservedGeoint?: boolean;
  warning?: string;
}

export type GeoIntegritySource =
  | "EXIF_GPS"
  | "DEVICE_GPS"
  | "STREET_VIEW_PANORAMA"
  | "SOURCE_RECORD"
  | "ANALYST_SELECTED"
  | "GEOCODED_VERIFIED"
  | "PROJECT_GEOMETRY"
  | "LEGACY_UNCLASSIFIED"
  | "UNKNOWN_SOURCE"
  | "DEFAULT"
  | "RANDOM"
  | "JITTER"
  | "SYNTHETIC"
  | "AI_GENERATED"
  | "GPS"
  | "USER"
  | "MAP"
  | "IMPORT"
  | "NONE";

export interface GeoIntegrityInput {
  latitude?: unknown;
  longitude?: unknown;
  source?: GeoIntegritySource;
  precision?: number | null;
  observedAt?: string | null;
  sourceReference?: string | null;
}

const DEFAULT_AGUASCALIENTES_LAT = 21.8853;
const DEFAULT_AGUASCALIENTES_LNG = -102.2916;
const PROHIBITED_FALLBACK_LAT = 21.80994922142517;
const PROHIBITED_FALLBACK_LNG = -102.26811267400397;
const SYNTHETIC_GEO_SOURCES = new Set<GeoIntegritySource>(["DEFAULT", "RANDOM", "JITTER", "SYNTHETIC", "AI_GENERATED", "NONE"]);
const UNVERIFIED_PRESERVE_SOURCES = new Set<GeoIntegritySource>(["LEGACY_UNCLASSIFIED", "UNKNOWN_SOURCE"]);

function invalidGeoResult(warning: string, source: GeoIntegritySource = "NONE"): GeoIntegrityResult {
  return {
    latitude: null,
    longitude: null,
    confidence: "UNKNOWN",
    source,
    status: "LOCATION_PENDING",
    geolocationStatus: "INVALID",
    precision: null,
    observedAt: null,
    sourceReference: null,
    isSynthetic: SYNTHETIC_GEO_SOURCES.has(source),
    reportableAsObservedGeoint: false,
    warning
  };
}

function missingGeoResult(warning: string): GeoIntegrityResult {
  return {
    latitude: null,
    longitude: null,
    confidence: "UNKNOWN",
    source: "NONE",
    status: "LOCATION_PENDING",
    geolocationStatus: "NOT_GEOREFERENCED",
    precision: null,
    observedAt: null,
    sourceReference: null,
    isSynthetic: false,
    reportableAsObservedGeoint: false,
    warning
  };
}

/**
 * Valida un par de coordenadas para asegurar su integridad y descartar fallbacks.
 * Aplica de forma estricta las directrices anti-fallback de CEIPOL.
 */
export function validateGeoIntegrity(
  latitudeOrInput?: number | null | GeoIntegrityInput,
  longitude?: number | null,
  providedSource?: GeoIntegritySource
): GeoIntegrityResult {
  const input: GeoIntegrityInput =
    typeof latitudeOrInput === "object" && latitudeOrInput !== null && !Array.isArray(latitudeOrInput)
      ? latitudeOrInput
      : {
          latitude: latitudeOrInput,
          longitude,
          source: providedSource,
        };
  const latitude = input.latitude;
  const lng = input.longitude;
  const source = input.source || providedSource || "GPS";
  
  // 1. Caso de coordenadas vacías, ausentes o no numéricas
  if (
    latitude == null ||
    lng == null ||
    typeof latitude !== "number" ||
    typeof lng !== "number" ||
    isNaN(latitude) ||
    isNaN(lng) ||
    !isFinite(latitude) ||
    !isFinite(lng)
  ) {
    return missingGeoResult("Ubicación no determinada / pendiente");
  }

  if (SYNTHETIC_GEO_SOURCES.has(source)) {
    return invalidGeoResult("Coordenada sintética/default/random/jitter no certificable como observación GEOINT", source);
  }

  // 1b. Descartar de forma proactiva la coordenada fallback prohibida
  const isProhibitedFallback =
    Math.abs(latitude - PROHIBITED_FALLBACK_LAT) < 0.0001 &&
    Math.abs(lng - PROHIBITED_FALLBACK_LNG) < 0.0001;

  if (isProhibitedFallback) {
    return invalidGeoResult("Coordenada fallback artificial descartada por regla de gobernanza v2.6.2", "DEFAULT");
  }

  // 2. Descartar de forma proactiva el fallback de Aguascalientes centro
  const isDefaultFallback = 
    Math.abs(latitude - DEFAULT_AGUASCALIENTES_LAT) < 0.0001 && 
    Math.abs(lng - DEFAULT_AGUASCALIENTES_LNG) < 0.0001;

  if (isDefaultFallback) {
    return invalidGeoResult("Ubicación por defecto de Aguascalientes descartada para preservar la integridad", "DEFAULT");
  }

  // 3. Descartar coordenadas inválidas u origen 0,0
  if (latitude === 0 && lng === 0) {
    return invalidGeoResult("Coordenadas en el origen (0,0) inválidas", "DEFAULT");
  }

  // 4. Validar límites geográficos generales.
  if (
    latitude < -90 || 
    latitude > 90 || 
    lng < -180 || 
    lng > 180
  ) {
    return invalidGeoResult("Coordenadas fuera de rango geográfico válido", source);
  }

  if (UNVERIFIED_PRESERVE_SOURCES.has(source)) {
    return {
      latitude,
      longitude: lng,
      confidence: "UNKNOWN",
      source,
      status: "LOCATION_PENDING",
      geolocationStatus: "PRESERVED_UNVERIFIED",
      precision: input.precision ?? null,
      observedAt: input.observedAt ?? null,
      sourceReference: input.sourceReference ?? null,
      isSynthetic: false,
      reportableAsObservedGeoint: false,
      warning: "Coordenada histórica preservada sin procedencia geoespacial verificable"
    };
  }

  // 5. Coordenada válida aprobada por la auditoría de integridad
  return {
    latitude,
    longitude: lng,
    confidence: "VERIFIED",
    source,
    status: "VERIFIED",
    geolocationStatus: "VALID_GEOLOCATION",
    precision: input.precision ?? null,
    observedAt: input.observedAt ?? null,
    sourceReference: input.sourceReference ?? null,
    isSynthetic: false,
    reportableAsObservedGeoint: true
  };
}
