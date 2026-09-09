import {
  assessPandillasEvidence,
  buildEvidenceBoundPandillasNarrative,
  PANDILLAS_EMPTY_EVIDENCE_TEXT,
  PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT,
} from "../src/utils/intelligenceLayoutEngine";

const affirmativePatterns = [
  /dinamicas delictivas asociadas/i,
  /zona de influencia activa/i,
  /control territorial/i,
  /presencia probable/i,
  /grupo local/i,
];

const expectNoAffirmativeFallback = (text: string) => {
  for (const pattern of affirmativePatterns) {
    expect(text).not.toMatch(pattern);
  }
};

describe("P3-C Pandillas narrative is evidence-bound", () => {
  test("T1 markdown con palabra pandilla pero sin sweep no produce afirmacion factual", () => {
    const text = buildEvidenceBoundPandillasNarrative([]);

    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoAffirmativeFallback(text);
  });

  test("T2 sin evidencia queda en insuficiencia gobernada", () => {
    const assessment = assessPandillasEvidence([]);
    const text = buildEvidenceBoundPandillasNarrative([]);

    expect(assessment.state).toBe("NO_EVIDENCE");
    expect(text).toContain("evidencia gobernada suficiente");
    expectNoAffirmativeFallback(text);
  });

  test("T3 P1-E EMPTY redacta ausencia limitada a la consulta", () => {
    const sweeps = [{ engine: "Pandillas", sweepStatus: "EMPTY", provider: "PANDILLAS_API" }];
    const text = buildEvidenceBoundPandillasNarrative(sweeps);

    expect(assessPandillasEvidence(sweeps).state).toBe("EVIDENCE_EMPTY");
    expect(text).toContain(PANDILLAS_EMPTY_EVIDENCE_TEXT);
    expect(text).toContain("alcance de la consulta");
    expect(text).not.toContain("no existen pandillas");
    expectNoAffirmativeFallback(text);
  });

  test("T4 P1-E SUCCESS narra solo atributos presentes", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "Pandillas",
      sweepStatus: "SUCCESS",
      provider: "PANDILLAS_API",
      source: "Censo gobernado P1-E",
      traceabilityId: "trace-pandillas-1",
      result: {
        nombre: "Grupo Norte",
        zonaInfluencia: "Sector A",
        hallazgos: ["Coincidencia documental A"],
        confidence: 72,
      },
    }]);

    expect(text).toContain("Grupo Norte");
    expect(text).toContain("Sector A");
    expect(text).toContain("Coincidencia documental A");
    expect(text).toContain("confidence: 72");
    expect(text).not.toMatch(/jerarquia/i);
    expect(text).not.toMatch(/liderazgo/i);
    expect(text).not.toMatch(/alianzas/i);
    expect(text).not.toMatch(/violencia/i);
    expectNoAffirmativeFallback(text);
  });

  test("T5 P1-E NOT_CONFIGURED no genera hecho", () => {
    const text = buildEvidenceBoundPandillasNarrative([{ engine: "Pandillas", sweepStatus: "NOT_CONFIGURED" }]);

    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expect(text).toContain("NOT_CONFIGURED");
    expectNoAffirmativeFallback(text);
  });

  test("T6 P1-E TIMEOUT no genera hecho", () => {
    const text = buildEvidenceBoundPandillasNarrative([{ engine: "Pandillas", sweepStatus: "TIMEOUT" }]);

    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expect(text).toContain("TIMEOUT");
    expectNoAffirmativeFallback(text);
  });

  test("T7 P1-E PROVIDER_ERROR no genera hecho", () => {
    const text = buildEvidenceBoundPandillasNarrative([{ engine: "Pandillas", sweepStatus: "PROVIDER_ERROR" }]);

    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expect(text).toContain("PROVIDER_ERROR");
    expectNoAffirmativeFallback(text);
  });

  test("T8 CIFA mock no sustenta narrativa de pandillas", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "CIFA",
      source: "CIFA_MOCK",
      data: "menciona pandilla como contexto diagnostico",
    }]);

    expect(assessPandillasEvidence([{ engine: "CIFA", source: "CIFA_MOCK", data: "pandilla" }]).state).toBe("NO_EVIDENCE");
    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoAffirmativeFallback(text);
  });

  test("T9 SCINCE simulated no sustenta narrativa de pandillas", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "SCINCE",
      source: "SCINCE_SIMULATED",
      data: "gang/pandilla en texto de prueba",
    }]);

    expect(assessPandillasEvidence([{ engine: "SCINCE", source: "SCINCE_SIMULATED", data: "gang" }]).state).toBe("NO_EVIDENCE");
    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoAffirmativeFallback(text);
  });

  test("T10 no aparecen nombres no presentes en input gobernado", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "Pandillas",
      sweepStatus: "SUCCESS",
      result: { nombre: "Grupo Unico", hallazgo: "Registro A" },
    }]);

    expect(text).toContain("Grupo Unico");
    expect(text).not.toContain("Cartel Inventado");
    expect(text).not.toContain("Los Sureños");
  });

  test("T11 provenance se conserva", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "Pandillas",
      sweepStatus: "SUCCESS",
      provider: "PANDILLAS_API",
      source: "Censo gobernado P1-E",
      generatedAt: "2026-09-09T12:00:00.000Z",
      model: "modelo-test",
      traceabilityId: "trace-pandillas-2",
      evidenceIds: ["ev-1", "ev-2"],
      result: { hallazgo: "Registro gobernado" },
    }]);

    expect(text).toContain("sweepStatus: SUCCESS");
    expect(text).toContain("provider: PANDILLAS_API");
    expect(text).toContain("source: Censo gobernado P1-E");
    expect(text).toContain("generatedAt: 2026-09-09T12:00:00.000Z");
    expect(text).toContain("model: modelo-test");
    expect(text).toContain("traceabilityId: trace-pandillas-2");
    expect(text).toContain("evidenceIds: ev-1; ev-2");
  });

  test("T12 coincidencia lexical gang/pandilla no activa fallback factual", () => {
    const text = buildEvidenceBoundPandillasNarrative([{
      engine: "OSINT",
      source: "diagnostico textual",
      context: "gang pandilla clica",
    }]);

    expect(assessPandillasEvidence([{ engine: "OSINT", context: "gang pandilla clica" }]).state).toBe("NO_EVIDENCE");
    expect(text).toContain(PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoAffirmativeFallback(text);
  });
});
