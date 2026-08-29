import { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import { UniversalEvidenceComparison } from "@/types/geointTemporalComparison";
import { GeointGovernanceStatus, normalizeGeointGovernanceStatus } from "@/types/geointGovernance";
import { validateGeoIntegrity } from "@/utils/geoIntegrityEngine";
import { validateLineage, type CanonicalLineageNode } from "@/utils/evidenceLineage";

/**
 * ADR-019.17 — Bridge deterministico UniversalEvidenceComparison -> StreetViewFinding (Función Pura).
 * Mantiene la cadena Foto original -> GeoEvidence -> Panorama -> Comparison -> Finding.
 */
export function UniversalEvidenceComparisonToFinding(
  comparison: UniversalEvidenceComparison
): StreetViewFinding {
  const primaryEvidence = comparison.evidenceA || comparison.evidenceB;
  const contextualEvidence = comparison.evidenceB || comparison.evidenceA;
  const coordinates = contextualEvidence?.coordinates || primaryEvidence?.coordinates || { lat: null, lng: null };
  const source = contextualEvidence?.source === "STREET_VIEW_HISTORICAL" ? "STREET_VIEW_PANORAMA" : "SOURCE_RECORD";
  const supportingEvidenceIds = [comparison.evidenceA?.sourceEvidenceId || comparison.evidenceA?.id, comparison.evidenceB?.sourceEvidenceId || comparison.evidenceB?.id]
    .filter((id): id is string => Boolean(id));
  const lineage: CanonicalLineageNode[] = [
    ...supportingEvidenceIds.map((evidenceId) => ({
      id: evidenceId,
      type: "EVIDENCE" as const,
      evidenceId,
      sourceReference: "TemporalComparison",
    })),
    {
      id: comparison.comparisonId,
      type: "FINDING" as const,
      findingId: comparison.comparisonId,
      supportingEvidenceIds,
    },
  ];
  const lineageValidation = validateLineage(lineage);
  const geoValidation = validateGeoIntegrity({
    latitude: coordinates.lat,
    longitude: coordinates.lng,
    source,
    sourceReference: `temporalComparison:${comparison.comparisonId}`,
  });

  return {
    id: comparison.comparisonId,
    expedienteId: comparison.expedienteId,
    traceabilityId: comparison.traceabilityId,
    sourceEvidenceId: comparison.sourceEvidenceId || primaryEvidence?.sourceEvidenceId || primaryEvidence?.id || comparison.comparisonId,
    supportingEvidenceIds,
    lineage,
    lineageStatus: lineageValidation.status,
    evidenciaId: comparison.comparisonId,
    captureId: contextualEvidence?.id || primaryEvidence?.id,
    categoria: "COMPARACION_TEMPORAL",
    coordenadas: {
      lat: geoValidation.latitude,
      lng: geoValidation.longitude,
    },
    geolocationIntegrity: geoValidation,
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
