import type {
  MultisourceOrchestrationItem,
  SourceAuthorityClassification,
  SourceIntegrityClassification,
} from "@/types/multisourceOrchestration";
import { evaluateSourceEligibility } from "@/services/geoint/multisourceOrchestrationService";

type AcquisitionStatus =
  | "ACQUIRED"
  | "NO_DATA"
  | "NOT_CONFIGURED"
  | "FAILED"
  | string;

export interface ProductiveSourceIntegrityInput {
  sourceId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  sourceType?: string | null;
  acquisitionMode?: string | null;
  acquisitionStatus?: AcquisitionStatus | null;
  semanticRole?: string | null;
  isSimulated?: boolean | null;
  sourceReference?: string | null;
  rawSourceReference?: string | null;
  query?: string | null;
  resultCount?: number | null;
}

export interface DenueScinceOrchestrationInput {
  expedienteId?: string | null;
  integrity?: ProductiveSourceIntegrityInput | null;
}

export function canAdmitSourceToInstitutionalContext(
  item: MultisourceOrchestrationItem | null | undefined
): boolean {
  return Boolean(item && item.eligibility === "ELIGIBLE");
}

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function cleanToken(value: string | undefined): string {
  return value ? encodeURIComponent(value) : "UNAVAILABLE";
}

function technicalDescriptorId(
  sourceType: string | undefined,
  sourceId: string | undefined,
  query: string | undefined
): string {
  return ['ADR021', 'SOURCE', cleanToken(sourceType), cleanToken(sourceId), cleanToken(query)].join(':');
}

function classifyAuthority(
  integrity: ProductiveSourceIntegrityInput
): SourceAuthorityClassification {
  const sourceId = present(integrity.sourceId)?.toUpperCase();
  const providerId = present(integrity.providerId)?.toUpperCase();
  const sourceType = present(integrity.sourceType)?.toUpperCase();
  const acquisitionMode = present(integrity.acquisitionMode)?.toUpperCase();

  if (
    integrity.isSimulated === true ||
    acquisitionMode === "SIMULATED" ||
    sourceId === "SCINCE_LOCAL_SIMULATOR" ||
    providerId === "SCINCE_LOCAL_SIMULATOR"
  ) {
    return "SIMULATED";
  }

  if (
    sourceType === "DENUE" &&
    sourceId === "INEGI-DENUE-API" &&
    providerId === "INEGI_DENUE" &&
    acquisitionMode === "OBSERVED"
  ) {
    return "AUTHORITATIVE";
  }

  return "UNKNOWN";
}

function classifyIntegrity(
  integrity: ProductiveSourceIntegrityInput,
  authority: SourceAuthorityClassification
): SourceIntegrityClassification {
  if (authority === "SIMULATED") return "SIMULATED";

  const status = present(integrity.acquisitionStatus)?.toUpperCase();

  if (authority === "AUTHORITATIVE" && (status === "ACQUIRED" || status === "NO_DATA")) {
    return "VERIFIED";
  }

  if (status === "NOT_CONFIGURED" || status === "FAILED") {
    return "NOT_READY";
  }

  return "UNKNOWN";
}

export function adaptDenueScinceSource(
  input: DenueScinceOrchestrationInput
): MultisourceOrchestrationItem | null {
  const integrity = input.integrity;
  if (!integrity) return null;

  const sourceId = present(integrity.sourceId);
  const providerId = present(integrity.providerId);
  const sourceType = present(integrity.sourceType);
  const sourceReference = present(integrity.sourceReference);
  const rawSourceReference = present(integrity.rawSourceReference);
  const query = present(integrity.query);

  if (!sourceType || !sourceId) return null;

  if (sourceType !== "DENUE" && sourceType !== "SCINCE") return null;

  const authorityClassification = classifyAuthority(integrity);
  const integrityClassification = classifyIntegrity(integrity, authorityClassification);
  const descriptorId = technicalDescriptorId(sourceType, sourceId, query);

  const source = {
    descriptorId,
    sourceType,
    sourceId,
    ...(providerId ? { providerId } : {}),
    sourceFamily: sourceType === "DENUE" ? "INEGI_DENUE" : "SCINCE",
    ...(sourceReference ? { sourceReference } : {}),
    ...(rawSourceReference ? { rawSourceReference } : {}),
    authorityClassification,
    integrityClassification,
  };

  return {
    itemId: descriptorId,
    source,
    eligibility: evaluateSourceEligibility(source),
  };
}
