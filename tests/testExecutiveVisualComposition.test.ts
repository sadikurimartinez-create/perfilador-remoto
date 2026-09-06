import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveVisualComposition, MAX_EXECUTIVE_VISUALS } from "../src/utils/executiveVisualComposition";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";

const generatedAt = "2026-09-06T12:00:00.000Z";

function geography(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON"): CanonicalProjectGeography {
  const points =
    type === "INDIVIDUAL"
      ? [{ lat: 22.1, lng: -101.9 }]
      : type === "CORRIDOR"
        ? [{ lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.8 }]
        : [{ lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.9 }, { lat: 22.2, lng: -101.8 }];
  return buildCanonicalProjectGeography({ projectId: `exp-${type}`, type, points, now: 1 });
}

function multipolygonGeography(): CanonicalProjectGeography {
  return {
    ...geography("POLYGON"),
    geographyId: "geo-multipolygon",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[-101.9, 22.1], [-101.8, 22.1], [-101.8, 22.2], [-101.9, 22.1]]],
        [[[-101.7, 22.3], [-101.6, 22.3], [-101.6, 22.4], [-101.7, 22.3]]],
      ],
    },
    derived: {
      centroid: { lat: 22.25, lng: -101.75, derivation: "DERIVED_FROM_POLYGON" },
      bounds: { north: 22.4, south: 22.1, east: -101.6, west: -101.9, derivation: "DERIVED_FROM_GEOMETRY" },
      closedRing: true,
    },
  };
}

function finding(id = "finding-1") {
  return {
    findingId: id,
    title: "Concentracion gobernada en acceso oriental",
    summary: "Hallazgo gobernado de configuracion territorial",
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    supportingFactors: ["factor documentado"],
    contradictingFactors: [],
    interpretation: "Interpretacion gobernada",
    implication: "Implicacion gobernada",
    confidence: "ALTO",
    limitations: [],
    traceabilityIds: [`trace-${id}`],
    technicalMetadata: { sourceFindingIds: [id], sourceEvidenceIds: ["ev-1"], sourceAnalysisIds: ["analysis-1"] },
  };
}

function keyEvidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    title: "Fotografia de campo",
    summary: "Evidencia visual gobernada",
    visualReference: "asset://photo-1",
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    relatedFindingIds: ["finding-1"],
    selectionReason: "Seleccionada por trazabilidad",
    limitations: [],
    traceabilityIds: ["trace-ev-1"],
    technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-1" },
    ...overrides,
  };
}

function visualCandidate(overrides: any = {}) {
  return {
    visualId: "map-1",
    title: "Concentracion gobernada en acceso oriental",
    summary: "Mapa gobernado del area",
    visualType: "MAP",
    reference: "asset://map-1",
    relatedFindingIds: ["finding-1"],
    traceabilityIds: ["trace-map-1"],
    technicalMetadata: { sourceItemId: "map-1", sourceType: "VISUAL_CANDIDATE" },
    ...overrides,
  };
}

function executiveModel(overrides: any = {}) {
  const geo = overrides.geography ?? geography("INDIVIDUAL");
  const governedMap = visualCandidate({
    geographyId: geo.geographyId,
    technicalMetadata: { sourceItemId: "map-1", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId },
  });
  return {
    identity: {},
    panorama: { hallazgosClave: [], decisionesSugeridas: [] },
    territorialSituation: {
      canonicalGeography: geo,
      territorialSummary: "Resumen territorial",
      principalMapCandidate: governedMap,
      territorialFindings: [],
      relevantPoi: [],
      spatialLimitations: [],
    },
    findings: [finding()],
    keyEvidence: [keyEvidence()],
    multisourceAnalysis: {
      convergencias: ["Convergencia multifuente gobernada"],
      contradicciones: [],
      fuentesIndependientes: [],
      dependenciasParciales: [],
      brechasInformacion: [],
      nivelSoporte: "ALTO",
      traceabilityIds: ["trace-analysis-1"],
      technicalMetadata: { sourceAnalysisIds: ["analysis-1"], sourceEvidenceIds: ["ev-1"] },
    },
    prospectiveAnalysis: {
      tendencia: "PERSISTENCIA",
      escenario: "PERSISTENCIA",
      factoresSoporte: ["factor prospectivo"],
      factoresContradiccion: [],
      nivelConfianza: "ALTO",
      incertidumbre: "MODERADA",
      vigencia: "2026-12-31",
      limitaciones: [],
      relacionHipotesis: "SOPORTA LA HIPOTESIS",
      traceabilityIds: ["trace-pap-1"],
      excludedProducts: [],
      technicalMetadata: { sourceProductIds: ["pap-1"] },
    },
    decisionImplications: [{ hallazgoRelacionado: "Concentracion gobernada en acceso oriental" }],
    visualCandidates: [governedMap],
    technicalAnnex: {},
    selectionAudit: {},
    presentation: { visibleText: [] },
    technicalMetadata: { sourceProjectId: "project-technical-id" },
    ...overrides,
  };
}

