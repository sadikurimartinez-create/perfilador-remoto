import type { DenueAnalyticalRelation, DenueAnalyticalRelationType } from "../src/utils/denueAnalyticalRelation";
import {
  assessDenueAnalyticalPublication,
  type DenueAnalyticalPublicationInput,
} from "../src/utils/denueAnalyticalPublicationGate";
import {
  appendDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "../src/utils/denueAnalyticalReviewLedger";
import { buildEvidenceLineage, type CanonicalLineageNode } from "../src/utils/evidenceLineage";

const EXPEDIENTE_ID = "exp-r32b6e";
const GEOGRAPHY_ID = "geo-r32b6e";
const METHODOLOGY = "ADR-026:R3.2B.6E:v1";

function denueLineage(): CanonicalLineageNode[] {
  return buildEvidenceLineage({
    sourceId: "INEGI_DENUE",
    sourceReference: "denue://query/1",
    evidenceId: "denue:evidence:1",
    geographyId: GEOGRAPHY_ID,
    geographyType: "INDIVIDUAL",
  });
}

function fieldLineage(): CanonicalLineageNode[] {
  return buildEvidenceLineage({
    sourceId: "CEIPOL_FIELD",
    sourceReference: "field://capture/1",
    evidenceId: "field:evidence:1",
    geographyId: GEOGRAPHY_ID,
    geographyType: "INDIVIDUAL",
  });
}

function relation(
  relationType: DenueAnalyticalRelationType = "SPATIAL_PROXIMITY",
  overrides: Partial<DenueAnalyticalRelation> = {}
): DenueAnalyticalRelation {
  const linkedEvidenceIds = relationType === "EVIDENCE_COINCIDENCE" || relationType === "FINDING_RELATION"
    ? ["field:evidence:1"]
    : [];
  const linkedFindingIds = relationType === "FINDING_RELATION" ? ["finding:1"] : [];
  const linkedHypothesisRefs = relationType === "HYPOTHESIS_SUPPORT" || relationType === "HYPOTHESIS_CONTRADICTION"
    ? ["hypothesis:1:v1"]
    : [];
  const linkedSourceRefs = relationType === "EXPLICIT_SOURCE_LINK" || relationType === "MULTISOURCE_CORROBORATION"
    ? ["denue:evidence:1", "field:evidence:1"]
    : ["denue:evidence:1", "field:evidence:1"];
  const findingNode: CanonicalLineageNode = {
    id: "finding:1",
    type: "FINDING",
    findingId: "finding:1",
    geographyId: GEOGRAPHY_ID,
    supportingEvidenceIds: ["field:evidence:1"],
  };
  const lineage = [
    ...denueLineage(),
    ...(relationType === "EVIDENCE_COINCIDENCE" || relationType === "FINDING_RELATION" ? fieldLineage() : []),
    ...(relationType === "FINDING_RELATION" ? [findingNode] : []),
  ];
  const limitations = [
    { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
    { code: "HUMAN_VALIDATION_REQUIRED" },
    ...(relationType === "SPATIAL_PROXIMITY" ? [{ code: "PROXIMITY_NOT_CAUSALITY" }] : []),
    ...(relationType === "CONTEXTUAL_ASSOCIATION" ? [{ code: "CONTEXT_NOT_CAUSALITY" }] : []),
  ];
  return {
    relationId: `relation:${relationType.toLowerCase()}`,
    denueLayerId: "denue:evidence:1",
    sourceEvidenceId: "denue:evidence:1",
    expedienteId: EXPEDIENTE_ID,
    geographyId: GEOGRAPHY_ID,
    relationTypes: [relationType],
    linkedEvidenceIds,
    linkedFindingIds,
    linkedHypothesisRefs,
    linkedSourceRefs,
    spatialMetrics: relationType === "SPATIAL_PROXIMITY"
      ? { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 24 }
      : null,
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: relationType === "MULTISOURCE_CORROBORATION"
      ? {
          status: "INDEPENDENT",
          assessedSourceRefs: linkedSourceRefs,
          independentSourceRefs: linkedSourceRefs,
          rationale: ["DISTINCT_SOURCE_FAMILIES"],
        }
      : {
          status: "UNKNOWN",
          assessedSourceRefs: linkedSourceRefs,
          independentSourceRefs: [],
          rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
        },
    lineage,
    measuredFacts: [{
      factId: `fact:${relationType.toLowerCase()}`,
      metric: relationType === "SPATIAL_PROXIMITY" ? "distanceMeters" : "formalRelationObserved",
      value: relationType === "SPATIAL_PROXIMITY" ? 24 : true,
      unit: relationType === "SPATIAL_PROXIMITY" ? "METERS" : null,
      sourceRefs: linkedSourceRefs,
    }],
    proposedInterpretations: [],
    limitations,
    machineAssessment: { status: "DETECTED", reasonCodes: ["GOVERNED_RELATION_DETECTED"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: METHODOLOGY,
    ...overrides,
  };
}

function reviewedInput(base = relation(), nextStatus: "ACCEPTED" | "REJECTED" | "REQUIRES_REVISION" = "ACCEPTED"): DenueAnalyticalPublicationInput {
  const ledger = createDenueAnalyticalReviewLedger(base);
  if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
  const reviewEvent = buildDenueAnalyticalReviewEvent(base, {
    nextStatus,
    reviewedBy: "ppc-1",
    reviewedAt: "2026-09-29T16:00:00.000Z",
    rationale: `Decision PPC ${nextStatus}.`,
  });
  const reviewed = appendDenueAnalyticalReviewEvent(base, ledger.ledger, reviewEvent);
  if (reviewed.status !== "VALID") throw new Error(reviewed.reasons.join(","));
  return { baseRelation: base, relation: reviewed.relation, ledger: reviewed.ledger };
}

describe("R3.2B.6E DENUE analytical publication gate", () => {
  test.each([
    "SPATIAL_PROXIMITY",
    "EXPLICIT_SOURCE_LINK",
    "EVIDENCE_COINCIDENCE",
    "FINDING_RELATION",
    "HYPOTHESIS_SUPPORT",
    "HYPOTHESIS_CONTRADICTION",
    "CONTEXTUAL_ASSOCIATION",
    "MULTISOURCE_CORROBORATION",
  ] as DenueAnalyticalRelationType[])("%s aceptada con ledger vigente es ELIGIBLE", (relationType) => {
    const decision = assessDenueAnalyticalPublication(reviewedInput(relation(relationType)));
    expect(decision.eligible).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.relationFingerprint).not.toBe("UNAVAILABLE");
  });

  test("PENDING permanece INELIGIBLE", () => {
    const base = relation();
    const ledger = createDenueAnalyticalReviewLedger(base);
    if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
    const decision = assessDenueAnalyticalPublication({ baseRelation: base, relation: base, ledger: ledger.ledger });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("HUMAN_VALIDATION_NOT_ACCEPTED:PENDING");
  });

  test.each(["REJECTED", "REQUIRES_REVISION"] as const)("%s permanece INELIGIBLE", (status) => {
    const decision = assessDenueAnalyticalPublication(reviewedInput(relation(), status));
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain(`HUMAN_VALIDATION_NOT_ACCEPTED:${status}`);
  });

  test("machineAssessment INSUFFICIENT permanece INELIGIBLE", () => {
    const base = relation("SPATIAL_PROXIMITY", {
      machineAssessment: { status: "INSUFFICIENT", reasonCodes: ["INSUFFICIENT_SOURCE_SUPPORT"] },
    });
    const decision = assessDenueAnalyticalPublication(reviewedInput(base));
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("MACHINE_ASSESSMENT_INSUFFICIENT");
  });

  test("ACCEPTED y ledger valido no rescatan una relacion invalida", () => {
    const input = reviewedInput();
    const invalid = { ...input.relation, limitations: [] };
    const decision = assessDenueAnalyticalPublication({ ...input, relation: invalid });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("RELATION_INVALID");
  });

  test("fingerprint material distinto queda INELIGIBLE", () => {
    const input = reviewedInput();
    const changed = {
      ...input.relation,
      spatialMetrics: { ...input.relation.spatialMetrics!, distanceMeters: 35 },
      measuredFacts: input.relation.measuredFacts.map((fact) => ({ ...fact, value: 35 })),
    };
    const decision = assessDenueAnalyticalPublication({ ...input, relation: changed });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(["LEDGER_CURRENT_RELATION_MISMATCH", "RELATION_FINGERPRINT_MISMATCH"]));
  });

  test("methodologyVersion distinta queda INELIGIBLE", () => {
    const input = reviewedInput();
    const changed = { ...input.relation, methodologyVersion: "ADR-026:R3.2B.6E:v2" };
    const decision = assessDenueAnalyticalPublication({ ...input, relation: changed });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("METHODOLOGY_VERSION_MISMATCH");
  });

  test("lineage invalido queda INELIGIBLE", () => {
    const input = reviewedInput();
    const decision = assessDenueAnalyticalPublication({ ...input, relation: { ...input.relation, lineage: [] } });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("RELATION_INVALID");
  });

  test("ledger invalido queda INELIGIBLE", () => {
    const input = reviewedInput();
    const decision = assessDenueAnalyticalPublication({
      ...input,
      ledger: { ...input.ledger, relationFingerprint: "fingerprint-alterado" },
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      "LEDGER_INVALID",
      "LEDGER:LEDGER_FINGERPRINT_MISMATCH",
    ]));
  });

  test("conflicto de identidad fuerza INELIGIBLE", () => {
    const decision = assessDenueAnalyticalPublication({ ...reviewedInput(), identityConflict: true });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("IDENTITY_CONFLICT");
  });

  test("gate no muta relacion, base ni ledger", () => {
    const input = reviewedInput();
    const snapshot = JSON.stringify(input);
    assessDenueAnalyticalPublication(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
