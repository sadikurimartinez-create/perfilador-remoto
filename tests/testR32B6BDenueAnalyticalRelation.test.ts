import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  buildDenueAnalyticalRelation,
  normalizeDenueAnalyticalRelation,
  validateDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
  type DenueAnalyticalRelationType,
} from "../src/utils/denueAnalyticalRelation";

function relation(overrides: Partial<DenueAnalyticalRelation> = {}): DenueAnalyticalRelation {
  const sourceEvidenceId = overrides.sourceEvidenceId ?? "denue:source:1";
  const geographyId = overrides.geographyId ?? "geo-1";
  return {
    relationId: "denue-relation-1",
    denueLayerId: "denue-layer-1",
    sourceEvidenceId,
    expedienteId: "exp-1",
    geographyId,
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: ["denue:source:1", "field:source:1"],
    spatialMetrics: {
      unit: "METERS",
      method: "SpatialLayerEngine.getDistance",
      distanceMeters: 42.5,
    },
    temporalCompatibility: "UNKNOWN",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: ["denue:source:1", "field:source:1"],
      independentSourceRefs: [],
      rationale: ["INDEPENDENCE_NOT_ASSESSED"],
    },
    lineage: buildEvidenceLineage({
      sourceId: "INEGI_DENUE",
      sourceReference: "denue:query:1",
      evidenceId: sourceEvidenceId,
      geographyId,
      geographyType: "INDIVIDUAL",
    }),
    measuredFacts: [{
      factId: "fact-distance-1",
      metric: "distanceMeters",
      value: 42.5,
      unit: "METERS",
      sourceRefs: ["denue:source:1", "field:source:1"],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["SPATIAL_METRIC_OBSERVED"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: "ADR-026:B6B:v1",
    ...overrides,
  };
}

function accepted(overrides: Partial<DenueAnalyticalRelation> = {}): DenueAnalyticalRelation {
  return relation({
    humanValidation: {
      status: "ACCEPTED",
      validatedBy: "ppc-1",
      validatedAt: "2026-09-29T12:00:00.000Z",
      rationale: "La PPC acepta la relacion y sus limitaciones declaradas.",
    },
    publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
    ],
    ...overrides,
  });
}

function expectReason(input: unknown, reason: string) {
  const result = validateDenueAnalyticalRelation(input);
  expect(result.valid).toBe(false);
  expect(result.reasons).toContain(reason);
}

describe("R3.2B.6B DenueAnalyticalRelation", () => {
  test("A SPATIAL_PROXIMITY DETECTED y PENDING es valida pero no publicable", () => {
    expect(validateDenueAnalyticalRelation(relation())).toEqual({ valid: true, reasons: [] });
  });

  test("B EVIDENCE_COINCIDENCE aceptada y elegible es valida", () => {
    const input = accepted({
      relationTypes: ["EVIDENCE_COINCIDENCE"],
      linkedEvidenceIds: ["field-evidence-1"],
      spatialMetrics: null,
      measuredFacts: [{ factId: "fact-link-1", metric: "explicitEvidenceLink", value: true, sourceRefs: ["field:source:1"] }],
      machineAssessment: { status: "PROPOSED", reasonCodes: ["EVIDENCE_LINK_DETECTED"] },
      proposedInterpretations: [{ interpretationId: "proposal-1", status: "PROPOSED", text: "Relacion sujeta a la valoracion documentada por la PPC.", sourceRefs: ["field:source:1"] }],
    });
    expect(validateDenueAnalyticalRelation(input)).toEqual({ valid: true, reasons: [] });
  });

  test("C FINDING_RELATION con referencia formal es valida", () => {
    const input = accepted({
      relationTypes: ["FINDING_RELATION"],
      linkedFindingIds: ["finding-1"],
      spatialMetrics: null,
      machineAssessment: { status: "PROPOSED", reasonCodes: ["FINDING_LINK_DETECTED"] },
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test("D HYPOTHESIS_SUPPORT exige referencia y aceptacion PPC para publicar", () => {
    const input = accepted({
      relationTypes: ["HYPOTHESIS_SUPPORT"],
      linkedHypothesisRefs: ["hypothesis-1:v2"],
      spatialMetrics: null,
      machineAssessment: { status: "PROPOSED", reasonCodes: ["HYPOTHESIS_LINK_DETECTED"] },
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test("HYPOTHESIS_CONTRADICTION con referencia formal y aceptacion PPC es valida", () => {
    const input = accepted({
      relationTypes: ["HYPOTHESIS_CONTRADICTION"],
      linkedHypothesisRefs: ["hypothesis-1:v2"],
      spatialMetrics: null,
      machineAssessment: { status: "PROPOSED", reasonCodes: ["HYPOTHESIS_CONTRADICTION_PROPOSED"] },
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test("EXPLICIT_SOURCE_LINK con referencia verificable es valida", () => {
    const input = accepted({
      relationTypes: ["EXPLICIT_SOURCE_LINK"],
      spatialMetrics: null,
      machineAssessment: { status: "DETECTED", reasonCodes: ["EXPLICIT_SOURCE_LINK_DETECTED"] },
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test("CONTEXTUAL_ASSOCIATION conserva disclosure de no causalidad", () => {
    const input = accepted({
      relationTypes: ["CONTEXTUAL_ASSOCIATION"],
      spatialMetrics: null,
      limitations: [
        { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
        { code: "CONTEXT_NOT_CAUSALITY" },
      ],
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test("E MULTISOURCE_CORROBORATION exige pluralidad independiente estructurada", () => {
    const input = accepted({
      relationTypes: ["MULTISOURCE_CORROBORATION"],
      spatialMetrics: null,
      sourceIndependence: {
        status: "INDEPENDENT",
        assessedSourceRefs: ["denue:source:1", "field:source:1"],
        independentSourceRefs: ["denue:source:1", "field:source:1"],
        rationale: ["DISTINCT_OBSERVED_PROVIDERS"],
      },
      machineAssessment: { status: "PROPOSED", reasonCodes: ["INDEPENDENT_SOURCES_DETECTED"] },
    });
    expect(validateDenueAnalyticalRelation(input).valid).toBe(true);
  });

  test.each([
    ["relationTypes vacio", { relationTypes: [] }, "RELATION_TYPES_REQUIRED"],
    ["sourceEvidenceId vacio", { sourceEvidenceId: "" }, "SOURCE_EVIDENCE_ID_REQUIRED"],
    ["geographyId vacio", { geographyId: "", lineage: [] }, "GEOGRAPHY_ID_REQUIRED"],
    ["methodologyVersion vacia", { methodologyVersion: "" }, "METHODOLOGY_VERSION_REQUIRED"],
  ])("rechaza %s", (_label, override, reason) => {
    expectReason(relation(override as Partial<DenueAnalyticalRelation>), reason);
  });

  test.each([
    ["negativa", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rechaza distancia %s", (_label, distanceMeters) => {
    expectReason(relation({ spatialMetrics: { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters } }), "SPATIAL_METRICS_INVALID");
  });

  test.each([
    ["EVIDENCE_COINCIDENCE", "EVIDENCE_LINK_REQUIRED"],
    ["FINDING_RELATION", "FINDING_LINK_REQUIRED"],
    ["HYPOTHESIS_SUPPORT", "HYPOTHESIS_LINK_REQUIRED"],
    ["HYPOTHESIS_CONTRADICTION", "HYPOTHESIS_LINK_REQUIRED"],
  ] as Array<[DenueAnalyticalRelationType, string]>)
  ("rechaza %s sin referencia formal", (relationType, reason) => {
    expectReason(relation({ relationTypes: [relationType], spatialMetrics: null }), reason);
  });

  test.each(["validatedBy", "validatedAt", "rationale"] as const)("rechaza ACCEPTED sin %s", (field) => {
    const humanValidation = { ...accepted().humanValidation, [field]: null };
    expectReason(accepted({ humanValidation }), "HUMAN_VALIDATION_METADATA_REQUIRED");
  });

  test.each(["PENDING", "REJECTED", "REQUIRES_REVISION"] as const)("rechaza %s publicable", (status) => {
    const humanValidation = status === "PENDING"
      ? { status, validatedBy: null, validatedAt: null, rationale: null }
      : { status, validatedBy: "ppc-1", validatedAt: "2026-09-29T12:00:00.000Z", rationale: "Decision PPC documentada." };
    expectReason(accepted({ humanValidation, publicationEligibility: "ELIGIBLE" }), "HUMAN_ACCEPTANCE_REQUIRED_FOR_PUBLICATION");
  });

  test("rechaza lineage invalido", () => {
    expectReason(relation({ lineage: [{ id: "finding-orphan", type: "FINDING", findingId: "finding-orphan", supportingEvidenceIds: [] }] }), "LINEAGE_INVALID");
  });

  test("rechaza un tipo de nodo lineage desconocido en runtime", () => {
    expectReason(relation({ lineage: [{ id: "unknown-1", type: "UNKNOWN" } as any] }), "LINEAGE_INVALID");
  });

  test("rechaza MULTISOURCE_CORROBORATION sin dos fuentes independientes", () => {
    expectReason(accepted({
      relationTypes: ["MULTISOURCE_CORROBORATION"],
      spatialMetrics: null,
      sourceIndependence: {
        status: "UNKNOWN",
        assessedSourceRefs: ["denue:source:1", "field:source:1"],
        independentSourceRefs: [],
        rationale: ["INDEPENDENCE_NOT_ESTABLISHED"],
      },
    }), "MULTISOURCE_INDEPENDENCE_REQUIRED");
  });

  test("rechaza measuredFacts con afirmacion de riesgo", () => {
    expectReason(relation({ measuredFacts: [{ factId: "fact-risk", metric: "riskLevel", value: "alto", sourceRefs: [] }] }), "MEASURED_FACT_PROHIBITED_INTERPRETATION");
  });

  test("rechaza campos de scoring o riesgo aunque entren por payload no tipado", () => {
    expectReason({ ...relation(), riskScore: 90 }, "FORBIDDEN_RISK_OR_SCORING_FIELD");
  });

  test("rechaza IDs duplicados y builder no oculta el fallo", () => {
    const input = relation({ linkedEvidenceIds: ["evidence-1", "evidence-1"] });
    const built = buildDenueAnalyticalRelation(input);
    expect(built.relation.linkedEvidenceIds).toEqual(["evidence-1"]);
    expect(built.validation.reasons).toContain("LINKED_EVIDENCE_IDS_DUPLICATED");
    expect(input.linkedEvidenceIds).toEqual(["evidence-1", "evidence-1"]);
  });

  test("normalizacion es determinista para arrays en distinto orden", () => {
    const first = accepted({
      relationTypes: ["EXPLICIT_SOURCE_LINK", "EVIDENCE_COINCIDENCE"],
      linkedEvidenceIds: ["evidence-b", "evidence-a"],
      linkedSourceRefs: ["source-b", "source-a"],
      sourceIndependence: {
        status: "INDEPENDENT",
        assessedSourceRefs: ["source-b", "source-a"],
        independentSourceRefs: ["source-b", "source-a"],
        rationale: ["TWO_PROVIDERS", "SEPARATE_ACQUISITIONS"],
      },
      spatialMetrics: null,
    });
    const second = accepted({
      relationTypes: ["EVIDENCE_COINCIDENCE", "EXPLICIT_SOURCE_LINK"],
      linkedEvidenceIds: ["evidence-a", "evidence-b"],
      linkedSourceRefs: ["source-a", "source-b"],
      sourceIndependence: {
        status: "INDEPENDENT",
        assessedSourceRefs: ["source-a", "source-b"],
        independentSourceRefs: ["source-a", "source-b"],
        rationale: ["SEPARATE_ACQUISITIONS", "TWO_PROVIDERS"],
      },
      spatialMetrics: null,
    });
    expect(normalizeDenueAnalyticalRelation(first)).toEqual(normalizeDenueAnalyticalRelation(second));
    expect(buildDenueAnalyticalRelation(first).validation).toEqual(buildDenueAnalyticalRelation(second).validation);
  });

  test("REJECTED y REQUIRES_REVISION requieren metadata PPC completa", () => {
    for (const status of ["REJECTED", "REQUIRES_REVISION"] as const) {
      expectReason(relation({ humanValidation: { status, validatedBy: null, validatedAt: null, rationale: null } }), "HUMAN_VALIDATION_METADATA_REQUIRED");
    }
  });

  test("DETECTED no puede contener interpretaciones propuestas", () => {
    expectReason(relation({
      proposedInterpretations: [{ interpretationId: "proposal-1", status: "PROPOSED", text: "Interpretacion pendiente.", sourceRefs: [] }],
    }), "DETECTED_CANNOT_CONTAIN_PROPOSED_INTERPRETATIONS");
  });

  test("INSUFFICIENT no puede publicarse aunque exista aceptacion PPC", () => {
    expectReason(accepted({
      machineAssessment: { status: "INSUFFICIENT", reasonCodes: ["INSUFFICIENT_SOURCE_SUPPORT"] },
      measuredFacts: [],
    }), "INSUFFICIENT_NOT_PUBLICABLE");
  });
});
