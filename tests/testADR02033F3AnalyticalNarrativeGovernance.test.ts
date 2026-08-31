import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis, validateHypothesisWithHumanDecision } from "../src/utils/hypothesisGovernance";
import {
  buildNarrativeAssertion,
  buildNarrativeAssertionsFromInstitutionalInput,
  renderGovernedExecutiveSummary,
  renderGovernedNarrative,
} from "../src/utils/analyticalNarrativeGovernance";
import {
  buildInstitutionalReportInput,
  reconcileInstitutionalReportPayload,
} from "../src/utils/institutionalReportPublicationContract";

const geography = buildCanonicalProjectGeography({
  projectId: "project-f3",
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
  sourceId: "source-f3",
  evidenceId: "ev-f3",
  findingId: "find-f3",
  inferenceId: "inf-f3",
  analysisId: "analysis-f3",
  conclusionId: "conclusion-f3",
});

const goodHash = "d".repeat(64);

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-f3",
    id: "ev-f3",
    text: "se registra luminaria apagada junto al corredor peatonal",
    acquisitionMode: "OBSERVED",
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
    findingId: "find-f3",
    id: "find-f3",
    text: "patrón documentado de baja iluminación en accesos secundarios",
    usedInReport: true,
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function inference(overrides: any = {}) {
  return {
    inferenceId: "inf-f3",
    id: "inf-f3",
    text: "la baja iluminación podría asociarse con oportunidad delictiva",
    findingIds: ["find-f3"],
    evidenceIds: ["ev-f3"],
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return {
    ...createAiAnalyticalOutput({
      outputId: "analysis-f3",
      outputType: "ANALYSIS",
      evidenceIds: ["ev-f3"],
      findingIds: ["find-f3"],
      inferenceIds: ["inf-f3"],
      lineage,
      validationStatus: "APPROVED",
      confidence: 95,
      confidenceSource: "PROVIDER",
      limitations: ["AI-generated interpretation"],
      ...overrides,
    }),
    ...overrides,
  };
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-f3",
    id: "conclusion-f3",
    text: "la intervención de iluminación debe priorizarse en el corredor",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    analysisIds: ["analysis-f3"],
    findingIds: ["find-f3"],
    evidenceIds: ["ev-f3"],
    ...overrides,
  };
}

