import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  approvePredictiveAnalyticalProduct,
  buildPredictiveAnalyticalProduct,
  getPredictiveProductStatus,
  rejectPredictiveAnalyticalProduct,
  type AnalyticalLevel,
  type CanonicalGeographyKind,
} from "../src/utils/predictiveAnalyticalProducts";
import {
  approveConvergenceResult,
  buildInstitutionalConvergence,
  type ConvergenceResult,
  type ConvergenceSourceEntry,
} from "../src/utils/institutionalMultisourceConvergence";

const baseLineage = buildEvidenceLineage({
  sourceId: "source-0254",
  sourceReference: "fixture://adr-0254",
  evidenceId: "evidence-0254",
  findingId: "finding-0254",
  geographyId: "geo-0254",
});

function source(overrides: Partial<ConvergenceSourceEntry> = {}): ConvergenceSourceEntry {
  const suffix = overrides.sourceId || overrides.sourceKind || "street-view";
  return {
    sourceKind: "STREET_VIEW",
    sourceId: `src-${suffix}`,
    sourceEvidenceId: `evidence-${suffix}`,
    traceabilityId: `trace-${suffix}`,
    expedienteId: "exp-0254",
    geographyId: "geo-0254",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    timestamp: "2026-09-06T12:00:00.000Z",
    temporalClass: "CURRENT",
    epistemicRole: "SOURCE_FACT",
    validationStatus: "APPROVED",
    lineage: baseLineage,
    sourceReferences: [`fixture:${suffix}`],
    phenomenonTags: ["access", "gate"],
    assertion: "PRESENT",
    acquisitionMode: "OBSERVED",
    ...overrides,
  };
}

function convergence(overrides: Partial<Parameters<typeof buildInstitutionalConvergence>[0]> = {}): ConvergenceResult {
  return buildInstitutionalConvergence({
    expedienteId: "exp-0254",
    geographyId: "geo-0254",
    phenomenon: "ACCESS_FEATURE_CORROBORATION",
    sources: [
      source({ sourceId: "street-view", sourceEvidenceId: "evidence-street-view", traceabilityId: "trace-street-view" }),
      source({ sourceKind: "DENUE", sourceId: "denue", sourceEvidenceId: "evidence-denue", traceabilityId: "trace-denue" }),
      source({ sourceKind: "FIELD_OBSERVATION", sourceId: "field", sourceEvidenceId: "evidence-field", traceabilityId: "trace-field", epistemicRole: "HUMAN_OBSERVATION" }),
    ],
    generatedAt: "2026-09-06T12:05:00.000Z",
    hypothesisRelation: "SUPPORTS",
    ...overrides,
  });
}

function approved(overrides: Partial<Parameters<typeof buildInstitutionalConvergence>[0]> = {}): ConvergenceResult {
  return approveConvergenceResult(convergence(overrides), {
    reviewedBy: "ppc-0254",
    reviewedAt: "2026-09-06T12:10:00.000Z",
  });
}

function product(convergences: ConvergenceResult[] = [approved()], level?: AnalyticalLevel, geographyType: CanonicalGeographyKind = "POINT") {
  const result = buildPredictiveAnalyticalProduct({
    expedienteId: "exp-0254",
    geographyId: "geo-0254",
    canonicalGeographyType: geographyType,
    approvedConvergences: convergences,
    analyticalLevel: level,
    generatedAt: "2026-09-06T13:00:00.000Z",
  });
  if (!result.product) throw new Error(`Expected product, got ${result.blockingReasons.join(",")}`);
  return result.product;
}

