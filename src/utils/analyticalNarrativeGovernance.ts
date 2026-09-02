import type { AcquisitionMode, EpistemicValidationStatus } from "@/types/epistemicIntegrity";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";
import { validateLineage } from "@/utils/evidenceLineage";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import type { InstitutionalReportInput, PublicationItemType } from "@/utils/institutionalReportPublicationContract";

export type NarrativeEpistemicClass =
  | "DATA"
  | "EVIDENCE"
  | "FINDING"
  | "INFERENCE"
  | "ANALYSIS"
  | "VALIDATED_CONCLUSION"
  | "HYPOTHESIS"
  | "RECOMMENDATION"
  | "LEGACY_UNCLASSIFIED";

export type NarrativeStrength =
  | "OBSERVATIONAL"
  | "EVIDENTIARY"
  | "ANALYTICAL"
  | "INFERENTIAL"
  | "CONDITIONAL"
  | "VALIDATED_CONCLUSION";

export type NarrativeSourceItemType = PublicationItemType | "RECOMMENDATION";

export interface NarrativeAssertion {
  assertionId: string;
  text: string;
  epistemicClass: NarrativeEpistemicClass;
  sourceItemId: string;
  sourceItemType: NarrativeSourceItemType;
  geographyId?: string | null;
  evidenceIds: string[];
  findingIds: string[];
  inferenceIds: string[];
  analysisIds: string[];
  conclusionIds: string[];
  validationStatus: EpistemicValidationStatus | "APPROVED" | "LEGACY_UNCLASSIFIED";
  acquisitionMode: AcquisitionMode | "UNKNOWN";
  confidence: number | "UNKNOWN" | "UNAVAILABLE";
  allowedNarrativeStrength: NarrativeStrength;
  disclosureCodes: string[];
  lineageStatus: LineageStatus;
  limitations: string[];
  renderableInInstitutionalReport: boolean;
}

export interface GovernedNarrativeRender {
  assertionId: string;
  sourceItemId: string;
  sourceItemType: NarrativeSourceItemType;
  text: string;
  narrativeStrength: NarrativeStrength;
  claimIds: string[];
  disclosureCodes: string[];
  warnings: string[];
  rendered: boolean;
}

const STRENGTH_RANK: Record<NarrativeStrength, number> = {
  CONDITIONAL: 1,
  OBSERVATIONAL: 2,
  EVIDENTIARY: 3,
  INFERENTIAL: 4,
  ANALYTICAL: 5,
  VALIDATED_CONCLUSION: 6,
};

const CAUSAL_TERMS = /\b(causa|causó|provoca|provocó|genera|generó|determina|determinó|origina|originó|produce|produjo)\b/gi;
const PROVEN_TERMS = /\b(confirmado|confirmada|demostrado|demostrada|comprobado|comprobada|probado|probada)\b/gi;

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function sourceId(item: any, type: NarrativeSourceItemType): string {
  return String(
    item?.assertionId ||
    item?.id ||
    item?.evidenceId ||
    item?.findingId ||
    item?.inferenceId ||
    item?.analysisId ||
    item?.conclusionId ||
    item?.outputId ||
    item?.hypothesisId ||
    item?.recommendationId ||
    item?.traceabilityReference ||
    `${type}-UNAVAILABLE`
  );
}

function lineageOf(item: any): CanonicalLineageNode[] {
  return asArray<CanonicalLineageNode>(item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage);
}

function lineageStatusOf(item: any): LineageStatus {
  const nodes = lineageOf(item);
  if (nodes.length > 0) return validateLineage(nodes).status;
  return item?.lineageStatus || item?.multimodalEvidence?.lineageStatus || "LEGACY_UNCLASSIFIED";
}

function refs(item: any) {
  const nodes = lineageOf(item);
  return {
    geographyId: item?.geographyId || item?.multimodalEvidence?.geographyId || nodes.find((node) => node.geographyId)?.geographyId || null,
    evidenceIds: uniq([
      ...asArray<string>(item?.evidenceIds),
      ...asArray<string>(item?.comparedEvidenceIds || item?.aiAnalyticalOutput?.comparedEvidenceIds),
      item?.evidenceId,
      item?.multimodalEvidence?.evidenceId,
      ...nodes.map((node) => node.evidenceId),
    ]),
    findingIds: uniq([
      ...asArray<string>(item?.findingIds),
      ...asArray<string>(item?.derivedFromFindingIds),
      ...asArray<string>(item?.supportingFindingIds),
      item?.findingId,
      ...nodes.map((node) => node.findingId),
    ]),
    inferenceIds: uniq([
      ...asArray<string>(item?.inferenceIds),
      ...asArray<string>(item?.supportingInferenceIds),
      item?.inferenceId,
      ...nodes.map((node) => node.inferenceId),
    ]),
    analysisIds: uniq([
      ...asArray<string>(item?.analysisIds),
      item?.analysisId,
      item?.outputType === "ANALYSIS" ? item?.outputId : null,
      ...nodes.map((node) => node.analysisId),
    ]),
    conclusionIds: uniq([
      ...asArray<string>(item?.conclusionIds),
      item?.conclusionId,
      ...nodes.map((node) => node.conclusionId),
    ]),
  };
}

