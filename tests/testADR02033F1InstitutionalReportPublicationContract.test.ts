import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity, createHashUnavailableIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  assessReportItemEligibility,
  buildDraftReportInput,
  buildInstitutionalReportInput,
} from "../src/utils/institutionalReportPublicationContract";

const geography = buildCanonicalProjectGeography({
  projectId: "project-1",
  type: "POLYGON",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.29 },
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

const goodHash = "b".repeat(64);

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-1",
    usedInReport: true,
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return createAiAnalyticalOutput({
    outputId: "analysis-1",
    outputType: "ANALYSIS",
    evidenceIds: ["ev-1"],
    findingIds: ["find-1"],
    lineage,
    validationStatus: "APPROVED",
    ...overrides,
  });
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-1",
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
    projectId: "project-1",
    text: "Hipótesis humana inicial.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-1"],
    supportingFindingIds: ["find-1"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-1",
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    evidence: [evidence()],
    findings: [finding()],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    sources: [{ id: "source-1", sourceStatus: "AUTHORITATIVE" }],
    sweeps: [{ id: "sweep-1", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-1"], outputFindingIds: ["find-1"] }],
    ...overrides,
  };
}

describe("ADR-020.33 F1 - Institutional report publication contract", () => {
  test("TEST 1 project NOT_READY rejects institutional report input", () => {
    expect(() => buildInstitutionalReportInput(readyProject({ canonicalGeography: null }))).toThrow("INSTITUTIONAL_REPORT_INPUT_REJECTED");
  });

  test("TEST 2 project REPORT_READY can build publication contract", () => {
    const input = buildInstitutionalReportInput(readyProject(), { generatedAt: "2026-08-30T10:00:00.000Z" });
    expect(input.projectId).toBe("project-1");
    expect(input.reportReadyAssessment.status).toBe("REPORT_READY");
  });

  test("TEST 3 valid evidence -> ELIGIBLE", () => {
    expect(assessReportItemEligibility(evidence(), { itemType: "EVIDENCE" }).eligibility).toBe("ELIGIBLE");
  });

  test("TEST 4 raw file only -> INELIGIBLE as institutional evidence", () => {
    const result = assessReportItemEligibility({ fileId: "file-1", storageReference: "raw" }, { itemType: "EVIDENCE" });
    expect(result.eligibility).toBe("INELIGIBLE");
    expect(result.exclusions[0].reasonCode).toBe("RAW_FILE_ONLY");
  });

  test("TEST 5 critical integrity failure -> INELIGIBLE", () => {
    const result = assessReportItemEligibility(evidence({ forensicIntegrity: createHashUnavailableIntegrity({ status: "HASH_MISMATCH" }) }), { itemType: "EVIDENCE" });
    expect(result.eligibility).toBe("INELIGIBLE");
  });

  test("TEST 6 supported traceable finding -> ELIGIBLE", () => {
    expect(assessReportItemEligibility(finding(), { itemType: "FINDING" }).eligibility).toBe("ELIGIBLE");
  });

  test("TEST 7 unsupported finding -> INELIGIBLE", () => {
    expect(assessReportItemEligibility(finding({ lineage: [], lineageStatus: "UNSUPPORTED" }), { itemType: "FINDING" }).eligibility).toBe("INELIGIBLE");
  });

  test("TEST 8 inference remains labeled inference", () => {
    const result = assessReportItemEligibility({ inferenceId: "inf-1", lineage, lineageStatus: "SUPPORTED" }, { itemType: "INFERENCE" });
    expect(result.role).toBe("INFERENCE");
    expect(result.eligibility).toBe("ELIGIBLE");
  });

  test("TEST 9 human-validated supported analysis -> ELIGIBLE", () => {
    expect(assessReportItemEligibility(analysis(), { itemType: "ANALYSIS" }).eligibility).toBe("ELIGIBLE");
  });

  test("TEST 10 AI analysis pending review -> INELIGIBLE institutional analysis", () => {
    const result = assessReportItemEligibility(analysis({ validationStatus: "PENDING_REVIEW" }), { itemType: "ANALYSIS" });
    expect(result.eligibility).toBe("INELIGIBLE");
  });

  test("TEST 11 validated conclusion with reverse lineage -> ELIGIBLE", () => {
    expect(assessReportItemEligibility(conclusion(), { itemType: "CONCLUSION" }).eligibility).toBe("ELIGIBLE");
  });

  test("TEST 12 AI conclusion suggestion -> INELIGIBLE as institutional conclusion", () => {
    const suggestion = createAiAnalyticalOutput({ outputType: "CONCLUSION_SUGGESTION", findingIds: ["find-1"], lineage });
    expect(assessReportItemEligibility(suggestion, { itemType: "CONCLUSION" }).eligibility).toBe("INELIGIBLE");
  });

  test("TEST 13 human initial hypothesis preserved", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.hypothesis.initialHypothesis).toBe("Hipótesis humana inicial.");
  });

  test("TEST 14 AI hypothesis suggestion not promoted", () => {
    const project = readyProject({
      canonicalHypothesis: {
        ...hypothesis(),
        aiSuggestions: [createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" })],
      },
    });
    const input = buildInstitutionalReportInput(project);
    expect(input.hypothesis.aiSuggestions[0].representation).toBe("AI HYPOTHESIS SUGGESTION");
    expect(input.hypothesis.currentHypothesis).toBe("Hipótesis humana inicial.");
  });

  test("TEST 15 canonical geography preserved", () => {
    expect(buildInstitutionalReportInput(readyProject()).geography?.geographyId).toBe(geography.geographyId);
  });

  test("TEST 16 photo pins do not redefine geography", () => {
    const input = buildInstitutionalReportInput(readyProject({ album: [{ id: "photo-pin", lat: 0, lng: 0 }] }));
    expect(input.geography?.geometry.type).toBe("Polygon");
  });

  test("TEST 17 Telegram/Gemini synthesis not observed social fact", () => {
    const result = assessReportItemEligibility(
      createAiAnalyticalOutput({ outputType: "SUMMARY", sourceReferences: ["TELEGRAM_CONTEXT"] }),
      { itemType: "OSINT" }
    );
    expect(result.eligibility).toBe("INELIGIBLE");
    expect(result.exclusions[0].reasonCode).toBe("OSINT_NOT_OBSERVED_FACT");
  });

  test("TEST 18 Street View item preserves evidenceId/geographyId", () => {
    const result = assessReportItemEligibility({ evidenceId: "sv-1", geographyId: geography.geographyId, panoramaId: "pano-1" }, { itemType: "STREET_VIEW" });
    expect(result.eligibility).toBe("ELIGIBLE");
    expect(result.lineageRefs.geographyId).toBe(geography.geographyId);
  });

  test("TEST 19 Temporal Comparison references both evidence IDs", () => {
    const result = assessReportItemEligibility(
      { comparisonId: "tc-1", comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" },
      { itemType: "TEMPORAL_COMPARISON" }
    );
    expect(result.eligibility).toBe("ELIGIBLE");
    expect(result.lineageRefs.evidenceIds).toEqual(["ev-a", "ev-b"]);
  });

  test("TEST 20 Pandillas consumes CertifiedGangAnalysisPayload only", () => {
    const raw = assessReportItemEligibility({ validatedByACE: false }, { itemType: "SPECIALIZED_INTELLIGENCE" });
    const certified = assessReportItemEligibility({ validatedByACE: true, traceabilityReference: "gim-cert-1" }, { itemType: "SPECIALIZED_INTELLIGENCE" });
    expect(raw.eligibility).toBe("INELIGIBLE");
    expect(certified.eligibility).toBe("ELIGIBLE");
  });

  test("TEST 21 non-authoritative contextual source -> ELIGIBLE_WITH_DISCLOSURE", () => {
    const result = assessReportItemEligibility(evidence({ sourceStatus: "NON_AUTHORITATIVE" }), { itemType: "EVIDENCE" });
    expect(result.eligibility).toBe("ELIGIBLE_WITH_DISCLOSURE");
    expect(result.disclosures[0].code).toBe("SOURCE_NON_AUTHORITATIVE");
  });

  test("TEST 22 simulated content cannot become institutional fact", () => {
    const result = assessReportItemEligibility(evidence({ sourceStatus: "SIMULATED" }), { itemType: "EVIDENCE" });
    expect(result.eligibility).toBe("INELIGIBLE");
  });

  test("TEST 23 excluded candidate records reason", () => {
    const result = assessReportItemEligibility(finding({ lineageStatus: "UNSUPPORTED", lineage: [] }), { itemType: "FINDING" });
    expect(result.exclusions[0].reasonCode).toBe("UNSUPPORTED_OR_SYNTHETIC_FINDING");
  });

  test("TEST 24 limited candidate records disclosure", () => {
    const result = assessReportItemEligibility(evidence({ sourceStatus: "LEGACY_UNCLASSIFIED" }), { itemType: "EVIDENCE" });
    expect(result.disclosures[0].code).toBe("LEGACY_METADATA_PARTIAL");
  });

  test("TEST 25 legacy unclassified input -> no fabricated authority", () => {
    const result = assessReportItemEligibility(evidence({ sourceStatus: "LEGACY_UNCLASSIFIED" }), { itemType: "EVIDENCE" });
    expect(result.eligibility).toBe("ELIGIBLE_WITH_DISCLOSURE");
    expect(result.disclosures.some((d) => d.code === "LEGACY_METADATA_PARTIAL")).toBe(true);
  });

  test("TEST 26 report item maintains reverse lineage refs", () => {
    const result = assessReportItemEligibility(conclusion(), { itemType: "CONCLUSION" });
    expect(result.lineageRefs.analysisIds).toContain("analysis-1");
    expect(result.lineageRefs.findingIds).toContain("find-1");
    expect(result.lineageRefs.evidenceIds).toContain("ev-1");
    expect(result.lineageRefs.sourceIds).toContain("source-1");
  });

  test("TEST 27 draft report path remains distinguishable", () => {
    const draft = buildDraftReportInput({ id: "draft-project" });
    expect(draft.draft).toBe(true);
    expect(draft.institutional).toBe(false);
  });

  test("TEST 28 publication eligibility does not equal certification", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.publicationEligibility).toBe("ELIGIBLE");
    expect(input.certified).toBe(false);
    expect(input.published).toBe(false);
  });
});
