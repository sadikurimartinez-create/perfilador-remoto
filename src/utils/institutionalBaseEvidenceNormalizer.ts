import {
  validateInstitutionalEvidenceTraceability,
  type InstitutionalEvidenceTraceabilityResult,
} from "@/utils/institutionalEvidenceTraceabilityGuard";
import { buildEvidenceLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import { buildGeointTraceabilityId } from "@/types/geointGovernance";

export type InstitutionalBaseEvidenceClass =
  | "INSTITUTIONAL_EVIDENCE"
  | "CONTEXTUAL_EVIDENCE";

export interface InstitutionalBaseEvidenceInput {
  id?: string | null;
  evidenceId?: string | null;
  sourceEvidenceId?: string | null;
  traceabilityId?: string | null;
  expedienteId?: string | null;
  projectId?: string | null;
  geographyId?: string | null;
  geographyType?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  coordinates?: { lat?: number | string | null; lng?: number | string | null } | null;
  lineage?: CanonicalLineageNode[] | null;
  lineageStatus?: LineageStatus | "COMPLETE" | "PARTIAL" | "LEGACY_PARTIAL" | "UNAVAILABLE" | null;
  legacy?: boolean;
}

export interface InstitutionalBaseEvidenceNormalizationResult {
  evidenceClass: InstitutionalBaseEvidenceClass;
  traceability: InstitutionalEvidenceTraceabilityResult;
  fields: {
    evidenceId: string | null;
    sourceEvidenceId: string | null;
    traceabilityId: string | null;
    expedienteId: string | null;
    geographyId: string | null;
    coordinates: { lat: number; lng: number } | null;
    lineage: CanonicalLineageNode[];
    lineageStatus: LineageStatus | "COMPLETE" | "PARTIAL" | "LEGACY_PARTIAL" | "UNAVAILABLE";
  };
}

function present(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function resolveCoordinates(input: InstitutionalBaseEvidenceInput): { lat: number; lng: number } | null {
  const rawLat = input.coordinates?.lat ?? input.lat;
  const rawLng = input.coordinates?.lng ?? input.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function normalizeInstitutionalBaseEvidence(
  input: InstitutionalBaseEvidenceInput
): InstitutionalBaseEvidenceNormalizationResult {
  const evidenceId = present(input.evidenceId) ?? present(input.id);
  const sourceEvidenceId = present(input.sourceEvidenceId) ?? evidenceId;
  const expedienteId = present(input.expedienteId) ?? present(input.projectId);
  const geographyId = present(input.geographyId);
  const coordinates = resolveCoordinates(input);
  const traceabilityId =
    present(input.traceabilityId) ||
    buildGeointTraceabilityId("trace-evidence", [
      expedienteId || "NO_EXPEDIENTE",
      sourceEvidenceId || "NO_SOURCE_EVIDENCE",
      geographyId || "NO_GEOGRAPHY",
    ]);

  const lineage =
    input.lineage && input.lineage.length > 0
      ? input.lineage
      : evidenceId
        ? buildEvidenceLineage({
            sourceId: sourceEvidenceId,
            sourceReference: sourceEvidenceId,
            geographyId,
            geographyType: input.geographyType ?? null,
            evidenceId,
          })
        : [];

  const lineageStatus =
    input.lineageStatus ||
    (evidenceId && sourceEvidenceId && geographyId && expedienteId && coordinates ? "SUPPORTED" : "LEGACY_UNCLASSIFIED");

  const traceability = validateInstitutionalEvidenceTraceability({
    traceabilityId,
    sourceEvidenceId,
    geographyId,
    expedienteId,
    lineageStatus,
    coordinates,
    lineage,
    legacy: input.legacy || lineageStatus === "LEGACY_UNCLASSIFIED",
  });

  return {
    evidenceClass: traceability.eligible ? "INSTITUTIONAL_EVIDENCE" : "CONTEXTUAL_EVIDENCE",
    traceability,
    fields: {
      evidenceId,
      sourceEvidenceId,
      traceabilityId,
      expedienteId,
      geographyId,
      coordinates,
      lineage,
      lineageStatus,
    },
  };
}
