import fs from "node:fs";
import path from "node:path";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  acceptAiSuggestionAsHumanRevision,
  addAiHypothesisReview,
  adaptLegacyProjectHypothesis,
  attachAiHypothesisSuggestion,
  buildReportChapter0Hypothesis,
  canProceedWithInstitutionalAnalysis,
  formulateHumanHypothesis,
  getReportReadyHypothesisInput,
  validateHypothesisWithHumanDecision,
} from "../src/utils/hypothesisGovernance";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const supportedLineage = buildEvidenceLineage({
  geographyId: "geo-canonical-1",
  sourceId: "src-1",
  evidenceId: "ev-1",
  findingId: "find-1",
  inferenceId: "inf-1",
  analysisId: "analysis-1",
});

describe("ADR-020.31 - Hypothesis governance / report boundary", () => {
  test("TEST 1 new project without human hypothesis blocks gate", () => {
    expect(canProceedWithInstitutionalAnalysis({ id: "project-1" }).allowed).toBe(false);
  });

  test("TEST 2 human hypothesis formulated allows gate", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Hipótesis humana central." });
    expect(canProceedWithInstitutionalAnalysis({ canonicalHypothesis: hypothesis }).allowed).toBe(true);
  });

  test("TEST 3 AI suggestion only keeps gate blocked", () => {
    const suggestion = createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION", confidence: 99, confidenceSource: "PROVIDER" });
    expect(attachAiHypothesisSuggestion(null, suggestion)).toBeNull();
    expect(canProceedWithInstitutionalAnalysis({ aiSuggestions: [suggestion] }).allowed).toBe(false);
  });

  test("TEST 4 AI suggestion does not overwrite human hypothesis", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Hipótesis humana original." });
    const suggestion = createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" });
    const updated = attachAiHypothesisSuggestion(hypothesis, suggestion)!;
    expect(updated.text).toBe("Hipótesis humana original.");
    expect(updated.aiSuggestions).toHaveLength(1);
  });

  test("TEST 5 accepting AI suggestion creates human revision/version", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Hipótesis humana original." });
    const suggestion = createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" });
    const accepted = acceptAiSuggestionAsHumanRevision(hypothesis, {
      suggestion,
      suggestedText: "Hipótesis humana revisada por aceptación explícita.",
      authorId: "real-user-1",
    });
    expect(accepted.authorType).toBe("HUMAN");
    expect(accepted.version).toBe(2);
    expect(accepted.history[1].sourceAiOutputId).toBe(suggestion.outputId);
  });

  test("TEST 6 initial hypothesis text is preserved after revision", () => {
    const original = formulateHumanHypothesis({ projectId: "project-1", text: "Texto inicial." });
    const revised = acceptAiSuggestionAsHumanRevision(original, {
      suggestion: createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" }),
      suggestedText: "Texto revisado.",
    });
    expect(revised.history[0].text).toBe("Texto inicial.");
    expect(revised.text).toBe("Texto revisado.");
  });

  test("TEST 7 revision increments version", () => {
    const original = formulateHumanHypothesis({ projectId: "project-1", text: "Texto inicial." });
    const revised = acceptAiSuggestionAsHumanRevision(original, {
      suggestion: createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" }),
      suggestedText: "Texto revisado.",
    });
    expect(revised.version).toBe(original.version + 1);
  });

  test("TEST 8 legacy hypothesis text is preserved without fabricated metadata", () => {
    const legacy = adaptLegacyProjectHypothesis({ id: "project-legacy", hipotesis: "Hipótesis legacy.", geographyId: "geo-1" })!;
    expect(legacy.text).toBe("Hipótesis legacy.");
    expect(legacy.status).toBe("LEGACY_FORMULATED");
    expect(legacy.authorId).toBeNull();
    expect(legacy.createdAt).toBeNull();
  });

  test("TEST 9 legacy project without hypothesis remains readable but gated", () => {
    const legacy = adaptLegacyProjectHypothesis({ id: "project-legacy" });
    expect(legacy).toBeNull();
    expect(canProceedWithInstitutionalAnalysis({ canonicalHypothesis: legacy }).allowed).toBe(false);
  });

  test("TEST 10 supporting evidence references are preserved", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto.", supportingEvidenceIds: ["ev-1", "ev-1"] });
    expect(hypothesis.supportingEvidenceIds).toEqual(["ev-1"]);
  });

  test("TEST 11 contradicting evidence references are preserved", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto.", contradictingEvidenceIds: ["ev-x"] });
    expect(hypothesis.contradictingEvidenceIds).toEqual(["ev-x"]);
    expect(hypothesis.supportStatus).toBe("CONTRADICTED");
  });

  test("TEST 12 unsupported hypothesis is not validated", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto." });
    const validated = validateHypothesisWithHumanDecision(hypothesis, { validatorIdentity: { id: "u-1" } });
    expect(validated.status).not.toBe("VALIDATED");
    expect(validated.validationStatus).toBe("PENDING_REVIEW");
  });

  test("TEST 13 high AI confidence does not validate hypothesis", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto.", supportingEvidenceIds: ["ev-1"], lineage: supportedLineage });
    const reviewed = addAiHypothesisReview(hypothesis, createAiAnalyticalOutput({ outputType: "ANALYSIS", confidence: 0.99, confidenceSource: "PROVIDER" }));
    expect(reviewed.validationStatus).toBe("UNREVIEWED");
    expect(reviewed.status).toBe("FORMULATED");
  });

  test("TEST 14 human validation can mark supported hypothesis validated", () => {
    const hypothesis = formulateHumanHypothesis({
      projectId: "project-1",
      text: "Texto.",
      supportingEvidenceIds: ["ev-1"],
      supportingFindingIds: ["find-1"],
      lineage: supportedLineage,
    });
    const validated = validateHypothesisWithHumanDecision(hypothesis, {
      validatorIdentity: { id: "u-1" },
      validatedAt: "2026-08-30T12:00:00.000Z",
    });
    expect(validated.status).toBe("VALIDATED");
    expect(validated.validationStatus).toBe("APPROVED");
  });

  test("TEST 15 AI review is not human validation", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto." });
    const reviewed = addAiHypothesisReview(hypothesis, createAiAnalyticalOutput({ outputType: "ANALYSIS" }));
    expect(reviewed.aiReviews).toHaveLength(1);
    expect(reviewed.validationStatus).toBe("UNREVIEWED");
  });

  test("TEST 16 geographyId is preserved", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto.", geographyId: "geo-canonical-1" });
    expect(hypothesis.geographyId).toBe("geo-canonical-1");
  });

  test("TEST 17 report Chapter 0 uses real human initial hypothesis", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Inicial humana." });
    const chapter0 = buildReportChapter0Hypothesis({ canonicalHypothesis: hypothesis });
    expect(chapter0.initialHypothesis).toBe("Inicial humana.");
  });

  test("TEST 18 no human hypothesis means report does not fabricate one", () => {
    const chapter0 = buildReportChapter0Hypothesis({ id: "project-1" });
    expect(chapter0.initialHypothesis).toBe("HIPÓTESIS NO FORMULADA");
  });

  test("TEST 19 AI suggestion appears marked as AI", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Humana." });
    const updated = attachAiHypothesisSuggestion(hypothesis, createAiAnalyticalOutput({ outputType: "HYPOTHESIS_SUGGESTION" }))!;
    const chapter0 = buildReportChapter0Hypothesis({ canonicalHypothesis: updated });
    expect(chapter0.aiSuggestions[0].representation).toBe("AI HYPOTHESIS SUGGESTION");
  });

  test("TEST 20 validated hypothesis is not automatically final conclusion", () => {
    const hypothesis = formulateHumanHypothesis({
      projectId: "project-1",
      text: "Texto.",
      supportingEvidenceIds: ["ev-1"],
      lineage: supportedLineage,
    });
    const validated = validateHypothesisWithHumanDecision(hypothesis, { validatorIdentity: { id: "u-1" } });
    expect(validated.status).toBe("VALIDATED");
    expect(validated.finalConclusionId).toBeNull();
  });

  test("TEST 21 formulate/revise hypothesis does not emit sweep event", () => {
    const source = readSource("src/utils/hypothesisGovernance.ts");
    expect(source).not.toContain("enqueueSweepLifecycleEvents");
    expect(source).not.toContain("logGeointEvent");
    expect(source).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 22 hypothesisRequirementSatisfied is exposed for ADR-020.32", () => {
    const input = getReportReadyHypothesisInput({ id: "project-1", hipotesis: "Texto humano legacy." });
    expect(input.hypothesisRequirementSatisfied).toBe(true);
  });

  test("TEST 23 hypothesisId is not projectId/photoId/sweepId/traceabilityId", () => {
    const hypothesis = formulateHumanHypothesis({ projectId: "project-1", text: "Texto." });
    expect(hypothesis.hypothesisId).not.toBe("project-1");
    expect(hypothesis.hypothesisId).not.toBe("photo-1");
    expect(hypothesis.hypothesisId).not.toBe("sweep-1");
    expect((hypothesis as any).traceabilityId).toBeUndefined();
  });

  test("TEST 24 PhotoAlbum persists human hypothesis instead of UI-only approval", () => {
    const source = readSource("src/components/PhotoAlbum.tsx");
    expect(source).toContain("await saveHumanHypothesis(updatedContext)");
    expect(source).toContain("canProceedWithInstitutionalAnalysis");
  });

  test("TEST 25 ProjectContext persists canonicalHypothesis and gate", () => {
    const source = readSource("src/context/ProjectContext.tsx");
    expect(source).toContain("canonicalHypothesis");
    expect(source).toContain("hypothesisRequirementSatisfied");
    expect(source).toContain("await updateDoc(projectRef, updates)");
  });

  test("TEST 26 missing validator identity is not fabricated", () => {
    const hypothesis = formulateHumanHypothesis({
      projectId: "project-1",
      text: "Texto.",
      supportingEvidenceIds: ["ev-1"],
      lineage: supportedLineage,
    });
    const validated = validateHypothesisWithHumanDecision(hypothesis, { validatorIdentity: null });
    expect(validated.validationStatus).toBe("APPROVED");
    expect(validated.validatedBy).toBeNull();
    expect(validated.validatedAt).toBeTruthy();
  });
});
