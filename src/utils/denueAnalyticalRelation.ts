import type { CanonicalLineageNode } from "@/utils/evidenceLineage";
import { validateLineage } from "@/utils/evidenceLineage";
import type { PublicationEligibility } from "@/utils/institutionalReportPublicationContract";
import type {
  ConvergenceCompatibility,
  SourceIndependence,
} from "@/utils/institutionalMultisourceConvergence";

export type DenueAnalyticalRelationType =
  | "SPATIAL_PROXIMITY"
  | "EXPLICIT_SOURCE_LINK"
  | "EVIDENCE_COINCIDENCE"
  | "FINDING_RELATION"
  | "HYPOTHESIS_SUPPORT"
  | "HYPOTHESIS_CONTRADICTION"
  | "CONTEXTUAL_ASSOCIATION"
  | "MULTISOURCE_CORROBORATION";

export type DenueMachineAssessmentStatus = "DETECTED" | "PROPOSED" | "INSUFFICIENT";

export type DenueHumanValidationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "REQUIRES_REVISION";

export interface DenueSpatialMetrics {
  unit: "METERS";
  method: string;
  distanceMeters?: number | null;
  insideCanonicalGeography?: boolean | null;
  distanceToBoundaryMeters?: number | null;
  distanceToCorridorMeters?: number | null;
}

export interface DenueSourceIndependenceAssessment {
  status: SourceIndependence;
  assessedSourceRefs: string[];
  independentSourceRefs: string[];
  rationale: string[];
}

export interface DenueMeasuredFact {
  factId: string;
  metric: string;
  value: string | number | boolean;
  unit?: string | null;
  sourceRefs: string[];
}

export interface DenueProposedInterpretation {
  interpretationId: string;
  status: "PROPOSED";
  text: string;
  sourceRefs: string[];
}

export interface DenueAnalyticalLimitation {
  code: string;
  detail?: string | null;
}

export interface DenueMachineAssessment {
  status: DenueMachineAssessmentStatus;
  reasonCodes: string[];
}

export interface DenueHumanValidation {
  status: DenueHumanValidationStatus;
  validatedBy: string | null;
  validatedAt: string | null;
  rationale: string | null;
}

export interface DenueAnalyticalRelation {
  relationId: string;
  denueLayerId: string;
  sourceEvidenceId: string;
  expedienteId: string;
  geographyId: string;
  relationTypes: DenueAnalyticalRelationType[];
  linkedEvidenceIds: string[];
  linkedFindingIds: string[];
  linkedHypothesisRefs: string[];
  linkedSourceRefs: string[];
  spatialMetrics: DenueSpatialMetrics | null;
  temporalCompatibility: ConvergenceCompatibility;
  sourceIndependence: DenueSourceIndependenceAssessment;
  lineage: CanonicalLineageNode[];
  measuredFacts: DenueMeasuredFact[];
  proposedInterpretations: DenueProposedInterpretation[];
  limitations: DenueAnalyticalLimitation[];
  machineAssessment: DenueMachineAssessment;
  humanValidation: DenueHumanValidation;
  publicationEligibility: PublicationEligibility;
  methodologyVersion: string;
}

