import fs from "node:fs";
import path from "node:path";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  buildInstitutionalReportInput,
  reconcileInstitutionalReportPayload,
} from "../src/utils/institutionalReportPublicationContract";
import { validateInstitutionalReportTraceability } from "../src/utils/institutionalReportTraceabilityGate";
import {
  evaluatePredictiveProductAdmission,
  persistApprovedPredictiveProductToExpediente,
  renderPredictiveProductsForInstitutionalReport,
  selectPredictiveProductsForInstitutionalReport,
} from "../src/utils/institutionalPredictiveProductIntegration";
import {
  approvePredictiveAnalyticalProduct,
  buildPredictiveAnalyticalProduct,
  rejectPredictiveAnalyticalProduct,
  type PredictiveAnalyticalProduct,
} from "../src/utils/predictiveAnalyticalProducts";
import {
  approveConvergenceResult,
  buildInstitutionalConvergence,
  type ConvergenceSourceEntry,
} from "../src/utils/institutionalMultisourceConvergence";
import { buildReport } from "../src/utils/buildReport";
import { assertInstitutionalExportAuthorization } from "../src/lib/reportEngine";

const root = process.cwd();
const geography = buildCanonicalProjectGeography({
  projectId: "exp-0255",
  type: "POINT",
  points: [{ lat: 21.8818, lng: -102.2916 }],
  now: 1,
});
const lineage = buildEvidenceLineage({
  sourceId: "source-0255",
  sourceReference: "fixture://adr-0255",
  evidenceId: "ev-0255",
  findingId: "find-0255",
  inferenceId: "inf-0255",
  analysisId: "analysis-0255",
  conclusionId: "conclusion-0255",
  geographyId: geography.geographyId,
});
const goodHash = "d".repeat(64);

function source(overrides: Partial<ConvergenceSourceEntry> = {}): ConvergenceSourceEntry {
  const suffix = overrides.sourceId || overrides.sourceKind || "street-view";
  return {
    sourceKind: "STREET_VIEW",
    sourceId: `src-${suffix}`,
    sourceEvidenceId: `evidence-${suffix}`,
    traceabilityId: `trace-${suffix}`,
    expedienteId: "exp-0255",
    geographyId: geography.geographyId,
    coordinates: { lat: 21.8818, lng: -102.2916 },
    timestamp: "2026-09-06T12:00:00.000Z",
    temporalClass: "CURRENT",
    epistemicRole: "SOURCE_FACT",
    validationStatus: "APPROVED",
    lineage,
    sourceReferences: [`fixture:${suffix}`],
    phenomenonTags: ["access", "gate"],
    assertion: "PRESENT",
    acquisitionMode: "OBSERVED",
    ...overrides,
  };
}

function approvedConvergence(generatedAt = "2026-09-06T12:00:00.000Z") {
  return approveConvergenceResult(
    buildInstitutionalConvergence({
      expedienteId: "exp-0255",
      geographyId: geography.geographyId,
      phenomenon: "ACCESS_FEATURE_CORROBORATION",
      sources: [
        source({ sourceId: "street-view", sourceEvidenceId: "evidence-street-view", traceabilityId: "trace-street-view" }),
        source({ sourceKind: "DENUE", sourceId: "denue", sourceEvidenceId: "evidence-denue", traceabilityId: "trace-denue" }),
        source({ sourceKind: "FIELD_OBSERVATION", sourceId: "field", sourceEvidenceId: "evidence-field", traceabilityId: "trace-field", epistemicRole: "HUMAN_OBSERVATION" }),
      ],
      generatedAt,
      hypothesisRelation: "SUPPORTS",
    }),
    { reviewedBy: "ppc-conv", reviewedAt: "2026-09-06T12:30:00.000Z" }
  );
}

function draftProduct(): PredictiveAnalyticalProduct {
  const result = buildPredictiveAnalyticalProduct({
    expedienteId: "exp-0255",
    geographyId: geography.geographyId,
    canonicalGeographyType: "POINT",
    approvedConvergences: [
      { ...approvedConvergence("2026-08-01T12:00:00.000Z"), confidence: 0.5 },
      { ...approvedConvergence("2026-09-01T12:00:00.000Z"), confidence: 0.7 },
    ],
    analyticalLevel: "PROSPECTIVE_SCENARIO",
    generatedAt: "2026-09-06T13:00:00.000Z",
  });
  if (!result.product) throw new Error(result.blockingReasons.join(","));
  return result.product;
}

