import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";
import type {
  InstitutionalSourceEligibility,
  MultisourceOrchestrationItem,
  SourceAuthorityClassification,
  SourceDependencyType,
  SourceIntegrityClassification,
} from "@/types/multisourceOrchestration";

export interface OsintCanonicalOrchestrationInput {
  expedienteId?: string | null;
  integrity?: Partial<EpistemicIntegrityMetadata> | null;
}

export interface OsintMultisourceOrchestrationItem extends MultisourceOrchestrationItem {
  dependencyClassification: SourceDependencyType;
}

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalized(value: string | null | undefined): string | undefined {
  return present(value)?.toUpperCase();
}

function cleanToken(value: string | undefined): string {
  return value ? encodeURIComponent(value) : "UNAVAILABLE";
}

function technicalDescriptorId(
  sourceType: string,
  sourceId: string,
  reference: string | undefined
): string {
  return ["ADR021", "OSINT", cleanToken(sourceType), cleanToken(sourceId), cleanToken(reference)].join(":");
}

export function adaptOsintSource(
  input: OsintCanonicalOrchestrationInput
): OsintMultisourceOrchestrationItem | null {
  const integrity = input.integrity;
  if (!integrity) return null;

  const sourceId = present(integrity.sourceId);
  const providerId = present(integrity.providerId);
  const sourceType = present(integrity.sourceType);
  const sourceReference = present(integrity.sourceReference);
  const rawSourceReference = present(integrity.rawSourceReference);
  const query = present(integrity.query);

  if (!sourceType || !sourceId) return null;

  const providerToken = normalized(providerId);
  const sourceTypeToken = normalized(sourceType);
  const acquisitionMode = normalized(integrity.acquisitionMode);
  const semanticRole = normalized(integrity.semanticRole);
  const isGeminiTelegramSynthesis =
    providerToken === "GEMINI" &&
    sourceTypeToken === "TELEGRAM_CONTEXT" &&
    acquisitionMode === "AI_GENERATED" &&
    semanticRole === "SYNTHESIS";
  const isTelegramDirectLegacy =
    providerToken === "TELEGRAM" && sourceTypeToken === "TELEGRAM_DIRECT_OBSERVATION";
  const isConnectivity =
    sourceTypeToken === "FACEBOOK_CONNECTIVITY" || sourceTypeToken === "INSTAGRAM_CONNECTIVITY";

  let authorityClassification: SourceAuthorityClassification = "UNKNOWN";
  let integrityClassification: SourceIntegrityClassification = "UNKNOWN";
  let dependencyClassification: SourceDependencyType = "UNKNOWN_DEPENDENCY";
  let eligibility: InstitutionalSourceEligibility = "LIMITED";

  if (isGeminiTelegramSynthesis) {
    authorityClassification = "NON_AUTHORITATIVE";
    integrityClassification = "READY_WITH_LIMITATIONS";
    dependencyClassification = "DERIVED";
    eligibility = "LIMITED";
  } else if (isTelegramDirectLegacy) {
    authorityClassification = "LEGACY_UNCLASSIFIED";
    integrityClassification = "READY_WITH_LIMITATIONS";
    dependencyClassification = "UNKNOWN_DEPENDENCY";
    eligibility = "LIMITED";
  } else if (isConnectivity) {
    authorityClassification = "NON_AUTHORITATIVE";
    integrityClassification = "NOT_READY";
    dependencyClassification = "UNKNOWN_DEPENDENCY";
    eligibility = "INELIGIBLE";
  }

  const descriptorId = technicalDescriptorId(
    sourceType,
    sourceId,
    query || rawSourceReference || sourceReference
  );
  const source = {
    descriptorId,
    sourceType,
    sourceId,
    ...(providerId ? { providerId } : {}),
    ...(sourceReference ? { sourceReference } : {}),
    ...(rawSourceReference ? { rawSourceReference } : {}),
    authorityClassification,
    integrityClassification,
  };

  return {
    itemId: descriptorId,
    source,
    eligibility,
    dependencyClassification,
  };
}
