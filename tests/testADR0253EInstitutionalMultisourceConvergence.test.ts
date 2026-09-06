import { MultiSourceCorrelationEngine, type InstitutionalCorrelationItem } from "../src/lib/geoint/multiSourceCorrelationEngine";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  approveConvergenceResult,
  buildInstitutionalConvergence,
  classifySourceIndependence,
  convergenceToInstitutionalCorrelationItem,
  rejectConvergenceResult,
  type ConvergenceSourceEntry,
} from "../src/utils/institutionalMultisourceConvergence";

const lineage = buildEvidenceLineage({
  sourceId: "source-0253e",
  sourceReference: "fixture://adr-0253e",
  evidenceId: "evidence-0253e",
  findingId: "finding-0253e",
  geographyId: "geo-0253e",
});

function source(overrides: Partial<ConvergenceSourceEntry> = {}): ConvergenceSourceEntry {
  return {
    sourceKind: "STREET_VIEW",
    sourceId: "street-view-0253e",
    sourceEvidenceId: "sv-source-0253e",
    traceabilityId: "trace-sv-0253e",
    expedienteId: "exp-0253e",
    geographyId: "geo-0253e",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    timestamp: "2026-09-06T12:00:00.000Z",
    temporalClass: "CURRENT",
    epistemicRole: "SOURCE_FACT",
    validationStatus: "APPROVED",
    lineage,
    sourceReferences: ["streetview:pano-0253e"],
    phenomenonTags: ["gate", "access"],
    assertion: "PRESENT",
    acquisitionMode: "OBSERVED",
    ...overrides,
  };
}

function convergence(overrides: Partial<Parameters<typeof buildInstitutionalConvergence>[0]> = {}) {
  return buildInstitutionalConvergence({
    expedienteId: "exp-0253e",
    geographyId: "geo-0253e",
    phenomenon: "ACCESS_FEATURE_CORROBORATION",
    sources: [
      source(),
      source({
        sourceKind: "VISION",
        sourceId: "vision-0253e",
        sourceEvidenceId: "vision-source-0253e",
        traceabilityId: "trace-vision-0253e",
        epistemicRole: "ANALYTICAL_SUGGESTION",
        dependsOnSourceEvidenceIds: ["sv-source-0253e"],
        sourceReferences: ["google-vision:sv-source-0253e"],
        phenomenonTags: ["gate", "access"],
      }),
      source({
        sourceKind: "FIELD_OBSERVATION",
        sourceId: "field-observation-0253e",
        sourceEvidenceId: "field-obs-source-0253e",
        traceabilityId: "trace-field-0253e",
        epistemicRole: "HUMAN_OBSERVATION",
        visitId: "visit-0253e",
        sourceReferences: ["field:observation:0253e"],
        phenomenonTags: ["gate", "access"],
      }),
    ],
    generatedAt: "2026-09-06T12:05:00.000Z",
    ...overrides,
  });
}

function denueItem(): InstitutionalCorrelationItem {
  return {
    id: "denue-item-0253e",
    sourceType: "DENUE",
    providerId: "INEGI_DENUE",
    sourceEvidenceId: "denue-source-0253e",
    traceabilityId: "trace-denue-0253e",
    expedienteId: "exp-0253e",
    geographyId: "geo-0253e",
    coordinates: { lat: 21.88181, lng: -102.29161 },
    observedAt: "2026-09-06T11:55:00.000Z",
    acquiredAt: "2026-09-06T11:56:00.000Z",
    semanticRole: "SOURCE_FACT",
    epistemicIntegrity: {
      acquisitionMode: "OBSERVED",
      acquisitionStatus: "ACQUIRED",
      semanticRole: "SOURCE_FACT",
      validationStatus: "APPROVED",
      traceabilityId: "trace-denue-0253e",
    },
    payload: { assertion: "PRESENT", findingType: "ACCESS_FEATURE_CORROBORATION" },
    category: "ACCESS_FEATURE_CORROBORATION",
    tags: ["access", "gate"],
  };
}