export type DenueAnalyticalRelationValidationReason =
  | "RELATION_REQUIRED"
  | "RELATION_ID_REQUIRED"
  | "DENUE_LAYER_ID_REQUIRED"
  | "SOURCE_EVIDENCE_ID_REQUIRED"
  | "EXPEDIENTE_ID_REQUIRED"
  | "GEOGRAPHY_ID_REQUIRED"
  | "METHODOLOGY_VERSION_REQUIRED"
  | "RELATION_TYPES_REQUIRED"
  | "RELATION_TYPE_INVALID"
  | "RELATION_TYPES_DUPLICATED"
  | "LINKED_EVIDENCE_IDS_INVALID"
  | "LINKED_EVIDENCE_IDS_DUPLICATED"
  | "LINKED_FINDING_IDS_INVALID"
  | "LINKED_FINDING_IDS_DUPLICATED"
  | "LINKED_HYPOTHESIS_REFS_INVALID"
  | "LINKED_HYPOTHESIS_REFS_DUPLICATED"
  | "LINKED_SOURCE_REFS_INVALID"
  | "LINKED_SOURCE_REFS_DUPLICATED"
  | "SPATIAL_METRICS_INVALID"
  | "SPATIAL_METRIC_REQUIRED"
  | "EXPLICIT_SOURCE_LINK_REQUIRED"
  | "EVIDENCE_LINK_REQUIRED"
  | "FINDING_LINK_REQUIRED"
  | "HYPOTHESIS_LINK_REQUIRED"
  | "CONTEXT_NOT_CAUSALITY_LIMITATION_REQUIRED"
  | "PROXIMITY_NOT_CAUSALITY_LIMITATION_REQUIRED"
  | "MULTISOURCE_INDEPENDENCE_REQUIRED"
  | "SOURCE_INDEPENDENCE_INVALID"
  | "TEMPORAL_COMPATIBILITY_INVALID"
  | "LINEAGE_REQUIRED"
  | "LINEAGE_INVALID"
  | "LINEAGE_SOURCE_EVIDENCE_REQUIRED"
  | "LINEAGE_GEOGRAPHY_MISMATCH"
  | "MEASURED_FACTS_INVALID"
  | "MEASURED_FACT_PROHIBITED_INTERPRETATION"
  | "PROPOSED_INTERPRETATIONS_INVALID"
  | "DETECTED_CANNOT_CONTAIN_PROPOSED_INTERPRETATIONS"
  | "DETECTED_REQUIRES_MEASURED_FACT"
  | "PROPOSED_REQUIRES_CONTENT"
  | "MACHINE_ASSESSMENT_INVALID"
  | "HUMAN_VALIDATION_INVALID"
  | "HUMAN_VALIDATION_METADATA_REQUIRED"
  | "HUMAN_VALIDATION_DATE_INVALID"
  | "PUBLICATION_ELIGIBILITY_INVALID"
  | "HUMAN_ACCEPTANCE_REQUIRED_FOR_PUBLICATION"
  | "INSUFFICIENT_NOT_PUBLICABLE"
  | "LIMITATIONS_REQUIRED"
  | "LIMITATIONS_INVALID"
  | "DENUE_NOT_CRIMINAL_EVIDENCE_LIMITATION_REQUIRED"
  | "HUMAN_VALIDATION_REQUIRED_LIMITATION_REQUIRED"
  | "FORBIDDEN_RISK_OR_SCORING_FIELD";

export interface DenueAnalyticalRelationValidationResult {
  valid: boolean;
  reasons: DenueAnalyticalRelationValidationReason[];
}

export interface DenueAnalyticalRelationBuildResult {
  relation: DenueAnalyticalRelation;
  validation: DenueAnalyticalRelationValidationResult;
}

const RELATION_TYPES = new Set<DenueAnalyticalRelationType>([
  "SPATIAL_PROXIMITY",
  "EXPLICIT_SOURCE_LINK",
  "EVIDENCE_COINCIDENCE",
  "FINDING_RELATION",
  "HYPOTHESIS_SUPPORT",
  "HYPOTHESIS_CONTRADICTION",
  "CONTEXTUAL_ASSOCIATION",
  "MULTISOURCE_CORROBORATION",
]);

