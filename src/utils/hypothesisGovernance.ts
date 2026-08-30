import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import type { CanonicalHumanValidationStatus } from "@/utils/humanValidationPolicy";
import { applyHumanValidationAction } from "@/utils/humanValidationPolicy";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";
import { validateLineage } from "@/utils/evidenceLineage";

export type HypothesisAuthorType = "HUMAN" | "AI_SUGGESTION";
export type HypothesisStatus =
  | "DRAFT"
  | "FORMULATED"
  | "UNDER_REVIEW"
  | "VALIDATED"
  | "REJECTED"
  | "SUPERSEDED"
  | "LEGACY_FORMULATED";
export type HypothesisSupportStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "UNSUPPORTED"
  | "INSUFFICIENT_DATA";

export interface HypothesisVersion {
  hypothesisId: string;
  text: string;
  authorType: HypothesisAuthorType;
  authorId?: string | null;
  createdAt?: string | null;
  status: HypothesisStatus;
  version: number;
  sourceAiOutputId?: string | null;
}

export interface CanonicalProjectHypothesis {
  hypothesisId: string;
  projectId: string;
  geographyId?: string | null;
  text: string;
  authorType: HypothesisAuthorType;
  authorId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status: HypothesisStatus;
  version: number;
  supportingEvidenceIds: string[];
  supportingFindingIds: string[];
  contradictingEvidenceIds: string[];
  contradictingFindingIds: string[];
  lineageStatus: LineageStatus;
  supportStatus: HypothesisSupportStatus;
  validationStatus: CanonicalHumanValidationStatus;
  validationSource?: string | null;
  validatedBy?: any | null;
  validatedAt?: string | null;
  lineage?: CanonicalLineageNode[];
  aiSuggestions?: AiAnalyticalOutput[];
  aiReviews?: AiAnalyticalOutput[];
  history: HypothesisVersion[];
  alternativeGroupId?: string | null;
  finalConclusionId?: string | null;
}

const FORMULATED_STATUSES = new Set<HypothesisStatus>([
  "FORMULATED",
  "UNDER_REVIEW",
  "VALIDATED",
  "LEGACY_FORMULATED",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).padStart(6, "0").slice(0, 8);
}

export function buildHypothesisId(projectId: string, version: number, text = ""): string {
  return `hyp-${simpleHash(`${projectId}:${version}:${text}`)}-v${version}`;
}

export function evaluateHypothesisSupport(input: Pick<
  CanonicalProjectHypothesis,
  "supportingEvidenceIds" | "supportingFindingIds" | "contradictingEvidenceIds" | "contradictingFindingIds" | "lineage" | "lineageStatus"
>): HypothesisSupportStatus {
  const contradictionCount = input.contradictingEvidenceIds.length + input.contradictingFindingIds.length;
  if (contradictionCount > 0) return "CONTRADICTED";

  const supportCount = input.supportingEvidenceIds.length + input.supportingFindingIds.length;
  if (supportCount === 0) return "INSUFFICIENT_DATA";

  const lineageStatus = input.lineage ? validateLineage(input.lineage).status : input.lineageStatus;
  if (lineageStatus === "BROKEN_REFERENCE" || lineageStatus === "UNSUPPORTED") return "UNSUPPORTED";
  if (lineageStatus === "PARTIALLY_SUPPORTED" || lineageStatus === "LEGACY_UNCLASSIFIED") return "PARTIALLY_SUPPORTED";
  return "SUPPORTED";
}

