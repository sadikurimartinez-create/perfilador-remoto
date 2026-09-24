import { readFileSync } from "fs";
import { join } from "path";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveGeointTechnicalAnnexModel } from "../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveVisualComposition } from "../src/utils/executiveVisualComposition";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";

const root = process.cwd();
const generatedAt = "2026-09-06T12:00:00.000Z";

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

async function packageXml(document: any) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  const read = async (path: string) => zip.file(path)?.async("string") || "";
  const names = Object.keys(zip.files);
  return {
    document: await read("word/document.xml"),
    headers: await Promise.all(names.filter((name) => /^word\/header\d+\.xml$/.test(name)).map(read)),
    footers: await Promise.all(names.filter((name) => /^word\/footer\d+\.xml$/.test(name)).map(read)),
    media: names.filter((name) => /^word\/media\//.test(name)),
  };
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
      { id: "denue-1", sourceType: "DENUE", title: "DENUE comercio", sourceUrl: "https://denue.test", traceabilityIds: ["trace-denue-1"], sourceItemId: "source-denue-1",
        epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false, semanticRole: "SOURCE_FACT" } },
      { id: "places-review-1", sourceType: "GOOGLE_PLACES_REVIEWS", title: "Resena publica no verificada", sourceUrl: "https://places.test", traceabilityIds: ["trace-places-1"], limitations: ["contexto no verificado"] },
      { id: "vision-ocr-1", sourceType: "GOOGLE_VISION_OCR", title: "Texto OCR", sourceUrl: "asset://vision", traceabilityIds: ["trace-vision-1"], limitations: ["OCR no constituye verdad semantica"] },
      { id: "osint-untraced", sourceType: "OSINT", title: "Sin trazabilidad" },
    ],
    denuePois: [{ id: "poi-1", source: "DENUE", provider: "INEGI_DENUE", territorialStatus: "INSTITUTIONAL",
      name: "Comercio observado", activityCode: "A1", category: "Comercio", distanceMeters: 120,
      traceabilityId: "trace-poi-1", epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false } }],
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

  test("9 DENUE estructurado aparece como fuente territorial", () => {
    const records = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records || [];
    expect(records.some((record) => record.sourceType.includes("DENUE"))).toBe(true);
  });

  test("10 Places Reviews sin adquisición observada no se promueven", () => {
    const record = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records.find((item) => item.recordId === "places-review-1");
    expect(record).toBeUndefined();
  });

  test("11 Vision OCR sin adquisición observada no se convierte en hecho", () => {
    const record = annex().sections.find((s) => s.sectionId === "territorial-sources")?.records.find((item) => item.recordId === "vision-ocr-1");
    expect(record).toBeUndefined();
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

  test("15 projectId permanece interno y no se imprime", () => {
    const model = annex();
    const technical = model.sections.find((s) => s.sectionId === "technical-traceability");
    expect(model.identity.projectId).toBe("project-technical-id");
    expect(model.sections.flatMap((s) => s.content).join(" ")).not.toContain("projectId:");
    expect(technical?.content.join(" ")).toContain("Expediente:");
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

  test("21A DOCX identifica el Anexo y diferencia portada de interiores", async () => {
    const logo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(annex(), {
      institutionalLogos: { sspe: logo, ceipol: logo },
    });
    const xml = await packageXml(rendered.document);
    const visiblePackage = [xml.document, ...xml.headers, ...xml.footers].join(" ");
    const visibleText = visiblePackage.replace(/<[^>]+>/g, " ");

    expect(xml.document).toContain("<w:titlePg/>");
    expect(xml.document).toContain('w:headerReference w:type="first"');
    expect(xml.document).toContain('w:footerReference w:type="first"');
    expect(xml.headers).toHaveLength(2);
    expect(xml.footers).toHaveLength(2);
    expect(xml.headers.some((part) => part.includes("ANEXO TÉCNICO"))).toBe(true);
    expect(xml.headers.some((part) => !part.includes("<w:t"))).toBe(true);
    expect(xml.footers.some((part) => part.includes("PAGE") && part.includes("NUMPAGES") && part.includes("06092026-0007-JMG"))).toBe(true);
    expect(xml.footers.some((part) => !part.includes("<w:t"))).toBe(true);
    expect(xml.document).toContain("SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO DE AGUASCALIENTES");
    expect(xml.document).toContain("ANEXO TÉCNICO");
    expect(xml.document).toContain("06092026-0007-JMG");
    expect(xml.document.match(/Nombre del expediente:/g)).toHaveLength(1);
    expect(xml.media.length).toBeGreaterThanOrEqual(1);
    expect(visiblePackage).not.toContain("DICTAMEN TÉCNICO DE INTELIGENCIA TERRITORIAL");
    expect(visiblePackage).not.toContain("INFORME DE GEOINTELIGENCIA PARA LA PREVENCIÓN DEL DELITO");
    expect(visibleText).not.toMatch(/project-technical-id|storagePath|gs:\/\/|https?:\/\//i);
  });

  test("22 filename usa numeroExpediente", () => {
    expect(renderExecutiveGeointTechnicalAnnexWordDocument(annex()).filename).toContain("06092026-0007-JMG");
  });

  test("23 incidencia descriptiva se proyecta y no se trata como evidencia", () => {
    const contract = { productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT", analyticalLevel: "DESCRIPTIVE",
      queryReference: { status: "EXECUTED", admission: { accepted: true } }, datasetReference: { datasetId: "c5i-911" },
      projectionReference: { metrics: { frequency: { totalRecords: 12 } } } };
    const model = annex(input({ crimeIncidenceExportContract: contract }));
    const facts = model.sections.find((s) => s.sectionId === "incidence")?.facts || [];
    expect(facts).toContainEqual({ label: "Registros", value: "12" });
    expect(facts).toContainEqual(expect.objectContaining({ label: "Naturaleza", value: expect.stringContaining("no evidencia primaria") }));
    expect(annex(input({ crimeIncidenceExportContract: { ...contract, queryReference: { status: "FAILED" } } }))
      .sections.find((s) => s.sectionId === "incidence")?.facts).toHaveLength(0);
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

  test("26 anexo comparte la referencia cartografica gobernada y puede insertar el mismo activo", () => {
    const model = annex();
    const mapId = model.executiveReportReference.principalMapId;
    expect(mapId).toBe("principal-territorial-map");
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(model, {
      visualAssetsById: { [mapId]: { data: new Uint8Array(1024), type: "png", width: 500, height: 280 } },
    });
    expect(rendered.renderAudit.renderedVisualIds).toContain(mapId);
    expect(rendered.renderAudit.missingVisualAssetIds).not.toContain(mapId);
    const renderRequired = annex(input(), {}, { principalTerritorialMap: {
      ...visualComposition().principalTerritorialMap, status: "MAP_RENDER_REQUIRED", visualReference: null,
    } });
    const mapNarrative = renderRequired.sections.find((s) => s.sectionId === "canonical-geography")?.content.join(" ") || "";
    expect(mapNarrative).toContain("representada mediante mapa territorial gobernado");
    expect(mapNarrative).not.toContain("requiere resolver");
    expect(renderExecutiveGeointTechnicalAnnexWordDocument(renderRequired, {
      visualAssetsById: { [mapId]: { data: new Uint8Array(1024), type: "png" } },
    }).renderAudit.renderedVisualIds).toContain(mapId);
  });

  test("27 SCINCE solo presenta datos observados y validos", () => {
    const scince = { status: "OBSERVED", provenance: { datasetId: "inegi-cpv-2020", referenceYear: 2020 },
      geography: { ageb: { code: "001" } }, demographics: { populationTotal: 125, housingTotal: null },
      epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false } };
    const facts = annex(input({ scinceDemographics: scince })).sections.find((s) => s.sectionId === "scince")?.facts || [];
    expect(facts).toContainEqual({ label: "Población", value: "125" });
    expect(facts).toContainEqual({ label: "Viviendas", value: "No disponible" });
    expect(annex(input({ scinceDemographics: { ...scince, status: "NO_DATA" } }))
      .sections.find((s) => s.sectionId === "scince")?.facts).toHaveLength(0);
  });

  test("28 DENUE no depende del texto OSINT y descarta fuentes ajenas", () => {
    const model = annex(input({ osint: [], denuePois: [
      ...input().denuePois,
      { ...input().denuePois[0], id: "ajeno", source: "GOOGLE", name: "No DENUE" },
    ] }));
    const records = model.sections.find((s) => s.sectionId === "denue")?.records || [];
    expect(records).toHaveLength(1);
    expect(records[0].summary).toContain("Distancia: 120 m");
    expect(records[0].title).toBe("Comercio observado");
  });

  test("29 CEFI solo promueve fuente observada adquirida y no sintesis", () => {
    const base = input().osint[0];
    const records = annex(input({ osint: [base,
      { ...base, id: "failed", epistemicIntegrity: { ...base.epistemicIntegrity, acquisitionStatus: "FAILED" } },
      { ...base, id: "synthesis", epistemicIntegrity: { ...base.epistemicIntegrity, semanticRole: "AI_SYNTHESIS" } },
      { ...base, id: "not-configured", epistemicIntegrity: { ...base.epistemicIntegrity, acquisitionStatus: "NOT_CONFIGURED" } },
    ] })).sections.find((s) => s.sectionId === "osint")?.records || [];
    expect(records.map((record) => record.recordId)).toEqual(["denue-1"]);
    expect(annex().sections.find((section) => section.sectionId === "osint")?.title).toBe("CEFI - FUENTES ABIERTAS");
  });

  test("30 GIM solo crea capitulo con certificacion ACE", () => {
    const gim = { schemaVersion: "GIM-REPORT-1.0", validatedByACE: true, validationStatus: "CERTIFIED",
      traceabilityReference: "trace-gim-1", analyticalFindings: ["Hallazgo certificado"] };
    expect(annex(input({ specializedIntelligence: [gim] })).sections.some((s) => s.sectionId === "gang-intelligence")).toBe(true);
    expect(annex(input({ specializedIntelligence: [{ ...gim, validatedByACE: false }] }))
      .sections.some((s) => s.sectionId === "gang-intelligence")).toBe(false);
    for (const validationStatus of ["DRAFT", "PENDING", "VALIDATED", "NOT_CERTIFIED", "FAILED", undefined, null]) {
      expect(annex(input({ specializedIntelligence: [{ ...gim, validationStatus }] }))
        .sections.some((s) => s.sectionId === "gang-intelligence")).toBe(false);
    }
  });

  test("31 cero Street View real conserva fotos de campo separadas", () => {
    const fake = { id: "fake", imageUrl: "asset://photo", isStreetView: true, traceabilityIds: ["trace-fake"] };
    const model = annex(input({ streetView: [fake], evidence: input().evidence }));
    expect(model.sections.find((s) => s.sectionId === "street-view")?.records).toHaveLength(0);
    expect(model.sections.find((s) => s.sectionId === "field-photographs")?.records).toHaveLength(1);
    expect(model.sections.find((s) => s.sectionId === "street-view")?.content).toContain("NO DISPONIBLE EN EL EXPEDIENTE");
    expect(annex(input({ streetView: [{ ...fake, url: "https://example.org/streetview.png" }] }))
      .sections.find((s) => s.sectionId === "street-view")?.records).toHaveLength(0);
  });

  test("32 serializacion visible no filtra secretos ni objetos de lineage", () => {
    const contaminated = "Bearer abc123 access_token=secret refresh_token=secret apiKey=secret api_key=secret client_secret=secret password=secret " +
      "DATABASE_URL=postgresql://private Authorization: Bearer hidden storagePath=projects/private projectId=internal-project " +
      "C:\\Users\\usuario\\archivo.txt /Users/usuario/private.json /home/service/private.json gs://bucket/private/file " +
      "TypeError: private failure. stack trace [object Object] https://internal.example/api/private INEGI DENUE SCINCE Google Street View";
    const model = annex(input({ evidence: [{ evidenceId: "ev-safe", title: contaminated, imageUrl: "https://host.test/photo?token=secret", traceabilityIds: ["trace-safe"],
      lineage: [{ sourceId: "source-1", nested: { secret: "never-show" } }] }] }));
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(model);
    const visible = JSON.stringify(rendered.children);
    for (const forbidden of ["abc123", "access_token", "refresh_token", "apiKey", "api_key", "client_secret", "password=",
      "DATABASE_URL", "Authorization:", "storagePath", "internal-project", "C:\\\\Users", "/Users/", "/home/", "gs://",
      "TypeError:", "stack trace", "[object Object]", "https://internal.example", "https://host.test", "never-show"]) {
      expect(visible).not.toContain(forbidden);
    }
    expect(visible).toContain("INEGI");
    expect(visible).toContain("DENUE");
    expect(visible).toContain("SCINCE");
    expect(visible).toContain("Google Street View");
  });

  test("33 renderer conserva mas de 40 referencias en el inventario sintetico", () => {
    const many = Array.from({ length: 41 }, (_, index) => ({ evidenceId: `ev-${index}`, title: `Foto ${index}`,
      traceabilityIds: [`trace-${index}`], imageUrl: `asset://photo-${index}` }));
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(annex(input({ evidence: many })));
    expect(JSON.stringify(rendered.children)).toContain("ev-40");
  });

  test("34 matriz liga hallazgo con tipo y referencia de evidencia", () => {
    const record = annex().sections.find((s) => s.sectionId === "findings-matrix")?.records[0];
    expect(record?.sourceType).toContain("FIELD_PHOTO");
    expect(record?.referenceLabel).toContain("ev-1");
    expect(record?.selectedForExecutiveBody).toBe(true);
  });

  test("35 fotos elegibles usan un activo separado de Street View", () => {
    const model = annex();
    const photo = model.sections.find((s) => s.sectionId === "field-photographs")?.records[0];
    const street = model.sections.find((s) => s.sectionId === "street-view")?.records[0];
    expect(photo?.sourceType).toBe("FIELD_PHOTO");
    expect(street?.sourceType).toBe("GOOGLE_STREET_VIEW");
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(model, { visualAssetsById: {
      [photo!.recordId]: { data: new Uint8Array(1024), type: "png" },
      [street!.recordId]: { data: new Uint8Array(1024), type: "png" },
    } });
    expect(rendered.renderAudit.renderedVisualIds).toEqual(expect.arrayContaining([photo!.recordId, street!.recordId]));
  });

  test("36 anexo con mapa y tablas empaqueta DOCX", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument(annex(), {
      visualAssetsById: { "principal-territorial-map": { data: png, type: "png", width: 500, height: 280 } },
    });
    expect((await Packer.toBuffer(rendered.document)).byteLength).toBeGreaterThan(1000);
  });

  test("37 tablas del Anexo reutilizan el renderer tabular gobernado", () => {
    const rendererSource = source("src/utils/executiveGeointTechnicalAnnexWordRenderer.ts");
    expect(rendererSource).toContain("renderStructuredTable");
    expect(rendererSource).not.toMatch(/new Table\(|new TableRow\(|new TableCell\(/);
    expect(rendererSource).toContain("compactCell");
  });

  test("38 caso adversarial conserva 24 filas sin descargar narrativa extensa en las celdas", async () => {
    const model = annex();
    const longText = "CONTENIDO_LARGO_INTEGRO_" + "evidencia trazable con observaciones y limitaciones completas ".repeat(18);
    const records = Array.from({ length: 24 }, (_, index) => ({
      recordId: `adversarial-${index + 1}`,
      title: `REGISTRO_ADVERSARIAL_${String(index + 1).padStart(2, "0")}`,
      sourceType: index % 2 === 0 ? "FUENTE_MULTIPLE_A" : "FUENTE_MULTIPLE_B",
      summary: `${longText} FILA_FINAL_${index + 1}`,
      selectedForExecutiveBody: index % 3 === 0,
      traceabilityIds: [`trace-adversarial-${index + 1}`],
      technicalIds: {},
      limitations: [`Limitacion completa ${index + 1}`],
      referenceLabel: `ref-${index + 1}`,
      traceabilityStatus: "TRAZABLE",
      reportUsage: index % 3 === 0 ? "SI" as const : "NO" as const,
    }));
    const inventory = model.sections.find((section) => section.sectionId === "evidence-inventory")!;
    inventory.records = records;

    const xml = (await packageXml(renderExecutiveGeointTechnicalAnnexWordDocument(model).document)).document;
    expect(xml).toContain("<w:tblHeader/>");
    expect(xml).toContain("<w:cantSplit/>");
    expect(xml).toContain("<w:tblW");
    expect(xml).toContain("<w:tcW");
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(xml).not.toContain(longText);
    expect(xml).not.toContain("[object Object]");
    for (const record of records) {
      expect(xml.match(new RegExp(`>${record.referenceLabel!}<`, "g"))).toHaveLength(1);
    }
    expect(xml).toContain("SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO DE AGUASCALIENTES");
    expect(xml).toContain("ANEXO TÉCNICO");
  });

  test("39 consigna fotografica se conserva como contexto y nunca se rotula como hallazgo", async () => {
    const instruction = "Se solicita al Perfilador Remoto realizar análisis del corredor y determinar factores territoriales.";
    const controlled = input({
      geography: buildCanonicalProjectGeography({
        projectId: "project-technical-id",
        type: "CORRIDOR",
        points: [{ lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.8 }],
        now: 1,
      }),
      evidence: Array.from({ length: 3 }, (_, index) => ({
        evidenceId: `controlled-photo-${index + 1}`,
        title: `Fotografía controlada ${index + 1}`,
        summary: index === 0 ? instruction : `Registro visual ${index + 1}`,
        imageUrl: `asset://controlled-${index + 1}`,
        traceabilityIds: [`trace-controlled-${index + 1}`],
        sourceItemId: `source-controlled-${index + 1}`,
      })),
      streetView: [], osint: [], denuePois: [], analyses: [], predictiveAnalyticalProducts: [],
      hypothesis: {
        initialHypothesis: instruction,
        currentHypothesis: instruction,
        versions: [{ text: instruction, authorType: "HUMAN", status: "FORMULATED", createdAt: "2026-09-23T12:00:00.000Z" }],
      } as any,
    });
    const reportModel = buildExecutiveGeointReportModel(controlled as any, {
      documentIdentity: { numeroExpediente: "08092026-0045-BRPD" },
      nombreExpediente: "Expediente BRPD",
      fecha: "2026-09-24T02:54:17.387Z",
      personaPerfiladora: "NO DISPONIBLE",
    });
    const mapSpec = buildExecutiveCanonicalTerritorialMapSpec(controlled.geography!);
    const composition = buildExecutiveVisualComposition(reportModel, controlled as any, { principalMapSpec: mapSpec });
    const reportDocumentModel = buildExecutiveGeointReportDocumentModel(reportModel, composition, controlled as any);
    const model = buildExecutiveGeointTechnicalAnnexModel(
      controlled as any,
      reportModel,
      composition,
      reportDocumentModel,
      { numeroExpediente: "08092026-0045-BRPD", nombreExpediente: "Expediente BRPD" }
    );
    const photos = model.sections.find((section) => section.sectionId === "field-photographs")?.records || [];
    expect(photos).toHaveLength(3);
    expect(photos[0]).toEqual(expect.objectContaining({
      contentRole: "INSTRUCTION",
      contextOriginal: "",
      instructionOriginal: instruction,
      narrativeSegmentationStatus: "INSTRUCTION_ONLY",
    }));
    for (const sectionId of ["scince", "denue", "incidence", "osint", "multisource-correlation"] as const) {
      expect(model.sections.find((section) => section.sectionId === sectionId)?.content).toContain("NO DISPONIBLE EN EL EXPEDIENTE");
    }
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
    const assets = Object.fromEntries([
      [composition.principalTerritorialMap.mapId, { data: png, type: "png" as const, width: 500, height: 280 }],
      ...photos.map((photo) => [photo.recordId, { data: png, type: "png" as const, width: 360, height: 220 }]),
    ]);
    const renderedReport = renderExecutiveGeointWordDocument(reportDocumentModel, { visualAssetsById: assets });
    const renderedAnnex = renderExecutiveGeointTechnicalAnnexWordDocument(model, { visualAssetsById: assets });
    const reportPackage = await packageXml(renderedReport.document);
    const annexPackage = await packageXml(renderedAnnex.document);
    expect((await Packer.toBuffer(renderedReport.document)).byteLength).toBeGreaterThan(1000);
    expect((await Packer.toBuffer(renderedAnnex.document)).byteLength).toBeGreaterThan(1000);
    expect(renderedReport.renderAudit.renderedVisualIds).toContain(composition.principalTerritorialMap.mapId);
    expect(renderedAnnex.renderAudit.renderedVisualIds).toContain(composition.principalTerritorialMap.mapId);
    expect(reportPackage.document).toContain(`Escala: ${mapSpec.cartographicScale.label}.`);
    expect(annexPackage.document).toContain(`Escala: ${mapSpec.cartographicScale.label}.`);
    expect(reportPackage.document).toContain("Hipótesis vigente: Sin modificación respecto de la hipótesis inicial.");
    expect(annexPackage.document).toContain(`Instrucción original de análisis: ${instruction}`);
    expect(annexPackage.document).not.toContain(`Hallazgo: ${instruction}`);
    expect(annexPackage.document).not.toContain(`Resultado: ${instruction}`);
    expect(annexPackage.document).not.toContain("requiere resolver el activo visual");
    expect(annexPackage.document).toContain("CEFI - FUENTES ABIERTAS");
    expect(annexPackage.document).not.toContain("CIFA / CEFI");
    expect(annexPackage.document).not.toContain(instruction.repeat(2));
  });

  test("40 solo una revision humana aprobada recibe etiqueta de sintesis analitica validada", async () => {
    const analyticalEvidence = {
      evidenceId: "analysis-photo",
      title: "Fotografía analítica",
      imageUrl: "asset://analysis-photo",
      traceabilityIds: ["trace-analysis-photo"],
      contentRole: "ANALYSIS",
      analysis: "Lectura analítica controlada.",
    };
    const unapproved = annex(input({ evidence: [analyticalEvidence] }));
    expect(unapproved.sections.find((section) => section.sectionId === "field-photographs")?.records[0].validatedAnalysis).toBe("");

    const approved = annex(input({ evidence: [{ ...analyticalEvidence, humanValidationStatus: "APPROVED" }] }));
    const xml = (await packageXml(renderExecutiveGeointTechnicalAnnexWordDocument(approved).document)).document;
    expect(xml).toContain("Síntesis analítica validada: Lectura analítica controlada.");
  });

  test("41 separa observacion e instruccion incrustada sin reinterpretar el texto", async () => {
    const observation = "La vialidad presenta iluminación y circulación peatonal observable.";
    const instruction = "BARRIDO DE INCIDENCIA DELICTIVA Se solicita al Perfilador Remoto realizar un barrido exhaustivo del sector.";
    const model = annex(input({ evidence: [{
      evidenceId: "mixed-photo",
      title: "FOTOGRAFIA_DE_CAMPO",
      sourceType: "FOTOGRAFIA_DE_CAMPO",
      comentario: `${observation} ${instruction}`,
      imageUrl: "asset://mixed-photo",
      traceabilityIds: ["trace-mixed-photo"],
      publicationEligibility: { role: "INSTITUTIONAL_FACT" },
    }] }));
    const record = model.sections.find((section) => section.sectionId === "field-photographs")?.records[0];
    expect(record).toEqual(expect.objectContaining({
      contentRole: "OBSERVATION",
      contextOriginal: observation,
      instructionOriginal: instruction,
      narrativeSegmentationStatus: "SEPARATED",
    }));
    const xml = (await packageXml(renderExecutiveGeointTechnicalAnnexWordDocument(model).document)).document;
    expect(xml).toContain(`Contexto original: ${observation}`);
    expect(xml).toContain(`Instrucción original de análisis: ${instruction}`);
    expect(xml).not.toContain(`Hallazgo: ${instruction}`);
    expect(xml).not.toContain(`Conclusión: ${instruction}`);
    expect(xml).not.toContain(`Síntesis analítica validada: ${instruction}`);
    expect(xml).toContain("Título: Fotografía de campo");
    expect(xml).toContain("Fuente: Fotografía de campo.");
  });

  test("42 normaliza labels editoriales sin renombrar identificadores internos", () => {
    const model = annex(input({
      exclusions: [{ itemType: "EVIDENCE", reason: "Fuente no admisible" }],
      disclosures: [{ itemType: "SOURCE", message: "Cobertura limitada" }],
    }));
    const geographyText = model.sections.find((section) => section.sectionId === "canonical-geography")?.content.join(" ") || "";
    const limitationsText = model.sections.find((section) => section.sectionId === "sources-limitations")?.content.join(" ") || "";
    const photo = model.sections.find((section) => section.sectionId === "field-photographs")?.records[0];
    expect(geographyText).toContain("Descripción:");
    expect(limitationsText).toContain("Declaraciones de límite: 1");
    expect(limitationsText).toContain("Exclusión EVIDENCE: Fuente no admisible");
    expect(photo?.sourceType).toBe("FIELD_PHOTO");
  });

  test("43 conserva sin reinterpretar una instruccion que no puede segmentarse automaticamente", async () => {
    const opaqueInstruction = "Revisión operativa especial conforme a la consigna recibida.";
    const model = annex(input({ evidence: [{
      evidenceId: "opaque-instruction",
      title: "Registro recibido",
      imageUrl: "asset://opaque-instruction",
      traceabilityIds: ["trace-opaque-instruction"],
      contentRole: "INSTRUCTION",
      context: opaqueInstruction,
    }] }));
    const record = model.sections.find((section) => section.sectionId === "field-photographs")?.records[0];
    expect(record).toEqual(expect.objectContaining({
      contextOriginal: opaqueInstruction,
      instructionOriginal: "",
      narrativeSegmentationStatus: "NOT_SEPARABLE",
    }));
    const xml = (await packageXml(renderExecutiveGeointTechnicalAnnexWordDocument(model).document)).document;
    expect(xml).toContain(`Contexto original: ${opaqueInstruction}`);
    expect(xml).toContain("Clasificación narrativa no separable automáticamente.");
  });
});
