import fs from "node:fs";
import path from "node:path";
import {
  applyHumanContextualizationDecision,
  classifyContextualizationMode,
  createContextualizationAiReview,
  createContextualizationReviewLedger,
} from "../src/utils/contextualizationReviewLedger";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("ADR-024.2 - Contextualization Review Ledger", () => {
  test("TEST 1 originalHumanText is preserved", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano original.",
      observations: "Observacion IA.",
      suggestedText: "Texto sugerido por IA.",
    });
    expect(ledger.originalHumanText).toBe("Texto humano original.");
    expect(ledger.aiReview.suggestedText).toBe("Texto sugerido por IA.");
    expect(ledger.finalHumanText).toBeNull();
  });

  test("TEST 2 AI review is generated separately", () => {
    const aiReview = createContextualizationAiReview({
      mode: "suggest",
      provider: "GeminiREST",
      model: "gemini-test",
      prompt: "Mejora el contexto",
      inputIds: ["project:EXP-1"],
    });
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano original.",
      aiReview,
      observations: "Revision IA.",
      suggestedText: "Texto sugerido por IA.",
    });
    expect(ledger.aiReview.output?.acquisitionMode).toBe("AI_GENERATED");
    expect(ledger.originalHumanText).not.toBe(ledger.aiReview.suggestedText);
  });

  test("TEST 3 AI cannot change originalHumanText", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Version humana 1.",
      suggestedText: "Version IA 1.",
    });
    const second = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: ledger.originalHumanText,
      suggestedText: "Version IA 2.",
    });
    expect(second.originalHumanText).toBe("Version humana 1.");
    expect(second.aiReview.suggestedText).toBe("Version IA 2.");
  });

  test("TEST 4 AI output starts PENDING_REVIEW", () => {
    const aiReview = createContextualizationAiReview({
      mode: "validate-photos",
      provider: "VertexAI",
      model: "gemini-test",
      prompt: "Valida fotos",
      evidenceIds: ["EVI-1"],
    });
    expect(aiReview.validationStatus).toBe("PENDING_REVIEW");
    expect(aiReview.outputType).toBe("ANALYSIS");
  });

  test("TEST 5 accepting review requires explicit human action", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano.",
      suggestedText: "Texto IA.",
    });
    expect(ledger.humanDecision.status).toBe("PENDING_REVIEW");
    expect(ledger.finalHumanText).toBeNull();
    const accepted = applyHumanContextualizationDecision(ledger, {
      status: "ACCEPTED",
      decidedBy: "analyst-1",
      decidedAt: "2026-09-05T10:00:00.000Z",
    });
    expect(accepted.humanDecision.status).toBe("ACCEPTED");
    expect(accepted.finalHumanText).toBe("Texto IA.");
  });

  test("TEST 6 rejecting review preserves human text", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano.",
      suggestedText: "Texto IA.",
    });
    const rejected = applyHumanContextualizationDecision(ledger, {
      status: "REJECTED",
      decidedAt: "2026-09-05T10:00:00.000Z",
    });
    expect(rejected.finalHumanText).toBe("Texto humano.");
  });

  test("TEST 7 partially accepted review does not adopt suggestedText automatically", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano.",
      suggestedText: "Texto IA.",
    });
    const partial = applyHumanContextualizationDecision(ledger, {
      status: "PARTIALLY_ACCEPTED",
      decidedAt: "2026-09-05T10:00:00.000Z",
    });
    expect(partial.finalHumanText).toBeNull();
  });

  test("TEST 8 Gemini failure preserves original and creates no AI review or final text", () => {
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano intacto.",
      technicalStatus: "FAILED",
      failureReason: "Gemini timeout",
    });
    expect(ledger.originalHumanText).toBe("Texto humano intacto.");
    expect(ledger.aiReview.output).toBeNull();
    expect(ledger.finalHumanText).toBeNull();
    expect(ledger.technicalStatus).toBe("FAILED");
  });

  test("TEST 9 validate-photos is AI analysis and not a finding", () => {
    const aiReview = createContextualizationAiReview({
      mode: "validate-photos",
      provider: "GeminiREST",
      model: "gemini-test",
      prompt: "Valida fotos",
      evidenceIds: ["PHOTO-1"],
    });
    expect(aiReview.outputType).toBe("ANALYSIS");
    expect(aiReview.acquisitionMode).toBe("AI_GENERATED");
    expect(aiReview.findingIds).toEqual([]);
  });

  test("TEST 10 hypothesis-qa remains a suggestion and does not replace human hypothesis", () => {
    const aiReview = createContextualizationAiReview({
      mode: "hypothesis-qa",
      provider: "GeminiREST",
      model: "gemini-test",
      prompt: "Critica hipotesis humana",
    });
    const ledger = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "hypothesis-qa",
      originalHumanText: "Hipotesis humana.",
      aiReview,
      suggestedText: "Hipotesis sugerida por IA.",
    });
    expect(aiReview.outputType).toBe("HYPOTHESIS_SUGGESTION");
    expect(ledger.originalHumanText).toBe("Hipotesis humana.");
    expect(ledger.finalHumanText).toBeNull();
  });

  test("TEST 11 second review keeps first human version intact", () => {
    const first = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: "Texto humano base.",
      suggestedText: "Sugerencia uno.",
      createdAt: "2026-09-05T10:00:00.000Z",
    });
    const second = createContextualizationReviewLedger({
      expedienteId: "EXP-1",
      mode: "suggest",
      originalHumanText: first.originalHumanText,
      suggestedText: "Sugerencia dos.",
      createdAt: "2026-09-05T10:01:00.000Z",
    });
    expect(first.originalHumanText).toBe("Texto humano base.");
    expect(second.originalHumanText).toBe("Texto humano base.");
    expect(first.ledgerId).not.toBe(second.ledgerId);
  });

  test("TEST 12 promptHash and inputIds are preserved", () => {
    const aiReview = createContextualizationAiReview({
      mode: "suggest",
      provider: "GeminiREST",
      model: "gemini-test",
      prompt: "Prompt trazable",
      inputIds: ["project:EXP-1", "trace-1"],
    });
    expect(aiReview.promptHash).toMatch(/^prompt-/);
    expect(aiReview.promptId).toBe("refine-context:suggest");
    expect(aiReview.inputIds).toEqual(["project:EXP-1", "trace-1"]);
  });

  test("TEST 13 refine-context modes are classified and response includes reviewLedger", () => {
    expect(classifyContextualizationMode("hypothesis-qa")).toBe("SUPERVISION");
    expect(classifyContextualizationMode("validate-photos")).toBe("VALIDATION");
    expect(classifyContextualizationMode("rss-news")).toBe("SYNTHESIS");
    expect(classifyContextualizationMode("suggest")).toBe("REWRITE");
    const source = readSource("src/app/api/refine-context/route.ts");
    expect(source).toContain("attachReviewLedger");
    expect(source).toContain("reviewLedger");
    expect(source).toContain("originalHumanText");
  });

  test("TEST 14 PhotoAlbum sends originalHumanText and evidence IDs to refine-context", () => {
    const source = readSource("src/components/PhotoAlbum.tsx");
    expect(source).toContain("originalHumanText");
    expect(source).toContain("evidenceId: p.evidenceId || p.id");
  });
});
