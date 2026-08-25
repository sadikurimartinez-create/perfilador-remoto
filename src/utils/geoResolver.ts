import {
  GeoEvidence,
  GeoLocationCompatibilityResult,
  GeoEvidenceSource,
} from "../types/geointEvidence";

/**
 * Valida si un par de coordenadas es numérica y geográficamente válida.
 * Regla Inmutable ADR-019.13: Prohibido usar fallbacks estáticos (ej. 21.8850, -102.2910).
 */
export function isValidCoordinate(lat: any, lng: any): boolean {
  if (lat == null || lng == null) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;
  // Excluir Coordenada 0,0 (Null Island) por falta de fijación GPS real
  if (numLat === 0 && numLng === 0) return false;

  return true;
}

/**
 * Calcula la distancia ortodrómica en metros entre dos puntos geográficos usando la fórmula Haversine.
 * Devuelve Infinity si alguna coordenada es inválida.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return Infinity;
  }

  const R = 6371000; // Radio de la Tierra en metros
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Determina si dos evidencias GEOINT pertenecen a la misma ubicación geográfica
 * dentro de un margen de tolerancia en metros.
 * 
 * Regla de Seguridad Geoespacial ADR-019.13:
 * Si alguna evidencia carece de coordenadas válidas, devuelve { isCompatible: false, distanceMeters: Infinity }.
 */
export function isSameLocation(
  evidenceA: GeoEvidence | null | undefined,
  evidenceB: GeoEvidence | null | undefined,
  toleranceMeters: number = 50
): GeoLocationCompatibilityResult {
  if (!evidenceA || !evidenceB) {
    return {
      isCompatible: false,
      distanceMeters: Infinity,
      reason: "EVIDENCIA_NULA: Una o ambas evidencias son nulas.",
    };
  }

  const coordsA = evidenceA.coordinates;
  const coordsB = evidenceB.coordinates;

  if (
    !coordsA ||
    !coordsB ||
    !isValidCoordinate(coordsA.lat, coordsA.lng) ||
    !isValidCoordinate(coordsB.lat, coordsB.lng)
  ) {
    return {
      isCompatible: false,
      distanceMeters: Infinity,
      reason: "COORDENADAS_INVALIDAS: Una o ambas evidencias carecen de coordenadas GPS válidas. Prohibido aplicar fallbacks.",
    };
  }

  const distanceMeters = calculateHaversineDistanceMeters(
    coordsA.lat,
    coordsA.lng,
    coordsB.lat,
    coordsB.lng
  );

  const isCompatible = distanceMeters <= toleranceMeters;

  return {
    isCompatible,
    distanceMeters,
    reason: isCompatible
      ? `COMPATIBLE: Evidencias dentro del radio de tolerancia (${distanceMeters}m <= ${toleranceMeters}m).`
      : `INCOMPATIBLE: Evidencias fuera del radio de tolerancia (${distanceMeters}m > ${toleranceMeters}m).`,
  };
}

/**
 * ADAPTADORES NO DESTRUCTIVOS DE TRANSICIÓN PROGRESIVA
 */

export function adaptStreetViewFindingToGeoEvidence(finding: any): GeoEvidence | null {
  if (!finding) return null;

  const lat = finding.coordenadas?.lat ?? finding.lat;
  const lng = finding.coordenadas?.lng ?? finding.lng;

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  const source: GeoEvidenceSource =
    finding.origenRevision === "MANUAL"
      ? "STREET_VIEW_MANUAL"
      : finding.categoria === "EVIDENCIA_PRIMARIA_CAMPO"
      ? "FIELD_PHOTO"
      : "STREET_VIEW_AUTOMATIC";

  return {
    id: finding.id || `ge-sv-${Date.now()}`,
    expedienteId: finding.expedienteId || "EXP-UNKNOWN",
    source,
    coordinates: {
      lat: Number(lat),
      lng: Number(lng),
    },
    captureDate: finding.fechaCreacion
      ? new Date(finding.fechaCreacion).toISOString().split("T")[0]
      : undefined,
    imageReference: finding.imagen || finding.archivo_url || "",
    metadata: {
      heading: finding.heading,
      pitch: finding.pitch,
      fov: finding.fov,
      category: finding.categoria,
      sourceProvider: "GOOGLE_STREET_VIEW",
      originalFindingId: finding.id,
    },
    status:
      finding.estado === "APROBADO" || finding.estado === "APPROVED_EVIDENCE"
        ? "APPROVED_EVIDENCE"
        : finding.estado === "IGNORADO" || finding.estado === "REJECTED_FINDING"
        ? "REJECTED_FINDING"
        : finding.estado === "GENERATED"
        ? "GENERATED"
        : "PENDING_REVIEW",
  };
}

export function adaptSweepPayloadToGeoEvidence(payload: any, expedienteId: string = "EXP-2026"): GeoEvidence | null {
  if (!payload) return null;

  const lat = payload.geometry?.lat ?? payload.lat;
  const lng = payload.geometry?.lng ?? payload.lng;

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  return {
    id: payload.originalFindingId || `ge-sweep-${Date.now()}`,
    expedienteId,
    source: "STREET_VIEW_AUTOMATIC",
    coordinates: {
      lat: Number(lat),
      lng: Number(lng),
    },
    captureDate: payload.timestamp
      ? new Date(payload.timestamp).toISOString().split("T")[0]
      : undefined,
    imageReference: payload.file_url || "",
    metadata: {
      heading: payload.geometry?.heading,
      pitch: payload.geometry?.pitch,
      fov: payload.geometry?.fov,
      investigator: payload.createdBy,
      category: payload.category,
      sourceProvider: "GOOGLE_STREET_VIEW",
      originalFindingId: payload.originalFindingId,
    },
    status: payload.status === "APPROVED_EVIDENCE" ? "APPROVED_EVIDENCE" : "PENDING_REVIEW",
  };
}