function approvedProduct(overrides: Partial<PredictiveAnalyticalProduct> = {}): PredictiveAnalyticalProduct {
  return {
    ...approvePredictiveAnalyticalProduct(draftProduct(), {
      reviewedBy: "ppc-product",
      reviewedAt: "2026-09-06T14:00:00.000Z",
      reviewComment: "Producto integrado.",
    }),
    ...overrides,
  };
}

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-0255",
    id: "ev-0255",
    traceabilityId: "trace-ev-0255",
    sourceEvidenceId: "source-ev-0255",
    expedienteId: "exp-0255",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    coordinates: { lat: 21.8818, lng: -102.2916 },
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-0255",
    id: "find-0255",
    traceabilityId: "trace-find-0255",
    sourceEvidenceId: "source-ev-0255",
    expedienteId: "exp-0255",
    geographyId: geography.geographyId,
    usedInReport: true,
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return {
    ...createAiAnalyticalOutput({
      outputId: "analysis-0255",
      outputType: "ANALYSIS",
      evidenceIds: ["ev-0255"],
      findingIds: ["find-0255"],
      lineage,
      validationStatus: "APPROVED",
      ...overrides,
    }),
    id: "analysis-0255",
    analysisId: "analysis-0255",
    traceabilityId: "trace-analysis-0255",
    expedienteId: "exp-0255",
    geographyId: geography.geographyId,
    ...overrides,
  };
}