const MACHINE_STATUSES = new Set<DenueMachineAssessmentStatus>(["DETECTED", "PROPOSED", "INSUFFICIENT"]);
const HUMAN_STATUSES = new Set<DenueHumanValidationStatus>(["PENDING", "ACCEPTED", "REJECTED", "REQUIRES_REVISION"]);
const PUBLICATION_ELIGIBILITIES = new Set<PublicationEligibility>(["ELIGIBLE", "ELIGIBLE_WITH_DISCLOSURE", "INELIGIBLE"]);
const TEMPORAL_COMPATIBILITIES = new Set<ConvergenceCompatibility>(["COMPATIBLE", "PARTIAL", "INCOMPATIBLE", "UNKNOWN"]);
const SOURCE_INDEPENDENCE_STATUSES = new Set<SourceIndependence>(["INDEPENDENT", "PARTIALLY_DEPENDENT", "DERIVED", "UNKNOWN"]);
const LINEAGE_NODE_TYPES = new Set(["GEOGRAPHY", "SOURCE", "EVIDENCE", "FINDING", "INFERENCE", "ANALYSIS", "CONCLUSION"]);
const HUMAN_DECISIONS_REQUIRING_METADATA = new Set<DenueHumanValidationStatus>(["ACCEPTED", "REJECTED", "REQUIRES_REVISION"]);
const FORBIDDEN_FIELDS = new Set([
  "riskScore",
  "riskLevel",
  "vulnerabilityScore",
  "criminogenicity",
  "dangerLevel",
  "ipt",
  "weightedScore",
  "ranking",
  "rank",
  "threshold",
]);
const PROHIBITED_MEASURED_FACT_LANGUAGE = /(?:\b(vulnerable|vulnerability|vulnerabilidad|dangerous|peligros[oa]|criminogenic|criminogenic[oa]|riesgo|risk)\b|risk(?:score|level)|vulnerabilityscore|dangerlevel|criminogenicity)/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(present);
}

function duplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasRelation(relation: Record<string, unknown>, type: DenueAnalyticalRelationType): boolean {
  return Array.isArray(relation.relationTypes) && relation.relationTypes.includes(type);
}

function hasLimitation(relation: Record<string, unknown>, code: string): boolean {
  return Array.isArray(relation.limitations) && relation.limitations.some((item) => record(item) && item.code === code);
}

function validateStringIds(
  value: unknown,
  invalidReason: DenueAnalyticalRelationValidationReason,
  duplicateReason: DenueAnalyticalRelationValidationReason,
  reasons: DenueAnalyticalRelationValidationReason[]
) {
  if (!stringArray(value)) {
    reasons.push(invalidReason);
    return;
  }
  if (duplicates(value)) reasons.push(duplicateReason);
}

function validateSpatialMetrics(value: unknown, required: boolean, reasons: DenueAnalyticalRelationValidationReason[]) {
  if (value === null || value === undefined) {
    if (required) reasons.push("SPATIAL_METRIC_REQUIRED");
    return;
  }
  if (!record(value) || value.unit !== "METERS" || !present(value.method)) {
    reasons.push("SPATIAL_METRICS_INVALID");
    return;
  }
  const numericKeys = ["distanceMeters", "distanceToBoundaryMeters", "distanceToCorridorMeters"];
  for (const key of numericKeys) {
    const metric = value[key];
    if (metric !== undefined && metric !== null && !finiteNonNegative(metric)) reasons.push("SPATIAL_METRICS_INVALID");
  }
  if (value.insideCanonicalGeography !== undefined && value.insideCanonicalGeography !== null && typeof value.insideCanonicalGeography !== "boolean") {
    reasons.push("SPATIAL_METRICS_INVALID");
  }
  const hasMetric = numericKeys.some((key) => value[key] !== undefined && value[key] !== null) ||
    typeof value.insideCanonicalGeography === "boolean";
  if (required && !hasMetric) reasons.push("SPATIAL_METRIC_REQUIRED");
}

function validateSourceIndependence(
  relation: Record<string, unknown>,
  linkedSourceRefs: string[],
  reasons: DenueAnalyticalRelationValidationReason[]
) {
  const value = relation.sourceIndependence;
  if (!record(value) || !SOURCE_INDEPENDENCE_STATUSES.has(value.status as SourceIndependence) ||
    !stringArray(value.assessedSourceRefs) || !stringArray(value.independentSourceRefs) || !stringArray(value.rationale)) {
    reasons.push("SOURCE_INDEPENDENCE_INVALID");
    return;
  }
  if (duplicates(value.assessedSourceRefs) || duplicates(value.independentSourceRefs) || duplicates(value.rationale)) {
    reasons.push("SOURCE_INDEPENDENCE_INVALID");
  }
  const allKnown = [...value.assessedSourceRefs, ...value.independentSourceRefs].every((sourceRef) => linkedSourceRefs.includes(sourceRef));
  if (!allKnown) reasons.push("SOURCE_INDEPENDENCE_INVALID");
  if (hasRelation(relation, "MULTISOURCE_CORROBORATION")) {
    if (value.status === "UNKNOWN" || value.independentSourceRefs.length < 2 || value.rationale.length === 0) {
      reasons.push("MULTISOURCE_INDEPENDENCE_REQUIRED");
    }
  }
}

