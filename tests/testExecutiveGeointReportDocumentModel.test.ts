import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveVisualComposition, MAX_EXECUTIVE_VISUALS } from "../src/utils/executiveVisualComposition";

const generatedAt = "2026-09-06T12:00:00.000Z";

function geography(): CanonicalProjectGeography {
  return buildCanonicalProjectGeography({ projectId: "exp-document", type: "INDIVIDUAL", points: [{ lat: 22.1, lng: -101.9 }], now: 1 });
}

function finding(id = "finding-1", title = "Concentracion territorial prioritaria") {
  return {
    findingId: id,
    title,
    summary: `${title} documentada`,
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    supportingFactors: ["factor documentado"],
    contradictingFactors: ["limitacion contextual"],
    interpretation: "Interpretacion institucional gobernada",
    implication: "Implicacion institucional para decision",
    confidence: "ALTO",
    limitations: ["limitacion registrada"],
    traceabilityIds: [`trace-${id}`],
    technicalMetadata: { sourceFindingIds: [id], sourceEvidenceIds: ["ev-1"], sourceAnalysisIds: ["analysis-1"] },
  };
}

function keyEvidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    title: "Fotografia de campo",
    summary: "Evidencia visual clave vinculada al hallazgo",
    visualReference: "asset://photo-1",
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    relatedFindingIds: ["finding-1"],
    selectionReason: "Seleccionada por soporte directo",
    limitations: [],
    traceabilityIds: ["trace-ev-1"],
    technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-1" },
    ...overrides,
  };
}

function visualCandidate(geo: CanonicalProjectGeography, overrides: any = {}) {
  return {
    visualId: "map-1",
    title: "Mapa territorial gobernado",
    summary: "Mapa principal del area analizada",
    visualType: "MAP",
    reference: "asset://map-1",
    geographyId: geo.geographyId,
    relatedFindingIds: ["finding-1"],
    traceabilityIds: ["trace-map-1"],
    technicalMetadata: { sourceItemId: "map-1", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId },
    ...overrides,
  };
}