function hypothesis() {
  return formulateHumanHypothesis({
    projectId: "exp-0255",
    text: "Hipotesis humana gobernada.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-0255"],
    supportingFindingIds: ["find-0255"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "exp-0255",
    projectId: "exp-0255",
    expedienteId: "exp-0255",
    geographyId: geography.geographyId,
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    photoEvidence: [evidence()],
    findings: [finding()],
    analysisOutputs: [analysis()],
    predictiveAnalyticalProducts: [approvedProduct()],
    conclusions: [{
      conclusionId: "conclusion-0255",
      id: "conclusion-0255",
      humanValidationStatus: "APPROVED",
      lineage,
      lineageStatus: "SUPPORTED",
      analysisIds: ["analysis-0255"],
    }],
    sweeps: [{ id: "sweep-0255", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-0255"], outputFindingIds: ["find-0255"] }],
    ...overrides,
  };
}

describe("ADR-025.5 institutional product integration and report governance", () => {
  test("1. approved predictive product passes gate", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct(), { now: new Date("2026-09-07") }).admissible).toBe(true);
  });

  test("2. pending blocked", () => {
    expect(evaluatePredictiveProductAdmission(draftProduct()).reasons.join(" ")).toMatch(/NOT_APPROVED/);
  });

  test("3. rejected blocked", () => {
    expect(evaluatePredictiveProductAdmission(rejectPredictiveAnalyticalProduct(draftProduct())).reasons.join(" ")).toMatch(/REJECTED/);
  });

  test("4. draft blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ humanReviewStatus: "DRAFT" })).admissible).toBe(false);
  });

  test("5. stale blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ validUntil: "2026-01-01T00:00:00.000Z" }), { now: new Date("2026-09-07") }).reasons).toContain("PREDICTIVE_PRODUCT_STALE");
  });

  test("6. missing reviewer blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ reviewedBy: "" })).reasons).toContain("PREDICTIVE_PRODUCT_MISSING_REVIEWER");
  });

  test("7. missing reviewedAt blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ reviewedAt: "" })).reasons).toContain("PREDICTIVE_PRODUCT_MISSING_REVIEWED_AT");
  });

  test("8. missing traceability blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ traceabilityIds: [] })).reasons).toContain("PREDICTIVE_PRODUCT_MISSING_TRACEABILITY");
  });

  test("9. invalid lineage blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ lineage: [] })).reasons).toContain("PREDICTIVE_PRODUCT_INVALID_LINEAGE");
  });

  test("10. wrong geography blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct(), { geographyId: "geo-other" }).reasons).toContain("PREDICTIVE_PRODUCT_WRONG_GEOGRAPHY");
  });

  test("11. blockingReasons nonempty blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ blockingReasons: ["BLOCK"] })).reasons).toContain("PREDICTIVE_PRODUCT_HAS_BLOCKING_REASONS");
  });

  test("12. non analytical projection blocked", () => {
    expect(evaluatePredictiveProductAdmission({ ...approvedProduct(), epistemicRole: "SOURCE_FACT" }).reasons).toContain("PREDICTIVE_PRODUCT_INVALID_EPISTEMIC_ROLE");
  });

  test("13. source fact cannot masquerade as predictive", () => {
    const reportInput = buildInstitutionalReportInput(readyProject({ predictiveAnalyticalProducts: [{ ...approvedProduct(), epistemicRole: "SOURCE_FACT" }] }));
    expect(reportInput.predictiveAnalyticalProducts).toHaveLength(0);
    expect(reportInput.exclusions.map((item) => item.reasonCode)).toContain("PREDICTIVE_PRODUCT_INVALID_EPISTEMIC_ROLE");
  });

  test("14. approved product persists review metadata", () => {
    const persisted = persistApprovedPredictiveProductToExpediente({ id: "exp-0255" }, approvedProduct(), { persistedAt: "2026-09-06T15:00:00.000Z" });
    expect(persisted.predictiveAnalyticalProducts[0].reviewedBy).toBe("ppc-product");
    expect(persisted.predictiveAnalyticalProducts[0].reviewedAt).toBe("2026-09-06T14:00:00.000Z");
  });

  test("15. history preserved", () => {
    const p1 = approvedProduct({ productId: "pap-1" });
    const p2 = approvedProduct({ productId: "pap-2" });
    const project = persistApprovedPredictiveProductToExpediente(persistApprovedPredictiveProductToExpediente({ id: "exp-0255" }, p1), p2);
    expect(project.predictiveAnalyticalProductHistory.map((item) => item.productId)).toEqual(["pap-1", "pap-2"]);
  });

  test("16. stale history preserved", () => {
    const stale = approvedProduct({ productId: "stale", validUntil: "2026-01-01T00:00:00.000Z" });
    const project = { predictiveAnalyticalProductHistory: [stale], predictiveAnalyticalProducts: [stale] };
    expect(selectPredictiveProductsForInstitutionalReport(project, { now: new Date("2026-09-07") }).products).toHaveLength(0);
    expect(project.predictiveAnalyticalProductHistory).toHaveLength(1);
  });

  test("17. report selector returns approved only", () => {
    const selection = selectPredictiveProductsForInstitutionalReport(readyProject({ predictiveAnalyticalProducts: [approvedProduct(), draftProduct()] }), { now: new Date("2026-09-07") });
    expect(selection.products).toHaveLength(1);
  });

  test("18. export excludes pending", () => {
    expect(buildInstitutionalReportInput(readyProject({ predictiveAnalyticalProducts: [draftProduct()] })).predictiveAnalyticalProducts).toHaveLength(0);
  });

  test("19. export excludes rejected", () => {
    expect(buildInstitutionalReportInput(readyProject({ predictiveAnalyticalProducts: [rejectPredictiveAnalyticalProduct(draftProduct())] })).predictiveAnalyticalProducts).toHaveLength(0);
  });

  test("20. export excludes stale", () => {
    expect(selectPredictiveProductsForInstitutionalReport(readyProject({ predictiveAnalyticalProducts: [approvedProduct({ validUntil: "2026-01-01T00:00:00.000Z" })] }), { now: new Date("2026-09-07") }).products).toHaveLength(0);
  });

  test("21. report preserves productId", () => {
    expect(buildInstitutionalReportInput(readyProject()).predictiveAnalyticalProducts[0].productId).toBe(approvedProduct().productId);
  });

  test("22. report preserves traceability", () => {
    expect(buildInstitutionalReportInput(readyProject()).predictiveAnalyticalProducts[0].traceabilityIds).toContain("trace-street-view");
  });

  test("23. report preserves reviewer", () => {
    expect(buildInstitutionalReportInput(readyProject()).predictiveAnalyticalProducts[0].reviewedBy).toBe("ppc-product");
  });

  test("24. report preserves uncertainty", () => {
    expect(buildInstitutionalReportInput(readyProject()).predictiveAnalyticalProducts[0].uncertaintyLevel).toBeDefined();
  });

  test("25. report preserves limitations", () => {
    expect(buildInstitutionalReportInput(readyProject()).predictiveAnalyticalProducts[0].limitations.length).toBeGreaterThan(0);
  });

  test("26. supports/contradicts relation preserved", () => {
    expect(buildInstitutionalReportInput(readyProject({ predictiveAnalyticalProducts: [approvedProduct({ hypothesisRelation: "CONTRADICTS" })] })).predictiveAnalyticalProducts[0].hypothesisRelation).toBe("CONTRADICTS");
  });

  test("27. no false precision language", () => {
    expect(renderPredictiveProductsForInstitutionalReport([approvedProduct()])).not.toContain("%");
  });

  test("28. no personal prediction language", () => {
    expect(renderPredictiveProductsForInstitutionalReport([approvedProduct()])).not.toMatch(/el sujeto hara|se cometera|ocurrira|probabilidad de delito|zona criminal confirmada/i);
  });

  test("29. contextualized semantics explicitly blocked", () => {
    expect(evaluatePredictiveProductAdmission(approvedProduct({ humanReviewStatus: "CONTEXTUALIZED" })).reasons).toContain("CONTEXTUALIZED_NOT_REPORTABLE_WITHOUT_NEW_APPROVAL");
  });

  test("30. E2E approved path works", () => {
    const ppcApproved = approvedProduct();
    const gate = evaluatePredictiveProductAdmission(ppcApproved, { now: new Date("2026-09-07") });
    const expediente = persistApprovedPredictiveProductToExpediente(readyProject({ predictiveAnalyticalProducts: [] }), ppcApproved);
    const input = buildInstitutionalReportInput(expediente);
    const reconciled = reconcileInstitutionalReportPayload(expediente, input);
    expect(gate.admissible).toBe(true);
    expect(input.predictiveAnalyticalProducts).toHaveLength(1);
    expect(reconciled.prospectiveAnalysis).toMatch(/analisis prospectivo identifica/i);
  });

  test("31. E2E pending blocked", () => {
    expect(buildInstitutionalReportInput(readyProject({ predictiveAnalyticalProducts: [draftProduct()] })).predictiveAnalyticalProducts).toHaveLength(0);
  });

  test("32. E2E stale blocked", () => {
    expect(selectPredictiveProductsForInstitutionalReport(readyProject({ predictiveAnalyticalProducts: [approvedProduct({ validUntil: "2026-01-01T00:00:00.000Z" })] }), { now: new Date("2026-09-07") }).products).toHaveLength(0);
  });

  test("33. legacy export bypass absent", () => {
    const panel = fs.readFileSync(path.join(root, "src/components/PredictivePanel.tsx"), "utf8");
    const legacyReport = buildReport(readyProject({ predictiveAnalyticalProducts: [draftProduct()] })) as any;
    expect(panel).not.toContain("runPredictiveAnalysis");
    expect(panel).not.toContain("escalationProbability");
    expect(legacyReport.predictiveAnalyticalProducts).toHaveLength(0);
  });

  test("34. ADR-022 gate regression remains green for predictive analytical product type", () => {
    const gate = validateInstitutionalReportTraceability({ analyticalProducts: [approvedProduct()] });
    expect(gate.eligibleForInstitutionalPublication).toBe(true);
    expect(gate.analyticalProductSummary.eligible).toBe(1);
  });

  test("35. institutional export authorization still requires report input", () => {
    expect(() => assertInstitutionalExportAuthorization({ exportMode: "INSTITUTIONAL" }, "WORD")).toThrow("WORD_INSTITUTIONAL_EXPORT_BLOCKED");
  });
});
