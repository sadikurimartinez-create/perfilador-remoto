import {
  buildEvidenceLineage,
  buildStreetViewFindingLineage,
  validateLineage,
  type CanonicalLineageNode,
} from "../src/utils/evidenceLineage";
import { evaluateHumanValidation } from "../src/utils/humanValidationPolicy";
import { mapStreetViewToAlbumPhoto } from "../src/modules/streetView/streetViewMapper";
import { UniversalEvidenceComparisonToFinding } from "../src/services/geoint/temporalComparisonBridge";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";
import { evaluateReportLineageBoundary, isReportEngineEvidenceEligible } from "../src/lib/reportEngine";

describe("ADR-020.25 - Evidence to conclusion lineage", () => {
  test("TEST 1 evidence to finding has valid support", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-1",
      evidenceId: "ev-1",
      findingId: "find-1",
    });

    expect(validateLineage(lineage).status).toBe("SUPPORTED");
  });

  test("TEST 2 finding without evidence is unsupported", () => {
    const result = validateLineage([{ id: "find-2", type: "FINDING", findingId: "find-2", supportingEvidenceIds: [] }]);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.blockingReasons).toContain("UNSUPPORTED_FINDING");
    expect(result.unsupportedFindingIds).toContain("find-2");
  });

  test("TEST 3 finding to inference relation is preserved", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-3",
      evidenceId: "ev-3",
      findingId: "find-3",
      inferenceId: "inf-3",
    });
    const inference = lineage.find((node) => node.type === "INFERENCE");

    expect(inference?.derivedFromFindingIds).toEqual(["find-3"]);
    expect(validateLineage(lineage).status).toBe("SUPPORTED");
  });

  test("TEST 4 analysis with finding and inference support is supported", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-4",
      evidenceId: "ev-4",
      findingId: "find-4",
      inferenceId: "inf-4",
      analysisId: "analysis-4",
    });

    expect(validateLineage(lineage).status).toBe("SUPPORTED");
  });

  test("TEST 5 analysis without support is unsupported", () => {
    const result = validateLineage([{ id: "analysis-5", type: "ANALYSIS", analysisId: "analysis-5" }]);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.blockingReasons).toContain("UNSUPPORTED_ANALYSIS");
  });

  test("TEST 6 conclusion with valid analysis is supported", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-6",
      evidenceId: "ev-6",
      findingId: "find-6",
      inferenceId: "inf-6",
      analysisId: "analysis-6",
      conclusionId: "conclusion-6",
    });

    expect(validateLineage(lineage).status).toBe("SUPPORTED");
  });

  test("TEST 7 conclusion without analysis is unsupported", () => {
    const result = validateLineage([{ id: "conclusion-7", type: "CONCLUSION", conclusionId: "conclusion-7", supportingAnalysisIds: [] }]);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.blockingReasons).toContain("UNSUPPORTED_CONCLUSION");
  });

  test("TEST 8 broken referenced evidenceId is detected", () => {
    const lineage: CanonicalLineageNode[] = [
      { id: "find-8", type: "FINDING", findingId: "find-8", supportingEvidenceIds: ["missing-ev"] },
    ];
    const result = validateLineage(lineage);

    expect(result.status).toBe("BROKEN_REFERENCE");
    expect(result.brokenReferenceIds).toContain("missing-ev");
  });

  test("TEST 9 Street View finding references actual evidence identity", () => {
    const photo = mapStreetViewToAlbumPhoto({
      dataUrl: "data:image/jpeg;base64,abc",
      poiLat: 21.88,
      poiLng: -102.29,
      panoramaLat: 21.881,
      panoramaLng: -102.291,
      heading: 90,
      pitch: 0,
      fov: 90,
      panoId: "pano-9",
    });

    expect(photo.evidenceId).toBeTruthy();
    expect(photo.sourceEvidenceId).toBe(photo.evidenceId);
    expect(photo.lineageStatus).toBe("SUPPORTED");
    expect(photo.lineage?.find((node) => node.type === "FINDING")?.supportingEvidenceIds).toEqual([photo.evidenceId]);
  });

  test("TEST 10 Temporal Comparison finding references compared evidence", () => {
    const finding = UniversalEvidenceComparisonToFinding({
      comparisonId: "cmp-10",
      expedienteId: "exp-10",
      traceabilityId: "trace-10",
      sourceEvidenceId: "ev-a",
      evidenceA: {
        id: "geo-a",
        expedienteId: "exp-10",
        traceabilityId: "trace-a",
        sourceEvidenceId: "ev-a",
        source: "FIELD_PHOTO",
        coordinates: { lat: 21.88, lng: -102.29 },
        imageReference: "a.jpg",
        metadata: {},
        status: GeointGovernanceStatus.PENDING_REVIEW,
      },
      evidenceB: {
        id: "geo-b",
        expedienteId: "exp-10",
        traceabilityId: "trace-b",
        sourceEvidenceId: "ev-b",
        source: "STREET_VIEW_HISTORICAL",
        coordinates: { lat: 21.88, lng: -102.29 },
        imageReference: "b.jpg",
        metadata: {},
        status: GeointGovernanceStatus.PENDING_REVIEW,
      },
      comparisonType: "TEMPORAL_VISUAL_DELTA",
      spatialValidation: { isCompatible: true, distanceMeters: 1 },
      temporalValidation: { isValid: true },
      createdBy: "tester",
      createdAt: "2026-08-29T00:00:00.000Z",
      aiAnalysis: {
        observedChanges: [],
        structuralModifications: [],
        riskDiscrepancies: [],
        confidenceScore: 90,
        calibratedObservation: "Cambio temporal observado",
      },
      analystValidationStatus: GeointGovernanceStatus.PENDING_REVIEW,
    });

    expect(finding.supportingEvidenceIds).toEqual(["ev-a", "ev-b"]);
    expect(finding.lineageStatus).toBe("SUPPORTED");
  });

  test("TEST 11 AI inference remains inference, not observed finding", () => {
    const lineage: CanonicalLineageNode[] = [
      { id: "ev-11", type: "EVIDENCE", evidenceId: "ev-11" },
      { id: "find-11", type: "FINDING", findingId: "find-11", supportingEvidenceIds: ["ev-11"], semanticRole: "SOURCE_FACT" },
      { id: "inf-11", type: "INFERENCE", inferenceId: "inf-11", derivedFromFindingIds: ["find-11"], semanticRole: "AI_GENERATED" },
    ];

    expect(lineage.find((node) => node.id === "inf-11")?.type).toBe("INFERENCE");
    expect(lineage.find((node) => node.id === "inf-11")?.semanticRole).toBe("AI_GENERATED");
    expect(validateLineage(lineage).status).toBe("SUPPORTED");
  });

  test("TEST 12 human approved but unsupported remains lineage unsupported", () => {
    const lineage = [{ id: "find-12", type: "FINDING" as const, findingId: "find-12", supportingEvidenceIds: [] }];
    const validation = evaluateHumanValidation({ humanValidationStatus: "APPROVED", validatedBy: { id: "u-12" } });

    expect(validation.isInstitutionalApproval).toBe(true);
    expect(validateLineage(lineage).status).toBe("UNSUPPORTED");
  });

  test("TEST 13 legacy object without lineage is preserved, not fabricated", () => {
    const result = validateLineage(undefined);

    expect(result.status).toBe("LEGACY_UNCLASSIFIED");
    expect(result.warnings).toContain("LEGACY_OBJECT_WITHOUT_LINEAGE_PRESERVED");
  });

  test("TEST 14 reverse lineage walks conclusion to evidence", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-14",
      evidenceId: "ev-14",
      findingId: "find-14",
      inferenceId: "inf-14",
      analysisId: "analysis-14",
      conclusionId: "conclusion-14",
    });
    const result = validateLineage(lineage);

    expect(result.reversePath[0]).toBe("CONCLUSION:conclusion-14");
    expect(result.reversePath).toContain("ANALYSIS:analysis-14");
    expect(result.reversePath).toContain("FINDING:find-14");
    expect(result.reversePath).toContain("EVIDENCE:ev-14");
    expect(result.reversePath).toContain("SOURCE:src-14");
  });

  test("TEST 15 Report consumer receives lineage status and IDs", () => {
    const lineage = buildEvidenceLineage({
      sourceId: "src-15",
      evidenceId: "ev-15",
      findingId: "find-15",
      inferenceId: "inf-15",
      analysisId: "analysis-15",
      conclusionId: "conclusion-15",
    });
    const boundary = evaluateReportLineageBoundary({ conclusionId: "conclusion-15", lineage });

    expect(boundary.lineageStatus).toBe("SUPPORTED");
    expect(boundary.supportingEvidenceIds).toContain("ev-15");
    expect(boundary.supportingFindingIds).toContain("find-15");
    expect(boundary.supportingAnalysisIds).toContain("analysis-15");
    expect(boundary.canPresentAsSupportedConclusion).toBe(true);
    expect(isReportEngineEvidenceEligible({
      conclusionId: "conclusion-15",
      lineage,
      acquisitionMode: "OBSERVED",
      validationStatus: "APPROVED",
      semanticRole: "SOURCE_FACT",
    })).toBe(true);
  });
});
