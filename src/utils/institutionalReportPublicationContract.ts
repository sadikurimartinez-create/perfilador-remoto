import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import { buildReportChapter0Hypothesis } from "@/utils/hypothesisGovernance";
import { assessReportReadiness, type ReportReadyAssessment } from "@/utils/reportReadyGovernance";
import {
  buildNarrativeAssertionsFromInstitutionalInput,
  renderGovernedExecutiveSummary,
} from "@/utils/analyticalNarrativeGovernance";

export type PublicationEligibility = "ELIGIBLE" | "ELIGIBLE_WITH_DISCLOSURE" | "INELIGIBLE";
export type PublicationItemType =
  | "GEOGRAPHY"
  | "HYPOTHESIS"
  | "EVIDENCE"
  | "FINDING"
  | "INFERENCE"
  | "ANALYSIS"
  | "CONCLUSION"
  | "OSINT"
  | "STREET_VIEW"
  | "TEMPORAL_COMPARISON"
  | "SPECIALIZED_INTELLIGENCE"
  | "VISUAL_PRODUCT";

export interface PublicationExclusion {
  itemId: string;
  itemType: PublicationItemType;
  reasonCode: string;
  reason: string;
}

export interface PublicationDisclosure {
  itemId: string;
  itemType: PublicationItemType;
  code: string;
  message: string;
}

export interface ReportItemEligibilityAssessment {
  itemId: string;
  itemType: PublicationItemType;
  eligibility: PublicationEligibility;
  role: "INSTITUTIONAL_FACT" | "INFERENCE" | "ANALYSIS" | "CONCLUSION" | "CONTEXTUAL" | "AI_SUGGESTION";
  exclusions: PublicationExclusion[];
  disclosures: PublicationDisclosure[];
  lineageRefs: {
    geographyId?: string | null;
    sourceIds: string[];
    evidenceIds: string[];
    findingIds: string[];
    analysisIds: string[];
    conclusionIds: string[];
  };
}

