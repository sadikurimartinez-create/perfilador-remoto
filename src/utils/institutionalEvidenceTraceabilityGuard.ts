import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";

export type InstitutionalEvidenceTraceabilityStatus =
  | "INSTITUTIONAL_ELIGIBLE"
  | "CONTEXTUAL_ONLY"
  | "INSTITUTIONAL_INELIGIBLE";

export interface InstitutionalEvidenceTraceabilityInput {
  traceabilityId?: unknown;
  sourceEvidenceId?: unknown;
  evidenceId?: unknown;
  geographyId?: unknown;
  expedienteId?: unknown;
  projectId?: unknown;
  coordinates?: { lat?: unknown; lng?: unknown } | null;
  coordenadas?: { lat?: unknown; lng?: unknown } | null;
  lat?: unknown;
  lng?: unknown;
  lineage?: CanonicalLineageNode[] | null;
  lineageStatus?: LineageStatus | "COMPLETE" | "PARTIAL" | "LEGACY_PARTIAL" | "UNAVAILABLE" | null;
  evidenceOrigin?: unknown;
  evidenceCategoryClass?: unknown;
  sourceType?: unknown;
  sourceStatus?: unknown;
  acquisitionMode?: unknown;
  legacy?: unknown;
  [key: string]: unknown;
}

export interface InstitutionalEvidenceTraceabilityResult {
  eligible: boolean;
  status: InstitutionalEvidenceTraceabilityStatus;
  reasons: string[];
  missingFields: string[];
  invalidFields: string[];
  normalized: {
    traceabilityId: string | null;
    sourceEvidenceId: string | null;
    geographyId: string | null;
    expedienteId: string | null;
    coordinates: { lat: number; lng: number } | null;
    lineageStatus: string | null;
  };
}

const REQUIRED_FIELDS = [
  "traceabilityId",
  "sourceEvidenceId",
  "geographyId",
  "expedienteId",
  "lineageStatus",
  "coordinates",
] as const;

const INSTITUTIONAL_LINEAGE_STATUSES = new Set<string>([
  "SUPPORTED",
  "COMPLETE",
]);

const CONTEXTUAL_SOURCE_MARKERS = new Set<string>([
  "LEGACY",
  "LEGACY_UNCLASSIFIED",
  "LEGACY_PARTIAL",
  "MOCK",
  "SIMULATED",
  "NON_AUTHORITATIVE",
  "CONTEXTUAL",
]);

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveCoordinates(input: InstitutionalEvidenceTraceabilityInput): { lat: number; lng: number } | null {
  const rawLat = input.coordinates?.lat ?? input.coordenadas?.lat ?? input.lat;
  const rawLng = input.coordinates?.lng ?? input.coordenadas?.lng ?? input.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

function resolveLineageStatus(input: InstitutionalEvidenceTraceabilityInput): string | null {
  const explicit = present(input.lineageStatus);
  if (explicit) return explicit;
  if (Array.isArray(input.lineage) && input.lineage.length > 0) {
    return validateLineage(input.lineage).status;
  }
  return null;
}

function isContextualOnly(input: InstitutionalEvidenceTraceabilityInput): boolean {
  if (input.legacy === true) return true;
  const markers = [
    input.lineageStatus,
    input.sourceStatus,
    input.sourceType,
    input.acquisitionMode,
    input.evidenceOrigin,
    input.evidenceCategoryClass,
  ];
  return markers.some((marker) => CONTEXTUAL_SOURCE_MARKERS.has(String(marker || "").toUpperCase()));
}

export function validateInstitutionalEvidenceTraceability(
  input: InstitutionalEvidenceTraceabilityInput | null | undefined
): InstitutionalEvidenceTraceabilityResult {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (!input) {
    return {
      eligible: false,
      status: "INSTITUTIONAL_INELIGIBLE",
      reasons: ["missing evidence object"],
      missingFields: [...REQUIRED_FIELDS],
      invalidFields: [],
      normalized: {
        traceabilityId: null,
        sourceEvidenceId: null,
        geographyId: null,
        expedienteId: null,
        coordinates: null,
        lineageStatus: null,
      },
    };
  }

  const traceabilityId = present(input.traceabilityId);
  const sourceEvidenceId = present(input.sourceEvidenceId) ?? present(input.evidenceId);
  const geographyId = present(input.geographyId);
  const expedienteId = present(input.expedienteId) ?? present(input.projectId);
  const coordinates = resolveCoordinates(input);
  const lineageStatus = resolveLineageStatus(input);

  const normalized = {
    traceabilityId,
    sourceEvidenceId,
    geographyId,
    expedienteId,
    coordinates,
    lineageStatus,
  };

  if (!traceabilityId) missingFields.push("traceabilityId");
  if (!sourceEvidenceId) missingFields.push("sourceEvidenceId");
  if (!geographyId) missingFields.push("geographyId");
  if (!expedienteId) missingFields.push("expedienteId");
  if (!lineageStatus) missingFields.push("lineageStatus");
  if (!coordinates) missingFields.push("coordinates");

  if (lineageStatus && !INSTITUTIONAL_LINEAGE_STATUSES.has(lineageStatus)) {
    invalidFields.push("lineageStatus");
    reasons.push(`invalid lineageStatus: ${lineageStatus}`);
  }
  if (!coordinates) {
    invalidFields.push("coordinates");
    reasons.push("invalid coordinates");
  }

  for (const field of missingFields) {
    reasons.push(`missing ${field}`);
  }

  const contextualOnly = isContextualOnly(input);
  if (contextualOnly) {
    reasons.push("contextual evidence cannot be certified as institutional evidence");
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    status: eligible
      ? "INSTITUTIONAL_ELIGIBLE"
      : contextualOnly
        ? "CONTEXTUAL_ONLY"
        : "INSTITUTIONAL_INELIGIBLE",
    reasons,
    missingFields,
    invalidFields,
    normalized,
  };
}

export function isInstitutionalEvidenceTraceable(
  input: InstitutionalEvidenceTraceabilityInput | null | undefined
): boolean {
  return validateInstitutionalEvidenceTraceability(input).eligible;
}
