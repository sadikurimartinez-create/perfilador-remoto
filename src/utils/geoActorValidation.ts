/**
 * Validación geoespacial estricta para actores territoriales.
 * Prohibido incluir actores con geocodificación por colonia/ciudad (jitter) o sin domicilio verificable.
 */

export interface GeorreferenciaMember {
  lat: number;
  lng: number;
  confidence?: number;
  status?: string;
}

export interface DireccionMember {
  calle?: string;
  numero?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
}

const REJECTED_GEO_STATUSES = [
  "local_db_city_jitter",
  "local_db_colonia_jitter",
  "city_jitter",
  "colonia_jitter",
  "fallback",
  "jitter",
];

const MIN_GEO_CONFIDENCE = 5;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDomicilio(direccion?: DireccionMember): string {
  if (!direccion) return "";
  const calle = (direccion.calle || "").trim();
  const numero = (direccion.numero || "").trim();
  const colonia = (direccion.colonia || "").trim();
  const parts: string[] = [];
  if (calle) parts.push(`${calle}${numero ? ` #${numero}` : ""}`);
  if (colonia) parts.push(`Col. ${colonia}`);
  return parts.join(", ");
}

/** ¿El domicilio tiene calle y número reales (no solo colonia)? */
export function hasValidatedAddress(direccion?: DireccionMember): boolean {
  if (!direccion) return false;
  const calle = (direccion.calle || "").trim();
  const numero = (direccion.numero || "").trim();
  return calle.length >= 2 && numero.length >= 1;
}

/** ¿Las coordenadas son numéricamente válidas y dentro de México? */
export function hasValidCoordinates(geo?: GeorreferenciaMember | null): boolean {
  if (!geo) return false;
  if (typeof geo.lat !== "number" || typeof geo.lng !== "number") return false;
  if (isNaN(geo.lat) || isNaN(geo.lng)) return false;
  if (Math.abs(geo.lat) < 0.1 || Math.abs(geo.lng) < 0.1) return false;
  return geo.lat >= 14 && geo.lat <= 33 && geo.lng >= -118 && geo.lng <= -86;
}

/** ¿La geocodificación es de calidad suficiente (no jitter por colonia/ciudad)? */
export function isGeocodingReliable(geo?: GeorreferenciaMember | null): boolean {
  if (!geo) return false;
  const status = (geo.status || "").toLowerCase();
  if (REJECTED_GEO_STATUSES.some((s) => status.includes(s))) return false;
  if (typeof geo.confidence === "number" && geo.confidence < MIN_GEO_CONFIDENCE) return false;
  return true;
}

export interface TerritorialActorValidation {
  valid: boolean;
  reason?: string;
  distancia?: number;
}

/**
 * Valida un integrante antes de incluirlo en el dictamen.
 * Requiere: domicilio con calle+número, coords válidas, geocodificación fiable, distancia coherente y dentro del radio.
 */
export function validateTerritorialActor(
  member: { georreferencia?: GeorreferenciaMember; direccion?: DireccionMember },
  epicenterLat: number,
  epicenterLng: number,
  maxRadiusMeters: number
): TerritorialActorValidation {
  if (!hasValidatedAddress(member.direccion)) {
    return { valid: false, reason: "Domicilio sin calle y número verificables" };
  }
  if (!hasValidCoordinates(member.georreferencia)) {
    return { valid: false, reason: "Coordenadas geográficas ausentes o inválidas" };
  }
  if (!isGeocodingReliable(member.georreferencia)) {
    return { valid: false, reason: "Geocodificación no verificada (jitter por colonia/ciudad)" };
  }

  const dist = haversineMeters(
    epicenterLat,
    epicenterLng,
    member.georreferencia!.lat,
    member.georreferencia!.lng
  );

  if (dist < 0 || dist >= 100000) {
    return { valid: false, reason: "Distancia cartográficamente incoherente", distancia: dist };
  }
  if (dist > maxRadiusMeters) {
    return { valid: false, reason: `Fuera del radio de análisis (${maxRadiusMeters}m)`, distancia: dist };
  }

  return { valid: true, distancia: dist };
}

export function classifyActorProximity(
  dist: number
): "Confirmado" | "Probable" | "No corroborado" {
  if (dist <= 350) return "Confirmado";
  if (dist <= 750) return "Probable";
  return "No corroborado";
}