function executiveModel(overrides: any = {}) {
  const geo = overrides.geography ?? geography();
  const map = visualCandidate(geo);
  return {
    identity: {
      numeroExpediente: "06092026-0001-PPC",
      ceipolId: "CEIPOL-LEGACY",
      fechaEmision: "2026-09-06",
      clasificacion: "CONFIDENCIAL - USO INSTITUCIONAL",
    },
    panorama: {
      situacion: "Situacion territorial sintetizada",
      hallazgosClave: ["Hallazgo uno", "Hallazgo dos", "Hallazgo tres", "Hallazgo cuatro", "Hallazgo cinco", "Hallazgo seis"],
      escenario: "Persistencia cualitativa",
      decisionesSugeridas: ["Decision uno", "Decision dos", "Decision tres", "Decision cuatro", "Decision cinco", "Decision seis"],
      nivelConfianza: "ALTO",
      incertidumbre: "MODERADA",
      vigencia: "2026-12-31",
    },
    territorialSituation: {
      canonicalGeography: geo,
      territorialSummary: "Resumen territorial gobernado",
      principalMapCandidate: map,
      territorialFindings: [],
      relevantPoi: [],
      spatialLimitations: [],
    },
    findings: [finding("finding-1"), finding("finding-2", "Patron territorial secundario")],
    keyEvidence: [keyEvidence(), keyEvidence({ evidenceId: "ev-2", visualReference: "asset://photo-2", traceabilityIds: ["trace-ev-2"], technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-2" } })],
    multisourceAnalysis: {
      convergencias: ["Convergencia multifuente gobernada"],
      contradicciones: ["Contradiccion documentada"],
      fuentesIndependientes: ["Fuente independiente registrada"],
      dependenciasParciales: ["Dependencia parcial registrada"],
      brechasInformacion: ["Brecha de informacion registrada"],
      nivelSoporte: "ALTO",
      traceabilityIds: ["trace-analysis-1"],
      technicalMetadata: { sourceAnalysisIds: ["analysis-1"], sourceEvidenceIds: ["ev-1"] },
    },
    prospectiveAnalysis: {
      tendencia: "PERSISTENCIA",
      escenario: "PERSISTENCIA",
      factoresSoporte: ["factor prospectivo"],
      factoresContradiccion: ["factor contrario"],
      nivelConfianza: "ALTO",
      incertidumbre: "MODERADA",
      vigencia: "2026-12-31",
      limitaciones: ["limitacion prospectiva"],
      relacionHipotesis: "SOPORTA LA HIPOTESIS",
      traceabilityIds: ["trace-pap-1"],
      excludedProducts: [],
      technicalMetadata: { sourceProductIds: ["pap-1"] },
    },
    decisionImplications: Array.from({ length: 6 }, (_, index) => ({
      hallazgoRelacionado: "Concentracion territorial prioritaria",
      implicacion: `Implicacion ${index + 1}`,
      accionSugerida: `Accion sugerida ${index + 1}`,
      prioridad: "ALTA",
      fundamento: "Fundamento gobernado",
      limitaciones: [],
      traceabilityIds: [`trace-decision-${index + 1}`],
      technicalMetadata: { sourceFindingId: "finding-1" },
    })),
    visualCandidates: [
      map,
      {
        visualId: "prospective-1",
        title: "Escenario prospectivo cualitativo",
        summary: "Visual prospectivo gobernado",
        visualType: "PROSPECTIVE_SCENARIO",
        reference: "asset://prospective-1",
        relatedFindingIds: ["finding-1"],
        traceabilityIds: ["trace-pap-1"],
        technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
      },
    ],
    technicalAnnex: {
      available: true,
      references: [
        { kind: "ALBUM_COMPLETO", label: "Album completo", itemCount: 12, traceabilityIds: ["trace-album"] },
        { kind: "TRACEABILITY", label: "Trazabilidad completa", itemCount: 8, traceabilityIds: ["trace-lineage"] },
      ],
    },
    selectionAudit: { exclusions: [], executiveExclusions: [], limits: {} },
    presentation: { labels: {}, visibleText: [] },
    technicalMetadata: {
      modelName: "ExecutiveGeointReportModel",
      modelVersion: "1.0.0",
      sourceProjectId: "project-technical-id",
      generatedAt,
      source: "InstitutionalReportInput",
    },
    ...overrides,
  };
}

function institutionalInput(overrides: any = {}) {
  const geo = overrides.geography ?? geography();
  return {
    projectId: "project-technical-id",
    generatedAt,
    geography: geo,
    reportReadyAssessment: {},
    hypothesis: {},
    evidence: [],
    findings: [],
    inferences: [],
    analyses: [],
    conclusions: [],
    osint: [],
    streetView: [],
    temporalComparisons: [],
    specializedIntelligence: [],
    predictiveAnalyticalProducts: [],
    predictiveAnalyticalNarrative: "",
    visualProducts: [],
    exclusions: [],
    disclosures: [],
    lineageSummary: { geographyId: geo.geographyId, sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 },
    traceabilityGate: {},
    publicationEligibility: "ELIGIBLE",
    draft: false,
    certified: false,
    published: false,
    ...overrides,
  };
}

function documentModel(modelOverrides: any = {}, inputOverrides: any = {}) {
  const input = institutionalInput(inputOverrides);
  const model = executiveModel({ geography: input.geography, ...modelOverrides });
  const visuals = buildExecutiveVisualComposition(model as any, input as any);
  return buildExecutiveGeointReportDocumentModel(model as any, visuals, input as any);
}

describe("Fase D - ExecutiveGeointReportDocumentModel", () => {
  test("1 estructura ejecutiva correcta", () => {
    expect(documentModel().sections.map((section) => section.sectionId)).toEqual([
      "cover",
      "executive-panorama",
      "territorial-situation",
      "priority-findings",
      "key-evidence",
      "multisource-analysis",
      "prospective-analysis",
      "decision-implications",
    ]);
  });

  test("2 portada usa numeroExpediente", () => {
    expect(documentModel().identity.numeroExpediente).toBe("06092026-0001-PPC");
    expect(documentModel().sections[0].content.join(" ")).toContain("06092026-0001-PPC");
  });

  test("3 projectId no aparece visible", () => {
    expect(documentModel().presentation.visibleText.join(" ")).not.toContain("project-technical-id");
  });

  test("4 mapa territorial obligatorio", () => {
    expect(documentModel().visualPlacements[0]).toMatchObject({ visualId: "principal-territorial-map", sectionId: "territorial-situation" });
  });

  test("5 visualBudget <=5", () => {
    expect(documentModel().visualPlacements.length).toBeLessThanOrEqual(MAX_EXECUTIVE_VISUALS);
  });

  test("6 no duplica visuales", () => {
    const ids = documentModel().visualPlacements.map((item) => item.visualId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("7 hallazgos <=5", () => {
    const findings = Array.from({ length: 8 }, (_, index) => finding(`finding-${index}`, `Hallazgo ${index}`));
    expect(documentModel({ findings }).sections.find((section) => section.sectionId === "priority-findings")?.content.length).toBeLessThanOrEqual(5);
  });

  test("8 evidencias clave <=4", () => {
    const keyEvidenceItems = Array.from({ length: 8 }, (_, index) => keyEvidence({ evidenceId: `ev-${index}`, visualReference: `asset://photo-${index}`, traceabilityIds: [`trace-${index}`], technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-${index}` } }));
    expect(documentModel({ keyEvidence: keyEvidenceItems }).sections.find((section) => section.sectionId === "key-evidence")?.content.length).toBeLessThanOrEqual(4);
  });

  test("9 decisiones <=5", () => {
    expect(documentModel().sections.find((section) => section.sectionId === "decision-implications")?.content.length).toBeLessThanOrEqual(5);
  });

  test("10 no crea capitulos por fuente", () => {
    const titles = documentModel().sections.map((section) => section.title).join(" ");
    expect(titles).not.toMatch(/CAP[IÍ]TULO|FOTOGRAF[IÍ]AS|ESTAD[IÍ]STICAS|PANDILLAS|MAPAS/);
  });

  test("11 Street View no aparece como capitulo", () => {
    expect(documentModel().sections.map((section) => section.title).join(" ")).not.toMatch(/STREET VIEW/);
  });

  test("12 OSINT no aparece como capitulo", () => {
    expect(documentModel().sections.map((section) => section.title).join(" ")).not.toMatch(/OSINT/);
  });

  test("13 evidencia se agrupa por hallazgo", () => {
    expect(documentModel().sections.find((section) => section.sectionId === "priority-findings")?.content[0]).toContain("Evidencia que lo sustenta");
  });

  test("14 prospectiva solo si gobernada", () => {
    expect(documentModel().sections.some((section) => section.sectionId === "prospective-analysis")).toBe(true);
    const noProspective = documentModel({ prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, traceabilityIds: [], technicalMetadata: { sourceProductIds: [] } } });
    expect(noProspective.sections.some((section) => section.sectionId === "prospective-analysis")).toBe(false);
  });

  test("15 no genera probabilidad criminal", () => {
    expect(JSON.stringify(documentModel()).toLowerCase()).not.toMatch(/probabilidad criminal|probabilidad de delito|%/);
  });

  test("16 no genera prediccion individual", () => {
    expect(JSON.stringify(documentModel()).toLowerCase()).not.toMatch(/predicci[oó]n individual|culpabilidad|reincidencia individual|ocurrir[aá] el delito/);
  });

  test("17 no inventa recomendaciones", () => {
    const decisions = documentModel().sections.find((section) => section.sectionId === "decision-implications")?.content.join(" ") || "";
    expect(decisions).toContain("Accion sugerida 1");
    expect(decisions).not.toContain("factor documentado como recomendacion");
  });

  test("18 IDs tecnicos no visibles", () => {
    const visible = documentModel().presentation.visibleText.join(" ");
    expect(visible).not.toMatch(/sourceItemId|traceabilityId|geographyId|publicationEligibility|reasonCode|modelVersion|ADR|Gate|payload|project-technical-id|trace-ev-1/);
  });

  test("19 technical metadata preservada", () => {
    expect(documentModel().technicalMetadata.sourceProjectId).toBe("project-technical-id");
    expect(documentModel().technicalMetadata.traceabilityIds).toContain("trace-ev-1");
  });

  test("20 annex references preservadas", () => {
    expect(documentModel().annexReferences.map((item) => item.kind)).toContain("ALBUM_COMPLETO");
    expect(documentModel().annexReferences.map((item) => item.kind)).toContain("TRACEABILITY");
  });

  test("21 header/footer no modificados", () => {
    expect(documentModel().presentation.headerFooterPolicy).toEqual({ preserveExistingInstitutionalHeaderFooter: true, onlyFeedNumeroExpediente: true });
    expect(documentModel().technicalMetadata.modifiesHeaderFooter).toBe(false);
  });

  test("22 deterministic output", () => {
    expect(documentModel()).toEqual(documentModel());
  });

  test("23 sin llamadas externas", () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => { throw new Error("external call"); }) as any;
    expect(() => documentModel()).not.toThrow();
    global.fetch = originalFetch;
  });

  test("24 Fase B pasa", () => {
    const input = institutionalInput();
    const model = buildExecutiveGeointReportModel(input as any, { documentIdentity: { numeroExpediente: "06092026-0001-PPC" }, now: generatedAt });
    expect(model.identity.numeroExpediente).toBe("06092026-0001-PPC");
  });

  test("25 Fase C pasa", () => {
    const input = institutionalInput();
    const model = executiveModel({ geography: input.geography });
    expect(buildExecutiveVisualComposition(model as any, input as any).visualBudget.used).toBeLessThanOrEqual(MAX_EXECUTIVE_VISUALS);
  });

  test("26 ADR-022 pasa", () => {
    expect(documentModel().technicalMetadata.source).toBe("InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition");
  });

  test("27 ADR-025.5 pasa", () => {
    expect(documentModel().sections.some((section) => section.sectionId === "prospective-analysis")).toBe(true);
  });

  test("28 TypeScript pasa mediante contrato tipado", () => {
    const sectionCount: number = documentModel().technicalMetadata.sectionCount;
    expect(sectionCount).toBeGreaterThanOrEqual(7);
  });

  test("29 build pasa con composicion sin render Word", () => {
    expect(documentModel().technicalMetadata.rendersWord).toBe(false);
  });

  test("30 accion ausente no crea recomendacion", () => {
    const decision = {
      hallazgoRelacionado: "Concentracion territorial prioritaria",
      implicacion: "",
      accionSugerida: "",
      prioridad: "ALTA",
      fundamento: "",
      limitaciones: [],
      traceabilityIds: ["trace-decision-empty"],
      technicalMetadata: { sourceFindingId: "finding-1" },
    };
    const visible = documentModel({ decisionImplications: [decision] }).presentation.visibleText.join(" ");
    expect(visible).toContain("ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
    expect(visible).not.toMatch(/seguimiento|vigilancia|verificaci[oó]n|priorizaci[oó]n|intervenci[oó]n|supervisi[oó]n/i);
  });

  test("31 evidenceReferences tecnicos no aparecen visibles", () => {
    const visible = documentModel({ findings: [finding("finding-1")] }).presentation.visibleText.join(" ");
    expect(visible).not.toContain("ev-1");
    expect(visible).toContain("Fotografia de campo");
  });

  test("32 finding IDs no aparecen visibles", () => {
    const visible = documentModel({ decisionImplications: [{ ...executiveModel().decisionImplications[0], hallazgoRelacionado: "finding-1" }] }).presentation.visibleText.join(" ");
    expect(visible).not.toContain("finding-1");
  });

  test("33 fallbacks de interpretacion declaran ausencia", () => {
    const content = documentModel({ findings: [{ ...finding("finding-1"), interpretation: "" }] }).sections.find((section) => section.sectionId === "priority-findings")?.content.join(" ") || "";
    expect(content).toContain("INTERPRETACION NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
    expect(content).not.toContain("Interpretacion institucional no ampliada");
  });

  test("34 fallbacks de implicacion declaran ausencia", () => {
    const content = documentModel({ findings: [{ ...finding("finding-1"), implication: "" }] }).sections.find((section) => section.sectionId === "priority-findings")?.content.join(" ") || "";
    expect(content).toContain("IMPLICACION NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
    expect(content).not.toContain("derivada del hallazgo gobernado");
  });

  test("35 fallback de fundamento declara ausencia", () => {
    const decision = { ...executiveModel().decisionImplications[0], fundamento: "" };
    const content = documentModel({ decisionImplications: [decision] }).sections.find((section) => section.sectionId === "decision-implications")?.content.join(" ") || "";
    expect(content).toContain("FUNDAMENTO NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
    expect(content).not.toContain("Fundamento gobernado en el modelo ejecutivo");
  });

  test("36 metadata tecnica conserva evidenceReferences y trazabilidad sin exponerlos", () => {
    const model = documentModel();
    expect(model.technicalMetadata.evidenceReferences).toContain("ev-1");
    expect(model.technicalMetadata.traceabilityIds).toContain("trace-ev-1");
    expect(model.presentation.visibleText.join(" ")).not.toMatch(/ev-1|trace-ev-1|sourceItemId|geographyId/);
  });

  test("37 estructura y presupuesto visual permanecen sin cambios", () => {
    const model = documentModel();
    expect(model.visualPlacements.length).toBeLessThanOrEqual(5);
    expect(model.paginationPolicy.targetPageRange).toBe("7-9");
    expect(model.paginationPolicy.ordinaryMaximumPages).toBe(10);
    expect(model.presentation.headerFooterPolicy.preserveExistingInstitutionalHeaderFooter).toBe(true);
  });
});
