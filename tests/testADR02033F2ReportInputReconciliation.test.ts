import fs from "node:fs";
import path from "node:path";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  buildDraftReportInput,
  buildInstitutionalReportInput,
  reconcileInstitutionalReportPayload,
} from "../src/utils/institutionalReportPublicationContract";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const geography = buildCanonicalProjectGeography({
  projectId: "project-f2",
  type: "CORRIDOR",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.28 },
  ],
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

const goodHash = "c".repeat(64);

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    id: "ev-1",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    humanValidationStatus: "APPROVED",
    caption: "Evidencia elegible",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-1",
    id: "find-1",
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
    outputId: "analysis-1",
    outputType: "ANALYSIS",
    evidenceIds: ["ev-1"],
    findingIds: ["find-1"],
    lineage,
    validationStatus: "APPROVED",
    ...overrides,
    }),
    ...overrides,
  };
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-1",
    id: "conclusion-1",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    analysisIds: ["analysis-1"],
    findingIds: ["find-1"],
    evidenceIds: ["ev-1"],
    ...overrides,
  };
}

function hypothesis() {
  return formulateHumanHypothesis({
    projectId: "project-f2",
    text: "Hipótesis humana gobernada.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-1"],
    supportingFindingIds: ["find-1"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f2",
    projectId: "project-f2",
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    finalHypothesis: "RAW FALLBACK NO INSTITUCIONAL",
    hipotesis: "RAW HIPOTESIS NO INSTITUCIONAL",
    photoEvidence: [evidence()],
    findings: [finding()],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    osint: [{ id: "osint-1", sourceStatus: "NON_AUTHORITATIVE", text: "Contexto OSINT", lineage, evidenceId: "ev-1" }],
    streetViewAnalysis: [{ id: "sv-1", evidenceId: "sv-1", geographyId: geography.geographyId, panoramaId: "pano-1", lineage }],
    temporalComparisons: [{ comparisonId: "tc-1", comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" }],
    intelligenceContext: {
      aceReport: {
        certifiedGimOutput: { validatedByACE: true, traceabilityReference: "gim-cert-1", analyticalFindings: ["Hallazgo GIM"] },
      },
    },
    maps: [{ id: "map-1", dataUrl: "data:image/png;base64,AAA", geographyId: geography.geographyId }],
    sweeps: [{ id: "sweep-1", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-1"], outputFindingIds: ["find-1"] }],
    ...overrides,
  };
}

describe("ADR-020.33 F2 - Report input reconciliation", () => {
  test("TEST 1 institutional export builds InstitutionalReportInput once", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect((source.match(/buildInstitutionalReportInput\(payload\)/g) || []).length).toBe(1);
  });

  test("TEST 2 same snapshot reused across builders", () => {
    const input = buildInstitutionalReportInput(readyProject());
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(reconciled.institutionalReportInput).toBe(input);
    expect(reconciled.reportReadyAssessment).toBe(input.reportReadyAssessment);
  });

  test("TEST 3 institutional export does not fallback to raw hypothesis", () => {
    const input = buildInstitutionalReportInput(readyProject());
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(reconciled.finalHypothesis).toBe("Hipótesis humana gobernada.");
    expect(reconciled.finalHypothesis).not.toBe("RAW FALLBACK NO INSTITUCIONAL");
  });

  test("TEST 4 draft export may retain legacy fallback", () => {
    const draft = buildDraftReportInput({ id: "legacy", finalHypothesis: "fallback" });
    expect(draft.draft).toBe(true);
  });

  test("TEST 5 hypothesis section uses governed human hypothesis", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.hypothesis.currentHypothesis).toBe("Hipótesis humana gobernada.");
  });

  test("TEST 6 geography section uses canonical geography", () => {
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), buildInstitutionalReportInput(readyProject()));
    expect(reconciled.canonicalGeography.geographyId).toBe(geography.geographyId);
  });

  test("TEST 7 photo pins do not reconstruct geography", () => {
    const input = buildInstitutionalReportInput(readyProject({ album: [{ id: "pin", lat: 0, lng: 0 }] }));
    expect(input.geography?.geometry.type).toBe("LineString");
  });

  test("TEST 8 evidence section excludes ineligible raw file", () => {
    const input = buildInstitutionalReportInput(readyProject({ photoEvidence: [evidence(), { fileId: "raw-file" }] }));
    expect(input.evidence.map((item) => item.fileId)).not.toContain("raw-file");
    expect(input.exclusions.some((item) => item.reasonCode === "RAW_FILE_ONLY")).toBe(true);
  });

  test("TEST 9 finding section excludes unsupported finding", () => {
    const input = buildInstitutionalReportInput(readyProject({ findings: [finding(), finding({ id: "bad", findingId: "bad", usedInReport: false, lineage: [], lineageStatus: "UNSUPPORTED" })] }));
    expect(input.findings.map((item) => item.findingId)).not.toContain("bad");
  });

  test("TEST 10 analysis section excludes AI pending review", () => {
    const input = buildInstitutionalReportInput(readyProject({ analysisOutputs: [analysis(), analysis({ outputId: "ai-pending", validationStatus: "PENDING_REVIEW", usedInReport: false })] }));
    expect(input.analyses.map((item) => item.outputId)).not.toContain("ai-pending");
  });

  test("TEST 11 conclusion section excludes AI suggestion", () => {
    const input = buildInstitutionalReportInput(readyProject({
      conclusions: [conclusion(), createAiAnalyticalOutput({ outputId: "ai-conclusion", outputType: "CONCLUSION_SUGGESTION", findingIds: ["find-1"], lineage })],
    }));
    expect(input.conclusions.map((item) => item.outputId)).not.toContain("ai-conclusion");
  });

  test("TEST 12 OSINT section preserves disclosure", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.disclosures.some((item) => item.code === "SOURCE_NON_AUTHORITATIVE")).toBe(true);
  });

  test("TEST 13 Street View preserves evidenceId/geographyId", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.streetView[0].evidenceId).toBe("sv-1");
    expect(input.streetView[0].geographyId).toBe(geography.geographyId);
  });

  test("TEST 14 Temporal Comparison preserves both evidence IDs", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.temporalComparisons[0].publicationEligibility.lineageRefs.evidenceIds).toEqual(["ev-a", "ev-b"]);
  });

  test("TEST 15 Pandillas uses certified specialized intelligence only", () => {
    const input = buildInstitutionalReportInput(readyProject({ certifiedGimOutput: { validatedByACE: false } }));
    expect(input.specializedIntelligence).toHaveLength(1);
    expect(input.specializedIntelligence[0].traceabilityReference).toBe("gim-cert-1");
  });

  test("TEST 16 excluded item cannot re-enter through another chapter builder", () => {
    const input = buildInstitutionalReportInput(readyProject({ findings: [finding(), finding({ id: "bad", findingId: "bad", usedInReport: false, lineage: [], lineageStatus: "UNSUPPORTED" })] }));
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(reconciled.findings.map((item: any) => item.findingId)).not.toContain("bad");
    expect(reconciled.approvedFindings.map((item: any) => item.findingId)).not.toContain("bad");
  });

  test("TEST 17 disclosure reaches rendering adapter", () => {
    const input = buildInstitutionalReportInput(readyProject());
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(reconciled.publicationDisclosures).toBe(input.disclosures);
  });

  test("TEST 18 reverse lineage refs survive mapping", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.lineageSummary.evidenceIds).toContain("ev-1");
    expect(input.lineageSummary.findingIds).toContain("find-1");
    expect(input.lineageSummary.analysisIds).toContain("analysis-1");
  });

  test("TEST 19 institutional builders do not recompute authority locally", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source).toContain("reconcileInstitutionalReportPayload");
    expect(source).not.toContain("sourceStatus === \"AUTHORITATIVE\"");
  });

  test("TEST 20 legacy project remains draft-readable", () => {
    expect(buildDraftReportInput({ id: "legacy", hipotesis: "legacy" }).institutional).toBe(false);
  });

  test("TEST 21 legacy incomplete project institutional export blocked", () => {
    expect(() => buildInstitutionalReportInput({ id: "legacy", hipotesis: "legacy" })).toThrow("INSTITUTIONAL_REPORT_INPUT_REJECTED");
  });

  test("TEST 22 visual product without eligible linkage excluded or disclosed", () => {
    const input = buildInstitutionalReportInput(readyProject({ maps: [{ id: "orphan-map", dataUrl: "data:image/png;base64,AAA" }] }));
    expect(input.visualProducts.map((item) => item.id)).not.toContain("orphan-map");
    expect(input.exclusions.some((item) => item.reasonCode === "VISUAL_PRODUCT_WITHOUT_ELIGIBLE_LINKAGE")).toBe(true);
  });

  test("TEST 23 eligible visual product preserved", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.visualProducts.map((item) => item.id)).toContain("map-1");
  });

  test("TEST 24 InstitutionalReportInput exclusions retained for audit", () => {
    const input = buildInstitutionalReportInput(readyProject({ photoEvidence: [evidence(), { fileId: "raw-file" }] }));
    expect(input.exclusions.length).toBeGreaterThan(0);
  });

  test("TEST 25 InstitutionalReportInput disclosures retained", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.disclosures.length).toBeGreaterThan(0);
  });

  test("TEST 26 REPORT_READY remains precondition", () => {
    expect(() => buildInstitutionalReportInput(readyProject({ canonicalHypothesis: null, hipotesis: "" }))).toThrow("INSTITUTIONAL_REPORT_INPUT_REJECTED");
  });

  test("TEST 27 institutional input does not set certified/published", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.certified).toBe(false);
    expect(input.published).toBe(false);
  });

  test("TEST 28 raw project fallback restricted to draft path", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source).toContain("options.exportMode === \"INSTITUTIONAL\"");
    expect(source).toContain("} else {");
    expect(source).toContain("assessReportReadiness(payload)");
  });
});
