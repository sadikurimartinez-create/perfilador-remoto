import fs from "node:fs";
import path from "node:path";
import {
  applyAiHypothesisSuggestion,
  approveAiAnalyticalOutput,
  canPromoteToFinding,
  createAiAnalyticalOutput,
  isObservedFact,
  legacyAiOutput,
} from "../src/utils/aiAnalysisGovernance";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const supportedLineage = buildEvidenceLineage({
  geographyId: "geo-exp-polygon",
  sourceId: "SOURCE-1",
  evidenceId: "EVI-1",
  findingId: "FND-1",
  inferenceId: "INF-1",
  analysisId: "AN-1",
});

describe("ADR-020.30 - AI analysis governance", () => {
  test("TEST 1 AI output uses acquisitionMode AI_GENERATED", () => {
    const output = createAiAnalyticalOutput({ outputType: "SUMMARY", provider: "Gemini", model: "gemini-test" });
    expect(output.acquisitionMode).toBe("AI_GENERATED");
    expect(output.epistemicClass).toBe("AI_GENERATED");
  });

  test("TEST 2 AI inference remains INFERENCE", () => {
    const output = createAiAnalyticalOutput({ outputType: "INFERENCE", evidenceIds: ["EVI-1"] });
    expect(output.outputType).toBe("INFERENCE");
    expect(canPromoteToFinding(output)).toBe(false);
  });

  test("TEST 3 AI inference with valid findings is supported", () => {
    const output = createAiAnalyticalOutput({ outputType: "INFERENCE", findingIds: ["FND-1"], lineage: supportedLineage });
    expect(output.lineageStatus).toBe("SUPPORTED");
    expect(output.derivedFromFindingIds).toEqual(["FND-1"]);
  });

  test("TEST 4 AI inference without support is unsupported", () => {
    const output = createAiAnalyticalOutput({ outputType: "INFERENCE" });
    expect(output.lineageStatus).toBe("UNSUPPORTED");
  });

  test("TEST 5 AI analysis with supporting findings/inferences is supported", () => {
    const output = createAiAnalyticalOutput({ outputType: "ANALYSIS", findingIds: ["FND-1"], inferenceIds: ["INF-1"] });
    expect(output.lineageStatus).toBe("SUPPORTED");
    expect(output.supportingFindingIds).toEqual(["FND-1"]);
  });

  test("TEST 6 AI analysis without support is unsupported", () => {
    const output = createAiAnalyticalOutput({ outputType: "ANALYSIS" });
    expect(output.lineageStatus).toBe("UNSUPPORTED");
  });

  test("TEST 7 AI hypothesis suggestion does not overwrite human hypothesis", () => {
    const suggestion = createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" });
    const result = applyAiHypothesisSuggestion("Hipótesis humana", suggestion);
    expect(result.humanHypothesis).toBe("Hipótesis humana");
    expect(result.overwritten).toBe(false);
  });

  test("TEST 8 AI conclusion suggestion is not validated conclusion", () => {
    const output = createAiAnalyticalOutput({ outputType: "CONCLUSION_SUGGESTION", findingIds: ["FND-1"] });
    expect(output.outputType).toBe("CONCLUSION_SUGGESTION");
    expect(output.validationStatus).toBe("PENDING_REVIEW");
  });

  test("TEST 9 hardcoded confidence is rejected as unknown", () => {
    const output = createAiAnalyticalOutput({ outputType: "ANALYSIS", confidence: 95, confidenceSource: "HARDCODED" });
    expect(output.confidence).toBe("UNKNOWN");
  });

  test("TEST 10 provider real confidence is preserved", () => {
    const output = createAiAnalyticalOutput({ outputType: "ANALYSIS", confidence: 0.82, confidenceSource: "PROVIDER" });
    expect(output.confidence).toBe(0.82);
  });

  test("TEST 11 human approved AI output remains AI_GENERATED", () => {
    const approved = approveAiAnalyticalOutput(createAiAnalyticalOutput({ outputType: "ANALYSIS", findingIds: ["FND-1"] }), {
      validatedBy: { id: "u-1" },
      validatedAt: "2026-08-30T10:00:00.000Z",
    });
    expect(approved.validationStatus).toBe("APPROVED");
    expect(approved.acquisitionMode).toBe("AI_GENERATED");
  });

  test("TEST 12 approved unsupported output remains unsupported", () => {
    const approved = approveAiAnalyticalOutput(createAiAnalyticalOutput({ outputType: "ANALYSIS" }), {
      validatedBy: { id: "u-1" },
    });
    expect(approved.validationStatus).toBe("APPROVED");
    expect(approved.lineageStatus).toBe("UNSUPPORTED");
  });

  test("TEST 13 Telegram/Gemini synthesis is not observed social evidence", () => {
    const output = createAiAnalyticalOutput({
      outputType: "SUMMARY",
      provider: "Gemini",
      model: "gemini-test",
      sourceReferences: ["TELEGRAM_CONTEXT"],
      limitations: ["OSINT synthesis is not a direct social-network observation."],
    });
    expect(output.acquisitionMode).toBe("AI_GENERATED");
    expect(isObservedFact(output)).toBe(false);
  });

  test("TEST 14 Street View AI output references evidenceId in productive mapper", () => {
    const source = readSource("src/modules/streetView/streetViewMapper.ts");
    expect(source).toContain("createAiAnalyticalOutput");
    expect(source).toContain("evidenceIds: [evidenceId]");
  });

  test("TEST 15 Temporal Comparison AI output references both evidence IDs", () => {
    const source = readSource("src/services/geoint/temporalComparisonBridge.ts");
    expect(source).toContain("comparedEvidenceIds: supportingEvidenceIds");
    expect(source).toContain("evidenceIds: supportingEvidenceIds");
  });

  test("TEST 16 Pandillas AI output cannot bypass CertifiedGangAnalysisPayload gate", () => {
    const source = readSource("src/utils/gangIntelligenceEngine/adapters/aceToReportAdapter.ts");
    expect(source).toContain("CertifiedGangAnalysisPayload");
    expect(source).toContain("humanApproved");
    expect(source).toContain("authoritativeSources");
    expect(source).toContain("hasLineage");
  });

  test("TEST 17 ACE processing is not equal to human approval", () => {
    const source = readSource("src/utils/gangIntelligenceEngine/adapters/aceToReportAdapter.ts");
    expect(source).toContain("humanValidationStatus");
    expect(source).toContain("validatedByACE");
    expect(source).toContain("humanApproved && authoritativeSources && hasLineage");
  });

  test("TEST 18 legacy AI output is LEGACY_UNCLASSIFIED", () => {
    const output = legacyAiOutput({ text: "legacy" });
    expect(output.validationStatus).toBe("LEGACY_UNCLASSIFIED");
    expect(output.epistemicClass).toBe("LEGACY_UNCLASSIFIED");
  });

  test("TEST 19 geographyId is preserved", () => {
    const output = createAiAnalyticalOutput({ outputType: "ANALYSIS", geographyId: "geo-exp-polygon", findingIds: ["FND-1"] });
    expect(output.geographyId).toBe("geo-exp-polygon");
  });

  test("TEST 20 AI alert/recommendation is not evidence or finding automatically", () => {
    const alert = createAiAnalyticalOutput({ outputType: "ALERT", evidenceIds: ["EVI-1"] });
    const recommendation = createAiAnalyticalOutput({ outputType: "RECOMMENDATION", findingIds: ["FND-1"] });
    expect(alert.outputType).toBe("ALERT");
    expect(recommendation.outputType).toBe("RECOMMENDATION");
    expect(canPromoteToFinding(alert)).toBe(false);
    expect(canPromoteToFinding(recommendation)).toBe(false);
  });

  test("TEST 21 PhotoAlbum AI score no longer certifies hypothesis automatically", () => {
    const source = readSource("src/components/PhotoAlbum.tsx");
    expect(source).toContain("lastAiHypothesisSuggestion");
    expect(source).toContain("no se certificó ni se generó dictamen automáticamente");
  });
});
