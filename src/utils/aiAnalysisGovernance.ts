import type { AcquisitionMode, EpistemicValidationStatus } from "@/types/epistemicIntegrity";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";

export type AiAnalyticalOutputType =
  | "INFERENCE"
  | "ANALYSIS"
  | "HYPOTHESIS_SUGGESTION"
  | "CONCLUSION_SUGGESTION"
  | "SUMMARY"
  | "ALERT"
  | "RECOMMENDATION";

export type AiEpistemicClass = "AI_GENERATED" | "LEGACY_UNCLASSIFIED";
export type AiConfidenceValue = number | "UNKNOWN" | "UNAVAILABLE";

export interface AiAnalyticalOutput {
  outputId: string;
  outputType: AiAnalyticalOutputType;
  acquisitionMode: AcquisitionMode;
  epistemicClass: AiEpistemicClass;
  promptHash?: string | null;
  promptVersion?: string | null;
  promptId?: string | null;
  inputIds?: string[];
  confidence: AiConfidenceValue;
  sourceReferences: string[];
  evidenceIds: string[];
  findingIds: string[];
  inferenceIds: string[];
  derivedFromFindingIds?: string[];
  supportingFindingIds?: string[];
  supportingInferenceIds?: string[];
  comparedEvidenceIds?: string[];
  geographyId?: string | null;
  lineage?: CanonicalLineageNode[];
  lineageStatus: LineageStatus;
  validationStatus: EpistemicValidationStatus;
  generatedAt: string;
  generatedBy: string;
  limitations: string[];
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

export const GENERATE_PROFILE_PROMPT_VERSION = "ADR-024.1:generate-profile:v1";

export function hashAiPrompt(prompt: string): string {
  return `prompt-${stableHash(prompt)}`;
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function normalizeConfidence(input: {
  confidence?: unknown;
  confidenceSource?: "PROVIDER" | "DETERMINISTIC_RULE" | "VALIDATED_RULE" | "HARDCODED" | "SYNTHETIC" | "UNKNOWN";
}): AiConfidenceValue {
  const source = input.confidenceSource || "UNKNOWN";
  if (source === "HARDCODED" || source === "SYNTHETIC" || source === "UNKNOWN") return "UNKNOWN";
  if (typeof input.confidence === "number" && Number.isFinite(input.confidence)) {
    return input.confidence > 1 ? Math.max(0, Math.min(100, input.confidence)) : Math.max(0, Math.min(1, input.confidence));
  }
  return "UNAVAILABLE";
}

function inferLineageStatus(params: {
  outputType: AiAnalyticalOutputType;
  lineage?: CanonicalLineageNode[];
  evidenceIds: string[];
  findingIds: string[];
  inferenceIds: string[];
}) {
  if (params.lineage && params.lineage.length > 0) return validateLineage(params.lineage).status;
  if (params.outputType === "INFERENCE") return params.findingIds.length > 0 || params.evidenceIds.length > 0 ? "SUPPORTED" : "UNSUPPORTED";
  if (params.outputType === "ANALYSIS") return params.findingIds.length > 0 || params.inferenceIds.length > 0 ? "SUPPORTED" : "UNSUPPORTED";
  if (params.outputType === "CONCLUSION_SUGGESTION") return params.findingIds.length > 0 || params.inferenceIds.length > 0 ? "PARTIALLY_SUPPORTED" : "UNSUPPORTED";
  return "LEGACY_UNCLASSIFIED";
}

export function createAiAnalyticalOutput(input: {
  outputType: AiAnalyticalOutputType;
  outputId?: string | null;
  provider?: string | null;
  model?: string | null;
  promptHash?: string | null;
  promptVersion?: string | null;
  promptId?: string | null;
  inputIds?: Array<string | null | undefined>;
  confidence?: unknown;
  confidenceSource?: "PROVIDER" | "DETERMINISTIC_RULE" | "VALIDATED_RULE" | "HARDCODED" | "SYNTHETIC" | "UNKNOWN";
  sourceReferences?: Array<string | null | undefined>;
  evidenceIds?: Array<string | null | undefined>;
  findingIds?: Array<string | null | undefined>;
  inferenceIds?: Array<string | null | undefined>;
  comparedEvidenceIds?: Array<string | null | undefined>;
  geographyId?: string | null;
  lineage?: CanonicalLineageNode[];
  validationStatus?: EpistemicValidationStatus;
  generatedAt?: string;
  limitations?: string[];
}): AiAnalyticalOutput {
  const sourceReferences = uniq(input.sourceReferences || []);
  const evidenceIds = uniq(input.evidenceIds || []);
  const findingIds = uniq(input.findingIds || []);
  const inferenceIds = uniq(input.inferenceIds || []);
  const comparedEvidenceIds = uniq(input.comparedEvidenceIds || []);
  const inputIds = uniq(input.inputIds || []);
  const generatedAt = input.generatedAt || new Date().toISOString();
  const providerModel = [input.provider, input.model].filter(Boolean).join("/");
  const generatedBy = providerModel || "UNAVAILABLE";
  const outputId = input.outputId || `ai-output-${stableHash([
    input.outputType,
    generatedBy,
    input.promptHash || "",
    input.promptVersion || "",
    input.promptId || "",
    inputIds.join(","),
    sourceReferences.join(","),
    evidenceIds.join(","),
    findingIds.join(","),
    inferenceIds.join(","),
    input.geographyId || "",
    generatedAt,
  ].join("|"))}`;
  const lineageStatus = inferLineageStatus({
    outputType: input.outputType,
    lineage: input.lineage,
    evidenceIds,
    findingIds,
    inferenceIds,
  });

  return {
    outputId,
    outputType: input.outputType,
    acquisitionMode: "AI_GENERATED",
    epistemicClass: "AI_GENERATED",
    promptHash: input.promptHash ?? null,
    promptVersion: input.promptVersion ?? null,
    promptId: input.promptId ?? null,
    inputIds,
    confidence: normalizeConfidence(input),
    sourceReferences,
    evidenceIds,
    findingIds,
    inferenceIds,
    derivedFromFindingIds: input.outputType === "INFERENCE" ? findingIds : undefined,
    supportingFindingIds: input.outputType === "ANALYSIS" || input.outputType === "CONCLUSION_SUGGESTION" ? findingIds : undefined,
    supportingInferenceIds: input.outputType === "ANALYSIS" || input.outputType === "CONCLUSION_SUGGESTION" ? inferenceIds : undefined,
    comparedEvidenceIds,
    geographyId: input.geographyId ?? null,
    lineage: input.lineage,
    lineageStatus,
    validationStatus: input.validationStatus || "PENDING_REVIEW",
    generatedAt,
    generatedBy,
    limitations: input.limitations || [],
  };
}

export function createGenerateProfileAiAnalyticalOutput(input: {
  outputType?: AiAnalyticalOutputType;
  provider?: string | null;
  model?: string | null;
  prompt: string;
  promptId?: string | null;
  promptVersion?: string | null;
  inputIds?: Array<string | null | undefined>;
  sourceReferences?: Array<string | null | undefined>;
  evidenceIds?: Array<string | null | undefined>;
  findingIds?: Array<string | null | undefined>;
  inferenceIds?: Array<string | null | undefined>;
  geographyId?: string | null;
  lineage?: CanonicalLineageNode[];
  validationStatus?: EpistemicValidationStatus;
  generatedAt?: string;
  limitations?: string[];
}): AiAnalyticalOutput {
  const evidenceIds = uniq(input.evidenceIds || []);
  const findingIds = uniq(input.findingIds || []);
  const inferenceIds = uniq(input.inferenceIds || []);
  const inputIds = uniq(input.inputIds || []);
  const hasLineageSignal =
    Boolean(input.lineage && input.lineage.length > 0) ||
    evidenceIds.length > 0 ||
    findingIds.length > 0 ||
    inferenceIds.length > 0 ||
    inputIds.length > 0;

  return createAiAnalyticalOutput({
    outputType: input.outputType || "ANALYSIS",
    provider: input.provider,
    model: input.model,
    promptHash: hashAiPrompt(input.prompt || ""),
    promptVersion: input.promptVersion || GENERATE_PROFILE_PROMPT_VERSION,
    promptId: input.promptId || "generate-profile",
    inputIds,
    confidenceSource: "UNKNOWN",
    sourceReferences: input.sourceReferences,
    evidenceIds,
    findingIds,
    inferenceIds,
    geographyId: input.geographyId,
    lineage: input.lineage,
    validationStatus: input.validationStatus,
    generatedAt: input.generatedAt,
    limitations: hasLineageSignal
      ? input.limitations || []
      : uniq([...(input.limitations || []), "INPUT_LINEAGE_INSUFFICIENT"]),
  });
}

export function approveAiAnalyticalOutput(output: AiAnalyticalOutput, validation: { validatedBy?: any | null; validatedAt?: string | null }) {
  const humanValidation = evaluateHumanValidation({
    humanValidationStatus: "APPROVED",
    validatedBy: validation.validatedBy,
    validatedAt: validation.validatedAt,
  });
  return {
    ...output,
    acquisitionMode: "AI_GENERATED" as const,
    epistemicClass: "AI_GENERATED" as const,
    validationStatus: humanValidation.status,
  };
}

export function applyAiHypothesisSuggestion(currentHumanHypothesis: string, suggestion: AiAnalyticalOutput) {
  return {
    humanHypothesis: currentHumanHypothesis,
    aiSuggestion: suggestion.outputType === "HYPOTHESIS_SUGGESTION" ? suggestion : null,
    overwritten: false,
  };
}

export function isObservedFact(output: AiAnalyticalOutput): false {
  return false;
}

export function canPromoteToFinding(output: AiAnalyticalOutput): false {
  return false;
}

export function legacyAiOutput(input: Record<string, unknown>): AiAnalyticalOutput {
  return {
    outputId: String(input.outputId || `legacy-ai-output-${stableHash(JSON.stringify(input))}`),
    outputType: "SUMMARY",
    acquisitionMode: "LEGACY",
    epistemicClass: "LEGACY_UNCLASSIFIED",
    confidence: "UNKNOWN",
    sourceReferences: [],
    evidenceIds: [],
    findingIds: [],
    inferenceIds: [],
    geographyId: null,
    lineageStatus: "LEGACY_UNCLASSIFIED",
    validationStatus: "LEGACY_UNCLASSIFIED",
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "UNAVAILABLE",
    generatedBy: typeof input.generatedBy === "string" ? input.generatedBy : "UNAVAILABLE",
    limitations: ["LEGACY_AI_OUTPUT_WITHOUT_EPISTEMIC_METADATA"],
  };
}
