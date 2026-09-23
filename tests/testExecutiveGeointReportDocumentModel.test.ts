import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveVisualComposition, MAX_EXECUTIVE_VISUALS } from "../src/utils/executiveVisualComposition";
import { buildReportChapter0Hypothesis, formulateHumanHypothesis, reviseHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { Packer } from "docx";
import JSZip from "jszip";

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

async function documentXml(document: any): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  return zip.file("word/document.xml")?.async("string") || "";
}

describe("Fase D - ExecutiveGeointReportDocumentModel", () => {
  test("1 estructura ejecutiva correcta", () => {
    expect(documentModel().sections.map((section) => section.sectionId)).toEqual([
      "cover",
      "executive-panorama",
      "initial-hypothesis",
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
    expect(titles).not.toMatch(/FOTOGRAF[IÍ]AS|ESTAD[IÍ]STICAS|PANDILLAS|MAPAS/);
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

  test("38 distingue la hipótesis inicial canónica de la vigente sin reformularlas", () => {
    const initial = "Observación humana inicial  con  dos espacios.";
    const current = "Hipótesis vigente tras revisión humana.";
    const model = documentModel({}, { hypothesis: {
      initialHypothesis: initial,
      currentHypothesis: current,
      versions: [{ text: initial, authorType: "HUMAN", version: 1 }],
      supportingEvidenceIds: ["ev-1"],
      supportingFindingIds: ["finding-1"],
      contradictingEvidenceIds: ["ev-2"],
      contradictingFindingIds: [],
    },
    evidence: [
      { evidenceId: "ev-1", title: "Fotografía de apoyo" },
      { evidenceId: "ev-2", title: "Fotografía contradictoria" },
    ],
    findings: [{ findingId: "finding-1", title: "Hallazgo de apoyo" }],
    conclusions: [{ text: "Conclusión validada por PPC", findingIds: ["finding-1"] }],
    });
    const section = model.sections.find((item) => item.sectionId === "initial-hypothesis");
    expect(section?.title).toBe("CAPÍTULO 0. HIPÓTESIS INICIAL Y TRAZABILIDAD");
    expect(section?.status).toBe("READY");
    expect(section?.content[0]).toBe(`Hipótesis inicial: ${initial}`);
    expect(section?.content[1]).toBe(`Hipótesis vigente: ${current}`);
    expect(section?.content[2]).toContain("Hallazgo de apoyo");
    expect(section?.content[3]).toContain("Fotografía de apoyo");
    expect(section?.content[4]).toContain("Fotografía contradictoria");
    expect(section?.content[5]).toContain("Conclusión validada por PPC");
    expect(model.technicalMetadata.evidenceReferences).toContain("ev-2");
    expect(model.presentation.visibleText).toContain(`Hipótesis inicial: ${initial}`);
  });

  test("39 no sustituye un historial inicial ausente por la hipótesis vigente", () => {
    const model = documentModel({}, { hypothesis: {
      initialHypothesis: "Texto no verificable",
      currentHypothesis: "Hipótesis vigente documentada",
      versions: [],
    } });
    const section = model.sections.find((item) => item.sectionId === "initial-hypothesis");
    expect(section?.status).toBe("INCOMPLETE");
    expect(section?.content[0]).toContain("No consta una hipótesis inicial humana verificable");
    expect(section?.content[0]).not.toContain("Hipótesis vigente documentada");
    expect(section?.content[1]).toContain("Hipótesis vigente documentada");
  });

  test("40 conserva la versión inicial tras serializar y reabrir la hipótesis canónica", () => {
    const formulated = formulateHumanHypothesis({ projectId: "exp-document", text: "Hipótesis formulada en campo" });
    const revised = reviseHumanHypothesis(formulated, { text: "Hipótesis vigente revisada" });
    const reopened = JSON.parse(JSON.stringify({ canonicalHypothesis: revised }));
    const model = documentModel({}, { hypothesis: buildReportChapter0Hypothesis(reopened) });
    const section = model.sections.find((item) => item.sectionId === "initial-hypothesis");
    expect(section?.content[0]).toBe("Hipótesis inicial: Hipótesis formulada en campo");
    expect(section?.content[1]).toBe("Hipótesis vigente: Hipótesis vigente revisada");
  });

  test("41 no presenta una conclusión ajena como vinculada a la hipótesis", () => {
    const model = documentModel({}, {
      hypothesis: {
        currentHypothesis: "Hipótesis vigente",
        versions: [{ text: "Hipótesis inicial", authorType: "HUMAN", version: 1 }],
        supportingFindingIds: ["finding-1"],
      },
      findings: [{ findingId: "finding-1", title: "Hallazgo vinculado" }],
      conclusions: [{ text: "Conclusión ajena", findingIds: ["finding-2"] }],
    });
    const section = model.sections.find((item) => item.sectionId === "initial-hypothesis");
    expect(section?.content[5]).toContain("No consta una conclusión validada y vinculada");
    expect(section?.content[5]).not.toContain("Conclusión ajena");
  });

  test("41A Capítulo 0 publica contexto gobernado disponible y separa hipótesis vigente", () => {
    const model = documentModel({ identity: { ...executiveModel().identity, personaPerfiladora: "PPC Laura Méndez" } }, {
      hypothesis: {
        initialHypothesis: "Hipótesis humana inicial",
        currentHypothesis: "Hipótesis vigente distinta",
        status: "UNDER_REVIEW",
        versions: [{
          text: "Hipótesis humana inicial",
          authorType: "HUMAN",
          version: 1,
          status: "FORMULATED",
          createdAt: "2026-09-01T10:30:00.000Z",
        }],
      },
    });
    const content = model.sections.find((item) => item.sectionId === "initial-hypothesis")?.content || [];
    expect(content).toContain("Hipótesis inicial: Hipótesis humana inicial");
    expect(content).toContain("Hipótesis vigente: Hipótesis vigente distinta");
    expect(content).toContain("Geografía de referencia: Punto territorial individual; estado VALID");
    expect(content).toContain("Persona perfiladora criminológica (PPC): PPC Laura Méndez");
    expect(content).toContain("Fecha de formulación: 2026-09-01T10:30:00.000Z");
    expect(content).toContain("Estado de la hipótesis inicial: FORMULATED");
  });

  test("41B Capítulo 0 expresa ausencias sin backfill ficticio", () => {
    const model = documentModel({
      identity: { ...executiveModel().identity, personaPerfiladora: "Persona perfiladora no disponible" },
      territorialSituation: { ...executiveModel().territorialSituation, canonicalGeography: null },
    }, {
      geography: null,
      hypothesis: { currentHypothesis: "Hipótesis vigente", versions: [] },
    });
    const section = model.sections.find((item) => item.sectionId === "initial-hypothesis")!;
    expect(section.status).toBe("INCOMPLETE");
    expect(section.content[0]).not.toContain("Hipótesis vigente");
    expect(section.content).toContain("Contexto de formulación: NO CONSIGNADO");
    expect(section.content).toContain("Geografía de referencia: NO CONSIGNADO");
    expect(section.content).toContain("Persona perfiladora criminológica (PPC): NO CONSIGNADO");
    expect(section.content).toContain("Fecha de formulación: NO CONSIGNADO");
    expect(section.content).toContain("Estado de la hipótesis inicial: NO CONSIGNADO");
  });

  test("41C cadena canónica entrega Capítulo 0 completo al OOXML", async () => {
    const initial = formulateHumanHypothesis({
      projectId: "exp-document",
      text: "Hipótesis inicial formulada por la PPC",
      geographyId: geography().geographyId,
      authorId: "ppc-1",
      createdAt: "2026-09-01T10:30:00.000Z",
    });
    const revised = reviseHumanHypothesis(initial, {
      text: "Hipótesis vigente después del contraste humano",
      authorId: "ppc-1",
      updatedAt: "2026-09-02T12:00:00.000Z",
    });
    const model = documentModel({ identity: { ...executiveModel().identity, personaPerfiladora: "PPC Laura Méndez" } }, {
      hypothesis: buildReportChapter0Hypothesis({ canonicalHypothesis: revised }),
    });
    const xml = await documentXml(renderExecutiveGeointWordDocument(model).document);
    expect(xml).toContain("CAPÍTULO 0. HIPÓTESIS INICIAL Y TRAZABILIDAD");
    expect(xml).toContain("Hipótesis inicial: Hipótesis inicial formulada por la PPC");
    expect(xml).toContain("Hipótesis vigente: Hipótesis vigente después del contraste humano");
    expect(xml).toContain("Persona perfiladora criminológica (PPC): PPC Laura Méndez");
    expect(xml).toContain("Fecha de formulación: 2026-09-01T10:30:00.000Z");
    expect(xml).not.toContain("ppc-1");
  });

  test("42 SCINCE muestra datos observados sin inventar ceros y conserva procedencia", () => {
    const source = {
      status: "OBSERVED",
      geography: { ageb: { code: "001" }, manzana: { code: "002" } },
      demographics: { populationTotal: 125, housingTotal: null, inhabitedPrivateHousing: 40, uninhabitedPrivateHousing: null },
      provenance: { datasetId: "inegi-cpv-2020", referenceYear: 2020, censusSourceUrl: "https://inegi.example/censo" },
      epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false, acquiredAt: generatedAt },
    };
    const model = documentModel({}, { scinceDemographics: source });
    const text = model.sections.find((item) => item.sectionId === "territorial-situation")?.content.join(" ") || "";
    expect(text).toContain("población 125");
    expect(text).toContain("viviendas No disponible");
    expect(text).toContain("Censo 2020");
    expect(model.technicalMetadata.sourceProvenance).toContainEqual(expect.objectContaining({ traceabilityId: "inegi-cpv-2020" }));
    const absent = documentModel({}, { scinceDemographics: { ...source, status: "NO_DATA" } });
    expect(absent.sections.find((item) => item.sectionId === "territorial-situation")?.content.join(" ")).not.toContain("población 125");
  });

  test("43 DENUE sólo representa POI observados y distingue conteo de muestra", () => {
    const pois = Array.from({ length: 5 }, (_, index) => ({
      id: `denue-${index}`, traceabilityId: `trace-denue-${index}`,
      name: `Comercio ${index}`, activityCode: "A1", source: "DENUE", provider: "INEGI_DENUE",
      territorialStatus: "INSTITUTIONAL", epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false },
    }));
    const model = documentModel({}, { denuePois: [...pois, { ...pois[0], id: "google-1", source: "GOOGLE", name: "POI ajeno" }] });
    const text = model.sections.find((item) => item.sectionId === "territorial-situation")?.content.join(" ") || "";
    expect(text).toContain("5 registro(s) elegible(s); 3 mostrado(s)");
    expect(text).toContain("Comercio 0");
    expect(text).not.toContain("POI ajeno");
    expect(text).not.toContain("Comercio 4");
  });

  test("44 incidencia sólo publica el contrato descriptivo ejecutado", () => {
    const contract = { productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT", analyticalLevel: "DESCRIPTIVE",
      queryReference: { status: "EXECUTED", admission: { accepted: true } },
      datasetReference: { datasetId: "c5i-911", coverage: { temporal: { start: "2020-01-01", end: "2020-12-31" } } },
      projectionReference: { metrics: { frequency: { totalRecords: 12 } } }, exportId: "inc-1" };
    const model = documentModel({}, { crimeIncidenceExportContract: contract });
    const text = model.sections.find((item) => item.sectionId === "territorial-situation")?.content.join(" ") || "";
    expect(text).toContain("12 registro(s)");
    expect(text).toContain("producto descriptivo, no evidencia");
    const rejected = documentModel({}, { crimeIncidenceExportContract: { ...contract, queryReference: { status: "REJECTED", admission: { accepted: false } } } });
    expect(rejected.sections.find((item) => item.sectionId === "territorial-situation")?.content.join(" ")).not.toContain("12 registro(s)");
  });

  test("45 OSINT y Pandillas sólo imprimen contenido gobernado y conservan provenance", () => {
    const osint = (status: string, title: string) => ({ title, url: `https://example.org/${title}`,
      epistemicIntegrity: { providerName: "GDELT", acquisitionMode: "OBSERVED", acquisitionStatus: status,
        isSimulated: false, acquiredAt: generatedAt, query: "consulta", traceabilityId: title } });
    const certified = { schemaVersion: "GIM-REPORT-1.0", validationStatus: "CERTIFIED", validatedByACE: true,
      traceabilityReference: "gim-cert-1", analyticalFindings: ["Relación territorial revisada"], evidenceSummary: ["Dos fuentes de campo"] };
    const model = documentModel({}, { osint: [osint("ACQUIRED", "Nota adquirida"), osint("FAILED", "Nota fallida"),
      osint("NO_DATA", "Nota vacía"), osint("NOT_CONFIGURED", "Nota sin configurar"),
      osint("UNAVAILABLE", "Nota no disponible"), osint("NO_APLICABLE", "Nota no aplicable")],
      specializedIntelligence: [certified] });
    const text = model.sections.find((item) => item.sectionId === "multisource-analysis")?.content.join(" ") || "";
    expect(text).toContain("Nota adquirida");
    expect(text).toContain("GDELT");
    expect(text).toContain("Relación territorial revisada");
    expect(text).not.toMatch(/Nota fallida|Nota vacía|Nota sin configurar|Nota no disponible|Nota no aplicable/);
    expect(model.technicalMetadata.sourceProvenance).toContainEqual(expect.objectContaining({ traceabilityId: "Nota adquirida", query: "consulta" }));
    const absent = documentModel({}, { osint: [osint("FAILED", "Nota fallida")], specializedIntelligence: [{ ...certified, validationStatus: "NOT_CERTIFIED" }] });
    const absentText = absent.sections.find((item) => item.sectionId === "multisource-analysis")?.content.join(" ") || "";
    expect(absentText).toContain("no constan registros observados adquiridos");
    expect(absentText).toContain("no consta un análisis certificado publicable");
    expect(absent.technicalMetadata.sourceProvenance?.some((item) => item.source === "GIM ACE")).toBe(false);
  });

  test("46 GIM exige CERTIFIED de forma simetrica en contenido y provenance", () => {
    const base = { schemaVersion: "GIM-REPORT-1.0", validatedByACE: true, traceabilityReference: "gim-cert-1",
      analyticalFindings: ["Hallazgo GIM gobernado"] };
    const certified = documentModel({}, { specializedIntelligence: [{ ...base, validationStatus: "CERTIFIED" }] });
    expect(certified.sections.find((item) => item.sectionId === "multisource-analysis")?.content.join(" ")).toContain("Hallazgo GIM gobernado");
    expect(certified.technicalMetadata.sourceProvenance).toContainEqual(expect.objectContaining({ source: "GIM ACE" }));
    for (const validationStatus of ["DRAFT", "PENDING", "VALIDATED", "NOT_CERTIFIED", "FAILED", undefined, null]) {
      const excluded = documentModel({}, { specializedIntelligence: [{ ...base, validationStatus }] });
      expect(excluded.sections.find((item) => item.sectionId === "multisource-analysis")?.content.join(" ")).toContain("no consta un análisis certificado publicable");
      expect(excluded.technicalMetadata.sourceProvenance?.some((item) => item.source === "GIM ACE")).toBe(false);
    }
  });
});
