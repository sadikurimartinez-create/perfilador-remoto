import {
  createAiAnalyticalOutput,
  hashAiPrompt,
  type AiAnalyticalOutput,
  type AiAnalyticalOutputType,
} from "@/utils/aiAnalysisGovernance";

export type ContextualizationReviewMode =
  | "rss-news"
  | "hypothesis-qa"
  | "validate-photos"
  | "suggest"
  | "audit"
  | "multimodal-sweep"
  | "default";

export type ContextualizationReviewClass =
  | "SUPERVISION"
  | "REWRITE"
  | "VALIDATION"
  | "SYNTHESIS"
  | "CONTEXTUALIZATION"
  | "OTHER";

export type ContextualizationHumanDecisionStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "PARTIALLY_ACCEPTED";

export interface ContextualizationReviewLedger {
  ledgerId: string;
  expedienteId: string;
  geographyId?: string | null;
  sourceEvidenceId?: string | null;
  traceabilityId?: string | null;
  contextType: ContextualizationReviewClass;
  mode: ContextualizationReviewMode | string;
  originalHumanText: string;
  aiReview: {
    output: AiAnalyticalOutput | null;
    observations: string;
    suggestedText?: string | null;
  };
  humanDecision: {
    status: ContextualizationHumanDecisionStatus;
    decidedBy?: string | null;
    decidedAt?: string | null;
    rationale?: string | null;
  };
  finalHumanText?: string | null;
  technicalStatus: "COMPLETED" | "FAILED";
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

export function classifyContextualizationMode(mode?: string | null): ContextualizationReviewClass {
  if (mode === "hypothesis-qa") return "SUPERVISION";
  if (mode === "validate-photos") return "VALIDATION";
  if (mode === "rss-news") return "SYNTHESIS";
  if (mode === "suggest") return "REWRITE";
  if (mode === "audit") return "SUPERVISION";
  if (mode === "multimodal-sweep") return "SYNTHESIS";
  return "CONTEXTUALIZATION";
}

export function outputTypeForContextualizationMode(mode?: string | null): AiAnalyticalOutputType {
  if (mode === "hypothesis-qa") return "HYPOTHESIS_SUGGESTION";
  if (mode === "rss-news") return "SUMMARY";
  if (mode === "validate-photos" || mode === "audit") return "ANALYSIS";
  return "RECOMMENDATION";
}

export function createContextualizationAiReview(input: {
  mode?: string | null;
  provider?: string | null;
  model?: string | null;
  prompt: string;
  promptId?: string | null;
  promptVersion?: string | null;
  inputIds?: Array<string | null | undefined>;
  evidenceIds?: Array<string | null | undefined>;
  findingIds?: Array<string | null | undefined>;
  inferenceIds?: Array<string | null | undefined>;
  geographyId?: string | null;
  sourceReferences?: Array<string | null | undefined>;
  limitations?: string[];
}) {
  return createAiAnalyticalOutput({
    outputType: outputTypeForContextualizationMode(input.mode),
    provider: input.provider,
    model: input.model,
    promptHash: hashAiPrompt(input.prompt || ""),
    promptVersion: input.promptVersion || "ADR-024.2:refine-context:v1",
    promptId: input.promptId || `refine-context:${input.mode || "default"}`,
    inputIds: uniq(input.inputIds || []),
    confidenceSource: "UNKNOWN",
    sourceReferences: input.sourceReferences || ["src/app/api/refine-context/route.ts", `mode:${input.mode || "default"}`],
    evidenceIds: uniq(input.evidenceIds || []),
    findingIds: uniq(input.findingIds || []),
    inferenceIds: uniq(input.inferenceIds || []),
    geographyId: input.geographyId,
    limitations: input.limitations || [],
  });
}

export function createContextualizationReviewLedger(input: {
  expedienteId?: string | null;
  geographyId?: string | null;
  sourceEvidenceId?: string | null;
  traceabilityId?: string | null;
  mode?: string | null;
  originalHumanText?: string | null;
  aiReview?: AiAnalyticalOutput | null;
  observations?: string | null;
  suggestedText?: string | null;
  technicalStatus?: "COMPLETED" | "FAILED";
  failureReason?: string | null;
  createdAt?: string;
}): ContextualizationReviewLedger {
  const createdAt = input.createdAt || new Date().toISOString();
  const mode = input.mode || "default";
  const originalHumanText = input.originalHumanText || "";
  const ledgerId = `ctx-ledger-${stableHash([
    input.expedienteId || "",
    input.geographyId || "",
    input.sourceEvidenceId || "",
    input.traceabilityId || "",
    mode,
    originalHumanText,
    createdAt,
  ].join("|"))}`;

  return {
    ledgerId,
    expedienteId: input.expedienteId || "UNAVAILABLE",
    geographyId: input.geographyId ?? null,
    sourceEvidenceId: input.sourceEvidenceId ?? null,
    traceabilityId: input.traceabilityId ?? null,
    contextType: classifyContextualizationMode(mode),
    mode,
    originalHumanText,
    aiReview: {
      output: input.aiReview || null,
      observations: input.observations || "",
      suggestedText: input.suggestedText ?? null,
    },
    humanDecision: {
      status: "PENDING_REVIEW",
      decidedBy: null,
      decidedAt: null,
      rationale: null,
    },
    finalHumanText: null,
    technicalStatus: input.technicalStatus || "COMPLETED",
    failureReason: input.failureReason ?? null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function applyHumanContextualizationDecision(
  ledger: ContextualizationReviewLedger,
  decision: {
    status: Exclude<ContextualizationHumanDecisionStatus, "PENDING_REVIEW">;
    decidedBy?: string | null;
    decidedAt?: string | null;
    rationale?: string | null;
    finalHumanText?: string | null;
  }
): ContextualizationReviewLedger {
  const decidedAt = decision.decidedAt || new Date().toISOString();
  const finalHumanText =
    decision.status === "ACCEPTED"
      ? decision.finalHumanText ?? ledger.aiReview.suggestedText ?? ledger.originalHumanText
      : decision.status === "REJECTED"
        ? decision.finalHumanText ?? ledger.originalHumanText
        : decision.finalHumanText ?? null;

  return {
    ...ledger,
    originalHumanText: ledger.originalHumanText,
    humanDecision: {
      status: decision.status,
      decidedBy: decision.decidedBy ?? null,
      decidedAt,
      rationale: decision.rationale ?? null,
    },
    finalHumanText,
    updatedAt: decidedAt,
  };
}