function validateMeasuredFacts(value: unknown, reasons: DenueAnalyticalRelationValidationReason[]) {
  if (!Array.isArray(value)) {
    reasons.push("MEASURED_FACTS_INVALID");
    return;
  }
  const ids: string[] = [];
  for (const fact of value) {
    if (!record(fact) || !present(fact.factId) || !present(fact.metric) ||
      !(typeof fact.value === "string" || typeof fact.value === "number" || typeof fact.value === "boolean") ||
      (typeof fact.value === "number" && !Number.isFinite(fact.value)) || !stringArray(fact.sourceRefs)) {
      reasons.push("MEASURED_FACTS_INVALID");
      continue;
    }
    ids.push(fact.factId);
    if (PROHIBITED_MEASURED_FACT_LANGUAGE.test(fact.metric) ||
      (typeof fact.value === "string" && PROHIBITED_MEASURED_FACT_LANGUAGE.test(fact.value))) {
      reasons.push("MEASURED_FACT_PROHIBITED_INTERPRETATION");
    }
  }
  if (duplicates(ids)) reasons.push("MEASURED_FACTS_INVALID");
}

function validateProposedInterpretations(value: unknown, reasons: DenueAnalyticalRelationValidationReason[]) {
  if (!Array.isArray(value)) {
    reasons.push("PROPOSED_INTERPRETATIONS_INVALID");
    return;
  }
  const ids: string[] = [];
  for (const interpretation of value) {
    if (!record(interpretation) || !present(interpretation.interpretationId) ||
      interpretation.status !== "PROPOSED" || !present(interpretation.text) || !stringArray(interpretation.sourceRefs)) {
      reasons.push("PROPOSED_INTERPRETATIONS_INVALID");
      continue;
    }
    ids.push(interpretation.interpretationId);
  }
  if (duplicates(ids)) reasons.push("PROPOSED_INTERPRETATIONS_INVALID");
}

function validateLimitations(value: unknown, reasons: DenueAnalyticalRelationValidationReason[]) {
  if (!Array.isArray(value) || value.length === 0) {
    reasons.push("LIMITATIONS_REQUIRED");
    return;
  }
  const keys: string[] = [];
  for (const limitation of value) {
    if (!record(limitation) || !present(limitation.code) || !/^[A-Z][A-Z0-9_]*$/.test(limitation.code) ||
      (limitation.detail !== undefined && limitation.detail !== null && !present(limitation.detail))) {
      reasons.push("LIMITATIONS_INVALID");
      continue;
    }
    keys.push(`${limitation.code}\u0000${limitation.detail ?? ""}`);
  }
  if (duplicates(keys)) reasons.push("LIMITATIONS_INVALID");
}

function validateHumanValidation(value: unknown, reasons: DenueAnalyticalRelationValidationReason[]) {
  if (!record(value) || !HUMAN_STATUSES.has(value.status as DenueHumanValidationStatus)) {
    reasons.push("HUMAN_VALIDATION_INVALID");
    return;
  }
  const metadataRequired = HUMAN_DECISIONS_REQUIRING_METADATA.has(value.status as DenueHumanValidationStatus);
  if (metadataRequired && (!present(value.validatedBy) || !present(value.validatedAt) || !present(value.rationale))) {
    reasons.push("HUMAN_VALIDATION_METADATA_REQUIRED");
  }
  if (present(value.validatedAt) && !Number.isFinite(Date.parse(value.validatedAt))) {
    reasons.push("HUMAN_VALIDATION_DATE_INVALID");
  }
}

