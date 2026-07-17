/**
 * SSPE-CEIPOL - NÚCLEO DE INTEGRIDAD GEOGRÁFICA (GEOINT Integrity Engine)
 * centraliza y valida toda decisión geográfica del Perfilador Remoto.
 */

export interface GeoIntegrityResult {
  latitude: number | null;
  longitude: number | null;
  confidence: "VERIFIED" | "DERIVED" | "UNKNOWN";
  source: "GPS" | "USER" | "MAP" | "IMPORT" | "NONE";
  warning?: string;
}

const DEFAULT_AGUASCALIENTES_LAT = 21.8853;
const DEFAULT_AGUASCALIENTES_LNG = -102.2916;

/**
 * Valida un par de coordenadas para asegurar su integridad y descartar fallbacks.
 * Aplica de forma estricta las directrices anti-fallback de CEIPOL.
 */
export function validateGeoIntegrity(
  latitude?: number | null,
  longitude?: number | null,
  providedSource?: "GPS" | "USER" | "MAP" | "IMPORT" | "NONE"
): GeoIntegrityResult {
  
  // 1. Caso de coordenadas vacías, ausentes o no numéricas
  if (
    latitude == null ||
    longitude == null ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    !isFinite(latitude) ||
    !isFinite(longitude)
  ) {
    return {
      latitude: null,
      longitude: null,
      confidence: "UNKNOWN",
      source: "NONE",
      warning: "Ubicación no determinada"
    };
  }

  // 2. Descartar de forma proactiva el fallback de Aguascalientes centro
  const isDefaultFallback = 
    Math.abs(latitude - DEFAULT_AGUASCALIENTES_LAT) < 0.0001 && 
    Math.abs(longitude - DEFAULT_AGUASCALIENTES_LNG) < 0.0001;

  if (isDefaultFallback) {
    return {
      latitude: null,
      longitude: null,
      confidence: "UNKNOWN",
      source: "NONE",
      warning: "Ubicación por defecto de Aguascalientes descartada para preservar la integridad"
    };
  }

  // 3. Descartar coordenadas inválidas u origen 0,0
  if (latitude === 0 && longitude === 0) {
    return {
      latitude: null,
      longitude: null,
      confidence: "UNKNOWN",
      source: "NONE",
      warning: "Coordenadas en el origen (0,0) inválidas"
    };
  }

  // 4. Validar límites geográficos generales del territorio mexicano
  // México está comprendido aproximadamente entre lat [14.0, 33.0] y lng [-118.0, -86.0]
  if (
    latitude < 14.0 || 
    latitude > 33.0 || 
    longitude < -118.0 || 
    longitude > -86.0
  ) {
    return {
      latitude: null,
      longitude: null,
      confidence: "UNKNOWN",
      source: "NONE",
      warning: "Coordenadas fuera del territorio de cobertura válido (México)"
    };
  }

  // 5. Coordenada válida aprobada por la auditoría de integridad
  return {
    latitude,
    longitude,
    confidence: "VERIFIED",
    source: providedSource || "GPS"
  };
}
