import {
  normalizeDenueAnalyticalRelation,
  validateDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
  type DenueAnalyticalRelationType,
} from "@/utils/denueAnalyticalRelation";
import {
  fingerprintDenueAnalyticalRelation,
  validateDenueAnalyticalReviewLedger,
  type DenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";

export interface DenueAnalyticalPublicationDecision {
  relationId: string;
  eligible: boolean;
  reasons: string[];
  methodologyVersion: string;
  relationFingerprint: string;
  expedienteId: string;
  geographyId: string;
}

export interface DenueAnalyticalPublicationInput {
  baseRelation: DenueAnalyticalRelation;
  relation: DenueAnalyticalRelation;
  ledger: DenueAnalyticalReviewLedger;
  identityConflict?: boolean;
}

const RELATION_TYPES: DenueAnalyticalRelationType[] = [
  "SPATIAL_PROXIMITY",
  "EXPLICIT_SOURCE_LINK",
  "EVIDENCE_COINCIDENCE",
  "FINDING_RELATION",
  "HYPOTHESIS_SUPPORT",
  "HYPOTHESIS_CONTRADICTION",
  "CONTEXTUAL_ASSOCIATION",
  "MULTISOURCE_CORROBORATION",
];

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function relationContent(relation: DenueAnalyticalRelation): string {
  return JSON.stringify(normalizeDenueAnalyticalRelation(relation));
}

function hasLimitation(relation: DenueAnalyticalRelation, code: string): boolean {
  return relation.limitations.some((limitation) => limitation.code === code);
}

function hasLineageIdentity(relation: DenueAnalyticalRelation, type: "EVIDENCE" | "FINDING", identity: string): boolean {
  return relation.lineage.some((node) =>
    node.type === type && [node.id, node.evidenceId, node.findingId].some((candidate) => candidate === identity)
  );
}

function validateTypeRequirements(relation: DenueAnalyticalRelation): string[] {
  const reasons: string[] = [];
  for (const relationType of relation.relationTypes) {
    if (!RELATION_TYPES.includes(relationType)) reasons.push("RELATION_TYPE_INVALID");
    if (relationType === "SPATIAL_PROXIMITY") {
      if (!relation.spatialMetrics || relation.spatialMetrics.distanceMeters == null) reasons.push("SPATIAL_DISTANCE_REQUIRED");
      if (!hasLimitation(relation, "PROXIMITY_NOT_CAUSALITY")) reasons.push("PROXIMITY_DISCLOSURE_REQUIRED");
    }
    if (relationType === "EXPLICIT_SOURCE_LINK" && relation.linkedSourceRefs.length < 2) {
      reasons.push("EXPLICIT_SOURCE_LINK_REQUIRED");
    }
    if (relationType === "EVIDENCE_COINCIDENCE") {
      if (relation.linkedEvidenceIds.length === 0) reasons.push("LINKED_EVIDENCE_REQUIRED");
      if (!relation.linkedEvidenceIds.every((id) => hasLineageIdentity(relation, "EVIDENCE", id))) {
        reasons.push("LINKED_EVIDENCE_LINEAGE_REQUIRED");
      }
    }
    if (relationType === "FINDING_RELATION") {
      if (relation.linkedFindingIds.length === 0) reasons.push("LINKED_FINDING_REQUIRED");
      if (!relation.linkedFindingIds.every((id) => hasLineageIdentity(relation, "FINDING", id))) {
        reasons.push("LINKED_FINDING_LINEAGE_REQUIRED");
      }
    }
    if ((relationType === "HYPOTHESIS_SUPPORT" || relationType === "HYPOTHESIS_CONTRADICTION") && relation.linkedHypothesisRefs.length === 0) {
      reasons.push("LINKED_HYPOTHESIS_REQUIRED");
    }
    if (relationType === "CONTEXTUAL_ASSOCIATION" && !hasLimitation(relation, "CONTEXT_NOT_CAUSALITY")) {
      reasons.push("CONTEXT_DISCLOSURE_REQUIRED");
    }
    if (relationType === "MULTISOURCE_CORROBORATION") {
      if (relation.sourceIndependence.status === "UNKNOWN" || relation.sourceIndependence.independentSourceRefs.length < 2) {
        reasons.push("MULTISOURCE_INDEPENDENCE_REQUIRED");
      }
      if (relation.sourceIndependence.rationale.length === 0) reasons.push("MULTISOURCE_RATIONALE_REQUIRED");
    }
  }
  return reasons;
}

export function assessDenueAnalyticalPublication(
  input: DenueAnalyticalPublicationInput
): DenueAnalyticalPublicationDecision {
  const relation = input?.relation;
  const reasons: string[] = [];
  const relationFingerprint = relation ? fingerprintDenueAnalyticalRelation(relation) : "UNAVAILABLE";

  if (!relation || !validateDenueAnalyticalRelation(relation).valid) reasons.push("RELATION_INVALID");
  if (relation?.humanValidation.status !== "ACCEPTED") reasons.push(`HUMAN_VALIDATION_NOT_ACCEPTED:${relation?.humanValidation.status || "UNKNOWN"}`);
  if (relation?.publicationEligibility !== "INELIGIBLE") reasons.push("RELATION_PREMATURELY_PUBLICABLE");
  if (relation?.machineAssessment.status === "INSUFFICIENT") reasons.push("MACHINE_ASSESSMENT_INSUFFICIENT");
  if (!present(relation?.sourceEvidenceId)) reasons.push("SOURCE_EVIDENCE_ID_REQUIRED");
  if (!Array.isArray(relation?.relationTypes) || relation.relationTypes.length === 0) reasons.push("RELATION_TYPES_REQUIRED");
  if (!Array.isArray(relation?.limitations) || relation.limitations.length === 0) reasons.push("LIMITATIONS_REQUIRED");
  if (input?.identityConflict === true) reasons.push("IDENTITY_CONFLICT");

  if (relation) reasons.push(...validateTypeRequirements(relation));

  const ledgerValidation = input?.baseRelation && input?.ledger
    ? validateDenueAnalyticalReviewLedger(input.baseRelation, input.ledger)
    : null;
  if (!ledgerValidation || ledgerValidation.status !== "VALID") {
    reasons.push("LEDGER_INVALID");
    if (ledgerValidation?.status === "REJECTED") {
      reasons.push(...ledgerValidation.reasons.map((reason) => `LEDGER:${reason}`));
    }
  } else if (relation) {
    if (relationContent(ledgerValidation.relation) !== relationContent(relation)) reasons.push("LEDGER_CURRENT_RELATION_MISMATCH");
    if (ledgerValidation.ledger.relationFingerprint !== relationFingerprint) reasons.push("RELATION_FINGERPRINT_MISMATCH");
    if (ledgerValidation.ledger.methodologyVersion !== relation.methodologyVersion) reasons.push("METHODOLOGY_VERSION_MISMATCH");
    if (ledgerValidation.ledger.expedienteId !== relation.expedienteId) reasons.push("EXPEDIENTE_ID_MISMATCH");
    if (ledgerValidation.ledger.geographyId !== relation.geographyId) reasons.push("GEOGRAPHY_ID_MISMATCH");
    const currentEvent = ledgerValidation.ledger.events[ledgerValidation.ledger.events.length - 1];
    if (!currentEvent || currentEvent.nextStatus !== "ACCEPTED") reasons.push("CURRENT_PPC_ACCEPTANCE_REQUIRED");
  }

  const normalizedReasons = uniqueSorted(reasons);
  return {
    relationId: relation?.relationId || "UNAVAILABLE",
    eligible: normalizedReasons.length === 0,
    reasons: normalizedReasons,
    methodologyVersion: relation?.methodologyVersion || "UNAVAILABLE",
    relationFingerprint,
    expedienteId: relation?.expedienteId || "UNAVAILABLE",
    geographyId: relation?.geographyId || "UNAVAILABLE",
  };
}