function validateLineageContract(
  value: unknown,
  sourceEvidenceId: string,
  geographyId: string,
  reasons: DenueAnalyticalRelationValidationReason[]
) {
  if (!Array.isArray(value) || value.length === 0 || value.some((node) => !record(node) || !present(node.id) || !present(node.type))) {
    reasons.push("LINEAGE_REQUIRED");
    return;
  }
  if (value.some((node) => !LINEAGE_NODE_TYPES.has(node.type as string))) reasons.push("LINEAGE_INVALID");
  const validation = validateLineage(value as CanonicalLineageNode[]);
  if (validation.status !== "SUPPORTED") reasons.push("LINEAGE_INVALID");
  if (!value.some((node) => node.type === "EVIDENCE" && node.evidenceId === sourceEvidenceId)) {
    reasons.push("LINEAGE_SOURCE_EVIDENCE_REQUIRED");
  }
  if (value.some((node) => present(node.geographyId) && node.geographyId !== geographyId)) {
    reasons.push("LINEAGE_GEOGRAPHY_MISMATCH");
  }
}

function findForbiddenFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(findForbiddenFields);
  if (!record(value)) return false;
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_FIELDS.has(key) || findForbiddenFields(nested));
}

export function validateDenueAnalyticalRelation(input: unknown): DenueAnalyticalRelationValidationResult {
  if (!record(input)) return { valid: false, reasons: ["RELATION_REQUIRED"] };
  const reasons: DenueAnalyticalRelationValidationReason[] = [];
  const requiredStrings: Array<[keyof DenueAnalyticalRelation, DenueAnalyticalRelationValidationReason]> = [
    ["relationId", "RELATION_ID_REQUIRED"],
    ["denueLayerId", "DENUE_LAYER_ID_REQUIRED"],
    ["sourceEvidenceId", "SOURCE_EVIDENCE_ID_REQUIRED"],
    ["expedienteId", "EXPEDIENTE_ID_REQUIRED"],
    ["geographyId", "GEOGRAPHY_ID_REQUIRED"],
    ["methodologyVersion", "METHODOLOGY_VERSION_REQUIRED"],
  ];
  for (const [key, reason] of requiredStrings) if (!present(input[key])) reasons.push(reason);

  if (!Array.isArray(input.relationTypes) || input.relationTypes.length === 0) {
    reasons.push("RELATION_TYPES_REQUIRED");
  } else {
    if (input.relationTypes.some((type) => !RELATION_TYPES.has(type as DenueAnalyticalRelationType))) reasons.push("RELATION_TYPE_INVALID");
    if (duplicates(input.relationTypes.filter(present))) reasons.push("RELATION_TYPES_DUPLICATED");
  }

  validateStringIds(input.linkedEvidenceIds, "LINKED_EVIDENCE_IDS_INVALID", "LINKED_EVIDENCE_IDS_DUPLICATED", reasons);
  validateStringIds(input.linkedFindingIds, "LINKED_FINDING_IDS_INVALID", "LINKED_FINDING_IDS_DUPLICATED", reasons);
  validateStringIds(input.linkedHypothesisRefs, "LINKED_HYPOTHESIS_REFS_INVALID", "LINKED_HYPOTHESIS_REFS_DUPLICATED", reasons);
  validateStringIds(input.linkedSourceRefs, "LINKED_SOURCE_REFS_INVALID", "LINKED_SOURCE_REFS_DUPLICATED", reasons);

  const linkedEvidenceIds = stringArray(input.linkedEvidenceIds) ? input.linkedEvidenceIds : [];
  const linkedFindingIds = stringArray(input.linkedFindingIds) ? input.linkedFindingIds : [];
  const linkedHypothesisRefs = stringArray(input.linkedHypothesisRefs) ? input.linkedHypothesisRefs : [];
  const linkedSourceRefs = stringArray(input.linkedSourceRefs) ? input.linkedSourceRefs : [];

  validateSpatialMetrics(input.spatialMetrics, hasRelation(input, "SPATIAL_PROXIMITY"), reasons);
  if (hasRelation(input, "EXPLICIT_SOURCE_LINK") && linkedSourceRefs.length === 0) reasons.push("EXPLICIT_SOURCE_LINK_REQUIRED");
  if (hasRelation(input, "EVIDENCE_COINCIDENCE") && linkedEvidenceIds.length === 0) reasons.push("EVIDENCE_LINK_REQUIRED");
  if (hasRelation(input, "FINDING_RELATION") && linkedFindingIds.length === 0) reasons.push("FINDING_LINK_REQUIRED");
  if ((hasRelation(input, "HYPOTHESIS_SUPPORT") || hasRelation(input, "HYPOTHESIS_CONTRADICTION")) && linkedHypothesisRefs.length === 0) {
    reasons.push("HYPOTHESIS_LINK_REQUIRED");
  }
  if (hasRelation(input, "CONTEXTUAL_ASSOCIATION") && !hasLimitation(input, "CONTEXT_NOT_CAUSALITY")) {
    reasons.push("CONTEXT_NOT_CAUSALITY_LIMITATION_REQUIRED");
  }
  if (hasRelation(input, "SPATIAL_PROXIMITY") && !hasLimitation(input, "PROXIMITY_NOT_CAUSALITY")) {
    reasons.push("PROXIMITY_NOT_CAUSALITY_LIMITATION_REQUIRED");
  }

  if (!TEMPORAL_COMPATIBILITIES.has(input.temporalCompatibility as ConvergenceCompatibility)) {
    reasons.push("TEMPORAL_COMPATIBILITY_INVALID");
  }
  validateSourceIndependence(input, linkedSourceRefs, reasons);
  validateLineageContract(input.lineage, present(input.sourceEvidenceId) ? input.sourceEvidenceId : "", present(input.geographyId) ? input.geographyId : "", reasons);
  validateMeasuredFacts(input.measuredFacts, reasons);
  validateProposedInterpretations(input.proposedInterpretations, reasons);
  validateLimitations(input.limitations, reasons);

  if (!record(input.machineAssessment) || !MACHINE_STATUSES.has(input.machineAssessment.status as DenueMachineAssessmentStatus) ||
    !stringArray(input.machineAssessment.reasonCodes) || duplicates(input.machineAssessment.reasonCodes)) {
    reasons.push("MACHINE_ASSESSMENT_INVALID");
  } else {
    const measuredCount = Array.isArray(input.measuredFacts) ? input.measuredFacts.length : 0;
    const proposedCount = Array.isArray(input.proposedInterpretations) ? input.proposedInterpretations.length : 0;
    if (input.machineAssessment.status === "DETECTED" && proposedCount > 0) reasons.push("DETECTED_CANNOT_CONTAIN_PROPOSED_INTERPRETATIONS");
    if (input.machineAssessment.status === "DETECTED" && measuredCount === 0) reasons.push("DETECTED_REQUIRES_MEASURED_FACT");
    if (input.machineAssessment.status === "PROPOSED" && measuredCount === 0 && proposedCount === 0) reasons.push("PROPOSED_REQUIRES_CONTENT");
  }

  validateHumanValidation(input.humanValidation, reasons);
  if (!PUBLICATION_ELIGIBILITIES.has(input.publicationEligibility as PublicationEligibility)) {
    reasons.push("PUBLICATION_ELIGIBILITY_INVALID");
  }
  const humanStatus = record(input.humanValidation) ? input.humanValidation.status : null;
  if (input.publicationEligibility !== "INELIGIBLE" && humanStatus !== "ACCEPTED") {
    reasons.push("HUMAN_ACCEPTANCE_REQUIRED_FOR_PUBLICATION");
  }
  if (input.publicationEligibility !== "INELIGIBLE" &&
    record(input.machineAssessment) && input.machineAssessment.status === "INSUFFICIENT") {
    reasons.push("INSUFFICIENT_NOT_PUBLICABLE");
  }
  if (!hasLimitation(input, "DENUE_NOT_CRIMINAL_EVIDENCE")) {
    reasons.push("DENUE_NOT_CRIMINAL_EVIDENCE_LIMITATION_REQUIRED");
  }
  if (humanStatus !== "ACCEPTED" && !hasLimitation(input, "HUMAN_VALIDATION_REQUIRED")) {
    reasons.push("HUMAN_VALIDATION_REQUIRED_LIMITATION_REQUIRED");
  }
  if (findForbiddenFields(input)) reasons.push("FORBIDDEN_RISK_OR_SCORING_FIELD");

  const uniqueReasons = Array.from(new Set(reasons)).sort((left, right) => left.localeCompare(right));
  return { valid: uniqueReasons.length === 0, reasons: uniqueReasons };
}