function hypothesis(overrides: any = {}) {
  const base = formulateHumanHypothesis({
    projectId: "project-f3",
    text: "Hipótesis humana sobre oportunidad delictiva asociada a condiciones ambientales.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-f3"],
    supportingFindingIds: ["find-f3"],
    contradictingEvidenceIds: ["ev-contradictory"],
    lineage,
  });
  return { ...base, ...overrides };
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f3",
    projectId: "project-f3",
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    photoEvidence: [evidence()],
    findings: [finding()],
    inferences: [inference()],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    osint: [],
    streetViewAnalysis: [{ id: "sv-f3", evidenceId: "sv-f3", geographyId: geography.geographyId, text: "fachada visible en panorama", lineage }],
    temporalComparisons: [{ comparisonId: "tc-f3", comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED", text: "diferencia de iluminación entre capturas" }],
    intelligenceContext: {
      aceReport: {
        certifiedGimOutput: { validatedByACE: true, traceabilityReference: "gim-cert-f3", text: "salida GIM certificada", lineage },
      },
    },
    maps: [{ id: "map-f3", geographyId: geography.geographyId }],
    sweeps: [{ id: "sweep-f3", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-f3"], outputFindingIds: ["find-f3"] }],
    ...overrides,
  };
}

describe("ADR-020.33 F3 - Analytical narrative governance", () => {
  test("TEST 1 OBSERVED evidence -> observational narrative allowed", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(evidence(), { sourceItemType: "EVIDENCE" }));
    expect(rendered.narrativeStrength).toBe("OBSERVATIONAL");
    expect(rendered.text).toContain("se observa");
  });

  test("TEST 2 AI_GENERATED content -> not rendered as observed", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(evidence({ acquisitionMode: "AI_GENERATED" }), { sourceItemType: "EVIDENCE" }));
    expect(rendered.narrativeStrength).toBe("CONDITIONAL");
    expect(rendered.text).not.toContain("se observa");
  });

  test("TEST 3 supported finding -> finding narrative allowed", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(finding(), { sourceItemType: "FINDING" }));
    expect(rendered.text).toContain("Se documenta el hallazgo");
  });

  test("TEST 4 unsupported finding -> no institutional narrative", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(finding({ lineage: [], lineageStatus: "UNSUPPORTED" }), { sourceItemType: "FINDING" }));
    expect(rendered.rendered).toBe(false);
  });

  test("TEST 5 inference -> uses inferential strength", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(inference(), { sourceItemType: "INFERENCE" }));
    expect(rendered.narrativeStrength).toBe("INFERENTIAL");
    expect(rendered.text).toContain("sugieren");
  });

  test("TEST 6 inference cannot render as validated conclusion", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(inference(), { sourceItemType: "INFERENCE" }), { requestedStrength: "VALIDATED_CONCLUSION" });
    expect(rendered.narrativeStrength).toBe("INFERENTIAL");
    expect(rendered.text).not.toContain("Se concluye");
  });

  test("TEST 7 supported analysis -> analytical narrative allowed", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(analysis(), { sourceItemType: "ANALYSIS" }));
    expect(rendered.narrativeStrength).toBe("ANALYTICAL");
    expect(rendered.text).toContain("El análisis integrado indica");
  });

  test("TEST 8 AI pending analysis -> no definitive institutional voice", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(analysis({ validationStatus: "PENDING_REVIEW" }), { sourceItemType: "ANALYSIS" }));
    expect(rendered.narrativeStrength).toBe("CONDITIONAL");
    expect(rendered.text).toContain("pendiente de validación humana");
    expect(rendered.text).not.toContain("Se concluye");
  });

  test("TEST 9 validated conclusion -> conclusion-strength language allowed", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(conclusion(), { sourceItemType: "CONCLUSION" }));
    expect(rendered.narrativeStrength).toBe("VALIDATED_CONCLUSION");
    expect(rendered.text).toContain("Se concluye");
  });

  test("TEST 10 AI conclusion suggestion -> no conclusion-strength language", () => {
    const suggestion = createAiAnalyticalOutput({ outputId: "ai-conclusion-f3", outputType: "CONCLUSION_SUGGESTION", findingIds: ["find-f3"], lineage });
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(suggestion, { sourceItemType: "CONCLUSION" }));
    expect(rendered.rendered).toBe(false);
  });

  test("TEST 11 high confidence alone -> cannot use confirmed/proven semantics", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(analysis({ confidence: 99, validationStatus: "PENDING_REVIEW" }), { sourceItemType: "ANALYSIS" }));
    expect(rendered.text).not.toMatch(/confirmad|demostrad|comprobad|probad/i);
    expect(rendered.warnings).toContain("CONFIDENCE_IS_NOT_CERTAINTY");
  });

  test("TEST 12 correlation -> cannot render causation", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(inference({ text: "la actividad causa concentración de riesgo" }), { sourceItemType: "INFERENCE" }), { relationKind: "CORRELATION" });
    expect(rendered.text).toContain("asociación");
    expect(rendered.text).not.toMatch(/causa|provoca|determina|origina|produce/i);
  });

  test("TEST 13 validated causal conclusion -> causal wording only if explicitly supported", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(conclusion({ text: "la omisión documentada causa pérdida de visibilidad" }), { sourceItemType: "CONCLUSION" }), { relationKind: "CAUSAL", explicitCausalSupport: true });
    expect(rendered.text).toMatch(/causa/i);
  });

  test("TEST 14 initial hypothesis -> remains hypothesis", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(hypothesis(), { sourceItemType: "HYPOTHESIS", text: hypothesis().history[0].text }));
    expect(rendered.text).toContain("hipótesis de trabajo");
    expect(rendered.text).not.toContain("Se concluye");
  });

  test("TEST 15 validated hypothesis -> not automatically conclusion", () => {
    const validated = validateHypothesisWithHumanDecision(hypothesis({ contradictingEvidenceIds: [] }), { validatorIdentity: { id: "validator-f3" }, validatedAt: "2026-08-30T10:00:00.000Z" });
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(validated, { sourceItemType: "HYPOTHESIS" }));
    expect(rendered.narrativeStrength).toBe("CONDITIONAL");
    expect(rendered.text).not.toContain("Se concluye");
  });

  test("TEST 16 contradictory evidence -> preserved in synthesis", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.hypothesis.contradictingEvidenceIds).toContain("ev-contradictory");
    const assertion = buildNarrativeAssertionsFromInstitutionalInput(input).find((item) => item.sourceItemType === "HYPOTHESIS");
    expect(assertion?.text).toContain("Hipótesis humana");
  });

  test("TEST 17 AI limitations -> propagated", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(analysis({ limitations: ["limited source coverage"] }), { sourceItemType: "ANALYSIS" }));
    expect(rendered.text).toContain("Limitaciones");
    expect(rendered.warnings).toContain("LIMITATIONS_PROPAGATED");
  });

  test("TEST 18 non-authoritative OSINT -> contextual language", () => {
    const assertion = buildNarrativeAssertion({ id: "osint-f3", sourceStatus: "NON_AUTHORITATIVE", text: "síntesis contextual" }, { sourceItemType: "OSINT" });
    const rendered = renderGovernedNarrative(assertion, { mode: "DRAFT" });
    expect(rendered.disclosureCodes).toContain("NON_AUTHORITATIVE_CONTEXT");
    expect(rendered.text).toContain("NON_AUTHORITATIVE_CONTEXT");
  });

  test("TEST 19 Telegram/Gemini synthesis -> not rendered as direct social observation", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion(createAiAnalyticalOutput({ outputId: "tg-f3", outputType: "SUMMARY", sourceReferences: ["TELEGRAM_CONTEXT"] }), { sourceItemType: "OSINT" }), { mode: "DRAFT" });
    expect(rendered.text).not.toContain("usuarios reportan");
    expect(rendered.text).not.toContain("se observa");
  });

  test("TEST 20 Street View AI interpretation -> not human observation", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ id: "sv-ai-f3", acquisitionMode: "AI_GENERATED", text: "interpretación visual automática" }, { sourceItemType: "STREET_VIEW" }));
    expect(rendered.text).not.toContain("se observa");
    expect(rendered.warnings).toContain("AI_GENERATED_TEXT_REQUIRES_PROVENANCE");
  });

  test("TEST 21 temporal difference -> no automatic causal interpretation", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ comparisonId: "tc-f3", comparedEvidenceIds: ["a", "b"], text: "cambio visible entre capturas" }, { sourceItemType: "TEMPORAL_COMPARISON" }), { relationKind: "TEMPORAL_DIFFERENCE" });
    expect(rendered.text).toContain("no establece por sí sola una causa");
  });

  test("TEST 22 certified Pandillas output -> governed analytical narrative", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ validatedByACE: true, traceabilityReference: "gim-cert-f3", text: "perfil territorial certificado" }, { sourceItemType: "SPECIALIZED_INTELLIGENCE" }));
    expect(rendered.rendered).toBe(true);
    expect(rendered.text).toContain("análisis");
  });

  test("TEST 23 raw GIM AI text -> not institutional fact", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ id: "raw-gim", acquisitionMode: "AI_GENERATED", text: "texto AI GIM raw" }, { sourceItemType: "SPECIALIZED_INTELLIGENCE" }));
    expect(rendered.narrativeStrength).toBe("CONDITIONAL");
    expect(rendered.text).not.toMatch(/hecho institucional|Se concluye/i);
  });

  test("TEST 24 recommendation -> remains recommendation", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ recommendationId: "rec-f3", text: "reforzar recorridos en accesos secundarios", analysisIds: ["analysis-f3"] }, { sourceItemType: "RECOMMENDATION" }));
    expect(rendered.text).toContain("Se recomienda");
    expect(rendered.sourceItemType).toBe("RECOMMENDATION");
  });

  test("TEST 25 executive summary -> introduces no new claim IDs", () => {
    const assertions = [buildNarrativeAssertion(evidence(), { sourceItemType: "EVIDENCE" }), buildNarrativeAssertion(finding(), { sourceItemType: "FINDING" })];
    const summary = renderGovernedExecutiveSummary(assertions);
    expect(summary.claimIds.every((id) => assertions.some((assertion) => assertion.assertionId === id))).toBe(true);
  });

  test("TEST 26 lineage refs survive narrative mapping", () => {
    const assertion = buildNarrativeAssertion(conclusion(), { sourceItemType: "CONCLUSION" });
    expect(assertion.evidenceIds).toContain("ev-f3");
    expect(assertion.findingIds).toContain("find-f3");
    expect(assertion.analysisIds).toContain("analysis-f3");
  });

  test("TEST 27 draft may expose unvalidated content with disclosure", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ id: "legacy-draft", sourceStatus: "LEGACY_UNCLASSIFIED", text: "texto legacy" }, { sourceItemType: "ANALYSIS" }), { mode: "DRAFT" });
    expect(rendered.rendered).toBe(true);
    expect(rendered.text).toContain("LEGACY_UNCLASSIFIED");
  });

  test("TEST 28 institutional mode rejects LEGACY_UNCLASSIFIED critical assertion", () => {
    const rendered = renderGovernedNarrative(buildNarrativeAssertion({ id: "legacy-critical", sourceStatus: "LEGACY_UNCLASSIFIED", text: "texto legacy" }, { sourceItemType: "ANALYSIS", critical: true }));
    expect(rendered.rendered).toBe(false);
  });

  test("TEST 29 human validated text -> editorial adaptation cannot elevate epistemic class", () => {
    const assertion = buildNarrativeAssertion(finding({ humanValidationStatus: "APPROVED" }), { sourceItemType: "FINDING" });
    const rendered = renderGovernedNarrative(assertion, { requestedStrength: "VALIDATED_CONCLUSION" });
    expect(assertion.epistemicClass).toBe("FINDING");
    expect(rendered.narrativeStrength).toBe("EVIDENTIARY");
  });

  test("TEST 30 InstitutionalReportInput remains source boundary", () => {
    const input = buildInstitutionalReportInput(readyProject());
    const reconciled = reconcileInstitutionalReportPayload(readyProject({ finalHypothesis: "RAW NO" }), input);
    expect(reconciled.institutionalReportInput).toBe(input);
    expect(reconciled.governedNarrativeAssertions.length).toBeGreaterThan(0);
    expect(reconciled.governedExecutiveSummary.claimIds.every((id: string) => reconciled.governedNarrativeAssertions.some((assertion: any) => assertion.assertionId === id))).toBe(true);
  });
});
