import { readFileSync } from "fs";
import { join } from "path";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveGeointTechnicalAnnexModel } from "../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";

const root = process.cwd();
const generatedAt = "2026-09-06T12:00:00.000Z";

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function geography() {
  return buildCanonicalProjectGeography({
    projectId: "project-technical-id",
    type: "INDIVIDUAL",
    points: [{ lat: 22.1, lng: -101.9 }],
    now: 1,
  });
}

function input(overrides: any = {}) {
  const geo = overrides.geography === undefined ? geography() : overrides.geography;
  return {
    projectId: "project-technical-id",
    generatedAt,
    geography: geo,
    reportReadyAssessment: {} as any,
    hypothesis: { currentHypothesis: "Hipotesis inicial gobernada" } as any,
    evidence: [
      { evidenceId: "ev-1", title: "Foto in situ", sourceType: "FIELD_PHOTO", imageUrl: "asset://photo-1", traceabilityIds: ["trace-ev-1"], sourceItemId: "source-ev-1", fingerprint: "fp-1" },
      { evidenceId: "ev-dup", title: "Foto duplicada", sourceType: "FIELD_PHOTO", imageUrl: "asset://photo-1", traceabilityIds: ["trace-ev-dup"], sourceItemId: "source-ev-dup", fingerprint: "fp-1" },
    ],
    findings: [],
    inferences: [],
    analyses: [{ analysisId: "analysis-1", traceabilityIds: ["trace-analysis-1"], sourceItemId: "source-analysis-1" }],
    conclusions: [],
    osint: [
      { id: "denue-1", sourceType: "DENUE", title: "DENUE comercio", sourceUrl: "https://denue.test", traceabilityIds: ["trace-denue-1"], sourceItemId: "source-denue-1" },
      { id: "places-review-1", sourceType: "GOOGLE_PLACES_REVIEWS", title: "Resena publica no verificada", sourceUrl: "https://places.test", traceabilityIds: ["trace-places-1"], limitations: ["contexto no verificado"] },
      { id: "vision-ocr-1", sourceType: "GOOGLE_VISION_OCR", title: "Texto OCR", sourceUrl: "asset://vision", traceabilityIds: ["trace-vision-1"], limitations: ["OCR no constituye verdad semantica"] },
      { id: "osint-untraced", sourceType: "OSINT", title: "Sin trazabilidad" },
    ],
    streetView: [
      { id: "sv-1", sourceType: "GOOGLE_STREET_VIEW", imageUrl: "asset://sv-1", coordinates: { lat: 22.1, lng: -101.9 }, heading: 90, pitch: 0, capturedAt: "2026-09-01", traceabilityIds: ["trace-sv-1"], sourceItemId: "source-sv-1" },
    ],
    temporalComparisons: [{ comparisonId: "tc-1", sourceType: "TEMPORAL_COMPARISON", title: "Comparacion temporal", traceabilityIds: ["trace-tc-1"], sourceItemId: "source-tc-1" }],
    specializedIntelligence: [{ id: "route-1", sourceType: "GOOGLE_ROUTES_ELEVATION", title: "Ruta y elevacion", traceabilityIds: ["trace-route-1"], sourceItemId: "source-route-1" }],
    predictiveAnalyticalProducts: [{ productId: "pap-1", traceabilityIds: ["trace-pap-1"], validUntil: "2026-12-31" }],
    predictiveAnalyticalNarrative: "",
    visualProducts: [],
    exclusions: [],
    disclosures: [],
    lineageSummary: { geographyId: geo?.geographyId ?? null, sourceIds: ["source-1"], evidenceIds: ["ev-1"], findingIds: [], analysisIds: ["analysis-1"], conclusionIds: [], itemCount: 4 },
    traceabilityGate: {} as any,
    publicationEligibility: "ELIGIBLE",
    draft: false,
    certified: false,
    published: false,
    hypothesisHistory: [{ summary: "Revision humana de hipotesis", status: "VALIDADO", traceabilityIds: ["trace-hyp-1"] }],
    ...overrides,
  };
}