function normalizeLineageNode(node: CanonicalLineageNode): CanonicalLineageNode {
  return {
    ...node,
    ...(node.supportingEvidenceIds ? { supportingEvidenceIds: sortedUnique(node.supportingEvidenceIds) } : {}),
    ...(node.derivedFromFindingIds ? { derivedFromFindingIds: sortedUnique(node.derivedFromFindingIds) } : {}),
    ...(node.supportingFindingIds ? { supportingFindingIds: sortedUnique(node.supportingFindingIds) } : {}),
    ...(node.supportingInferenceIds ? { supportingInferenceIds: sortedUnique(node.supportingInferenceIds) } : {}),
    ...(node.supportingAnalysisIds ? { supportingAnalysisIds: sortedUnique(node.supportingAnalysisIds) } : {}),
  };
}

export function normalizeDenueAnalyticalRelation(input: DenueAnalyticalRelation): DenueAnalyticalRelation {
  const normalized: DenueAnalyticalRelation = {
    ...input,
    relationTypes: sortedUnique(input.relationTypes) as DenueAnalyticalRelationType[],
    linkedEvidenceIds: sortedUnique(input.linkedEvidenceIds),
    linkedFindingIds: sortedUnique(input.linkedFindingIds),
    linkedHypothesisRefs: sortedUnique(input.linkedHypothesisRefs),
    linkedSourceRefs: sortedUnique(input.linkedSourceRefs),
    spatialMetrics: input.spatialMetrics ? { ...input.spatialMetrics } : null,
    sourceIndependence: {
      ...input.sourceIndependence,
      assessedSourceRefs: sortedUnique(input.sourceIndependence.assessedSourceRefs),
      independentSourceRefs: sortedUnique(input.sourceIndependence.independentSourceRefs),
      rationale: sortedUnique(input.sourceIndependence.rationale),
    },
    lineage: input.lineage
      .map(normalizeLineageNode)
      .sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`)),
    measuredFacts: input.measuredFacts
      .map((fact) => ({ ...fact, sourceRefs: sortedUnique(fact.sourceRefs) }))
      .sort((left, right) => left.factId.localeCompare(right.factId)),
    proposedInterpretations: input.proposedInterpretations
      .map((interpretation) => ({ ...interpretation, sourceRefs: sortedUnique(interpretation.sourceRefs) }))
      .sort((left, right) => left.interpretationId.localeCompare(right.interpretationId)),
    limitations: input.limitations
      .map((limitation) => ({ ...limitation }))
      .filter((limitation, index, values) => values.findIndex((candidate) =>
        candidate.code === limitation.code && candidate.detail === limitation.detail) === index)
      .sort((left, right) => `${left.code}:${left.detail ?? ""}`.localeCompare(`${right.code}:${right.detail ?? ""}`)),
    machineAssessment: {
      ...input.machineAssessment,
      reasonCodes: sortedUnique(input.machineAssessment.reasonCodes),
    },
    humanValidation: { ...input.humanValidation },
  };
  return normalized;
}

export function buildDenueAnalyticalRelation(input: DenueAnalyticalRelation): DenueAnalyticalRelationBuildResult {
  const inputValidation = validateDenueAnalyticalRelation(input);
  const relation = normalizeDenueAnalyticalRelation(input);
  return {
    relation,
    validation: inputValidation.valid ? validateDenueAnalyticalRelation(relation) : inputValidation,
  };
}