export function formulateHumanHypothesis(input: {
  projectId: string;
  text: string;
  geographyId?: string | null;
  authorId?: string | null;
  createdAt?: string | null;
  supportingEvidenceIds?: string[];
  supportingFindingIds?: string[];
  contradictingEvidenceIds?: string[];
  contradictingFindingIds?: string[];
  lineage?: CanonicalLineageNode[];
}): CanonicalProjectHypothesis {
  const text = normalizeText(input.text);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const lineageStatus = input.lineage ? validateLineage(input.lineage).status : "LEGACY_UNCLASSIFIED";
  const draft: CanonicalProjectHypothesis = {
    hypothesisId: buildHypothesisId(input.projectId, 1, text),
    projectId: input.projectId,
    geographyId: input.geographyId ?? null,
    text,
    authorType: "HUMAN",
    authorId: input.authorId ?? null,
    createdAt,
    updatedAt: createdAt,
    status: "FORMULATED",
    version: 1,
    supportingEvidenceIds: unique(input.supportingEvidenceIds || []),
    supportingFindingIds: unique(input.supportingFindingIds || []),
    contradictingEvidenceIds: unique(input.contradictingEvidenceIds || []),
    contradictingFindingIds: unique(input.contradictingFindingIds || []),
    lineageStatus,
    supportStatus: "INSUFFICIENT_DATA",
    validationStatus: "UNREVIEWED",
    validationSource: null,
    validatedBy: null,
    validatedAt: null,
    lineage: input.lineage || [],
    aiSuggestions: [],
    aiReviews: [],
    history: [],
    alternativeGroupId: null,
    finalConclusionId: null,
  };
  draft.supportStatus = evaluateHypothesisSupport(draft);
  draft.history = [toVersion(draft)];
  return draft;
}

function toVersion(hypothesis: CanonicalProjectHypothesis): HypothesisVersion {
  return {
    hypothesisId: hypothesis.hypothesisId,
    text: hypothesis.text,
    authorType: hypothesis.authorType,
    authorId: hypothesis.authorId ?? null,
    createdAt: hypothesis.updatedAt ?? hypothesis.createdAt ?? null,
    status: hypothesis.status,
    version: hypothesis.version,
  };
}

export function reviseHumanHypothesis(current: CanonicalProjectHypothesis, input: {
  text: string;
  authorId?: string | null;
  updatedAt?: string | null;
  sourceAiOutputId?: string | null;
}): CanonicalProjectHypothesis {
  const version = current.version + 1;
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const next: CanonicalProjectHypothesis = {
    ...current,
    hypothesisId: buildHypothesisId(current.projectId, version, input.text),
    text: normalizeText(input.text),
    authorType: "HUMAN",
    authorId: input.authorId ?? null,
    updatedAt,
    status: "FORMULATED",
    version,
    validationStatus: "UNREVIEWED",
    validationSource: null,
    validatedBy: null,
    validatedAt: null,
    finalConclusionId: null,
  };
  next.supportStatus = evaluateHypothesisSupport(next);
  next.history = [
    ...(current.history && current.history.length > 0 ? current.history : [toVersion(current)]),
    { ...toVersion(next), sourceAiOutputId: input.sourceAiOutputId ?? null },
  ];
  return next;
}

export function attachAiHypothesisSuggestion(
  current: CanonicalProjectHypothesis | null,
  suggestion: AiAnalyticalOutput
): CanonicalProjectHypothesis | null {
  if (!current) return null;
  return {
    ...current,
    aiSuggestions: [...(current.aiSuggestions || []), suggestion],
  };
}

export function acceptAiSuggestionAsHumanRevision(current: CanonicalProjectHypothesis, input: {
  suggestion: AiAnalyticalOutput;
  suggestedText: string;
  authorId?: string | null;
  acceptedAt?: string | null;
}): CanonicalProjectHypothesis {
  return reviseHumanHypothesis(current, {
    text: input.suggestedText,
    authorId: input.authorId ?? null,
    updatedAt: input.acceptedAt ?? null,
    sourceAiOutputId: input.suggestion.outputId,
  });
}

export function addAiHypothesisReview(
  current: CanonicalProjectHypothesis,
  review: AiAnalyticalOutput
): CanonicalProjectHypothesis {
  return {
    ...current,
    aiReviews: [...(current.aiReviews || []), review],
  };
}

export function validateHypothesisWithHumanDecision(current: CanonicalProjectHypothesis, input: {
  validatorIdentity?: any | null;
  validatedAt?: string | null;
}): CanonicalProjectHypothesis {
  const supportStatus = evaluateHypothesisSupport(current);
  if (supportStatus === "UNSUPPORTED" || supportStatus === "INSUFFICIENT_DATA") {
    return {
      ...current,
      supportStatus,
      status: current.status === "VALIDATED" ? "UNDER_REVIEW" : current.status,
      validationStatus: "PENDING_REVIEW",
      validationSource: "ADR_020_24_HUMAN_ACTION",
      validatedBy: null,
      validatedAt: null,
    };
  }

  const validation = applyHumanValidationAction({
    action: "APPROVE",
    validatorIdentity: input.validatorIdentity ?? null,
    validatedAt: input.validatedAt ?? null,
  });
  return {
    ...current,
    supportStatus,
    status: "VALIDATED",
    validationStatus: validation.humanValidationStatus,
    validationSource: validation.validationSource,
    validatedBy: validation.validatedBy,
    validatedAt: validation.validatedAt,
  };
}

