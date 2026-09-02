import { adaptEvidence } from "@/services/geoint/canonicalEvidenceRegistry";
import type { CanonicalEvidenceRef } from "@/types/canonicalEvidenceRegistry";
import type { MultisourceOrchestrationItem } from "@/types/multisourceOrchestration";
import { evaluateSourceEligibility } from "@/services/geoint/multisourceOrchestrationService";

export interface InSituPhotoCanonicalInput {
  expedienteId?: string | null;
  photoId: string;
  evidenceId?: string | null;
  sourceEvidenceId?: string | null;
  geographyId?: string | null;
  gpsSource?: string | null;
  validado?: boolean | null;
  legacy?: boolean;
}

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

const FIELD_PHOTO_GPS_SOURCES = new Set([
  "VALIDACION_CRUZADA_DEVICE_PRIORITY",
  "VALIDACION_CRUZADA_EXIF_PRIORITY",
  "DISCREPANCIA_DEVICE_PRIORITY",
  "DISCREPANCIA_EXIF_PRIORITY",
  "SOLO_DEVICE_GPS",
  "SOLO_EXIF_GPS",
  "MANUAL",
]);

export interface InSituPhotoClassificationInput {
  gpsSource?: string | null;
  tipo?: string | null;
  evidenceType?: string | null;
  analysisType?: string | null;
  streetViewSource?: string | null;
}

export function isExplicitInSituPhoto(
  input: InSituPhotoClassificationInput
): boolean {
  const gpsSource = present(input.gpsSource)?.toUpperCase();
  const tipo = present(input.tipo)?.toUpperCase();
  const evidenceType = present(input.evidenceType)?.toUpperCase();
  const analysisType = present(input.analysisType)?.toUpperCase();
  const streetViewSource = present(input.streetViewSource)?.toUpperCase();

  if (evidenceType === "GEOGRAPHIC_VECTOR") return false;
  if (tipo === "STREET_VIEW") return false;
  if (analysisType === "STREET_VIEW") return false;
  if (gpsSource === "STREET_VIEW") return false;
  if (streetViewSource) return false;

  return Boolean(gpsSource && FIELD_PHOTO_GPS_SOURCES.has(gpsSource));
}

export function deriveInSituPhotoCanonicalEvidence(
  input: InSituPhotoCanonicalInput
): CanonicalEvidenceRef | null {
  const photoId = present(input.photoId);
  if (!photoId) return null;

  return adaptEvidence({
    expedienteId: input.expedienteId,
    nativeEvidenceId: photoId,
    nativeType: "FIELD_PHOTO_EVIDENCE",
    sourceType: "FIELD_PHOTO",
    sourceId: input.sourceEvidenceId,
    geographyId: input.geographyId,
    legacy: input.legacy || !present(input.sourceEvidenceId),
  });
}

export function deriveInSituPhotoOrchestrationItem(
  input: InSituPhotoCanonicalInput
): MultisourceOrchestrationItem | null {
  const evidenceRef = deriveInSituPhotoCanonicalEvidence(input);
  if (!evidenceRef) return null;

  const source = {
    descriptorId: evidenceRef.registryRefId,
    sourceType: "FIELD_PHOTO",
    sourceId: present(input.sourceEvidenceId),
    sourceFamily: "FIELD_CAPTURE",
    sourceReference: present(input.evidenceId),
    rawSourceReference: present(input.photoId),
    authorityClassification:
      evidenceRef.lineageStatus === "COMPLETE"
        ? "AUTHORITATIVE" as const
        : "LEGACY_UNCLASSIFIED" as const,
    integrityClassification:
      input.validado === true && evidenceRef.lineageStatus === "COMPLETE"
        ? "VERIFIED" as const
        : "READY_WITH_LIMITATIONS" as const,
  };

  return {
    itemId: evidenceRef.registryRefId,
    evidenceRef,
    source,
    eligibility: evaluateSourceEligibility(source),
  };
}