function validationStatus(item: any): NarrativeAssertion["validationStatus"] {
  return evaluateHumanValidation(item?.multimodalEvidence || item).status as NarrativeAssertion["validationStatus"];
}

function acquisitionMode(item: any): NarrativeAssertion["acquisitionMode"] {
  return String(item?.acquisitionMode || item?.epistemicIntegrity?.acquisitionMode || item?.epistemic?.acquisitionMode || "UNKNOWN").toUpperCase() as NarrativeAssertion["acquisitionMode"];
}

function confidence(item: any): NarrativeAssertion["confidence"] {
  if (typeof item?.confidence === "number") return item.confidence;
  if (typeof item?.aiQualityScore === "number") return item.aiQualityScore;
  return item?.confidence === "UNAVAILABLE" ? "UNAVAILABLE" : "UNKNOWN";
}

function sourceClass(item: any): string {
  return String(
    item?.sourceStatus ||
    item?.sourceIntegrityStatus ||
    item?.epistemicClass ||
    item?.providerType ||
    item?.sourceType ||
    ""
  ).toUpperCase();
}

function pickText(item: any, fallback: string): string {
  return String(
    item?.text ||
    item?.summary ||
    item?.description ||
    item?.finding ||
    item?.analysis ||
    item?.conclusion ||
    item?.interpretation ||
    item?.recommendation ||
    item?.caption ||
    fallback
  ).trim();
}

function isLineageSupported(status: LineageStatus): boolean {
  return status === "SUPPORTED" || status === "PARTIALLY_SUPPORTED";
}

function isAi(item: any): boolean {
  return acquisitionMode(item) === "AI_GENERATED" || sourceClass(item) === "AI_GENERATED";
}

function inferClass(item: any, type: NarrativeSourceItemType): NarrativeEpistemicClass {
  if (sourceClass(item) === "LEGACY_UNCLASSIFIED") return "LEGACY_UNCLASSIFIED";
  if (type === "EVIDENCE") return "EVIDENCE";
  if (type === "FINDING") return "FINDING";
  if (type === "INFERENCE") return "INFERENCE";
  if (type === "ANALYSIS" || type === "TEMPORAL_COMPARISON" || type === "SPECIALIZED_INTELLIGENCE") return "ANALYSIS";
  if (type === "CONCLUSION") return validationStatus(item) === "APPROVED" && isLineageSupported(lineageStatusOf(item)) && !isAi(item) ? "VALIDATED_CONCLUSION" : "ANALYSIS";
  if (type === "HYPOTHESIS") return "HYPOTHESIS";
  if (type === "RECOMMENDATION") return "RECOMMENDATION";
  if (type === "OSINT" || type === "STREET_VIEW" || type === "VISUAL_PRODUCT") return "DATA";
  return "DATA";
}

export function assessNarrativeStrength(input: {
  epistemicClass: NarrativeEpistemicClass;
  acquisitionMode?: NarrativeAssertion["acquisitionMode"];
  validationStatus?: NarrativeAssertion["validationStatus"];
  lineageStatus?: LineageStatus;
  explicitCausalSupport?: boolean;
}): NarrativeStrength {
  if (input.epistemicClass === "VALIDATED_CONCLUSION" && input.validationStatus === "APPROVED" && isLineageSupported(input.lineageStatus || "LEGACY_UNCLASSIFIED")) {
    return "VALIDATED_CONCLUSION";
  }
  if (input.epistemicClass === "ANALYSIS") return input.validationStatus === "APPROVED" ? "ANALYTICAL" : "CONDITIONAL";
  if (input.epistemicClass === "INFERENCE") return "INFERENTIAL";
  if (input.epistemicClass === "FINDING") return "EVIDENTIARY";
  if (input.epistemicClass === "EVIDENCE") return input.acquisitionMode === "OBSERVED" || input.acquisitionMode === "UNKNOWN" ? "OBSERVATIONAL" : "CONDITIONAL";
  if (input.epistemicClass === "RECOMMENDATION") return "CONDITIONAL";
  return "CONDITIONAL";
}