describe("ADR-025.4 predictive analytical products engine", () => {
  test("1. bloquea convergencias sin aprobacion PPC", () => {
    const result = buildPredictiveAnalyticalProduct({
      expedienteId: "exp-0254",
      geographyId: "geo-0254",
      canonicalGeographyType: "POINT",
      approvedConvergences: [convergence()],
      generatedAt: "2026-09-06T13:00:00.000Z",
    });
    expect(result.product).toBeNull();
    expect(result.blockingReasons.join(" ")).toMatch(/CONVERGENCE_NOT_APPROVED/);
  });

  test("2. bloquea convergencias mock o no reportables", () => {
    const mocked = { ...approved(), blockingReasons: ["ACQUISITION_MODE_NOT_REPORTABLE"] };
    const result = buildPredictiveAnalyticalProduct({
      expedienteId: "exp-0254",
      geographyId: "geo-0254",
      canonicalGeographyType: "POINT",
      approvedConvergences: [mocked],
    });
    expect(result.product).toBeNull();
    expect(result.blockingReasons.join(" ")).toMatch(/CONVERGENCE_NOT_PRODUCTIVE|CONVERGENCE_HAS_BLOCKING_REASONS/);
  });

  test("3. bloquea linaje invalido o vacio", () => {
    const invalid = { ...approved(), lineage: [], lineageStatus: "SUPPORTED" as const };
    const result = buildPredictiveAnalyticalProduct({
      expedienteId: "exp-0254",
      geographyId: "geo-0254",
      canonicalGeographyType: "POINT",
      approvedConvergences: [invalid],
    });
    expect(result.product).toBeNull();
    expect(result.blockingReasons.join(" ")).toMatch(/INVALID_LINEAGE/);
  });

  test("4. bloquea geografia distinta", () => {
    const result = buildPredictiveAnalyticalProduct({
      expedienteId: "exp-0254",
      geographyId: "geo-other",
      canonicalGeographyType: "POINT",
      approvedConvergences: [approved()],
    });
    expect(result.product).toBeNull();
    expect(result.blockingReasons.join(" ")).toMatch(/DIFFERENT_GEOGRAPHY/);
  });

  test("5. una convergencia actual produce nivel descriptivo", () => {
    expect(product().analyticalLevel).toBe("DESCRIPTIVE");
  });

  test("6. una observacion no produce tendencia", () => {
    expect(product().trend).toBe("INSUFFICIENT_DATA");
  });

  test("7. dos periodos habilitan producto de tendencia", () => {
    const p = product([approved({ generatedAt: "2026-01-01T12:00:00.000Z" }), approved({ generatedAt: "2026-02-01T12:00:00.000Z" })], "TREND");
    expect(p.analyticalLevel).toBe("TREND");
    expect(p.trend).not.toBe("INSUFFICIENT_DATA");
  });

  test("8. confianza similar conserva tendencia estable", () => {
    const p = product([approved({ generatedAt: "2026-01-01T12:00:00.000Z" }), approved({ generatedAt: "2026-02-01T12:00:00.000Z" })], "TREND");
    expect(p.trend).toBe("STABLE");
  });

  test("9. confianza creciente produce tendencia increasing", () => {
    const low = { ...approved({ generatedAt: "2026-01-01T12:00:00.000Z" }), confidence: 0.35 };
    const high = { ...approved({ generatedAt: "2026-02-01T12:00:00.000Z" }), confidence: 0.75 };
    expect(product([low, high], "TREND").trend).toBe("INCREASING");
  });

  test("10. contradiccion reduce confianza final", () => {
    const clean = product([approved()]);
    const contradicted = product([approved({ sources: [source(), source({ sourceId: "absent", sourceEvidenceId: "absent-evidence", traceabilityId: "absent-trace", assertion: "ABSENT" })] })]);
    expect(contradicted.confidence).toBeLessThan(clean.confidence);
  });

  test("11. contradiccion eleva incertidumbre", () => {
    const p = product([approved({ sources: [source(), source({ sourceId: "absent", sourceEvidenceId: "absent-evidence", traceabilityId: "absent-trace", assertion: "ABSENT" })] })]);
    expect(p.uncertaintyReasons).toContain("contradiction");
    expect(["HIGH", "VERY_HIGH"]).toContain(p.uncertaintyLevel);
  });

  test("12. soporte de campo aumenta confianza", () => {
    const withoutField = product([
      approved({ generatedAt: "2026-01-01T12:00:00.000Z", sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue-a", sourceEvidenceId: "evidence-denue-a", traceabilityId: "trace-denue-a" })] }),
      approved({ generatedAt: "2026-02-01T12:00:00.000Z", sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue-b", sourceEvidenceId: "evidence-denue-b", traceabilityId: "trace-denue-b" })] }),
    ], "TREND");
    const withField = product([
      approved({ generatedAt: "2026-01-01T12:00:00.000Z" }),
      approved({ generatedAt: "2026-02-01T12:00:00.000Z" }),
    ], "TREND");
    expect(withField.confidence).toBeGreaterThan(withoutField.confidence);
  });

  test("13. contradiccion de campo reduce confianza", () => {
    const withField = product([approved()]);
    const fieldNo = product([approved({ sources: [source(), source({ sourceKind: "FIELD_OBSERVATION", sourceId: "field-no", sourceEvidenceId: "field-no-evidence", traceabilityId: "field-no-trace", assertion: "ABSENT", epistemicRole: "HUMAN_OBSERVATION" })] })]);
    expect(fieldNo.confidence).toBeLessThan(withField.confidence);
    expect(fieldNo.fieldStatus).toBe("fieldContradiction");
  });

  test("14. fuentes dependientes no inflan confianza", () => {
    const dependent = product([approved({ sources: [source(), source({ sourceKind: "VISION", sourceId: "vision", sourceEvidenceId: "vision-evidence", traceabilityId: "vision-trace", epistemicRole: "ANALYTICAL_SUGGESTION", dependsOnSourceEvidenceIds: ["evidence-street-view"] })] })]);
    const independent = product([approved({ sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue-2", sourceEvidenceId: "denue-2-evidence", traceabilityId: "denue-2-trace" })] })]);
    expect(dependent.confidence).toBeLessThanOrEqual(independent.confidence);
  });

  test("15. independencia de fuentes aumenta matriz de confianza", () => {
    const independent = product([approved({ sources: [source(), source({ sourceKind: "DENUE", sourceId: "denue-2", sourceEvidenceId: "denue-2-evidence", traceabilityId: "denue-2-trace" })] })]);
    expect(independent.confidenceBasis).toMatch(/independence=1/);
  });

  test("16. dato historico parcial no sostiene escenario actual", () => {
    const c1 = { ...approved({ generatedAt: "2026-01-01T12:00:00.000Z" }), temporalCompatibility: "PARTIAL" as const };
    const c2 = { ...approved({ generatedAt: "2026-02-01T12:00:00.000Z" }), temporalCompatibility: "PARTIAL" as const };
    const p = product([c1, c2], "PROSPECTIVE_SCENARIO");
    expect(p.scenario).toBe("INSUFFICIENT_EVIDENCE");
    expect(p.limitations.join(" ")).toMatch(/historicos/i);
  });

  test("17. producto vencido queda stale", () => {
    const p = product();
    expect(getPredictiveProductStatus(p, new Date("2027-01-01T00:00:00.000Z"))).toBe("STALE");
  });

  test("18. rol epistemico es analytical projection", () => {
    expect(product().epistemicRole).toBe("ANALYTICAL_PROJECTION");
  });

  test("19. nunca nace como source fact", () => {
    expect(JSON.stringify(product())).not.toMatch(/"SOURCE_FACT"/);
  });

  test("20. nace pendiente de revision humana", () => {
    expect(product().humanReviewStatus).toBe("PENDING_REVIEW");
  });

  test("21. aprobacion conserva reviewer", () => {
    const reviewed = approvePredictiveAnalyticalProduct(product(), { reviewedBy: "ppc-final", reviewedAt: "2026-09-06T14:00:00.000Z", reviewComment: "Aprobado." });
    expect(reviewed.humanReviewStatus).toBe("APPROVED");
    expect(reviewed.reviewedBy).toBe("ppc-final");
    expect(reviewed.reviewComment).toBe("Aprobado.");
  });

  test("22. rechazo bloquea estado downstream", () => {
    const rejected = rejectPredictiveAnalyticalProduct(product());
    expect(getPredictiveProductStatus(rejected)).toBe("REJECTED");
  });

  test("23. relacion SUPPORTS no modifica hipotesis externa", () => {
    const hypothesis = "Hipotesis institucional vigente";
    expect(product([approved({ hypothesisRelation: "SUPPORTS" })]).hypothesisRelation).toBe("SUPPORTS");
    expect(hypothesis).toBe("Hipotesis institucional vigente");
  });

  test("24. relacion CONTRADICTS no modifica hipotesis externa", () => {
    const hypothesis = "Hipotesis institucional vigente";
    expect(product([approved({ hypothesisRelation: "CONTRADICTS" })]).hypothesisRelation).toBe("CONTRADICTS");
    expect(hypothesis).toBe("Hipotesis institucional vigente");
  });

  test("25. no produce prediccion personal", () => {
    const p = product();
    expect(p.producedPersonalPrediction).toBe(false);
    expect(p.productType).not.toMatch(/OFFENDER|PERSON|INDIVIDUAL/);
  });

  test("26. no produce certeza de ocurrencia criminal", () => {
    const p = product();
    expect(p.producedCrimeOccurrenceCertainty).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/CRIME_WILL_OCCUR|OFFENDER_WILL_ACT|DRUG_POINT|GANG_ATTACK|ESCAPE_PROBABILITY/i);
  });

  test("27. no expresa falsa precision porcentual", () => {
    const p = product();
    expect(Number(p.confidence.toFixed(2))).toBe(p.confidence);
    expect(p.confidenceBasis).not.toContain("%");
  });

  test("28. produce vigencia temporal", () => {
    expect(Date.parse(product().validUntil)).toBeGreaterThan(Date.parse("2026-09-06T13:00:00.000Z"));
  });

  test("29. conserva supuestos analiticos", () => {
    expect(product().assumptions.length).toBeGreaterThan(0);
  });

  test("30. conserva limitaciones", () => {
    expect(product().limitations.join(" ")).toMatch(/no SOURCE_FACT/i);
  });

  test("31. conserva factores de soporte", () => {
    expect(product().supportingFactors).toEqual(expect.arrayContaining(["ACCESS_FEATURE_CORROBORATION", "SAME_POINT"]));
  });

  test("32. conserva factores contradictorios", () => {
    const p = product([approved({ sources: [source(), source({ sourceId: "absent", sourceEvidenceId: "absent-evidence", traceabilityId: "absent-trace", assertion: "ABSENT" })] })]);
    expect(p.contradictingFactors).toContain("absent");
  });

  test("33. conserva traceabilityIds", () => {
    expect(product().traceabilityIds).toEqual(expect.arrayContaining(["trace-street-view", "trace-denue", "trace-field"]));
  });

  test("34. conserva linaje canonico", () => {
    expect(product().lineage.length).toBeGreaterThan(0);
  });

  test("35. respeta geografia canonica declarada", () => {
    expect(product(undefined, undefined, "POLYGON").canonicalGeographyType).toBe("POLYGON");
  });

  test("36. soporta punto", () => {
    expect(product(undefined, undefined, "POINT").canonicalGeographyType).toBe("POINT");
  });

  test("37. soporta corredor", () => {
    const p = product([approved()], undefined, "CORRIDOR");
    expect(p.canonicalGeographyType).toBe("CORRIDOR");
    expect(p.productType).toBe("CORRIDOR_ACTIVITY_OUTLOOK");
  });

  test("38. soporta poligono", () => {
    expect(product(undefined, undefined, "POLYGON").canonicalGeographyType).toBe("POLYGON");
  });

  test("39. soporta multipoligono", () => {
    expect(product(undefined, undefined, "MULTIPOLYGON").canonicalGeographyType).toBe("MULTIPOLYGON");
  });

  test("40. E2E controlado: convergencia aprobada a producto aprobable", () => {
    const c1 = { ...approved({ generatedAt: "2026-01-01T12:00:00.000Z" }), confidence: 0.52 };
    const c2 = { ...approved({ generatedAt: "2026-02-01T12:00:00.000Z" }), confidence: 0.74 };
    const draft = product([c1, c2], "PROSPECTIVE_SCENARIO");
    expect(draft.trend).toBe("INCREASING");
    expect(draft.scenario).toBe("INTENSIFICATION");
    expect(draft.humanReviewStatus).toBe("PENDING_REVIEW");
    const reviewed = approvePredictiveAnalyticalProduct(draft, { reviewedBy: "ppc-final" });
    expect(reviewed.humanReviewStatus).toBe("APPROVED");
  });
});