export interface InstitutionalReportInput {
  projectId: string;
  reportReadyAssessment: ReportReadyAssessment;
  generatedAt: string;
  geography: CanonicalProjectGeography | null;
  hypothesis: ReturnType<typeof buildReportChapter0Hypothesis>;
  evidence: any[];
  findings: any[];
  inferences: any[];
  analyses: any[];
  conclusions: any[];
  osint: any[];
  streetView: any[];
  temporalComparisons: any[];
  specializedIntelligence: any[];
  visualProducts: any[];
  exclusions: PublicationExclusion[];
  disclosures: PublicationDisclosure[];
  lineageSummary: ReportItemEligibilityAssessment["lineageRefs"] & { itemCount: number };
  publicationEligibility: PublicationEligibility;
  draft: false;
  certified: false;
  published: false;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function itemId(item: any, type: PublicationItemType): string {
  return String(
    item?.id ||
    item?.evidenceId ||
    item?.findingId ||
    item?.inferenceId ||
    item?.analysisId ||
    item?.conclusionId ||
    item?.outputId ||
    item?.comparisonId ||
    item?.traceabilityReference ||
    `${type}-UNAVAILABLE`
  );
}

function lineage(item: any): CanonicalLineageNode[] {
  return asArray<CanonicalLineageNode>(item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage);
}

function lineageStatus(item: any): LineageStatus | null {
  const nodes = lineage(item);
  if (nodes.length > 0) return validateLineage(nodes).status;
  return item?.lineageStatus || item?.multimodalEvidence?.lineageStatus || null;
}

function isSupported(item: any): boolean {
  const status = lineageStatus(item);
  return status === "SUPPORTED" || status === "PARTIALLY_SUPPORTED";
}

function integrityFailure(item: any): boolean {
  const integrity = item?.forensicIntegrity || item?.multimodalEvidence?.forensicIntegrity;
  return integrity?.hashStatus === "HASH_MISMATCH" || integrity?.mimeStatus === "MIME_MISMATCH";
}

function sourceClass(item: any): string {
  return String(
    item?.sourceIntegrityStatus ||
    item?.sourceStatus ||
    item?.sourceType ||
    item?.acquisitionMode ||
    item?.epistemicClass ||
    item?.providerType ||
    ""
  ).toUpperCase();
}

function isAiGenerated(item: any): boolean {
  return item?.acquisitionMode === "AI_GENERATED" || item?.epistemicClass === "AI_GENERATED";
}

function isHumanApproved(item: any): boolean {
  return evaluateHumanValidation(item?.multimodalEvidence || item).status === "APPROVED";
}

function exclusion(item: any, type: PublicationItemType, reasonCode: string, reason: string): PublicationExclusion {
  return { itemId: itemId(item, type), itemType: type, reasonCode, reason };
}

function disclosure(item: any, type: PublicationItemType, code: string, message: string): PublicationDisclosure {
  return { itemId: itemId(item, type), itemType: type, code, message };
}

function refs(item: any): ReportItemEligibilityAssessment["lineageRefs"] {
  const nodes = lineage(item);
  return {
    geographyId: item?.geographyId || item?.multimodalEvidence?.geographyId || nodes.find((node) => node.geographyId)?.geographyId || null,
    sourceIds: [
      ...asArray<string>(item?.sourceIds),
      ...nodes.map((node) => node.sourceId).filter(Boolean) as string[],
    ],
    evidenceIds: [
      ...asArray<string>(item?.evidenceIds),
      ...asArray<string>(item?.comparedEvidenceIds || item?.aiAnalyticalOutput?.comparedEvidenceIds),
      item?.evidenceId,
      item?.multimodalEvidence?.evidenceId,
      ...nodes.map((node) => node.evidenceId).filter(Boolean) as string[],
    ].filter(Boolean),
    findingIds: [
      ...asArray<string>(item?.findingIds),
      item?.findingId,
      ...nodes.map((node) => node.findingId).filter(Boolean) as string[],
    ].filter(Boolean),
    analysisIds: [
      ...asArray<string>(item?.analysisIds),
      item?.analysisId,
      item?.outputType === "ANALYSIS" ? item?.outputId : null,
      ...nodes.map((node) => node.analysisId).filter(Boolean) as string[],
    ].filter(Boolean),
    conclusionIds: [
      ...asArray<string>(item?.conclusionIds),
      item?.conclusionId,
      ...nodes.map((node) => node.conclusionId).filter(Boolean) as string[],
    ].filter(Boolean),
  };
}

function withDecision(
  item: any,
  type: PublicationItemType,
  eligibility: PublicationEligibility,
  role: ReportItemEligibilityAssessment["role"],
  exclusions: PublicationExclusion[] = [],
  disclosures: PublicationDisclosure[] = []
): ReportItemEligibilityAssessment {
  return {
    itemId: itemId(item, type),
    itemType: type,
    eligibility,
    role,
    exclusions,
    disclosures,
    lineageRefs: refs(item),
  };
}

export function assessReportItemEligibility(item: any, context: {
  itemType: PublicationItemType;
  requireInstitutionalFact?: boolean;
}): ReportItemEligibilityAssessment {
  const type = context.itemType;
  const source = sourceClass(item);
  const disclosures: PublicationDisclosure[] = [];

  if (source === "LEGACY_UNCLASSIFIED") {
    disclosures.push(disclosure(item, type, "LEGACY_METADATA_PARTIAL", "Legacy input lacks full publication metadata."));
  }
  if (source === "NON_AUTHORITATIVE") {
    disclosures.push(disclosure(item, type, "SOURCE_NON_AUTHORITATIVE", "Source may be used only as contextual material."));
  }
  if (source === "SIMULATED" || source === "MOCK") {
    disclosures.push(disclosure(item, type, "SIMULATED_CONTEXT_ONLY", "Simulated content cannot be presented as institutional fact."));
  }
  if (isAiGenerated(item) && !(type === "ANALYSIS" && isHumanApproved(item))) {
    disclosures.push(disclosure(item, type, "AI_GENERATED_INTERPRETATION", "AI generated content must remain marked unless human-governed."));
  }

  if (type === "EVIDENCE") {
    if (!item?.evidenceId && !item?.multimodalEvidence?.evidenceId) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "RAW_FILE_ONLY", "Raw file without governed evidence identity is not institutional evidence.")], disclosures);
    }
    if (integrityFailure(item)) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "CRITICAL_INTEGRITY_FAILURE", "Evidence has critical forensic integrity failure.")], disclosures);
    }
    if (evaluateHumanValidation(item?.multimodalEvidence || item).status === "REJECTED") {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "HUMAN_REJECTED", "Human validation rejected this evidence.")], disclosures);
    }
    if (!isSupported(item) && lineage(item).length === 0) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "UNTRACEABLE_EVIDENCE", "Evidence lacks resolvable lineage.")], disclosures);
    }
    if (source === "SIMULATED" || source === "MOCK") {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "SIMULATED_AS_FACT", "Simulated evidence cannot enter as institutional fact.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "INSTITUTIONAL_FACT", [], disclosures);
  }

  if (type === "FINDING") {
    if (!isSupported(item) || isAiGenerated(item)) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "UNSUPPORTED_OR_SYNTHETIC_FINDING", "Finding must be supported, traceable, and human-governed.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "INSTITUTIONAL_FACT", [], disclosures);
  }

  if (type === "INFERENCE") {
    if (!isSupported(item)) {
      return withDecision(item, type, "INELIGIBLE", "INFERENCE", [exclusion(item, type, "UNSUPPORTED_INFERENCE", "Inference requires supporting lineage.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "INFERENCE", [], disclosures);
  }

  if (type === "ANALYSIS") {
    if (!isSupported(item) || !isHumanApproved(item)) {
      return withDecision(item, type, "INELIGIBLE", "ANALYSIS", [exclusion(item, type, "ANALYSIS_NOT_HUMAN_VALIDATED", "Institutional analysis requires supported lineage and human validation.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "ANALYSIS", [], disclosures);
  }

  if (type === "CONCLUSION") {
    if (item?.outputType === "CONCLUSION_SUGGESTION" || isAiGenerated(item) && !isHumanApproved(item)) {
      return withDecision(item, type, "INELIGIBLE", "CONCLUSION", [exclusion(item, type, "AI_CONCLUSION_SUGGESTION", "AI conclusion suggestion is not an institutional conclusion.")], disclosures);
    }
    if (!isSupported(item) || !isHumanApproved(item)) {
      return withDecision(item, type, "INELIGIBLE", "CONCLUSION", [exclusion(item, type, "CONCLUSION_NOT_VALIDATED", "Conclusion requires supported reverse lineage and human validation.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "CONCLUSION", [], disclosures);
  }

  if (type === "OSINT" && (source === "SIMULATED" || source === "MOCK" || isAiGenerated(item))) {
    return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "OSINT_NOT_OBSERVED_FACT", "AI synthesis or simulated OSINT cannot be presented as observed social fact.")], disclosures);
  }

  if (type === "STREET_VIEW") {
    if (!item?.evidenceId || !refs(item).geographyId) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "STREET_VIEW_IDENTITY_INCOMPLETE", "Street View report item must preserve evidenceId and geographyId.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "INSTITUTIONAL_FACT", [], disclosures);
  }

  if (type === "TEMPORAL_COMPARISON") {
    const compared = asArray<string>(item?.comparedEvidenceIds || item?.aiAnalyticalOutput?.comparedEvidenceIds);
    if (compared.length < 2 || (isAiGenerated(item?.aiAnalyticalOutput || item) && !isHumanApproved(item))) {
      return withDecision(item, type, "INELIGIBLE", "ANALYSIS", [exclusion(item, type, "TEMPORAL_COMPARISON_NOT_VALIDATED", "Temporal comparison requires two evidence references and governed validation.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "ANALYSIS", [], disclosures);
  }

  if (type === "SPECIALIZED_INTELLIGENCE") {
    if (item?.validatedByACE !== true || !item?.traceabilityReference) {
      return withDecision(item, type, "INELIGIBLE", "ANALYSIS", [exclusion(item, type, "SPECIALIZED_INTELLIGENCE_NOT_CERTIFIED_PAYLOAD", "Pandillas/GIM report input must be CertifiedGangAnalysisPayload.")], disclosures);
    }
    return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", "ANALYSIS", [], disclosures);
  }

  if (type === "VISUAL_PRODUCT") {
    const visualRefs = refs(item);
    const hasEligibleLink = Boolean(
      visualRefs.geographyId ||
      visualRefs.evidenceIds.length ||
      visualRefs.findingIds.length ||
      visualRefs.analysisIds.length
    );
    if (!hasEligibleLink && item?.contextual !== true) {
      return withDecision(item, type, "INELIGIBLE", "CONTEXTUAL", [exclusion(item, type, "VISUAL_PRODUCT_WITHOUT_ELIGIBLE_LINKAGE", "Institutional visual product requires resolvable linkage to eligible content.")], disclosures);
    }
    const visualDisclosures = item?.contextual === true
      ? [...disclosures, disclosure(item, type, "CONTEXTUAL_VISUAL_PRODUCT", "Visual product is contextual and not a standalone institutional fact.")]
      : disclosures;
    return withDecision(item, type, visualDisclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", item?.contextual === true ? "CONTEXTUAL" : "INSTITUTIONAL_FACT", [], visualDisclosures);
  }

  return withDecision(item, type, disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE", context.requireInstitutionalFact ? "INSTITUTIONAL_FACT" : "CONTEXTUAL", [], disclosures);
}

function collect(project: any, keys: string[]): any[] {
  return keys.flatMap((key) => asArray(project?.[key]));
}

function addEligible(target: any[], assessment: ReportItemEligibilityAssessment, item: any, exclusions: PublicationExclusion[], disclosures: PublicationDisclosure[]) {
  exclusions.push(...assessment.exclusions);
  disclosures.push(...assessment.disclosures);
  if (assessment.eligibility !== "INELIGIBLE") target.push({ ...item, publicationEligibility: assessment });
}

function summarizeLineage(assessments: ReportItemEligibilityAssessment[]): InstitutionalReportInput["lineageSummary"] {
  const sourceIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const findingIds = new Set<string>();
  const analysisIds = new Set<string>();
  const conclusionIds = new Set<string>();
  let geographyId: string | null | undefined = null;
  assessments.forEach((assessment) => {
    geographyId ||= assessment.lineageRefs.geographyId;
    assessment.lineageRefs.sourceIds.forEach((id) => sourceIds.add(id));
    assessment.lineageRefs.evidenceIds.forEach((id) => evidenceIds.add(id));
    assessment.lineageRefs.findingIds.forEach((id) => findingIds.add(id));
    assessment.lineageRefs.analysisIds.forEach((id) => analysisIds.add(id));
    assessment.lineageRefs.conclusionIds.forEach((id) => conclusionIds.add(id));
  });
  return {
    geographyId,
    sourceIds: Array.from(sourceIds),
    evidenceIds: Array.from(evidenceIds),
    findingIds: Array.from(findingIds),
    analysisIds: Array.from(analysisIds),
    conclusionIds: Array.from(conclusionIds),
    itemCount: assessments.length,
  };
}

export function buildInstitutionalReportInput(project: any, options: { generatedAt?: string } = {}): InstitutionalReportInput {
  const reportReadyAssessment = assessReportReadiness(project);
  if (!reportReadyAssessment.readyForInstitutionalReport) {
    throw new Error(`INSTITUTIONAL_REPORT_INPUT_REJECTED:${reportReadyAssessment.status}`);
  }

  const exclusions: PublicationExclusion[] = [];
  const disclosures: PublicationDisclosure[] = [];
  const assessments: ReportItemEligibilityAssessment[] = [];
  const evidence: any[] = [];
  const findings: any[] = [];
  const inferences: any[] = [];
  const analyses: any[] = [];
  const conclusions: any[] = [];
  const osint: any[] = [];
  const streetView: any[] = [];
  const temporalComparisons: any[] = [];
  const specializedIntelligence: any[] = [];
  const visualProducts: any[] = [];

  const process = (items: any[], type: PublicationItemType, target: any[]) => {
    items.forEach((item) => {
      const assessment = assessReportItemEligibility(item, { itemType: type });
      assessments.push(assessment);
      addEligible(target, assessment, item, exclusions, disclosures);
    });
  };

  process(collect(project, ["evidence", "evidences", "photoEvidence"]), "EVIDENCE", evidence);
  process(collect(project, ["findings", "approvedFindings"]), "FINDING", findings);
  process(collect(project, ["inferences"]), "INFERENCE", inferences);
  process(collect(project, ["analysisOutputs", "aiAnalyticalOutputs", "analyses"]), "ANALYSIS", analyses);
  process(collect(project, ["conclusions"]), "CONCLUSION", conclusions);
  process(collect(project, ["osint", "osintFindings"]), "OSINT", osint);
  process(collect(project, ["streetViewAnalysis", "streetView"]), "STREET_VIEW", streetView);
  process(collect(project, ["temporalComparisons"]), "TEMPORAL_COMPARISON", temporalComparisons);
  process([
    project?.intelligenceContext?.aceReport?.certifiedGimOutput,
    project?.certifiedGimOutput,
  ].filter(Boolean), "SPECIALIZED_INTELLIGENCE", specializedIntelligence);
  process(collect(project, ["maps", "charts", "visualProducts"]), "VISUAL_PRODUCT", visualProducts);

  return {
    projectId: reportReadyAssessment.projectId,
    reportReadyAssessment,
    generatedAt: options.generatedAt || new Date().toISOString(),
    geography: project?.canonicalGeography || null,
    hypothesis: buildReportChapter0Hypothesis(project),
    evidence,
    findings,
    inferences,
    analyses,
    conclusions,
    osint,
    streetView,
    temporalComparisons,
    specializedIntelligence,
    visualProducts,
    exclusions,
    disclosures,
    lineageSummary: summarizeLineage(assessments.filter((assessment) => assessment.eligibility !== "INELIGIBLE")),
    publicationEligibility: disclosures.length > 0 ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE",
    draft: false,
    certified: false,
    published: false,
  };
}

export function buildDraftReportInput(project: any) {
  return {
    projectId: String(project?.projectId || project?.id || "UNAVAILABLE"),
    draft: true,
    institutional: false,
  };
}

function disclosureNotes(disclosures: PublicationDisclosure[]): string {
  return disclosures.map((item) => `${item.code}: ${item.message}`).join("\n");
}

export function reconcileInstitutionalReportPayload(basePayload: any, input: InstitutionalReportInput) {
  const specializedGim = input.specializedIntelligence[0] || null;
  const governedNarrativeAssertions = buildNarrativeAssertionsFromInstitutionalInput(input);
  const governedExecutiveSummary = renderGovernedExecutiveSummary(governedNarrativeAssertions, "INSTITUTIONAL");
  return {
    ...basePayload,
    institutionalReportInput: input,
    governedNarrativeAssertions,
    governedExecutiveSummary,
    reportReadyAssessment: input.reportReadyAssessment,
    publicationEligibility: input.publicationEligibility,
    publicationExclusions: input.exclusions,
    publicationDisclosures: input.disclosures,
    canonicalGeography: input.geography,
    geographyId: input.geography?.geographyId ?? basePayload?.geographyId ?? null,
    finalHypothesis: input.hypothesis.currentHypothesis,
    hypothesisLifecycle: {
      ...(basePayload?.hypothesisLifecycle || {}),
      hipotesisInicial: input.hypothesis.initialHypothesis,
      hipotesisActual: input.hypothesis.currentHypothesis,
      estadoActual: input.hypothesis.status || basePayload?.hypothesisLifecycle?.estadoActual || "FORMULATED",
      evidenciaConfirmatoria: input.hypothesis.supportingEvidenceIds || [],
      evidenciaContradictoria: input.hypothesis.contradictingEvidenceIds || [],
    },
    photoEvidence: input.evidence,
    approvedFindings: input.findings,
    findings: input.findings,
    inferences: input.inferences,
    analysisOutputs: input.analyses,
    analyses: input.analyses,
    conclusions: input.conclusions,
    osintFindings: input.osint,
    osintSynthesized: input.osint.length
      ? `${input.osint.map((item: any) => item.summary || item.text || item.description || item.sourceReference || item.id).filter(Boolean).join("\n")}\n${disclosureNotes(input.disclosures.filter((d) => d.itemType === "OSINT"))}`.trim()
      : "",
    executiveSummary: governedExecutiveSummary.text || basePayload?.executiveSummary || "",
    streetViewAnalysis: input.streetView,
    temporalComparisons: input.temporalComparisons,
    maps: input.visualProducts.filter((item: any) => item.kind !== "chart"),
    charts: input.visualProducts.filter((item: any) => item.kind === "chart"),
    certifiedGimOutput: specializedGim,
    intelligenceContext: {
      ...(basePayload?.intelligenceContext || {}),
      aceReport: {
        ...(basePayload?.intelligenceContext?.aceReport || {}),
        certifiedGimOutput: specializedGim,
      },
    },
  };
}
