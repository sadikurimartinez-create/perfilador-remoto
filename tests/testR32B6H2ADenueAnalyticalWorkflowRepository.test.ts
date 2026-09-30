import { buildEvidenceLineage } from "@/utils/evidenceLineage";
import {
  normalizeDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
} from "@/utils/denueAnalyticalRelation";
import {
  appendDenueAnalyticalReviewEvent as appendToLedger,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";
import { assessDenueAnalyticalPublication } from "@/utils/denueAnalyticalPublicationGate";
import {
  InMemoryDenueAnalyticalWorkflowRepository,
  hydrateDenueAnalyticalWorkflow,
} from "@/services/denueAnalyticalWorkflowRepository";

const PROJECT_ID = "exp-r32b6h2a";
const REVIEWER = "user:perfilador-42";

function relation(overrides: Partial<DenueAnalyticalRelation> = {}): DenueAnalyticalRelation {
  return {
    relationId: "denue-relation-persistent-1",
    denueLayerId: "denue:layer:1",
    sourceEvidenceId: "denue:evidence:1",
    expedienteId: PROJECT_ID,
    geographyId: "geo-r32b6h2a",
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
      sourceReference: "denue://query/persistent-1",
      evidenceId: "denue:evidence:1",
      geographyId: "geo-r32b6h2a",
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
    methodologyVersion: "ADR-026:R3.2B.6H.2A:v1",
    ...overrides,
  };
}

describe("R3.2B.6H.2A DENUE analytical workflow repository", () => {
  test("legacy project loads empty workflow without migration", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    await expect(repository.load(PROJECT_ID)).resolves.toEqual({ relations: [], reviewLedgers: [] });
    expect(hydrateDenueAnalyticalWorkflow(PROJECT_ID, [], [])).toEqual({ relations: [], reviewLedgers: [] });
  });

  test("valid relations survive save and reload with canonical equivalence", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const input = relation({ linkedSourceRefs: ["field:evidence:1", "denue:evidence:1"] });
    const inputSnapshot = JSON.stringify(input);
    await repository.saveRelations(PROJECT_ID, [input]);
    const reloaded = await repository.load(PROJECT_ID);
    expect(reloaded.relations).toEqual([normalizeDenueAnalyticalRelation(input)]);
    expect(reloaded.reviewLedgers).toHaveLength(1);
    expect(reloaded.reviewLedgers[0].events).toEqual([]);
    expect(JSON.stringify(input)).toBe(inputSnapshot);
  });

  test("review events roundtrip, remain append-only, and retain fingerprints", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const base = relation();
    await repository.saveRelations(PROJECT_ID, [base]);

    const first = buildDenueAnalyticalReviewEvent(base, {
      nextStatus: "REQUIRES_REVISION",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:00:00.000Z",
      rationale: "La PPC solicita ampliar el soporte observado.",
    });
    const afterFirst = await repository.appendReviewEvent(PROJECT_ID, first);
    const current = afterFirst.relations[0];
    const second = buildDenueAnalyticalReviewEvent(current, {
      nextStatus: "ACCEPTED",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:10:00.000Z",
      rationale: "La PPC acepta la relacion tras revisar el soporte ampliado.",
    });
    await repository.appendReviewEvent(PROJECT_ID, second);
    const reloaded = await repository.load(PROJECT_ID);

    expect(reloaded.reviewLedgers[0].events).toEqual([first, second]);
    expect(reloaded.reviewLedgers[0].relationFingerprint).toBe(first.relationFingerprint);
    expect(reloaded.relations[0].humanValidation.status).toBe("ACCEPTED");
  });

  test("repeating the same event is idempotent", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const base = relation();
    await repository.saveRelations(PROJECT_ID, [base]);
    const reviewEvent = buildDenueAnalyticalReviewEvent(base, {
      nextStatus: "ACCEPTED",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:00:00.000Z",
      rationale: "Decision humana expresa y trazable.",
    });
    await repository.appendReviewEvent(PROJECT_ID, reviewEvent);
    await repository.appendReviewEvent(PROJECT_ID, reviewEvent);
    expect((await repository.load(PROJECT_ID)).reviewLedgers[0].events).toEqual([reviewEvent]);
  });

  test("invalid relation is rejected without persistence", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    await expect(repository.saveRelations(PROJECT_ID, [relation({ relationTypes: [] })]))
      .rejects.toThrow("DENUE_ANALYTICAL_RELATION_INVALID");
    await expect(repository.load(PROJECT_ID)).resolves.toEqual({ relations: [], reviewLedgers: [] });
  });

  test("invalid review identity and transition are rejected without mutation", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const base = relation();
    await repository.saveRelations(PROJECT_ID, [base]);
    const invalid = buildDenueAnalyticalReviewEvent(base, {
      nextStatus: "ACCEPTED",
      reviewedBy: "AUTO",
      reviewedAt: "2026-09-30T15:00:00.000Z",
      rationale: "No debe persistirse.",
    });
    const eventSnapshot = JSON.stringify(invalid);
    await expect(repository.appendReviewEvent(PROJECT_ID, invalid))
      .rejects.toThrow("REVIEWER_IDENTITY_RESERVED");
    expect(JSON.stringify(invalid)).toBe(eventSnapshot);
    expect((await repository.load(PROJECT_ID)).reviewLedgers[0].events).toEqual([]);
  });

  test("terminal ACCEPTED cannot be overwritten by a later review", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const base = relation();
    await repository.saveRelations(PROJECT_ID, [base]);
    const accepted = buildDenueAnalyticalReviewEvent(base, {
      nextStatus: "ACCEPTED",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:00:00.000Z",
      rationale: "Decision humana terminal.",
    });
    const afterAccepted = await repository.appendReviewEvent(PROJECT_ID, accepted);
    const forbidden = buildDenueAnalyticalReviewEvent(afterAccepted.relations[0], {
      nextStatus: "REQUIRES_REVISION",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:10:00.000Z",
      rationale: "Intento incompatible con el ledger canonico.",
    });
    await expect(repository.appendReviewEvent(PROJECT_ID, forbidden))
      .rejects.toThrow("TRANSITION_NOT_ALLOWED");
    expect((await repository.load(PROJECT_ID)).reviewLedgers[0].events).toEqual([accepted]);
  });

  test("publication gate result is reconstructible after reload", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const base = relation();
    const reviewEvent = buildDenueAnalyticalReviewEvent(base, {
      nextStatus: "ACCEPTED",
      reviewedBy: REVIEWER,
      reviewedAt: "2026-09-30T15:00:00.000Z",
      rationale: "La PPC acepta la relacion para evaluacion de publicacion.",
    });
    const empty = createDenueAnalyticalReviewLedger(base);
    if (empty.status !== "VALID") throw new Error(empty.reasons.join(","));
    const before = appendToLedger(base, empty.ledger, reviewEvent);
    if (before.status !== "VALID") throw new Error(before.reasons.join(","));
    const expected = assessDenueAnalyticalPublication({
      baseRelation: base,
      relation: before.relation,
      ledger: before.ledger,
    });

    await repository.saveRelations(PROJECT_ID, [base]);
    await repository.appendReviewEvent(PROJECT_ID, reviewEvent);
    const reloaded = await repository.load(PROJECT_ID);
    const actual = assessDenueAnalyticalPublication({
      baseRelation: base,
      relation: reloaded.relations[0],
      ledger: reloaded.reviewLedgers[0],
    });
    expect(actual).toEqual(expected);
    expect(actual.eligible).toBe(true);
  });
});
