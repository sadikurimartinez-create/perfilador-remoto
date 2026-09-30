import type { DenueAnalyticalRelation } from "../src/utils/denueAnalyticalRelation";
import {
  appendDenueAnalyticalReviewEvent,
  applyDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
  fingerprintDenueAnalyticalRelation,
  validateDenueAnalyticalReviewEvent,
  validateDenueAnalyticalReviewLedger,
  validateDenueAnalyticalReviewTransition,
  type DenueAnalyticalReviewEvent,
} from "../src/utils/denueAnalyticalReviewLedger";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";

const REVIEWER = "ppc-maria-01";
const ACCEPTED_AT = "2026-09-29T14:00:00.000Z";

function relation(overrides: Partial<DenueAnalyticalRelation> = {}): DenueAnalyticalRelation {
  return {
    relationId: "denue-relation-review-1",
    denueLayerId: "denue:layer:1",
    sourceEvidenceId: "denue:evidence:1",
    expedienteId: "exp-r32b6d",
    geographyId: "geo-r32b6d",
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: ["field:evidence:1"],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
    spatialMetrics: {
      unit: "METERS",
      method: "SpatialLayerEngine.getDistance",
      distanceMeters: 24,
    },
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: buildEvidenceLineage({
      sourceId: "INEGI_DENUE",
      sourceReference: "denue://query/1",
      evidenceId: "denue:evidence:1",
      geographyId: "geo-r32b6d",
      geographyType: "INDIVIDUAL",
    }),
    measuredFacts: [{
      factId: "fact-distance-1",
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: ["denue:evidence:1", "field:evidence:1"],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_SPATIAL_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: "ADR-026:R3.2B.6D:v1",
    ...overrides,
  };
}

function event(
  base: DenueAnalyticalRelation,
  nextStatus: "ACCEPTED" | "REJECTED" | "REQUIRES_REVISION",
  reviewedAt = ACCEPTED_AT
) {
  return buildDenueAnalyticalReviewEvent(base, {
    nextStatus,
    reviewedBy: REVIEWER,
    reviewedAt,
    rationale: `Decision PPC: ${nextStatus}.`,
  });
}

function expectApplied(base: DenueAnalyticalRelation, reviewEvent: DenueAnalyticalReviewEvent) {
  const result = applyDenueAnalyticalReviewEvent(base, reviewEvent);
  expect(result.status).toBe("APPLIED");
  if (result.status !== "APPLIED") throw new Error(result.reasons.join(","));
  return result.relation;
}

function expectEventReason(
  base: DenueAnalyticalRelation,
  reviewEvent: DenueAnalyticalReviewEvent,
  reason: string
) {
  const validation = validateDenueAnalyticalReviewEvent(base, reviewEvent);
  expect(validation.valid).toBe(false);
  expect(validation.reasons).toContain(reason);
}

describe("R3.2B.6D DENUE analytical PPC review ledger", () => {
  test("PENDING a ACCEPTED aplica decision PPC sin habilitar publicacion", () => {
    const base = relation();
    const reviewed = expectApplied(base, event(base, "ACCEPTED"));
    expect(reviewed.humanValidation).toEqual({
      status: "ACCEPTED",
      validatedBy: REVIEWER,
      validatedAt: ACCEPTED_AT,
      rationale: "Decision PPC: ACCEPTED.",
    });
    expect(reviewed.publicationEligibility).toBe("INELIGIBLE");
  });

  test("PENDING a REJECTED conserva hechos, lineage y trazabilidad", () => {
    const base = relation();
    const reviewed = expectApplied(base, event(base, "REJECTED"));
    expect(reviewed.humanValidation.status).toBe("REJECTED");
    expect(reviewed.publicationEligibility).toBe("INELIGIBLE");
    expect(reviewed.measuredFacts).toEqual(base.measuredFacts);
    expect(reviewed.lineage).toHaveLength(base.lineage.length);
    expect(reviewed.lineage).toEqual(expect.arrayContaining(base.lineage));
    expect(reviewed.linkedSourceRefs).toEqual(base.linkedSourceRefs);
  });

  test("PENDING a REQUIRES_REVISION registra racional sin corregir la relacion", () => {
    const base = relation();
    const reviewed = expectApplied(base, event(base, "REQUIRES_REVISION"));
    expect(reviewed.humanValidation.status).toBe("REQUIRES_REVISION");
    expect(reviewed.humanValidation.rationale).toBe("Decision PPC: REQUIRES_REVISION.");
    expect(reviewed.spatialMetrics).toEqual(base.spatialMetrics);
    expect(reviewed.publicationEligibility).toBe("INELIGIBLE");
  });

  test("REQUIRES_REVISION a ACCEPTED requiere un segundo evento formal", () => {
    const base = relation();
    const revisionEvent = event(base, "REQUIRES_REVISION", "2026-09-29T14:00:00.000Z");
    const requiresRevision = expectApplied(base, revisionEvent);
    const acceptanceEvent = event(requiresRevision, "ACCEPTED", "2026-09-29T14:10:00.000Z");
    const accepted = expectApplied(requiresRevision, acceptanceEvent);
    expect(accepted.humanValidation.status).toBe("ACCEPTED");

    const initial = createDenueAnalyticalReviewLedger(base);
    if (initial.status !== "VALID") throw new Error(initial.reasons.join(","));
    const withRevision = appendDenueAnalyticalReviewEvent(base, initial.ledger, revisionEvent);
    if (withRevision.status !== "VALID") throw new Error(withRevision.reasons.join(","));
    const completed = appendDenueAnalyticalReviewEvent(base, withRevision.ledger, acceptanceEvent);
    expect(completed.status).toBe("VALID");
    if (completed.status !== "VALID") throw new Error(completed.reasons.join(","));
    expect(completed.ledger.events).toHaveLength(2);
    expect(completed.relation.humanValidation.status).toBe("ACCEPTED");
  });

  test("REQUIRES_REVISION puede reiterarse con nuevo evento y racional", () => {
    const base = relation();
    const first = event(base, "REQUIRES_REVISION", "2026-09-29T14:00:00.000Z");
    const firstRelation = expectApplied(base, first);
    const second = event(firstRelation, "REQUIRES_REVISION", "2026-09-29T14:05:00.000Z");
    expect(validateDenueAnalyticalReviewEvent(firstRelation, second)).toEqual({ valid: true, reasons: [] });
  });

  test.each([
    ["PENDING", "ACCEPTED", true],
    ["PENDING", "REJECTED", true],
    ["PENDING", "REQUIRES_REVISION", true],
    ["REQUIRES_REVISION", "ACCEPTED", true],
    ["REQUIRES_REVISION", "REJECTED", true],
    ["REQUIRES_REVISION", "REQUIRES_REVISION", true],
    ["PENDING", "PENDING", false],
    ["ACCEPTED", "PENDING", false],
    ["ACCEPTED", "REJECTED", false],
    ["ACCEPTED", "REQUIRES_REVISION", false],
    ["REJECTED", "ACCEPTED", false],
    ["REJECTED", "PENDING", false],
  ] as const)("transicion %s a %s permitida=%s", (previousStatus, nextStatus, valid) => {
    expect(validateDenueAnalyticalReviewTransition(previousStatus, nextStatus).valid).toBe(valid);
  });

  test("eventId y fingerprint son estables ante orden incidental de arrays", () => {
    const first = relation();
    const second = relation({
      linkedSourceRefs: [...first.linkedSourceRefs].reverse(),
      limitations: [...first.limitations].reverse(),
      measuredFacts: first.measuredFacts.map((fact) => ({ ...fact, sourceRefs: [...fact.sourceRefs].reverse() })),
    });
    expect(fingerprintDenueAnalyticalRelation(first)).toBe(fingerprintDenueAnalyticalRelation(second));
    expect(event(first, "ACCEPTED").eventId).toBe(event(second, "ACCEPTED").eventId);
  });

  test("mismo evento repetido es idempotente y produce un evento logico", () => {
    const base = relation();
    const reviewEvent = event(base, "ACCEPTED");
    const initial = createDenueAnalyticalReviewLedger(base);
    if (initial.status !== "VALID") throw new Error(initial.reasons.join(","));
    const once = appendDenueAnalyticalReviewEvent(base, initial.ledger, reviewEvent);
    if (once.status !== "VALID") throw new Error(once.reasons.join(","));
    const twice = appendDenueAnalyticalReviewEvent(base, once.ledger, reviewEvent);
    expect(twice.status).toBe("VALID");
    if (twice.status !== "VALID") throw new Error(twice.reasons.join(","));
    expect(twice.ledger).toEqual(once.ledger);
    expect(twice.ledger.events).toHaveLength(1);
  });

  test("aplicacion y append no mutan relacion, evento ni ledger de entrada", () => {
    const base = relation();
    const reviewEvent = event(base, "ACCEPTED");
    const initial = createDenueAnalyticalReviewLedger(base);
    if (initial.status !== "VALID") throw new Error(initial.reasons.join(","));
    const baseSnapshot = JSON.stringify(base);
    const eventSnapshot = JSON.stringify(reviewEvent);
    const ledgerSnapshot = JSON.stringify(initial.ledger);
    expectApplied(base, reviewEvent);
    appendDenueAnalyticalReviewEvent(base, initial.ledger, reviewEvent);
    expect(JSON.stringify(base)).toBe(baseSnapshot);
    expect(JSON.stringify(reviewEvent)).toBe(eventSnapshot);
    expect(JSON.stringify(initial.ledger)).toBe(ledgerSnapshot);
    expect(Object.isFrozen(reviewEvent)).toBe(true);
    expect(Object.isFrozen(initial.ledger.events)).toBe(true);
  });

  test.each(["SYSTEM", "AI", "AUTO", "BOT", "   "])("rechaza reviewedBy reservado o vacio: %s", (reviewedBy) => {
    const base = relation();
    const original = event(base, "ACCEPTED");
    const altered = { ...original, reviewedBy };
    expectEventReason(base, altered, reviewedBy.trim() ? "REVIEWER_IDENTITY_RESERVED" : "REVIEWED_BY_REQUIRED");
  });

  test("rechaza reviewedAt invalido y rationale vacio", () => {
    const base = relation();
    const original = event(base, "ACCEPTED");
    expectEventReason(base, { ...original, reviewedAt: "not-a-date" }, "REVIEWED_AT_INVALID");
    expectEventReason(base, { ...original, rationale: "   " }, "RATIONALE_REQUIRED");
  });

  test.each([
    ["relationId", "other-relation", "RELATION_ID_MISMATCH"],
    ["expedienteId", "other-expediente", "EXPEDIENTE_ID_MISMATCH"],
    ["geographyId", "other-geography", "GEOGRAPHY_ID_MISMATCH"],
    ["methodologyVersion", "ADR-026:R3.2B.6D:v2", "METHODOLOGY_VERSION_MISMATCH"],
    ["relationFingerprint", "fingerprint-other", "RELATION_FINGERPRINT_MISMATCH"],
  ] as const)("rechaza mismatch de %s", (field, value, reason) => {
    const base = relation();
    expectEventReason(base, { ...event(base, "ACCEPTED"), [field]: value }, reason);
  });

  test("rechaza PENDING a PENDING incluso con evento sintacticamente completo", () => {
    const base = relation();
    const accepted = event(base, "ACCEPTED");
    const pending = { ...accepted, nextStatus: "PENDING" as const };
    expectEventReason(base, pending, "TRANSITION_NOT_ALLOWED");
  });

  test("ACCEPTED y REJECTED son terminales para el fingerprint", () => {
    const base = relation();
    const accepted = expectApplied(base, event(base, "ACCEPTED"));
    const rejected = expectApplied(base, event(base, "REJECTED"));
    const acceptedToRejected = buildDenueAnalyticalReviewEvent(accepted, {
      nextStatus: "REJECTED", reviewedBy: REVIEWER, reviewedAt: "2026-09-29T15:00:00.000Z", rationale: "Cambio no permitido.",
    });
    const rejectedToAccepted = buildDenueAnalyticalReviewEvent(rejected, {
      nextStatus: "ACCEPTED", reviewedBy: REVIEWER, reviewedAt: "2026-09-29T15:00:00.000Z", rationale: "Cambio no permitido.",
    });
    expectEventReason(accepted, acceptedToRejected, "TRANSITION_NOT_ALLOWED");
    expectEventReason(rejected, rejectedToAccepted, "TRANSITION_NOT_ALLOWED");
  });

  test("mismo eventId con contenido distinto produce EVENT_ID_CONFLICT", () => {
    const base = relation();
    const original = event(base, "REQUIRES_REVISION");
    const conflict = { ...original, rationale: "Contenido conflictivo." };
    const ledger = createDenueAnalyticalReviewLedger(base);
    if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
    const result = validateDenueAnalyticalReviewLedger(base, {
      ...ledger.ledger,
      events: [original, conflict],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("EVENT_ID_CONFLICT");
  });

  test("historia PENDING a ACCEPTED a REJECTED falla cerrada", () => {
    const base = relation();
    const acceptedEvent = event(base, "ACCEPTED", "2026-09-29T14:00:00.000Z");
    const acceptedRelation = expectApplied(base, acceptedEvent);
    const invalidSecond = buildDenueAnalyticalReviewEvent(acceptedRelation, {
      nextStatus: "REJECTED", reviewedBy: REVIEWER, reviewedAt: "2026-09-29T14:10:00.000Z", rationale: "Transicion terminal invalida.",
    });
    const empty = createDenueAnalyticalReviewLedger(base);
    if (empty.status !== "VALID") throw new Error(empty.reasons.join(","));
    const result = validateDenueAnalyticalReviewLedger(base, {
      ...empty.ledger,
      events: [acceptedEvent, invalidSecond],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toEqual(expect.arrayContaining(["HISTORY_INCONSISTENT", "TRANSITION_NOT_ALLOWED"]));
  });

  test("historia PENDING a REJECTED a ACCEPTED falla cerrada", () => {
    const base = relation();
    const rejectedEvent = event(base, "REJECTED", "2026-09-29T14:00:00.000Z");
    const rejectedRelation = expectApplied(base, rejectedEvent);
    const invalidSecond = buildDenueAnalyticalReviewEvent(rejectedRelation, {
      nextStatus: "ACCEPTED", reviewedBy: REVIEWER, reviewedAt: "2026-09-29T14:10:00.000Z", rationale: "Transicion terminal invalida.",
    });
    const empty = createDenueAnalyticalReviewLedger(base);
    if (empty.status !== "VALID") throw new Error(empty.reasons.join(","));
    const result = validateDenueAnalyticalReviewLedger(base, { ...empty.ledger, events: [rejectedEvent, invalidSecond] });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("HISTORY_INCONSISTENT");
  });

  test("relacion base estructuralmente invalida no puede revisarse", () => {
    const invalid = relation({ relationTypes: [] });
    const reviewEvent = event(invalid, "ACCEPTED");
    expectEventReason(invalid, reviewEvent, "RELATION_BASE_INVALID");
    expect(createDenueAnalyticalReviewLedger(invalid).reasons).toContain("RELATION_BASE_INVALID");
  });

  test("cambio de methodologyVersion invalida evento y ledger anteriores", () => {
    const v1 = relation();
    const reviewEvent = event(v1, "ACCEPTED");
    const ledger = createDenueAnalyticalReviewLedger(v1);
    if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
    const v2 = relation({ methodologyVersion: "ADR-026:R3.2B.6D:v2" });
    expectEventReason(v2, reviewEvent, "METHODOLOGY_VERSION_MISMATCH");
    expect(validateDenueAnalyticalReviewLedger(v2, ledger.ledger).reasons).toEqual(expect.arrayContaining([
      "LEDGER_METHODOLOGY_VERSION_MISMATCH", "LEDGER_FINGERPRINT_MISMATCH",
    ]));
  });

  test("cambio material conserva relationId pero cambia fingerprint y exige nuevo ciclo", () => {
    const original = relation();
    const reviewEvent = event(original, "ACCEPTED");
    const changed = relation({
      spatialMetrics: { ...original.spatialMetrics!, distanceMeters: 35 },
      measuredFacts: original.measuredFacts.map((fact) => ({ ...fact, value: 35 })),
    });
    expect(changed.relationId).toBe(original.relationId);
    expect(fingerprintDenueAnalyticalRelation(changed)).not.toBe(fingerprintDenueAnalyticalRelation(original));
    expectEventReason(changed, reviewEvent, "RELATION_FINGERPRINT_MISMATCH");
  });

  test("eventos logicos en distinto orden de entrada normalizan al mismo ledger", () => {
    const base = relation();
    const first = event(base, "REQUIRES_REVISION", "2026-09-29T14:00:00.000Z");
    const afterFirst = expectApplied(base, first);
    const second = event(afterFirst, "ACCEPTED", "2026-09-29T14:10:00.000Z");
    const empty = createDenueAnalyticalReviewLedger(base);
    if (empty.status !== "VALID") throw new Error(empty.reasons.join(","));
    const chronological = validateDenueAnalyticalReviewLedger(base, { ...empty.ledger, events: [first, second] });
    const reversed = validateDenueAnalyticalReviewLedger(base, { ...empty.ledger, events: [second, first] });
    expect(chronological.status).toBe("VALID");
    expect(reversed.status).toBe("VALID");
    if (chronological.status !== "VALID" || reversed.status !== "VALID") throw new Error("ledger normalization failed");
    expect(reversed.ledger).toEqual(chronological.ledger);
    expect(reversed.relation).toEqual(chronological.relation);
  });
});