export function adaptLegacyProjectHypothesis(project: any): CanonicalProjectHypothesis | null {
  if (project?.canonicalHypothesis?.hypothesisId) {
    return project.canonicalHypothesis as CanonicalProjectHypothesis;
  }
  const legacyText = normalizeText(project?.hipotesis ?? project?.hypothesisText);
  if (!legacyText) return null;
  const geographyId = project?.geographyId ?? project?.canonicalGeography?.geographyId ?? null;
  const hypothesis = formulateHumanHypothesis({
    projectId: project?.id || project?.projectId || "LEGACY_PROJECT",
    text: legacyText,
    geographyId,
    authorId: null,
    createdAt: null,
  });
  return {
    ...hypothesis,
    status: "LEGACY_FORMULATED",
    validationStatus: "LEGACY_UNCLASSIFIED",
    validationSource: "LEGACY_COMPATIBILITY",
    createdAt: null,
    updatedAt: null,
    history: hypothesis.history.map((entry) => ({
      ...entry,
      status: "LEGACY_FORMULATED",
      createdAt: null,
      authorId: null,
    })),
  };
}

export function canProceedWithInstitutionalAnalysis(input: any): {
  allowed: boolean;
  hypothesisRequirementSatisfied: boolean;
  reason: string;
  hypothesisId?: string;
} {
  const hypothesis = input?.canonicalHypothesis || input;
  const allowed = Boolean(
    hypothesis &&
    hypothesis.authorType === "HUMAN" &&
    FORMULATED_STATUSES.has(hypothesis.status)
  );
  return {
    allowed,
    hypothesisRequirementSatisfied: allowed,
    reason: allowed ? "HUMAN_HYPOTHESIS_FORMULATED" : "HUMAN_HYPOTHESIS_REQUIRED",
    hypothesisId: allowed ? hypothesis.hypothesisId : undefined,
  };
}

export function buildReportChapter0Hypothesis(project: any) {
  const hypothesis = adaptLegacyProjectHypothesis(project);
  if (!hypothesis || hypothesis.authorType !== "HUMAN") {
    return {
      title: "CAPÍTULO 0 - HIPÓTESIS",
      initialHypothesis: "HIPÓTESIS NO FORMULADA",
      currentHypothesis: "HIPÓTESIS NO FORMULADA",
      validationStatus: "UNREVIEWED" as CanonicalHumanValidationStatus,
      supportStatus: "INSUFFICIENT_DATA" as HypothesisSupportStatus,
      aiSuggestions: [],
      versions: [],
    };
  }
  return {
    title: "CAPÍTULO 0 - HIPÓTESIS",
    hypothesisId: hypothesis.hypothesisId,
    geographyId: hypothesis.geographyId ?? null,
    initialHypothesis: hypothesis.history[0]?.text || hypothesis.text,
    currentHypothesis: hypothesis.text,
    status: hypothesis.status,
    validationStatus: hypothesis.validationStatus,
    supportStatus: hypothesis.supportStatus,
    supportingEvidenceIds: hypothesis.supportingEvidenceIds,
    supportingFindingIds: hypothesis.supportingFindingIds,
    contradictingEvidenceIds: hypothesis.contradictingEvidenceIds,
    contradictingFindingIds: hypothesis.contradictingFindingIds,
    aiSuggestions: (hypothesis.aiSuggestions || []).map((suggestion) => ({
      ...suggestion,
      representation: "AI HYPOTHESIS SUGGESTION",
    })),
    versions: hypothesis.history,
  };
}

export function getReportReadyHypothesisInput(project: any) {
  const canonicalHypothesis = adaptLegacyProjectHypothesis(project);
  const gate = canProceedWithInstitutionalAnalysis({ canonicalHypothesis });
  return {
    hypothesisRequirementSatisfied: gate.hypothesisRequirementSatisfied,
    hypothesisStatus: canonicalHypothesis?.status ?? "DRAFT",
    hypothesisId: canonicalHypothesis?.hypothesisId,
    validationStatus: canonicalHypothesis?.validationStatus ?? "UNREVIEWED",
  };
}
