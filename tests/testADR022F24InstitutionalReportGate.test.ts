import {
  validateInstitutionalReportTraceability,
} from "../src/utils/institutionalReportTraceabilityGate";

const coordinates = { lat: 21.885, lng: -102.291 };

function evidence(overrides: any = {}) {
  return {
    id: "ev-1",
    evidenceId: "ev-1",
    traceabilityId: "trace-ev-1",
    sourceEvidenceId: "source-ev-1",
    geographyId: "geo-1",
    expedienteId: "exp-1",
    lineageStatus: "SUPPORTED",
    coordinates,
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    id: "finding-1",
    findingId: "finding-1",
    traceabilityId: "trace-finding-1",
    sourceEvidenceId: "source-ev-1",
    geographyId: "geo-1",
    expedienteId: "exp-1",
    lineageStatus: "SUPPORTED",
    supportingEvidenceIds: ["ev-1"],
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return {
    id: "analysis-1",
    analysisId: "analysis-1",
    traceabilityId: "trace-analysis-1",
    expedienteId: "exp-1",
    lineageStatus: "SUPPORTED",
    evidenceReferences: ["ev-1"],
    evidenceIds: ["ev-1"],
    sourceIds: ["source-ev-1"],
    ...overrides,
  };
}

describe("ADR-022 FASE 2.4 - Institutional Report Traceability Gate", () => {
  test("approves a fully traceable institutional report payload", () => {
    const result = validateInstitutionalReportTraceability({
      projectId: "exp-1",
      evidence: [evidence()],
      findings: [finding()],
      analyses: [analysis()],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(true);
    expect(result.status).toBe("INSTITUTIONAL_PUBLICATION_ELIGIBLE");
    expect(result.exclusions).toEqual([]);
  });

  test("blocks certification when evidence lacks geographyId", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [evidence({ geographyId: null })],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(false);
    expect(result.exclusions.map((item) => item.reasonCode)).toContain("EVIDENCE_EXCLUDED_MISSING_GEOGRAPHY");
  });

  test("blocks certification when evidence lacks sourceEvidenceId", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [evidence({ sourceEvidenceId: "" })],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(false);
    expect(result.exclusions.map((item) => item.reasonCode)).toContain("EVIDENCE_EXCLUDED_MISSING_SOURCE");
  });

  test("blocks certification when a finding lacks source evidence linkage", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [evidence()],
      findings: [finding({ sourceEvidenceId: "", supportingEvidenceIds: [], evidenceIds: [] })],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(false);
    expect(result.exclusions.map((item) => item.reasonCode)).toContain("FINDING_EXCLUDED_MISSING_SOURCE");
  });

  test("blocks certification when analysis lacks lineage and references", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [evidence()],
      analyses: [analysis({ lineageStatus: null, evidenceIds: [], sourceIds: [] })],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(false);
    expect(result.exclusions.map((item) => item.reasonCode)).toContain("ANALYSIS_EXCLUDED_INCOMPLETE_LINEAGE");
  });

  test("allows legacy contextual data for draft but blocks institutional publication", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [
        evidence({
          traceabilityId: "",
          sourceEvidenceId: "",
          geographyId: null,
          lineageStatus: "LEGACY_UNCLASSIFIED",
          legacy: true,
        }),
      ],
    });

    expect(result.eligibleForDraft).toBe(true);
    expect(result.eligibleForInstitutionalPublication).toBe(false);
    expect(result.status).toBe("CONTEXTUAL_ONLY");
  });

  test("approves valid Street View evidence with full traceability", () => {
    const result = validateInstitutionalReportTraceability({
      streetView: [
        evidence({
          id: "sv-1",
          evidenceId: "sv-1",
          traceabilityId: "trace-sv-1",
          sourceEvidenceId: "street-view-capture-1",
          sourceType: "STREET_VIEW",
        }),
      ],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(true);
    expect(result.streetViewSummary.eligible).toBe(1);
  });

  test("excludes contextual evidence from mixed payload and preserves institutional eligibility", () => {
    const result = validateInstitutionalReportTraceability({
      evidence: [
        evidence(),
        evidence({
          id: "legacy-ev",
          evidenceId: "legacy-ev",
          traceabilityId: "",
          sourceEvidenceId: "",
          geographyId: null,
          lineageStatus: "LEGACY_UNCLASSIFIED",
          legacy: true,
        }),
      ],
      findings: [finding()],
      analyses: [analysis()],
    });

    expect(result.eligibleForInstitutionalPublication).toBe(true);
    expect(result.evidenceSummary.eligible).toBe(1);
    expect(result.exclusions.map((item) => item.itemId)).toContain("legacy-ev");
  });
});