describe("ADR-025.3E institutional multisource convergence and field corroboration", () => {
  test("1. same expediente + same geography correlaciona", () => {
    expect(convergence().blockingReasons).toHaveLength(0);
  });

  test("2. different geography bloquea", () => {
    const c = convergence({ sources: [source(), source({ geographyId: "geo-other" })] });
    expect(c.blockingReasons).toContain("DIFFERENT_GEOGRAPHY");
  });

  test("3. spatial incompatibility reduce/bloquea convergencia", () => {
    const c = convergence({ sources: [source(), source({ sourceId: "far", sourceEvidenceId: "far-src", coordinates: { lat: 22.5, lng: -103 } })] });
    expect(c.blockingReasons).toContain("SPATIAL_INCOMPATIBILITY");
    expect(c.scoreMatrix.spatialScore).toBe(0);
  });

  test("4. historical vs current no se trata igual", () => {
    const c = convergence({ sources: [source(), source({ sourceId: "historical", sourceEvidenceId: "hist-src", temporalClass: "HISTORICAL", timestamp: "2021-01-01" })] });
    expect(c.temporalCompatibility).toBe("PARTIAL");
  });

  test("5. StreetView + Vision comparten dependencia", () => {
    const dep = classifySourceIndependence(source(), source({ sourceKind: "VISION", sourceId: "vision", sourceEvidenceId: "vision-src", dependsOnSourceEvidenceIds: ["sv-source-0253e"] }));
    expect(dep.independence).toBe("DERIVED");
  });

  test("6. dependent sources no duplican peso", () => {
    expect(convergence().scoreMatrix.independenceScore).toBeLessThan(1);
  });

  test("7. Places + review parcial dependencia", () => {
    const dep = classifySourceIndependence(source({ sourceKind: "PLACES" }), source({ sourceKind: "PLACES_REVIEW", sourceId: "review", sourceEvidenceId: "review-src" }));
    expect(dep.independence).toBe("PARTIALLY_DEPENDENT");
  });

  test("8. DENUE + Places independientes", () => {
    const dep = classifySourceIndependence(source({ sourceKind: "DENUE" }), source({ sourceKind: "PLACES", sourceId: "places", sourceEvidenceId: "places-src" }));
    expect(dep.independence).toBe("INDEPENDENT");
  });

  test("9. field photo + observation parcial dependencia", () => {
    const dep = classifySourceIndependence(
      source({ sourceKind: "FIELD_PHOTO", visitId: "visit-1" }),
      source({ sourceKind: "FIELD_OBSERVATION", sourceId: "obs", sourceEvidenceId: "obs-src", visitId: "visit-1" })
    );
    expect(dep.independence).toBe("PARTIALLY_DEPENDENT");
  });

  test("10. corroboration conserva sourceEvidenceIds", () => {
    expect(convergence().sourceEvidenceIds).toEqual(expect.arrayContaining(["sv-source-0253e", "vision-source-0253e"]));
  });

  test("11. conserva traceabilityIds", () => {
    expect(convergence().traceabilityIds).toEqual(expect.arrayContaining(["trace-sv-0253e", "trace-vision-0253e"]));
  });

  test("12. conserva lineage", () => {
    expect(convergence().lineageStatus).toBe("SUPPORTED");
  });

  test("13. contradiction no elimina fuente", () => {
    const c = convergence({ sources: [source(), source({ sourceId: "closed-field", sourceEvidenceId: "closed-src", assertion: "ABSENT" })] });
    expect(c.contradictingSources).toHaveLength(1);
    expect(c.sourceEvidenceIds).toContain("closed-src");
  });

  test("14. review allegation no se convierte en fact", () => {
    const review = source({ sourceKind: "PLACES_REVIEW", epistemicRole: "UNVERIFIED_USER_GENERATED_ALLEGATION" });
    expect(review.epistemicRole).not.toBe("SOURCE_FACT");
  });

  test("15. multiple reviews no crean criminal fact", () => {
    const c = convergence({
      sources: [
        source({ sourceKind: "PLACES_REVIEW", sourceId: "r1", sourceEvidenceId: "r1", epistemicRole: "USER_GENERATED_CONTEXT" }),
        source({ sourceKind: "PLACES_REVIEW", sourceId: "r2", sourceEvidenceId: "r2", epistemicRole: "USER_GENERATED_CONTEXT" }),
      ],
    });
    expect(c.producedPrediction).toBe(false);
    expect(c.limitations.join(" ")).toMatch(/No confirma actividad criminal/i);
  });

  test("16. DENUE no se vuelve criminal evidence", () => {
    const denue = source({ sourceKind: "DENUE", epistemicRole: "SOURCE_FACT", phenomenonTags: ["activity"] });
    expect(denue.epistemicRole).toBe("SOURCE_FACT");
    expect(convergence({ phenomenon: "FUNCTIONAL_ACTIVITY_CORROBORATION", sources: [denue, source({ sourceKind: "PLACES", sourceId: "places", sourceEvidenceId: "places-src", phenomenonTags: ["activity"] })] }).limitations.join(" ")).toMatch(/No confirma actividad criminal/i);
  });

  test("17. Vision no sustituye Street View source", () => {
    expect(convergence().sourceEvidenceIds).toEqual(expect.arrayContaining(["sv-source-0253e", "vision-source-0253e"]));
  });

  test("18. route + elevation dependencia parcial", () => {
    const dep = classifySourceIndependence(source({ sourceKind: "ROUTES" }), source({ sourceKind: "ELEVATION", sourceId: "elev", sourceEvidenceId: "elev-src" }));
    expect(dep.independence).toBe("PARTIALLY_DEPENDENT");
  });

  test("19. field corroboration aumenta soporte", () => {
    expect(convergence().fieldStatus).toBe("fieldSupport");
  });

  test("20. field contradiction se conserva", () => {
    const c = convergence({ sources: [source(), source({ sourceKind: "FIELD_OBSERVATION", sourceId: "field-no", sourceEvidenceId: "field-no-src", assertion: "ABSENT" })] });
    expect(c.fieldStatus).toBe("fieldContradiction");
    expect(c.contradictingSources[0].sourceId).toBe("field-no");
  });

  test("21. hypothesis SUPPORTS no modifica hipotesis", () => {
    const hypothesis = "Hipotesis vigente";
    const c = convergence({ hypothesisRelation: "SUPPORTS" });
    expect(c.hypothesisRelation).toBe("SUPPORTS");
    expect(hypothesis).toBe("Hipotesis vigente");
  });

  test("22. hypothesis CONTRADICTS no modifica hipotesis", () => {
    const hypothesis = "Hipotesis vigente";
    const c = convergence({ hypothesisRelation: "CONTRADICTS" });
    expect(c.hypothesisRelation).toBe("CONTRADICTS");
    expect(hypothesis).toBe("Hipotesis vigente");
  });

  test("23. convergence nace PENDING_REVIEW", () => {
    expect(convergence().humanReviewStatus).toBe("PENDING_REVIEW");
  });

  test("24. rejected no se promociona", () => {
    const result = convergenceToInstitutionalCorrelationItem(rejectConvergenceResult(convergence()));
    expect(result.item).toBeNull();
  });

  test("25. approved conserva reviewer", () => {
    const approved = approveConvergenceResult(convergence(), { reviewedBy: "ppc-1", reviewedAt: "2026-09-06T12:10:00.000Z", reviewComment: "Validado." });
    expect(approved.reviewedBy).toBe("ppc-1");
    expect(approved.reviewComment).toBe("Validado.");
  });

  test("26. mock/simulated bloqueado", () => {
    const c = convergence({ sources: [source({ acquisitionMode: "SIMULATED" })] });
    expect(c.blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE");
  });

  test("27. missing geographyId bloquea", () => {
    const c = convergence({ sources: [source({ geographyId: "" })] });
    expect(c.blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });

  test("28. missing traceability bloquea", () => {
    const c = convergence({ sources: [source({ traceabilityId: "" })] });
    expect(c.blockingReasons).toContain("MISSING_TRACEABILITY_ID");
  });

  test("29. invalid lineage bloquea", () => {
    const c = convergence({ sources: [source({ lineage: [] })] });
    expect(c.blockingReasons.join(" ")).toMatch(/INVALID_LINEAGE_STATUS/);
  });

  test("30. no double-count same source", () => {
    const c = convergence({
      sources: [
        source(),
        source({ sourceKind: "VISION", sourceId: "vision", sourceEvidenceId: "vision-src", dependsOnSourceEvidenceIds: ["sv-source-0253e"] }),
      ],
    });
    expect(c.scoreMatrix.supportScore).toBe(0.25);
  });

  test("31. semantic match without spatial match no basta", () => {
    const c = convergence({ sources: [source(), source({ sourceId: "far", sourceEvidenceId: "far-src", coordinates: { lat: 22.5, lng: -103 }, phenomenonTags: ["gate", "access"] })] });
    expect(c.blockingReasons).toContain("SPATIAL_INCOMPATIBILITY");
  });

  test("32. spatial match without semantic match no basta", () => {
    const c = convergence({ sources: [source(), source({ sourceId: "semantic-other", sourceEvidenceId: "semantic-other-src", phenomenonTags: ["unrelated"] })] });
    expect(c.blockingReasons).toContain("SEMANTIC_INCOMPATIBILITY");
  });

  test("33. contradictionScore afecta confidence", () => {
    const supported = convergence();
    const contradicted = convergence({ sources: [source(), source({ sourceId: "absent", sourceEvidenceId: "absent-src", assertion: "ABSENT" })] });
    expect(contradicted.confidence).toBeLessThan(supported.confidence);
  });

  test("34. independenceScore afecta confidence", () => {
    const dependent = convergence({ sources: [source(), source({ sourceKind: "VISION", sourceId: "vision", sourceEvidenceId: "vision-src", dependsOnSourceEvidenceIds: ["sv-source-0253e"] })] });
    const independent = convergence({ sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue", sourceEvidenceId: "denue-src" })] });
    expect(independent.scoreMatrix.independenceScore).toBeGreaterThan(dependent.scoreMatrix.independenceScore);
  });

  test("35. source count alone no determina confidence", () => {
    const manyDependent = convergence({
      sources: [
        source(),
        source({ sourceKind: "VISION", sourceId: "v1", sourceEvidenceId: "v1", dependsOnSourceEvidenceIds: ["sv-source-0253e"] }),
        source({ sourceKind: "VISION", sourceId: "v2", sourceEvidenceId: "v2", dependsOnSourceEvidenceIds: ["sv-source-0253e"] }),
      ],
    });
    const fewerIndependent = convergence({ sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue", sourceEvidenceId: "denue-src" })] });
    expect(manyDependent.confidence).toBeLessThanOrEqual(fewerIndependent.confidence);
  });

  test("36. E2E full controlled scenario funciona", () => {
    const e2e = convergence({
      phenomenon: "FIELD_CORROBORATED_FINDING",
      sources: [
        source(),
        source({ sourceKind: "VISION", sourceId: "vision", sourceEvidenceId: "vision-src", dependsOnSourceEvidenceIds: ["sv-source-0253e"] }),
        source({ sourceKind: "PLACES", sourceId: "places", sourceEvidenceId: "places-src" }),
        source({ sourceKind: "PLACES_REVIEW", sourceId: "review", sourceEvidenceId: "review-src", epistemicRole: "USER_GENERATED_CONTEXT" }),
        source({ sourceKind: "DENUE", sourceId: "denue", sourceEvidenceId: "denue-src" }),
        source({ sourceKind: "ROUTES", sourceId: "route", sourceEvidenceId: "route-src" }),
        source({ sourceKind: "ELEVATION", sourceId: "elevation", sourceEvidenceId: "elevation-src" }),
        source({ sourceKind: "FIELD_PHOTO", sourceId: "field-photo", sourceEvidenceId: "field-photo-src", visitId: "visit-1" }),
        source({ sourceKind: "FIELD_OBSERVATION", sourceId: "field-observation", sourceEvidenceId: "field-observation-src", visitId: "visit-1", epistemicRole: "HUMAN_OBSERVATION" }),
        source({ sourceKind: "PPC_CONTEXT", sourceId: "ppc", sourceEvidenceId: "ppc-src", epistemicRole: "HUMAN_INTERPRETATION" }),
      ],
    });
    expect(e2e.sourceEvidenceIds).toEqual(expect.arrayContaining(["sv-source-0253e", "vision-src", "denue-src", "route-src", "elevation-src", "field-photo-src", "field-observation-src", "ppc-src"]));
    expect(e2e.humanReviewStatus).toBe("PENDING_REVIEW");
  });

  test("37. ADR-023.8 recibe solo evidencia institucional valida", () => {
    const rejected = convergenceToInstitutionalCorrelationItem(rejectConvergenceResult(convergence()));
    const approved = convergenceToInstitutionalCorrelationItem(approveConvergenceResult(convergence(), { reviewedBy: "ppc-1" }));
    expect(rejected.item).toBeNull();
    expect(approved.item).not.toBeNull();
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [approved.item!, denueItem()]);
    expect(report.eligibleItemCount).toBe(2);
    expect(report.results.length).toBeGreaterThan(0);
  });

  test("38. no prediction produced", () => {
    expect(convergence().producedPrediction).toBe(false);
    expect(JSON.stringify(convergence())).not.toMatch(/future risk|crime probability|likely attack|likely escape|likely drug/i);
  });
});
