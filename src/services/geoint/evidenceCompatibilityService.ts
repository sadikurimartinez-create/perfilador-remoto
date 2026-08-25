import { GeoEvidence } from "../../types/geointEvidence";
import { isSameLocation, calculateHaversineDistanceMeters } from "../../utils/geoResolver";

export interface EvidenceCompatibilityFilterResult {
  compatibleEvidence: GeoEvidence[];
  rejectedCount: number;
  referenceEvidence: GeoEvidence | null;
}

export interface EvidenceDistanceMetadata {
  evidence: GeoEvidence;
  distanceMeters: number;
  isCompatible: boolean;
}

/**
 * Servicio Orquestador de Compatibilidad Geoespacial de Evidencias (ADR-019.13)
 * Centraliza las reglas de negocio para filtrar, clasificar y ordenar evidencias
 * compatibles con una referencia geográfica dada.
 */

/**
 * Filtra un conjunto de evidencias candidatas contra una evidencia de referencia,
 * devolviendo únicamente aquellas ubicadas dentro del radio de tolerancia en metros
 * y ordenadas por cercanía geográfica (distancia ascendente).
 */
export function filterCompatibleEvidence(
  referenceEvidence: GeoEvidence | null | undefined,
  candidates: GeoEvidence[] = [],
  toleranceMeters: number = 50
): GeoEvidence[] {
  if (!referenceEvidence || !candidates || candidates.length === 0) {
    return [];
  }

  const compatibleList: EvidenceDistanceMetadata[] = [];

  for (const candidate of candidates) {
    // Regla de Integridad: Evitar comparar una evidencia contra sí misma
    if (candidate.id === referenceEvidence.id) {
      continue;
    }

    const checkResult = isSameLocation(referenceEvidence, candidate, toleranceMeters);

    if (checkResult.isCompatible && isFinite(checkResult.distanceMeters)) {
      compatibleList.push({
        evidence: candidate,
        distanceMeters: checkResult.distanceMeters,
        isCompatible: true,
      });
    }
  }

  // Ordenar por distancia ascendente (la más cercana primero)
  compatibleList.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return compatibleList.map((item) => item.evidence);
}

/**
 * Retorna el resultado detallado de filtrado con métricas de elementos aceptados y rechazados.
 */
export function filterCompatibleEvidenceWithMetrics(
  referenceEvidence: GeoEvidence | null | undefined,
  candidates: GeoEvidence[] = [],
  toleranceMeters: number = 50
): EvidenceCompatibilityFilterResult {
  const compatible = filterCompatibleEvidence(referenceEvidence, candidates, toleranceMeters);
  const totalCandidateItems = candidates.filter((c) => c.id !== referenceEvidence?.id).length;
  const rejectedCount = Math.max(0, totalCandidateItems - compatible.length);

  return {
    compatibleEvidence: compatible,
    rejectedCount,
    referenceEvidence: referenceEvidence || null,
  };
}

/**
 * Calcula el detalle pericial de compatibilidad geográfica entre dos evidencias específicas.
 */
export function getEvidenceDistanceDetail(
  evidenceA: GeoEvidence | null | undefined,
  evidenceB: GeoEvidence | null | undefined
): { distanceMeters: number; formattedDistance: string; isValid: boolean } {
  if (!evidenceA?.coordinates || !evidenceB?.coordinates) {
    return { distanceMeters: Infinity, formattedDistance: "N/A", isValid: false };
  }

  const distanceMeters = calculateHaversineDistanceMeters(
    evidenceA.coordinates.lat,
    evidenceA.coordinates.lng,
    evidenceB.coordinates.lat,
    evidenceB.coordinates.lng
  );

  if (!isFinite(distanceMeters)) {
    return { distanceMeters: Infinity, formattedDistance: "Sin GPS", isValid: false };
  }

  const formattedDistance =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)} m`
      : `${(distanceMeters / 1000).toFixed(2)} km`;

  return { distanceMeters, formattedDistance, isValid: true };
}