export function buildNarrativeAssertion(item: any, options: {
  sourceItemType: NarrativeSourceItemType;
  text?: string;
  critical?: boolean;
  explicitCausalSupport?: boolean;
}): NarrativeAssertion {
  const itemRefs = refs(item);
  const status = validationStatus(item);
  const mode = acquisitionMode(item);
  const lineageStatus = lineageStatusOf(item);
  const epistemicClass = inferClass(item, options.sourceItemType);
  const disclosureCodes = uniq([
    ...asArray<string>(item?.disclosureCodes),
    ...asArray<any>(item?.publicationEligibility?.disclosures).map((d) => d?.code),
    ...asArray<any>(item?.disclosures).map((d) => d?.code),
    isAi(item) ? "AI_GENERATED_TEXT" : null,
    sourceClass(item) === "NON_AUTHORITATIVE" ? "NON_AUTHORITATIVE_CONTEXT" : null,
    sourceClass(item) === "LEGACY_UNCLASSIFIED" ? "LEGACY_UNCLASSIFIED" : null,
  ]);
  const allowedNarrativeStrength = assessNarrativeStrength({
    epistemicClass,
    acquisitionMode: mode,
    validationStatus: status,
    lineageStatus,
    explicitCausalSupport: options.explicitCausalSupport,
  });
  const renderableInInstitutionalReport =
    epistemicClass !== "LEGACY_UNCLASSIFIED" &&
    !(options.sourceItemType === "FINDING" && !isLineageSupported(lineageStatus)) &&
    !(options.sourceItemType === "CONCLUSION" && allowedNarrativeStrength !== "VALIDATED_CONCLUSION") &&
    !(options.critical === true && sourceClass(item) === "LEGACY_UNCLASSIFIED");

  return {
    assertionId: `NA-${options.sourceItemType}-${sourceId(item, options.sourceItemType)}`,
    text: options.text || pickText(item, `${options.sourceItemType} sin texto narrativo.`),
    epistemicClass,
    sourceItemId: sourceId(item, options.sourceItemType),
    sourceItemType: options.sourceItemType,
    geographyId: itemRefs.geographyId,
    evidenceIds: itemRefs.evidenceIds,
    findingIds: itemRefs.findingIds,
    inferenceIds: itemRefs.inferenceIds,
    analysisIds: itemRefs.analysisIds,
    conclusionIds: itemRefs.conclusionIds,
    validationStatus: status,
    acquisitionMode: mode,
    confidence: confidence(item),
    allowedNarrativeStrength,
    disclosureCodes,
    lineageStatus,
    limitations: uniq([...asArray<string>(item?.limitations), ...asArray<string>(item?.warnings)]),
    renderableInInstitutionalReport,
  };
}

function downgradeStrength(requested: NarrativeStrength | undefined, allowed: NarrativeStrength): NarrativeStrength {
  if (!requested) return allowed;
  return STRENGTH_RANK[requested] > STRENGTH_RANK[allowed] ? allowed : requested;
}

function softenCausality(text: string, explicitCausalSupport: boolean): string {
  if (explicitCausalSupport) return text;
  return text.replace(CAUSAL_TERMS, "se asocia con").replace(PROVEN_TERMS, "documentado");
}

function prefixFor(assertion: NarrativeAssertion, strength: NarrativeStrength): string {
  if (strength === "VALIDATED_CONCLUSION") return "Se concluye";
  if (assertion.epistemicClass === "EVIDENCE") return assertion.acquisitionMode === "OBSERVED" || assertion.acquisitionMode === "UNKNOWN" ? `En la evidencia ${assertion.sourceItemId} se observa` : `La referencia ${assertion.sourceItemId} contiene material no observado directamente`;
  if (assertion.epistemicClass === "FINDING") return `Se documenta el hallazgo ${assertion.sourceItemId}`;
  if (assertion.epistemicClass === "INFERENCE") return "Los elementos analizados sugieren";
  if (assertion.epistemicClass === "ANALYSIS") return strength === "CONDITIONAL" ? "El análisis pendiente de validación humana plantea" : "El análisis integrado indica";
  if (assertion.epistemicClass === "HYPOTHESIS") return "La hipótesis de trabajo plantea";
  if (assertion.epistemicClass === "RECOMMENDATION") return "Se recomienda";
  return "Se registra";
}

