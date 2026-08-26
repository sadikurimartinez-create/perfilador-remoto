import { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import { UniversalEvidenceComparison } from "@/types/geointTemporalComparison";
import { GeointGovernanceStatus, normalizeGeointGovernanceStatus } from "@/types/geointGovernance";

/**
 * ADR-019.17 — Bridge deterministico UniversalEvidenceComparison -> StreetViewFinding (Función Pura).
 * Mantiene la cadena Foto original -> GeoEvidence -> Panorama -> Comparison -> Finding.
 */
export function UniversalEvidenceComparisonToFinding(
  comparison: UniversalEvidenceComparison
): StreetViewFinding {
  const primaryEvidence = comparison.evidenceA || comparison.evidenceB;
  const contextualEvidence = comparison.evidenceB || comparison.evidenceA;
  const coordinates = contextualEvidence?.coordinates || primaryEvidence?.coordinates || { lat: 0, lng: 0 };

  return {
    id: comparison.comparisonId,
    expedienteId: comparison.expedienteId,
    traceabilityId: comparison.traceabilityId,
    sourceEvidenceId: comparison.sourceEvidenceId || primaryEvidence?.sourceEvidenceId || primaryEvidence?.id || comparison.comparisonId,
    evidenciaId: comparison.comparisonId,
    captureId: contextualEvidence?.id || primaryEvidence?.id,
    categoria: "COMPARACION_TEMPORAL",
    coordenadas: {
      lat: Number(coordinates.lat) || 0,
      lng: Number(coordinates.lng) || 0,
    },
    imagen: contextualEvidence?.imageReference || primaryEvidence?.imageReference || "",
    heading: contextualEvidence?.metadata?.heading ?? primaryEvidence?.metadata?.heading,
    pitch: contextualEvidence?.metadata?.pitch ?? primaryEvidence?.metadata?.pitch,
    fov: contextualEvidence?.metadata?.fov ?? primaryEvidence?.metadata?.fov,
    descripcion: comparison.aiAnalysis?.calibratedObservation || "Comparación temporal GEOINT",
    observaciones_visual: comparison.aiAnalysis?.calibratedObservation || "Comparación temporal GEOINT",
    estado: normalizeGeointGovernanceStatus(comparison.analystValidationStatus),
    fechaCreacion: comparison.createdAt,
    usuarioRevision: comparison.validatedBy || comparison.createdBy,
    origenRevision: "MANUAL",
  };
}

/**
 * Alias de compatibilidad para buildStreetViewFindingFromTemporalComparison
 */
export function buildStreetViewFindingFromTemporalComparison(
  comparison: UniversalEvidenceComparison
): StreetViewFinding {
  return UniversalEvidenceComparisonToFinding(comparison);
}
