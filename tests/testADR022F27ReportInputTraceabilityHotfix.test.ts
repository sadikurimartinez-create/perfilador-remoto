import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { buildInstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import { evaluatePredictiveProductAdmission } from "../src/utils/institutionalPredictiveProductIntegration";
import type { PredictiveAnalyticalProduct } from "../src/utils/predictiveAnalyticalProducts";

const generatedAt = "2026-09-06T12:00:00.000Z";
const geography = buildCanonicalProjectGeography({
  projectId: "exp-adr022-hotfix",
  type: "INDIVIDUAL",
  points: [{ lat: 21.885, lng: -102.291 }],
  now: 1,
});
const lineage = buildEvidenceLineage({
  sourceId: "source-hotfix",
  sourceReference: "fixture://adr-022-hotfix",
  evidenceId: "ev-valid",
  findingId: "finding-valid",
  analysisId: "analysis-valid",
  geographyId: geography.geographyId,
});

function evidence(overrides: any = {}) {
  return {
    id: "ev-valid",
    evidenceId: "ev-valid",
    traceabilityId: "trace-ev-valid",
    sourceEvidenceId: "source-ev-valid",
    expedienteId: "exp-adr022-hotfix",
    projectId: "exp-adr022-hotfix",
    geographyId: geography.geographyId,
    coordinates: { lat: 21.885, lng: -102.291 },
    lineageStatus: "SUPPORTED",
    lineage,
    humanValidationStatus: "APPROVED",
    sourceStatus: "AUTHORITATIVE",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    id: "finding-valid",
    findingId: "finding-valid",
    traceabilityId: "trace-finding-valid",
    sourceEvidenceId: "source-ev-valid",
    expedienteId: "exp-adr022-hotfix",
    projectId: "exp-adr022-hotfix",
    geographyId: geography.geographyId,
    lineageStatus: "SUPPORTED",
    lineage,
    supportingEvidenceIds: ["ev-valid"],
    humanValidationStatus: "APPROVED",
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return {
    id: "analysis-valid",
    analysisId: "analysis-valid",
    outputId: "analysis-valid",
    outputType: "ANALYSIS",
    traceabilityId: "trace-analysis-valid",
    expedienteId: "exp-adr022-hotfix",
    projectId: "exp-adr022-hotfix",
    geographyId: geography.geographyId,
    lineageStatus: "SUPPORTED",
    lineage,
    evidenceIds: ["ev-valid"],
    sourceIds: ["source-ev-valid"],
    findingIds: ["finding-valid"],
    validationStatus: "APPROVED",
    humanValidationStatus: "APPROVED",
    ...overrides,
  };
}

function predictiveProduct(overrides: Partial<PredictiveAnalyticalProduct> = {}): PredictiveAnalyticalProduct {
  return {
    productId: "pap-valid",
    expedienteId: "exp-adr022-hotfix",
    geographyId: geography.geographyId,
    canonicalGeographyType: "POINT",
    productType: "SPATIAL_PERSISTENCE_OUTLOOK",
    analyticalLevel: "TREND",
    trend: "STABLE",
    scenario: "PERSISTENCE",
    supportingConvergences: ["conv-valid"],
    contradictingConvergences: [],
    supportingFactors: ["factor gobernado"],
    contradictingFactors: [],
    assumptions: [],
    limitations: ["limitacion gobernada"],
    confidence: 0.72,
    confidenceBasis: "basis",
    uncertaintyLevel: "MODERATE",
    uncertaintyReasons: ["temporal_gap"],
    temporalWindow: {
      analysisWindowStart: generatedAt,
      analysisWindowEnd: generatedAt,
      generatedAt,
      validUntil: "2026-12-31T00:00:00.000Z",
      temporalAssumptions: [],
    },
    validUntil: "2026-12-31T00:00:00.000Z",
    hypothesisRelation: "SUPPORTS",
    fieldStatus: "fieldSupport",
    epistemicRole: "ANALYTICAL_PROJECTION",
    humanReviewStatus: "APPROVED",
    reviewedBy: "ppc-hotfix",
    reviewedAt: generatedAt,
    reviewComment: null,
    lineage,
    traceabilityIds: ["trace-pap-valid"],
    producedFromApprovedConvergences: true,
    blockingReasons: [],
    producedPersonalPrediction: false,
    producedCrimeOccurrenceCertainty: false,
    ...overrides,
  };
}

function readyProject(overrides: any = {}) {
  return {
    id: "exp-adr022-hotfix",
    projectId: "exp-adr022-hotfix",
    expedienteId: "exp-adr022-hotfix",
    geographyId: geography.geographyId,
    canonicalGeography: geography,
    canonicalHypothesis: formulateHumanHypothesis({
      projectId: "exp-adr022-hotfix",
      text: "Hipotesis humana gobernada.",
      geographyId: geography.geographyId,
      supportingEvidenceIds: ["ev-valid"],
      supportingFindingIds: ["finding-valid"],
      lineage,
    }),
    photoEvidence: [evidence()],
    findings: [finding()],
    analysisOutputs: [analysis()],
    streetViewAnalysis: [evidence({
      id: "sv-valid",
      evidenceId: "sv-valid",
      sourceEvidenceId: "source-sv-valid",
      traceabilityId: "trace-sv-valid",
      sourceType: "STREET_VIEW",
    })],
    predictiveAnalyticalProducts: [predictiveProduct()],
    sweeps: [{ id: "sweep-hotfix", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-valid"], outputFindingIds: ["finding-valid"] }],
    ...overrides,
  };
}

function report(overrides: any = {}) {
  return buildInstitutionalReportInput(readyProject(overrides), { generatedAt });
}

describe("ADR-022 FASE 2.7 - Report input traceability gate hotfix", () => {
  test("1 evidencia trazable entra", () => {
    expect(report().evidence.map((item) => item.evidenceId)).toContain("ev-valid");
  });

  test("2 evidencia no trazable se excluye selectivamente", () => {
    const input = report({ photoEvidence: [evidence(), evidence({ id: "ev-no-source", evidenceId: "ev-no-source", sourceEvidenceId: "" })] });
    expect(input.evidence.map((item) => item.evidenceId)).not.toContain("ev-no-source");
    expect(input.traceabilityGate.exclusions.map((item) => item.itemId)).toContain("ev-no-source");
  });

  test("3 finding trazable entra", () => {
    expect(report().findings.map((item) => item.findingId)).toContain("finding-valid");
  });

  test("4 finding no trazable se excluye selectivamente", () => {
    const input = report({ findings: [finding(), finding({ id: "finding-no-trace", findingId: "finding-no-trace", traceabilityId: "", usedInReport: false })] });
    expect(input.findings.map((item) => item.findingId)).not.toContain("finding-no-trace");
    expect(input.traceabilityGate.exclusions.map((item) => item.itemId)).toContain("finding-no-trace");
  });

  test("5 analysis trazable entra", () => {
    expect(report().analyses.map((item) => item.analysisId)).toContain("analysis-valid");
  });

  test("6 analysis no trazable se excluye selectivamente", () => {
    const input = report({ analysisOutputs: [analysis(), analysis({ id: "analysis-no-trace", analysisId: "analysis-no-trace", outputId: "analysis-no-trace", traceabilityId: "", usedInReport: false })] });
    expect(input.analyses.map((item) => item.analysisId)).not.toContain("analysis-no-trace");
    expect(input.traceabilityGate.exclusions.map((item) => item.itemId)).toContain("analysis-no-trace");
  });

  test("7 Street View trazable entra", () => {
    expect(report().streetView.map((item) => item.evidenceId)).toContain("sv-valid");
  });

  test("8 Street View sin trazabilidad suficiente se excluye selectivamente", () => {
    const input = report({
      streetViewAnalysis: [
        evidence({ id: "sv-valid", evidenceId: "sv-valid", sourceEvidenceId: "source-sv-valid", traceabilityId: "trace-sv-valid", sourceType: "STREET_VIEW" }),
        evidence({ id: "sv-no-source", evidenceId: "sv-no-source", sourceEvidenceId: "", traceabilityId: "trace-sv-no-source", sourceType: "STREET_VIEW", usedInReport: false }),
      ],
    });
    expect(input.streetView.map((item) => item.evidenceId)).not.toContain("sv-no-source");
    expect(input.traceabilityGate.exclusions.map((item) => item.itemId)).toContain("sv-no-source");
  });

  test("9 producto predictivo aprobado y trazable entra", () => {
    const input = report();
    expect(input.predictiveAnalyticalProducts.map((item) => item.productId)).toContain("pap-valid");
  });

  test("10 producto predictivo no admisible no entra", () => {
    const input = report({ predictiveAnalyticalProducts: [predictiveProduct({ productId: "pap-pending", humanReviewStatus: "PENDING_REVIEW" })] });
    expect(input.predictiveAnalyticalProducts).toHaveLength(0);
    expect(input.exclusions.map((item) => item.itemId)).toContain("pap-pending");
  });

  test("11 analyticalProducts no reemplaza validacion de evidence findings analyses streetView", () => {
    const input = report({
      photoEvidence: [evidence(), evidence({ id: "ev-no-source", evidenceId: "ev-no-source", sourceEvidenceId: "" })],
      findings: [finding(), finding({ id: "finding-no-trace", findingId: "finding-no-trace", traceabilityId: "", usedInReport: false })],
      analysisOutputs: [analysis(), analysis({ id: "analysis-no-trace", analysisId: "analysis-no-trace", outputId: "analysis-no-trace", traceabilityId: "", usedInReport: false })],
      streetViewAnalysis: [
        evidence({ id: "sv-valid", evidenceId: "sv-valid", sourceEvidenceId: "source-sv-valid", traceabilityId: "trace-sv-valid", sourceType: "STREET_VIEW" }),
        evidence({ id: "sv-no-source", evidenceId: "sv-no-source", sourceEvidenceId: "", sourceType: "STREET_VIEW", usedInReport: false }),
      ],
      predictiveAnalyticalProducts: [predictiveProduct()],
    });
    expect(input.traceabilityGate.evidenceSummary.total).toBe(2);
    expect(input.traceabilityGate.findingSummary.total).toBe(2);
    expect(input.traceabilityGate.analysisSummary.total).toBe(2);
    expect(input.traceabilityGate.streetViewSummary.total).toBe(2);
    expect(input.traceabilityGate.analyticalProductSummary.total).toBe(1);
  });

  test("12 excludedItemKeys refleja evidence finding analysis streetView y conserva exclusiones predictivas", () => {
    const input = report({
      photoEvidence: [evidence(), evidence({ id: "ev-no-source", evidenceId: "ev-no-source", sourceEvidenceId: "" })],
      findings: [finding(), finding({ id: "finding-no-trace", findingId: "finding-no-trace", traceabilityId: "", usedInReport: false })],
      analysisOutputs: [analysis(), analysis({ id: "analysis-no-trace", analysisId: "analysis-no-trace", outputId: "analysis-no-trace", traceabilityId: "", usedInReport: false })],
      streetViewAnalysis: [
        evidence({ id: "sv-valid", evidenceId: "sv-valid", sourceEvidenceId: "source-sv-valid", traceabilityId: "trace-sv-valid", sourceType: "STREET_VIEW" }),
        evidence({ id: "sv-no-source", evidenceId: "sv-no-source", sourceEvidenceId: "", sourceType: "STREET_VIEW", usedInReport: false }),
      ],
      predictiveAnalyticalProducts: [predictiveProduct(), predictiveProduct({ productId: "pap-no-lineage", lineage: [] })],
    });
    expect(input.traceabilityGate.exclusions.map((item) => `${item.itemType}:${item.itemId}`)).toEqual(expect.arrayContaining([
      "EVIDENCE:ev-no-source",
      "FINDING:finding-no-trace",
      "ANALYSIS:analysis-no-trace",
      "STREET_VIEW:sv-no-source",
    ]));
    expect(input.exclusions.map((item) => `${item.itemType}:${item.itemId}`)).toContain("PREDICTIVE_ANALYTICAL_PRODUCT:pap-no-lineage");
  });

  test("13 lineageSummary no cuenta items excluidos", () => {
    const input = report({ findings: [finding(), finding({ id: "finding-no-trace", findingId: "finding-no-trace", traceabilityId: "", usedInReport: false })] });
    expect(input.lineageSummary.findingIds).toContain("finding-valid");
    expect(input.lineageSummary.findingIds).not.toContain("finding-no-trace");
  });

  test("14 ExecutiveGeointReportModel solo recibe InstitutionalReportInput ya gobernado", () => {
    const input = report({ findings: [finding(), finding({ id: "finding-no-trace", findingId: "finding-no-trace", traceabilityId: "", usedInReport: false })] });
    const model = buildExecutiveGeointReportModel(input, {
      documentIdentity: { numeroExpediente: "06092026-0001-PPC" },
      now: generatedAt,
    });
    expect(model.findings.map((item) => item.findingId)).not.toContain("finding-no-trace");
  });

  test("15 ADR-025 permanece intacto", () => {
    expect(evaluatePredictiveProductAdmission(predictiveProduct(), { now: new Date("2026-09-07") }).admissible).toBe(true);
    expect(evaluatePredictiveProductAdmission(predictiveProduct({ productId: "pap-pending", humanReviewStatus: "PENDING_REVIEW" })).admissible).toBe(false);
  });
});