export function renderGovernedNarrative(assertion: NarrativeAssertion, options: {
  requestedStrength?: NarrativeStrength;
  mode?: "INSTITUTIONAL" | "DRAFT";
  relationKind?: "CORRELATION" | "CAUSAL" | "TEMPORAL_DIFFERENCE" | "SPATIAL_ASSOCIATION";
  explicitCausalSupport?: boolean;
} = {}): GovernedNarrativeRender {
  const warnings: string[] = [];
  const mode = options.mode || "INSTITUTIONAL";
  if (mode === "INSTITUTIONAL" && !assertion.renderableInInstitutionalReport) {
    return {
      assertionId: assertion.assertionId,
      sourceItemId: assertion.sourceItemId,
      sourceItemType: assertion.sourceItemType,
      text: "",
      narrativeStrength: assertion.allowedNarrativeStrength,
      claimIds: [],
      disclosureCodes: assertion.disclosureCodes,
      warnings: ["NARRATIVE_ASSERTION_NOT_INSTITUTIONAL_RENDERABLE"],
      rendered: false,
    };
  }

  const strength = downgradeStrength(options.requestedStrength, assertion.allowedNarrativeStrength);
  if (options.requestedStrength && strength !== options.requestedStrength) warnings.push("REQUESTED_NARRATIVE_STRENGTH_DOWNGRADED");
  if (assertion.confidence !== "UNKNOWN" && assertion.confidence !== "UNAVAILABLE" && strength !== "VALIDATED_CONCLUSION") {
    warnings.push("CONFIDENCE_IS_NOT_CERTAINTY");
  }
  if (assertion.acquisitionMode === "AI_GENERATED") warnings.push("AI_GENERATED_TEXT_REQUIRES_PROVENANCE");
  if (assertion.limitations.length > 0) warnings.push("LIMITATIONS_PROPAGATED");
  if (options.relationKind && options.relationKind !== "CAUSAL" && !options.explicitCausalSupport) warnings.push("CORRELATION_NOT_CAUSATION");

  const body = softenCausality(assertion.text, options.explicitCausalSupport === true || strength === "VALIDATED_CONCLUSION");
  const relationSuffix = options.relationKind === "CORRELATION" || options.relationKind === "SPATIAL_ASSOCIATION"
    ? " La relación debe entenderse como asociación espacial/temporal, no como origen establecido."
    : options.relationKind === "TEMPORAL_DIFFERENCE"
      ? " La diferencia temporal registrada no establece por sí sola una causa."
      : "";
  const limitationSuffix = assertion.limitations.length > 0 ? ` Limitaciones: ${assertion.limitations.join("; ")}.` : "";
  const disclosureSuffix = mode === "DRAFT" && assertion.disclosureCodes.length > 0 ? ` [${assertion.disclosureCodes.join(", ")}]` : "";
  const prefix = prefixFor(assertion, strength);

  return {
    assertionId: assertion.assertionId,
    sourceItemId: assertion.sourceItemId,
    sourceItemType: assertion.sourceItemType,
    text: `${prefix}: ${body}.${relationSuffix}${limitationSuffix}${disclosureSuffix}`.replace(/\.\./g, ".").trim(),
    narrativeStrength: strength,
    claimIds: [assertion.assertionId],
    disclosureCodes: assertion.disclosureCodes,
    warnings,
    rendered: true,
  };
}

export function buildNarrativeAssertionsFromInstitutionalInput(input: InstitutionalReportInput): NarrativeAssertion[] {
  const assertions: NarrativeAssertion[] = [];
  assertions.push(buildNarrativeAssertion(input.hypothesis, {
    sourceItemType: "HYPOTHESIS",
    text: input.hypothesis.currentHypothesis,
  }));
  input.evidence.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "EVIDENCE" })));
  input.findings.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "FINDING" })));
  input.inferences.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "INFERENCE" })));
  input.analyses.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "ANALYSIS" })));
  input.conclusions.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "CONCLUSION" })));
  input.osint.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "OSINT" })));
  input.streetView.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "STREET_VIEW" })));
  input.temporalComparisons.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "TEMPORAL_COMPARISON" })));
  input.specializedIntelligence.forEach((item) => assertions.push(buildNarrativeAssertion(item, { sourceItemType: "SPECIALIZED_INTELLIGENCE" })));
  return assertions;
}

export function renderNarrativeAssertions(assertions: NarrativeAssertion[], mode: "INSTITUTIONAL" | "DRAFT" = "INSTITUTIONAL"): GovernedNarrativeRender[] {
  return assertions.map((assertion) => renderGovernedNarrative(assertion, { mode })).filter((rendered) => rendered.rendered);
}

export function renderGovernedExecutiveSummary(assertions: NarrativeAssertion[], mode: "INSTITUTIONAL" | "DRAFT" = "INSTITUTIONAL"): {
  text: string;
  claimIds: string[];
  renderedAssertions: GovernedNarrativeRender[];
} {
  const renderedAssertions = renderNarrativeAssertions(assertions, mode).slice(0, 6);
  return {
    text: renderedAssertions.map((item) => item.text).join(" "),
    claimIds: renderedAssertions.flatMap((item) => item.claimIds),
    renderedAssertions,
  };
}