function institutionalInput(overrides: any = {}) {
  const geo = overrides.geography ?? geography("INDIVIDUAL");
  return {
    projectId: "project-technical-id",
    generatedAt,
    geography: geo,
    evidence: [],
    findings: [],
    analyses: [],
    osint: [],
    streetView: [],
    temporalComparisons: [],
    predictiveAnalyticalProducts: [],
    visualProducts: [],
    exclusions: [],
    disclosures: [],
    lineageSummary: { geographyId: geo?.geographyId ?? null, sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 },
    traceabilityGate: {},
    publicationEligibility: "ELIGIBLE",
    ...overrides,
  };
}

describe("Fase C - ExecutiveVisualComposition", () => {
  test("1 mapa principal siempre existe como candidato o render instruction", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput()).principalTerritorialMap.status).toBe("READY_FROM_GOVERNED_VISUAL");
    const noMap = executiveModel({ visualCandidates: [], territorialSituation: { ...executiveModel().territorialSituation, principalMapCandidate: null } });
    expect(buildExecutiveVisualComposition(noMap, institutionalInput()).principalTerritorialMap.renderInstruction).toBe("MAP_RENDER_REQUIRED");
  });

  test("2 canonical POINT se conserva", () => {
    const geo = geography("INDIVIDUAL");
    const composition = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.technicalMetadata.geometry?.type).toBe("Point");
    expect(composition.principalTerritorialMap.technicalMetadata.geographyId).toBe(geo.geographyId);
  });

  test("3 canonical CORRIDOR se conserva", () => {
    const geo = geography("CORRIDOR");
    expect(buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.geometry?.type).toBe("LineString");
  });

  test("4 POLYGON se conserva", () => {
    const geo = geography("POLYGON");
    expect(buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.geometry?.type).toBe("Polygon");
  });

  test("5 MULTIPOLYGON se conserva", () => {
    const geo = multipolygonGeography();
    const composition = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.technicalMetadata.geometry?.type).toBe("MultiPolygon");
    expect(composition.principalTerritorialMap.technicalMetadata.geographyType).toBe("MULTIPOLYGON");
  });

  test("6 no usa center hardcoded", () => {
    const geo = geography("INDIVIDUAL");
    const center = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.center;
    expect(center).toEqual({ lat: 22.1, lng: -101.9 });
    expect(center).not.toEqual({ lat: 21.885, lng: -102.291 });
  });

  test("7 no crea circulo desde pins", () => {
    const geo = geography("POLYGON");
    const metadata = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata as any;
    expect(metadata.geometry.type).toBe("Polygon");
    expect(metadata.radiusMeters).toBeUndefined();
  });

  test("8 maximo 5 visuales", () => {
    const visuals = Array.from({ length: 8 }, (_, index) => keyEvidence({
      evidenceId: `ev-${index}`,
      visualReference: `asset://photo-${index}`,
      traceabilityIds: [`trace-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(composition.visualBudget.used).toBeLessThanOrEqual(MAX_EXECUTIVE_VISUALS);
  });

  test("9 no rellena hasta 5 artificialmente", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [] }), institutionalInput());
    expect(composition.visualBudget.used).toBe(1);
    expect(composition.visualBudget.filledArtificially).toBe(false);
  });

  test("10 evidencia sin trazabilidad se excluye", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({ traceabilityIds: [] })] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("NO_TRACEABILITY");
  });

  test("11 visual sin relacion ejecutiva se excluye", () => {
    const unrelatedEvidence = keyEvidence({
      evidenceId: "ev-unrelated",
      evidenceReferences: ["ev-unrelated-ref"],
      relatedFindingIds: ["other"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-unrelated" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [unrelatedEvidence] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("NO_EXECUTIVE_RELATION");
  });

  test("12 duplicados se excluyen", () => {
    const duplicate = keyEvidence({ evidenceId: "ev-dup", visualReference: "asset://dup", traceabilityIds: ["trace-dup"], technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-dup" } });
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [duplicate, { ...duplicate, evidenceId: "ev-dup-2" }] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("DUPLICATE");
  });

  test("13 diversidad visual preservada", () => {
    const visuals = Array.from({ length: 4 }, (_, index) => keyEvidence({
      evidenceId: `ev-photo-${index}`,
      visualReference: `asset://photo-${index}`,
      traceabilityIds: [`trace-photo-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-photo-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(composition.secondaryVisuals.filter((item) => item.visualType === "EVIDENCE_IMAGE").length).toBeLessThanOrEqual(2);
  });

  test("14 Street View no crea seccion autonoma", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({ title: "Street View panorama" })] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.presentation.visibleSourceLabel).toBe("IMAGEN PANORAMICA DE GOOGLE");
    const visible = JSON.stringify([composition.principalTerritorialMap.presentation, ...composition.secondaryVisuals.map((item) => item.presentation)]);
    expect(visible).not.toContain("STREET VIEW INTELLIGENCE");
  });

  test("15 evidencia panoramica puede entrar como visual", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({ title: "Imagen panoramica de Google" })] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.presentation.visibleSourceLabel).toBe("IMAGEN PANORAMICA DE GOOGLE");
  });

  test("16 prospective visual solo con producto admitido", () => {
    const prospective = visualCandidate({
      visualId: "prospective-1",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const blocked = executiveModel({ visualCandidates: [prospective], prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, technicalMetadata: { sourceProductIds: [] } } });
    expect(buildExecutiveVisualComposition(blocked, institutionalInput()).selectionAudit.reasonCodes).toContain("CONTEXT_ONLY");
    expect(buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput()).secondaryVisuals.some((item) => item.visualType === "PROSPECTIVE_SCENARIO")).toBe(true);
  });

  test("17 no genera probabilidades criminales", () => {
    const text = JSON.stringify(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toLowerCase();
    expect(text).not.toMatch(/probabilidad criminal|probabilidad de delito|%/);
  });

  test("18 no genera prediccion individual", () => {
    const text = JSON.stringify(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toLowerCase();
    expect(text).not.toMatch(/predicci[oó]n individual|culpabilidad|reincidencia individual|ocurrir[aá] el delito/);
  });

  test("19 headline procede de hallazgo gobernado o fallback neutro", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("Concentracion gobernada en acceso oriental");
    expect(buildExecutiveVisualComposition(executiveModel({ findings: [] }), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("CONFIGURACION TERRITORIAL DEL AREA ANALIZADA");
  });

  test("20 visual conserva traceabilityIds internamente", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    expect(composition.secondaryVisuals[0]?.technicalMetadata.traceabilityIds).toContain("trace-ev-1");
  });

  test("21 IDs tecnicos no aparecen en presentacion", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    const visible = JSON.stringify([composition.principalTerritorialMap.presentation, ...composition.secondaryVisuals.map((item) => item.presentation)]);
    expect(visible).not.toContain("project-technical-id");
    expect(visible).not.toContain("trace-ev-1");
    expect(visible).not.toContain("ev-1");
  });

  test("22 deterministic output", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toEqual(buildExecutiveVisualComposition(executiveModel(), institutionalInput()));
  });

  test("23 no llamadas externas", () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => { throw new Error("external call"); }) as any;
    expect(() => buildExecutiveVisualComposition(executiveModel(), institutionalInput())).not.toThrow();
    global.fetch = originalFetch;
  });

  test("24 Fase B regresion pasa", () => {
    const input = institutionalInput({
      findings: [],
      evidence: [],
      visualProducts: [],
      predictiveAnalyticalProducts: [],
    });
    const model = buildExecutiveGeointReportModel(input as any, { documentIdentity: { numeroExpediente: "06092026-0001-PPC" }, now: generatedAt });
    expect(model.identity.numeroExpediente).toBe("06092026-0001-PPC");
  });

  test("25 ADR-022 regresion pasa", () => {
    const input = institutionalInput({ evidence: [{ evidenceId: "ev-governed", traceabilityIds: ["trace-governed"] }] });
    expect(buildExecutiveVisualComposition(executiveModel(), input).technicalMetadata.source).toBe("ExecutiveGeointReportModel+InstitutionalReportInput");
  });

  test("26 ADR-025 regresion pasa", () => {
    const prospective = visualCandidate({
      visualId: "prospective-1",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const model = executiveModel({ visualCandidates: [prospective] });
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toContain("pap-1");
    expect(buildExecutiveVisualComposition(model, institutionalInput()).secondaryVisuals.some((item) => item.visualType === "PROSPECTIVE_SCENARIO")).toBe(true);
  });

  test("27 TypeScript pasa mediante contrato tipado", () => {
    const used: number = buildExecutiveVisualComposition(executiveModel(), institutionalInput()).visualBudget.used;
    expect(used).toBeGreaterThanOrEqual(1);
  });

  test("28 build pasa con contrato sin render final", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    expect(composition.technicalMetadata.rendersFinalAssets).toBe(false);
    expect(composition.technicalMetadata.externalCalls).toBe(false);
  });

  test("29 mapa con geographyId correcto entra", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ geographyId: geo.geographyId, technicalMetadata: { sourceItemId: "map-compatible", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    expect(buildExecutiveVisualComposition(model, institutionalInput({ geography: geo })).principalTerritorialMap.status).toBe("READY_FROM_GOVERNED_VISUAL");
  });

  test("30 mapa con geographyId distinto se rechaza", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ geographyId: "geo-ajena", technicalMetadata: { sourceItemId: "map-mismatch", sourceType: "VISUAL_CANDIDATE", geographyId: "geo-ajena" } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    const composition = buildExecutiveVisualComposition(model, institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.renderInstruction).toBe("MAP_RENDER_REQUIRED");
    expect(composition.selectionAudit.reasonCodes).toContain("GEOGRAPHY_MISMATCH");
  });

  test("31 mapa sin vinculacion territorial verificable cae a MAP_RENDER_REQUIRED", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ technicalMetadata: { sourceItemId: "map-no-geo", sourceType: "VISUAL_CANDIDATE" } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    const composition = buildExecutiveVisualComposition(model, institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.status).toBe("MAP_RENDER_REQUIRED");
    expect(composition.selectionAudit.reasonCodes).toContain("MAP_RENDER_REQUIRED");
  });

  test("32 visual sin finding relacionado usa fallback neutro", () => {
    const secondary = visualCandidate({
      visualId: "temporal-no-finding",
      visualType: "TEMPORAL_COMPARISON",
      reference: "asset://temporal-no-finding",
      relatedFindingIds: [],
      traceabilityIds: ["trace-temporal"],
      technicalMetadata: { sourceItemId: "temporal-no-finding", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ visualCandidates: [secondary] }), institutionalInput());
    expect(composition.secondaryVisuals.find((item) => item.visualId === "temporal-no-finding")?.executiveHeadline).toBe("CONFIGURACION TERRITORIAL DEL AREA ANALIZADA");
    expect(buildExecutiveVisualComposition(executiveModel({ findings: [] }), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("CONFIGURACION TERRITORIAL DEL AREA ANALIZADA");
  });

  test("33 relatedFinding valido usa headline correcto", () => {
    const findings = [finding("finding-1"), { ...finding("finding-2"), title: "Hallazgo territorial occidental" }];
    const visual = keyEvidence({ relatedFindingIds: ["finding-2"], evidenceReferences: ["ev-1"] });
    const composition = buildExecutiveVisualComposition(executiveModel({ findings, keyEvidence: [visual] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.executiveHeadline).toBe("Hallazgo territorial occidental");
  });

  test("34 no usa primer finding como fallback", () => {
    const findings = [finding("finding-primero"), { ...finding("finding-segundo"), title: "Hallazgo segundo" }];
    const visual = visualCandidate({
      visualId: "trend-1",
      visualType: "TREND_VISUAL",
      reference: "asset://trend",
      relatedFindingIds: ["finding-inexistente"],
      traceabilityIds: ["trace-trend"],
      technicalMetadata: { sourceItemId: "trend-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ findings, visualCandidates: [visual] }), institutionalInput());
    expect(composition.secondaryVisuals.find((item) => item.visualId === "trend-1")?.executiveHeadline).toBe("CONFIGURACION TERRITORIAL DEL AREA ANALIZADA");
  });

  test("35 prospective visual relacionado entra", () => {
    const prospective = visualCandidate({
      visualId: "prospective-linked",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-linked",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    expect(buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput()).secondaryVisuals.some((item) => item.visualId === "prospective-linked")).toBe(true);
  });

  test("36 prospective visual no relacionado no entra", () => {
    const prospective = visualCandidate({
      visualId: "prospective-unlinked",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-unlinked",
      traceabilityIds: ["trace-other"],
      technicalMetadata: { sourceItemId: "pap-other", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput());
    expect(composition.secondaryVisuals.some((item) => item.visualId === "prospective-unlinked")).toBe(false);
    expect(composition.selectionAudit.reasonCodes).toContain("CONTEXT_ONLY");
  });

  test("37 producto prospectivo A no habilita visual prospectivo B", () => {
    const prospective = visualCandidate({
      visualId: "prospective-b",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-b",
      traceabilityIds: ["trace-pap-b"],
      technicalMetadata: { sourceItemId: "pap-b", sourceType: "VISUAL_CANDIDATE" },
    });
    const model = executiveModel({
      visualCandidates: [prospective],
      prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, traceabilityIds: ["trace-pap-a"], technicalMetadata: { sourceProductIds: ["pap-a"] } },
    });
    expect(buildExecutiveVisualComposition(model, institutionalInput()).secondaryVisuals.some((item) => item.visualId === "prospective-b")).toBe(false);
  });

  test("38 presupuesto total sigue en cinco visuales maximo", () => {
    const visuals = Array.from({ length: 10 }, (_, index) => keyEvidence({
      evidenceId: `ev-budget-${index}`,
      visualReference: `asset://budget-${index}`,
      traceabilityIds: [`trace-budget-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-budget-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(1 + composition.secondaryVisuals.length).toBeLessThanOrEqual(5);
  });
});
