import { adaptEvidence } from "@/services/geoint/canonicalEvidenceRegistry";
import { evaluateSourceEligibility } from "@/services/geoint/multisourceOrchestrationService";

import {
  buildSweepGeographyContext,
  getCanonicalMapViewport,
  type CanonicalProjectGeography,
  type SweepGeographyContext,
} from "@/utils/canonicalProjectGeography";

import type {
  MultisourceOrchestrationItem,
} from "@/types/multisourceOrchestration";

export interface PandillasStreetViewEvidenceInput {
  id: string;
  evidenceId?: string | null;
  sourceEvidenceId?: string | null;
  geographyId?: string | null;
  evidenceType?: string | null;
  tipo?: string | null;
  analysisType?: string | null;
  gpsSource?: string | null;
  streetViewSource?: string | null;
  sourceProvider?: string | null;
  isStreetView?: boolean | null;
  validado?: boolean | null;
}

export interface PandillasCanonicalInput {
  projectId: string;
  canonicalGeography: CanonicalProjectGeography | null | undefined;
  inSituOrchestrationItems?: MultisourceOrchestrationItem[] | null;
  streetViewItems?: PandillasStreetViewEvidenceInput[] | null;
  radiusMeters?: number;
}

export interface PandillasCanonicalEvidenceSummary {
  total: number;
  eligible: number;
  limited: number;
  ineligible: number;
}

export interface PandillasCanonicalAdaptedInput {
  projectId: string;
  geographyId: string;
  geographyType: CanonicalProjectGeography["type"];
  geography: SweepGeographyContext;
  representativePoint: {
    lat: number;
    lng: number;
    derived: true;
  };
  inSituEvidence: MultisourceOrchestrationItem[];
  streetViewEvidence: MultisourceOrchestrationItem[];
  inSituEvidenceSummary: PandillasCanonicalEvidenceSummary;
  streetViewEvidenceSummary: PandillasCanonicalEvidenceSummary;
}

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizedProjectId(value: string): string {
  return String(value || "").trim();
}

function normalizedToken(value: string | null | undefined): string | undefined {
  return present(value)?.toUpperCase();
}

function summarizeEvidence(
  items: MultisourceOrchestrationItem[]
): PandillasCanonicalEvidenceSummary {
  return {
    total: items.length,
    eligible: items.filter((item) => item.eligibility === "ELIGIBLE").length,
    limited: items.filter((item) => item.eligibility === "LIMITED").length,
    ineligible: items.filter((item) => item.eligibility === "INELIGIBLE").length,
  };
}

export function isExplicitPandillasStreetViewEvidence(
  input: PandillasStreetViewEvidenceInput
): boolean {
  const evidenceType = normalizedToken(input.evidenceType);
  const tipo = normalizedToken(input.tipo);
  const analysisType = normalizedToken(input.analysisType);
  const gpsSource = normalizedToken(input.gpsSource);
  const sourceProvider = normalizedToken(input.sourceProvider);

  return Boolean(
    input.isStreetView === true ||
    evidenceType === "VIRTUAL_STREET_VIEW" ||
    tipo === "REMOTE_STREET_VIEW" ||
    tipo === "STREET_VIEW" ||
    analysisType === "STREET_VIEW" ||
    gpsSource === "STREET_VIEW" ||
    sourceProvider === "GOOGLE_STREET_VIEW" ||
    present(input.streetViewSource)
  );
}

export function derivePandillasStreetViewOrchestrationItem(
  projectId: string,
  canonicalGeography: CanonicalProjectGeography,
  input: PandillasStreetViewEvidenceInput
): MultisourceOrchestrationItem | null {
  if (!isExplicitPandillasStreetViewEvidence(input)) {
    return null;
  }

  const photoId = present(input.id);

  if (!photoId) {
    return null;
  }

  const evidenceGeographyId = present(input.geographyId);
  if (
    evidenceGeographyId &&
    evidenceGeographyId !== canonicalGeography.geographyId
  ) {
    throw new Error("PANDILLAS_STREET_VIEW_GEOGRAPHY_MISMATCH");
  }

  const evidenceRef = adaptEvidence({
    expedienteId: projectId,
    nativeEvidenceId: photoId,
    nativeType: "STREET_VIEW_EVIDENCE",
    sourceType: "STREET_VIEW",
    sourceId: present(input.sourceEvidenceId),
    geographyId: canonicalGeography.geographyId,
    legacy: !present(input.sourceEvidenceId),
  });

  if (!evidenceRef) {
    return null;
  }

  const source = {
    descriptorId: evidenceRef.registryRefId,
    sourceType: "STREET_VIEW",
    sourceId: present(input.sourceEvidenceId),
    providerId: present(input.sourceProvider),
    sourceFamily: "REMOTE_VISUAL",
    sourceReference: present(input.evidenceId),
    rawSourceReference: photoId,
    authorityClassification: "NON_AUTHORITATIVE" as const,
    integrityClassification:
      input.validado === true &&
      evidenceRef.lineageStatus === "COMPLETE"
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

export function adaptPandillasCanonicalInput(
  input: PandillasCanonicalInput
): PandillasCanonicalAdaptedInput {
  const projectId = normalizedProjectId(input.projectId);

  if (!projectId) {
    throw new Error("PANDILLAS_PROJECT_ID_REQUIRED");
  }

  const canonicalGeography = input.canonicalGeography;

  if (!canonicalGeography) {
    throw new Error("PANDILLAS_CANONICAL_GEOGRAPHY_REQUIRED");
  }

  if (canonicalGeography.validationStatus !== "VALID") {
    throw new Error("PANDILLAS_CANONICAL_GEOGRAPHY_NOT_VALID");
  }

  const geography = buildSweepGeographyContext(
    canonicalGeography,
    input.radiusMeters
  );

  const viewport = getCanonicalMapViewport(canonicalGeography);

  if (!viewport.center) {
    throw new Error("PANDILLAS_CANONICAL_REPRESENTATIVE_POINT_UNAVAILABLE");
  }

  const inSituEvidence = Array.isArray(input.inSituOrchestrationItems)
    ? [...input.inSituOrchestrationItems]
    : [];

  const streetViewEvidence = Array.isArray(input.streetViewItems)
    ? input.streetViewItems.flatMap((item) => {
        const adapted = derivePandillasStreetViewOrchestrationItem(
          projectId,
          canonicalGeography,
          item
        );

        return adapted ? [adapted] : [];
      })
    : [];

  return {
    projectId,
    geographyId: canonicalGeography.geographyId,
    geographyType: canonicalGeography.type,
    geography,
    representativePoint: {
      lat: viewport.center.lat,
      lng: viewport.center.lng,
      derived: true,
    },
    inSituEvidence,
    streetViewEvidence,
    inSituEvidenceSummary: summarizeEvidence(inSituEvidence),
    streetViewEvidenceSummary: summarizeEvidence(streetViewEvidence),
  };
}