function executiveModel(inputValue = input(), overrides: any = {}) {
  return {
    identity: {
      numeroExpediente: "06092026-0007-JMG",
      nombreExpediente: "Expediente Centro",
      fecha: generatedAt,
      personaPerfiladora: "Analista",
      geografia: "INDIVIDUAL / GEOGRAFIA VALIDADA",
      clasificacion: "CONFIDENCIAL - USO INSTITUCIONAL",
      technicalMetadata: { projectId: inputValue.projectId, geographyId: inputValue.geography?.geographyId, source: "InstitutionalReportInput" },
    },
    panorama: {} as any,
    territorialSituation: {
      canonicalGeography: inputValue.geography,
      territorialSummary: "Unidad territorial validada",
      principalMapCandidate: null,
      territorialFindings: [],
      relevantPoi: [],
      spatialLimitations: [],
    },
    findings: [{ findingId: "finding-1", title: "Hallazgo Ejecutivo 1", summary: "Resumen", traceabilityIds: ["trace-finding-1"], technicalMetadata: { sourceFindingIds: ["finding-1"], sourceEvidenceIds: ["ev-1"], sourceAnalysisIds: ["analysis-1"] } }],
    keyEvidence: [{ evidenceId: "ev-1", title: "Foto in situ", summary: "Seleccionada", visualReference: "asset://photo-1", evidenceReferences: ["ev-1"], sourceTypes: ["FIELD_PHOTO"], relatedFindingIds: ["finding-1"], selectionReason: "Soporte", limitations: [], traceabilityIds: ["trace-ev-1"], technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "source-ev-1" } }],
    multisourceAnalysis: {
      convergencias: ["Relacion aceptada"],
      contradicciones: ["Contradiccion aceptada"],
      fuentesIndependientes: ["DENUE"],
      dependenciasParciales: ["Dependencia registrada"],
      brechasInformacion: ["Brecha registrada"],
      nivelSoporte: "ALTO",
      traceabilityIds: ["trace-analysis-1"],
      technicalMetadata: { sourceAnalysisIds: ["analysis-1"], sourceEvidenceIds: ["ev-1"] },
    },
    prospectiveAnalysis: {
      tendencia: "PERSISTENCIA",
      escenario: "Escenario gobernado",
      factoresSoporte: ["factor"],
      factoresContradiccion: [],
      nivelConfianza: "ALTO",
      incertidumbre: "MODERADA",
      vigencia: "2026-12-31",
      limitaciones: ["limitacion"],
      relacionHipotesis: "SOPORTA",
      traceabilityIds: ["trace-pap-1"],
      excludedProducts: [],
      technicalMetadata: { sourceProductIds: ["pap-1"] },
    },
    decisionImplications: [],
    visualCandidates: [],
    technicalAnnex: { available: true, references: [] },
    selectionAudit: { exclusions: [], executiveExclusions: [], limits: {} },
    presentation: { labels: {}, visibleText: ["Informe ejecutivo intacto"] },
    technicalMetadata: { modelName: "ExecutiveGeointReportModel", modelVersion: "1.0", sourceProjectId: inputValue.projectId, generatedAt, source: "InstitutionalReportInput" },
    ...overrides,
  };
}

function visualComposition(overrides: any = {}) {
  return {
    principalTerritorialMap: {
      mapId: "principal-territorial-map",
      status: "READY_FROM_GOVERNED_VISUAL",
      executiveHeadline: "Mapa",
      caption: "Mapa gobernado",
      renderInstruction: "USE_GOVERNED_VISUAL",
      visualReference: "asset://map-1",
      presentation: { title: "Mapa", visibleSourceLabel: "MAPA TERRITORIAL PRINCIPAL" },
      technicalMetadata: { geographyId: "geo-1", geometry: null, geographyType: "POINT", center: null, traceabilityIds: ["trace-map-1"], relatedFindingIds: [], relatedEvidenceIds: ["ev-1"], sourceItemId: "source-map-1" },
    },
    secondaryVisuals: [],
    visualBudget: { minimumFunctional: 1, maximumOrdinary: 5, used: 1, secondaryMaximum: 4, filledArtificially: false },
    selectionAudit: { selectedIds: ["principal-territorial-map"], excludedItems: [], reasonCodes: [], visualBudgetUsed: 1, visualBudgetMaximum: 5, territorialMapStatus: "READY_FROM_GOVERNED_VISUAL" },
    technicalMetadata: { source: "ExecutiveGeointReportModel+InstitutionalReportInput", deterministic: true, rendersFinalAssets: false, externalCalls: false },
    ...overrides,
  };
}

