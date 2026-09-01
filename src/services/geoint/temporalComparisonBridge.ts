import { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import { UniversalEvidenceComparison } from "@/types/geointTemporalComparison";
import { GeointGovernanceStatus, normalizeGeointGovernanceStatus } from "@/types/geointGovernance";
import { validateGeoIntegrity } from "@/utils/geoIntegrityEngine";
import { validateLineage, type CanonicalLineageNode } from "@/utils/evidenceLineage";
import { createAiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import { adaptEvidence, adaptFinding } from "@/services/geoint/canonicalEvidenceRegistry";
import type { CanonicalReferenceSet } from "@/types/canonicalEvidenceRegistry";

export function deriveTemporalComparisonCanonicalReferences(
  comparison: UniversalEvidenceComparison
): CanonicalReferenceSet {
  const geographyId = (comparison as any).geographyId ?? (comparison.evidenceA as any)?.geographyId ?? (comparison.evidenceB as any)?.geographyId;
  const evidenceRefs = [comparison.evidenceA, comparison.evidenceB]
    .map((evidence) => evidence ? adaptEvidence({
      expedienteId: comparison.expedienteId,
      nativeEvidenceId: evidence.id,
      nativeType: "TEMPORAL_EVIDENCE",
      sourceType: "TEMPORAL_COMPARISON",
      sourceId: evidence.sourceEvidenceId,
      traceabilityId: evidence.traceabilityId,
      geographyId,
      legacy: !evidence.id || !evidence.sourceEvidenceId,
    }) : null)
    .filter((ref): ref is NonNullable<typeof ref> => ref !== null);

  return {
    evidenceRefs,
    findingRef: adaptFinding({
      expedienteId: comparison.expedienteId,
      nativeFindingId: comparison.comparisonId,
      nativeType: "TEMPORAL_COMPARISON_FINDING",
      sourceType: "TEMPORAL_COMPARISON",
      sourceFindingId: comparison.comparisonId,
      sourceId: comparison.sourceEvidenceId,
      supportingEvidenceRefs: evidenceRefs,
      requiredEvidenceRefCount: 2,
      traceabilityId: comparison.traceabilityId,
      geographyId,
      legacy: evidenceRefs.length < 2,
    }),
  };
}

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
  const geographyId = (comparison as any).geographyId ?? (comparison.evidenceA as any)?.geographyId ?? (comparison.evidenceB as any)?.geographyId ?? null;
  const lineage: CanonicalLineageNode[] = [
    ...(geographyId ? [{ id: geographyId, type: "GEOGRAPHY" as const, geographyId }] : []),
    ...supportingEvidenceIds.map((evidenceId) => ({
      id: evidenceId,
      type: "EVIDENCE" as const,
      evidenceId,
      sourceReference: "TemporalComparison",
      geographyId,
    })),
    {
      id: comparison.comparisonId,
      type: "FINDING" as const,
      findingId: comparison.comparisonId,
      supportingEvidenceIds,
      geographyId,
    },
  ];
  const lineageValidation = validateLineage(lineage);
  const aiAnalyticalOutput = createAiAnalyticalOutput({
    outputType: "INFERENCE",
    provider: "TEMPORAL_COMPARISON",
    model: "UNAVAILABLE",
    confidence: comparison.aiAnalysis?.confidenceScore,
    confidenceSource: "PROVIDER",
    sourceReferences: [`temporalComparison:${comparison.comparisonId}`],
    evidenceIds: supportingEvidenceIds,
    comparedEvidenceIds: supportingEvidenceIds,
    findingIds: [comparison.comparisonId],
    geographyId,
    lineage,
    limitations: ["Temporal interpretation remains AI_GENERATED and requires human review."],
  });
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
    sourceEvidenceId: comparison.sourceEvidenceId || primaryEvidence?.sourceEvidenceId || primaryEvidence?.id,
    geographyId,
    supportingEvidenceIds,
    lineage,
    lineageStatus: lineageValidation.status,
    evidenciaId: primaryEvidence?.sourceEvidenceId || primaryEvidence?.id,
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
    aiAnalyticalOutput,
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
