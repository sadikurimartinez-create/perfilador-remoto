import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity, createHashUnavailableIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  assertInstitutionalReportReady,
  assessReportReadiness,
  canGenerateDraftReport,
  canGenerateInstitutionalReport,
} from "../src/utils/reportReadyGovernance";

const geography = buildCanonicalProjectGeography({
  projectId: "project-1",
  type: "INDIVIDUAL",
  points: [{ lat: 21.88, lng: -102.29 }],
  now: 1,
});

const lineage = buildEvidenceLineage({
  geographyId: geography.geographyId,
  sourceId: "source-1",
  evidenceId: "ev-1",
  findingId: "find-1",
  inferenceId: "inf-1",
  analysisId: "analysis-1",
  conclusionId: "conclusion-1",
});

const goodHash = "a".repeat(64);

function validEvidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    usedInReport: true,
    requiredForReport: true,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({
      rawSha256: goodHash,
      declaredMimeType: "image/jpeg",
    }),
    lineage,
    ...overrides,
  };
}

function supportedFinding(overrides: any = {}) {
  return {
    findingId: "find-1",
    usedInReport: true,
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function supportedAnalysis(overrides: any = {}) {
  return createAiAnalyticalOutput({
    outputId: "analysis-1",
    outputType: "ANALYSIS",
    findingIds: ["find-1"],
    evidenceIds: ["ev-1"],
    lineage,
    validationStatus: "APPROVED",
    ...overrides,
  });
}

function formulatedHypothesis(overrides: any = {}) {
  return formulateHumanHypothesis({
    projectId: "project-1",
    text: "Hipótesis humana formulada.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-1"],
    supportingFindingIds: ["find-1"],
    lineage,
    ...overrides,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-1",
    canonicalGeography: geography,
    canonicalHypothesis: formulatedHypothesis(),
    evidence: [validEvidence()],
    findings: [supportedFinding()],
    analysisOutputs: [supportedAnalysis()],
    sources: [{ id: "source-1", sourceStatus: "AUTHORITATIVE" }],
    sweeps: [{ id: "sweep-1", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-1"], outputFindingIds: ["find-1"] }],
    ...overrides,
  };
}

describe("ADR-020.32 - Report Ready governance", () => {
  test("TEST 1 missing canonical geography -> NOT_READY", () => {
    const assessment = assessReportReadiness(readyProject({ canonicalGeography: null }));
    expect(assessment.status).toBe("NOT_READY");
    expect(assessment.blockingReasons.some((r) => r.code === "GEOGRAPHY_INVALID_OR_MISSING")).toBe(true);
  });

  test("TEST 2 valid geography -> geographyReady true", () => {
    expect(assessReportReadiness(readyProject()).geographyReady).toBe(true);
  });

  test("TEST 3 missing human hypothesis -> NOT_READY", () => {
    const assessment = assessReportReadiness(readyProject({ canonicalHypothesis: null, hipotesis: "" }));
    expect(assessment.status).toBe("NOT_READY");
    expect(assessment.hypothesisReady).toBe(false);
  });

  test("TEST 4 human formulated hypothesis -> hypothesisReady true", () => {
    expect(assessReportReadiness(readyProject()).hypothesisReady).toBe(true);
  });

  test("TEST 5 AI suggestion only -> hypothesisReady false", () => {
    const assessment = assessReportReadiness(readyProject({
      canonicalHypothesis: null,
      aiSuggestions: [createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" })],
    }));
    expect(assessment.hypothesisReady).toBe(false);
  });

  test("TEST 6 no valid evidence -> NOT_READY", () => {
    const assessment = assessReportReadiness(readyProject({ evidence: [] }));
    expect(assessment.status).toBe("NOT_READY");
    expect(assessment.evidenceReady).toBe(false);
  });

  test("TEST 7 valid evidence -> evidenceReady true", () => {
    expect(assessReportReadiness(readyProject()).evidenceReady).toBe(true);
  });

  test("TEST 8 critical evidence integrity failure -> blocker", () => {
    const assessment = assessReportReadiness(readyProject({
      evidence: [validEvidence({ forensicIntegrity: createHashUnavailableIntegrity({ status: "HASH_MISMATCH" }) })],
    }));
    expect(assessment.forensicIntegrityReady).toBe(false);
    expect(assessment.blockingReasons.some((r) => r.code === "CRITICAL_EVIDENCE_INTEGRITY_FAILURE")).toBe(true);
  });

  test("TEST 9 noncritical warning does not necessarily block", () => {
    const assessment = assessReportReadiness(readyProject({
      evidence: [validEvidence({ forensicIntegrity: createHashUnavailableIntegrity({ status: "HASH_UNAVAILABLE" }) })],
    }));
    expect(assessment.warnings.some((r) => r.code === "EVIDENCE_HASH_NOT_FULLY_VERIFIED")).toBe(true);
    expect(assessment.status).toBe("READY_WITH_WARNINGS");
  });

  test("TEST 10 unsupported finding used in report -> blocker", () => {
    const assessment = assessReportReadiness(readyProject({
      findings: [supportedFinding({ lineage: [], lineageStatus: "UNSUPPORTED" })],
    }));
    expect(assessment.findingsReady).toBe(false);
  });

  test("TEST 11 traceable supported finding -> findingsReady", () => {
    expect(assessReportReadiness(readyProject()).findingsReady).toBe(true);
  });

  test("TEST 12 AI analysis pending review -> not sufficient", () => {
    const assessment = assessReportReadiness(readyProject({
      analysisOutputs: [supportedAnalysis({ validationStatus: "PENDING_REVIEW" })],
    }));
    expect(assessment.analysisReady).toBe(false);
    expect(assessment.unresolvedItems.some((r) => r.code === "AI_ANALYSIS_PENDING_HUMAN_REVIEW")).toBe(true);
  });

  test("TEST 13 human validated supported analysis -> analysisReady", () => {
    expect(assessReportReadiness(readyProject()).analysisReady).toBe(true);
  });

  test("TEST 14 broken lineage -> blocker", () => {
    const brokenLineage = [{ id: "find-1", type: "FINDING", supportingEvidenceIds: ["missing-ev"] }];
    const assessment = assessReportReadiness(readyProject({
      findings: [supportedFinding({ lineage: brokenLineage, lineageStatus: "BROKEN_REFERENCE" })],
      analysisOutputs: [supportedAnalysis({ lineage: brokenLineage })],
    }));
    expect(assessment.lineageReady).toBe(false);
    expect(assessment.blockingReasons.some((r) => r.code === "REPORT_LINEAGE_UNRESOLVED")).toBe(true);
  });

  test("TEST 15 complete reverse lineage -> lineageReady", () => {
    expect(assessReportReadiness(readyProject()).lineageReady).toBe(true);
  });

  test("TEST 16 pending mandatory human review -> blocker", () => {
    const assessment = assessReportReadiness(readyProject({
      evidence: [validEvidence({ humanValidationStatus: "PENDING_REVIEW" })],
    }));
    expect(assessment.humanValidationReady).toBe(false);
    expect(assessment.status).toBe("NOT_READY");
  });

  test("TEST 17 simulated contextual source -> warning not automatic certification", () => {
    const assessment = assessReportReadiness(readyProject({
      sources: [{ id: "source-sim", sourceStatus: "SIMULATED", contextual: true }],
    }));
    expect(assessment.warnings.some((r) => r.domain === "SOURCE_INTEGRITY")).toBe(true);
    expect(assessment.certified).toBe(false);
  });

  test("TEST 18 failed sweep used as support -> blocker", () => {
    const assessment = assessReportReadiness(readyProject({
      sweeps: [{ id: "sweep-failed", lifecycleStatus: "FAILED", outputEvidenceIds: ["ev-1"] }],
    }));
    expect(assessment.blockingReasons.some((r) => r.code === "FAILED_SWEEP_USED_AS_REPORT_SUPPORT")).toBe(true);
  });

  test("TEST 19 unused failed sweep does not automatically block", () => {
    const assessment = assessReportReadiness(readyProject({
      sweeps: [{ id: "sweep-failed", lifecycleStatus: "FAILED", outputEvidenceIds: ["ev-x"] }],
    }));
    expect(assessment.blockingReasons.some((r) => r.code === "FAILED_SWEEP_USED_AS_REPORT_SUPPORT")).toBe(false);
  });

  test("TEST 20 legacy project missing metadata -> no fabricated readiness", () => {
    const assessment = assessReportReadiness({ id: "legacy", hipotesis: "Texto legacy" });
    expect(assessment.status).toBe("NOT_READY");
    expect(assessment.geographyReady).toBe(false);
    expect(assessment.warnings.some((r) => r.code === "LEGACY_HYPOTHESIS_METADATA_INCOMPLETE")).toBe(true);
  });

  test("TEST 21 all requirements met -> REPORT_READY", () => {
    expect(assessReportReadiness(readyProject()).status).toBe("REPORT_READY");
  });

  test("TEST 22 ready with noncritical warning -> READY_WITH_WARNINGS", () => {
    const assessment = assessReportReadiness(readyProject({
      sources: [{ id: "source-sim", sourceStatus: "SIMULATED" }],
    }));
    expect(assessment.status).toBe("READY_WITH_WARNINGS");
  });

  test("TEST 23 new evidence invalidates prior readiness by recalculation", () => {
    const before = assessReportReadiness(readyProject());
    const after = assessReportReadiness(readyProject({
      evidence: [
        validEvidence(),
        validEvidence({ evidenceId: "ev-bad", requiredForReport: true, forensicIntegrity: createHashUnavailableIntegrity({ status: "HASH_MISMATCH" }) }),
      ],
    }));
    expect(before.status).toBe("REPORT_READY");
    expect(after.status).toBe("NOT_READY");
  });

  test("TEST 24 institutional export blocked if not REPORT_READY", () => {
    expect(() => assertInstitutionalReportReady(readyProject({ canonicalGeography: null }))).toThrow("REPORT_READY_REQUIRED");
  });

  test("TEST 25 draft export remains possible if architecture supports it", () => {
    expect(canGenerateDraftReport(readyProject({ canonicalGeography: null }))).toBe(true);
  });

  test("TEST 26 hypothesisRequirementSatisfied from ADR-020.31 consumed", () => {
    const assessment = assessReportReadiness(readyProject({
      hypothesisRequirementSatisfied: true,
    }));
    expect(assessment.hypothesisReady).toBe(true);
  });

  test("TEST 27 geographyId remains traceable", () => {
    const assessment = assessReportReadiness(readyProject());
    expect(assessment.geographyReady).toBe(true);
    expect(readyProject().canonicalHypothesis.geographyId).toBe(geography.geographyId);
  });

  test("TEST 28 REPORT_READY does not equal CERTIFIED/PUBLISHED", () => {
    const assessment = assessReportReadiness(readyProject());
    expect(assessment.status).toBe("REPORT_READY");
    expect(assessment.certified).toBe(false);
    expect(assessment.published).toBe(false);
    expect(canGenerateInstitutionalReport(readyProject())).toBe(true);
  });
});