function documentModel(overrides: any = {}) {
  return {
    identity: { numeroExpediente: "06092026-0007-JMG", clasificacion: "CONFIDENCIAL - USO INSTITUCIONAL", fechaEmision: "2026-09-06" },
    sections: [{ sectionId: "cover", order: 1, title: "PORTADA", role: "Identidad", content: ["INFORME EJECUTIVO GEOINT"], densityPolicy: { targetPages: "1" }, status: "READY" }],
    visualPlacements: [{ visualId: "principal-territorial-map", sectionId: "territorial-situation", placementRole: "PRINCIPAL_TERRITORIAL_MAP", headline: "Mapa", caption: "Mapa gobernado" }],
    annexReferences: [],
    paginationPolicy: { targetPageRange: "7-9", ordinaryMaximumPages: 10, guidance: {}, note: "" },
    presentation: { documentTitle: "INFORME EJECUTIVO GEOINT", visibleText: ["INFORME EJECUTIVO GEOINT"], headerFooterPolicy: { preserveExistingInstitutionalHeaderFooter: true, onlyFeedNumeroExpediente: true } },
    technicalMetadata: { modelName: "ExecutiveGeointReportDocumentModel", modelVersion: "1.0.0", source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition", deterministic: true, externalCalls: false, modifiesHeaderFooter: false, rendersWord: false, sourceProjectId: "project-technical-id", traceabilityIds: [], evidenceReferences: [], sectionCount: 1, visualPlacementCount: 1 },
    ...overrides,
  };
}

function annex(inputValue = input(), executiveOverrides: any = {}, visualOverrides: any = {}, documentOverrides: any = {}) {
  const exec = executiveModel(inputValue, executiveOverrides);
  return buildExecutiveGeointTechnicalAnnexModel(inputValue as any, exec as any, visualComposition(visualOverrides) as any, documentModel(documentOverrides) as any, { nombreExpediente: "Expediente Centro" });
}

describe("Fase F - ExecutiveGeointTechnicalAnnex", () => {
  test("1 construye annex model desde input gobernado", () => {
    expect(annex().technicalMetadata.modelName).toBe("ExecutiveGeointTechnicalAnnexModel");
  });

  test("2 numeroExpediente preservado", () => {
    expect(annex().identity.numeroExpediente).toBe("06092026-0007-JMG");
  });

  test("3 mismo projectId no se muestra como numeroExpediente", () => {
    const model = annex();
    expect(model.identity.projectId).toBe("project-technical-id");
    expect(model.identity.numeroExpediente).not.toBe("project-technical-id");
  });

  test("4 canonicalGeography preferida", () => {
    expect(annex().sections.find((s) => s.sectionId === "canonical-geography")?.content.join(" ")).toContain("INDIVIDUAL");
  });

  test("5 no fabrica geometria", () => {
    expect(annex().governance.geometryGenerated).toBe(false);
  });

  test("6 inventario solo contiene evidencia real", () => {
    const records = annex().sections.find((s) => s.sectionId === "evidence-inventory")?.records || [];
    expect(records.length).toBeGreaterThan(0);
    expect(records.map((record) => record.recordId)).not.toContain("placeholder");
  });

  test("7 Street View mantiene coordenadas", () => {
    const record = annex().sections.find((s) => s.sectionId === "street-view")?.records[0];
    expect(record?.coordinates).toEqual({ lat: 22.1, lng: -101.9 });
    expect(record?.heading).toBe(90);
  });

  test("8 OSINT no trazable queda excluido", () => {
    const records = annex().sections.find((s) => s.sectionId === "osint")?.records || [];
    expect(records.map((record) => record.recordId)).not.toContain("osint-untraced");
  });

  test("9 DENUE puede aparecer como fuente territorial", () => {
    const records = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records || [];
    expect(records.some((record) => record.sourceType.includes("DENUE"))).toBe(true);
  });

  test("10 Places Reviews permanecen contexto no verificado", () => {
    const record = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records.find((item) => item.recordId === "places-review-1");
    expect(record?.limitations.join(" ")).toMatch(/contexto no verificado/i);
  });

  test("11 Vision OCR no se convierte en verdad semantica", () => {
    const record = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records.find((item) => item.recordId === "vision-ocr-1");
    expect(record?.limitations.join(" ")).toMatch(/OCR no constituye verdad semantica/i);
  });

  test("12 correlation lineage preservada", () => {
    expect(annex().technicalMetadata.traceabilityIds).toContain("trace-analysis-1");
  });

  test("13 prospectiva solo gobernada", () => {
    expect(annex().sections.find((s) => s.sectionId === "prospective-products")?.status).toBe("READY");
    expect(annex(input(), { prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, technicalMetadata: { sourceProductIds: [] } } }).sections.find((s) => s.sectionId === "prospective-products")?.status).toBe("PARTIAL");
  });

  test("14 hipotesis historica preservada cuando existe", () => {
    expect(annex().sections.find((s) => s.sectionId === "hypothesis-history")?.content.join(" ")).toContain("Revision humana de hipotesis");
  });

  test("15 IDs tecnicos permitidos solo en seccion tecnica", () => {
    const model = annex();
    const technical = model.sections.find((s) => s.sectionId === "technical-traceability");
    const nonTechnical = model.sections.filter((s) => s.sectionId !== "technical-traceability").flatMap((s) => s.content).join(" ");
    expect(technical?.content.join(" ")).toContain("projectId");
    expect(nonTechnical).not.toContain("projectId:");
  });

  test("16 no se duplican imagenes por fingerprint cuando es detectable", () => {
    const records = annex().sections.find((s) => s.sectionId === "evidence-inventory")?.records || [];
    expect(records.filter((record) => record.visualReference === "asset://photo-1")).toHaveLength(1);
  });

  test("17 anexo no muta input", () => {
    const inputValue = input();
    const before = JSON.stringify(inputValue);
    annex(inputValue);
    expect(JSON.stringify(inputValue)).toBe(before);
  });

  test("18 no hace llamadas IA", () => {
    expect(source("src/utils/executiveGeointTechnicalAnnexModel.ts")).not.toMatch(/generateContent|openai|gemini|chatCompletion|responses/i);
  });

  test("19 no realiza llamadas externas analiticas", () => {
    expect(annex().governance.externalAnalyticalCalls).toBe(false);
    expect(source("src/utils/executiveGeointTechnicalAnnexModel.ts")).not.toContain("fetch(");
  });

  test("20 expediente legacy produce salida parcial y no crash", () => {
    expect(() => annex(input({ geography: null, evidence: [], osint: [], streetView: [], specializedIntelligence: [], temporalComparisons: [] }))).not.toThrow();
    expect(annex(input({ geography: null, evidence: [], osint: [], streetView: [], specializedIntelligence: [], temporalComparisons: [] })).sections.some((s) => s.status === "PARTIAL")).toBe(true);
  });

  test("21 HeaderFooterManager se reutiliza", () => {
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(annex());
    expect(rendered.renderAudit.headerFooterManagerReused).toBe(true);
    expect(source("src/utils/executiveGeointTechnicalAnnexWordRenderer.ts")).toContain("HeaderFooterManager.createDefaultHeader");
  });

  test("22 filename usa numeroExpediente", () => {
    expect(renderExecutiveGeointTechnicalAnnexWordDocument(annex()).filename).toContain("06092026-0007-JMG");
  });

  test("23 Incidencia no participa", () => {
    const text = `${source("src/utils/executiveGeointTechnicalAnnexModel.ts")}\n${source("src/utils/executiveGeointTechnicalAnnexWordRenderer.ts")}`;
    expect(text).not.toMatch(/incidencia|crimeIncidence|incidence/i);
  });

  test("24 no existe segundo ReportEngine", () => {
    const text = `${source("src/utils/executiveGeointTechnicalAnnexModel.ts")}\n${source("src/utils/executiveGeointTechnicalAnnexWordRenderer.ts")}`;
    expect(text).not.toMatch(/class .*ReportEngine|new .*ReportEngine|ReportEngine\(/);
  });

  test("25 informe ejecutivo no cambia de contenido", () => {
    const doc = documentModel();
    const before = JSON.stringify(doc.presentation.visibleText);
    annex(input(), {}, {}, doc);
    expect(JSON.stringify(doc.presentation.visibleText)).toBe(before);
  });
});
