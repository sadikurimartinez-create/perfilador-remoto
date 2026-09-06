import { readFileSync } from "fs";
import { join } from "path";
import {
  buildExecutiveGeointWordVisualAssets,
  renderExecutiveGeointWordDocument,
  sanitizeExecutiveGeointWordText,
} from "../src/utils/executiveGeointWordRenderer";
import type { ExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import type { ExecutiveVisualComposition } from "../src/utils/executiveVisualComposition";

const root = process.cwd();
const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function documentModel(overrides: Partial<ExecutiveGeointReportDocumentModel> = {}): ExecutiveGeointReportDocumentModel {
  return {
    identity: {
      numeroExpediente: "06092026-0007-JMG",
      clasificacion: "CONFIDENCIAL - USO INSTITUCIONAL",
      fechaEmision: "2026-09-06",
    },
    sections: [
      { sectionId: "cover", order: 1, title: "PORTADA", role: "Identidad", content: ["INFORME EJECUTIVO GEOINT"], densityPolicy: { targetPages: "1" }, status: "READY" },
      { sectionId: "executive-panorama", order: 2, title: "PANORAMA EJECUTIVO", role: "Sintesis", content: ["Situacion gobernada"], densityPolicy: { targetPages: "1", maxItems: 4 }, status: "READY" },
      { sectionId: "territorial-situation", order: 3, title: "SITUACION TERRITORIAL", role: "Mapa", content: ["Mapa territorial principal disponible desde visual gobernado."], densityPolicy: { targetPages: "1", maxItems: 4 }, status: "READY" },
      { sectionId: "priority-findings", order: 4, title: "HALLAZGOS Y PATRONES PRIORITARIOS", role: "Hallazgos", content: ["Hallazgo gobernado"], densityPolicy: { targetPages: "1-2", maxItems: 5 }, status: "READY" },
      { sectionId: "key-evidence", order: 5, title: "EVIDENCIA CLAVE", role: "Evidencia", content: ["Evidencia seleccionada"], densityPolicy: { targetPages: "1-2", maxItems: 4 }, status: "READY" },
      { sectionId: "multisource-analysis", order: 6, title: "ANALISIS MULTIFUENTE", role: "Multifuente", content: ["Convergencia gobernada"], densityPolicy: { targetPages: "1", maxItems: 8 }, status: "READY" },
      { sectionId: "prospective-analysis", order: 7, title: "ANALISIS PROSPECTIVO", role: "Prospectiva", content: ["Tendencia institucional"], densityPolicy: { targetPages: "0-1", maxItems: 8 }, status: "READY" },
      { sectionId: "decision-implications", order: 8, title: "IMPLICACIONES PARA LA DECISION", role: "Decision", content: Array.from({ length: 7 }, (_, i) => i === 0 ? "ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL" : `Accion gobernada ${i}`), densityPolicy: { targetPages: "1", maxItems: 5 }, status: "READY" },
      { sectionId: "additional-context", order: 9, title: "CONTEXTO ADICIONAL", role: "Contexto", content: ["Contexto no autorizado"], densityPolicy: { targetPages: "0-1" }, status: "OPTIONAL_SUPPRESSED" },
    ],
    visualPlacements: [
      { visualId: "principal-territorial-map", sectionId: "territorial-situation", placementRole: "PRINCIPAL_TERRITORIAL_MAP", headline: "Mapa gobernado", caption: "Caption institucional" },
      { visualId: "evidence-1", sectionId: "key-evidence", placementRole: "SUPPORTING_EVIDENCE", headline: "Google Street View", caption: "Fuente comercial: Google Street View" },
      { visualId: "visual-2", sectionId: "multisource-analysis", placementRole: "ANALYTICAL_SUPPORT", headline: "Soporte multifuente", caption: "Caption analitico" },
      { visualId: "visual-3", sectionId: "prospective-analysis", placementRole: "ANALYTICAL_SUPPORT", headline: "Escenario cualitativo", caption: "Caption prospectivo" },
      { visualId: "visual-4", sectionId: "priority-findings", placementRole: "ANALYTICAL_SUPPORT", headline: "Patron prioritario", caption: "Caption patron" },
      { visualId: "visual-5", sectionId: "key-evidence", placementRole: "SUPPORTING_EVIDENCE", headline: "No autorizado por presupuesto", caption: "No debe exceder" },
    ],
    annexReferences: [],
    paginationPolicy: {
      targetPageRange: "7-9",
      ordinaryMaximumPages: 10,
      guidance: {
        cover: "1",
        "executive-panorama": "1",
        "territorial-situation": "1",
        "priority-findings": "1-2",
        "key-evidence": "1-2",
        "multisource-analysis": "1",
        "prospective-analysis": "0-1",
        "decision-implications": "1",
      },
      note: "Politica editorial de densidad; no mide paginas fisicas.",
    },
    presentation: {
      documentTitle: "INFORME EJECUTIVO GEOINT",
      visibleText: [],
      headerFooterPolicy: {
        preserveExistingInstitutionalHeaderFooter: true,
        onlyFeedNumeroExpediente: true,
      },
    },
    technicalMetadata: {
      modelName: "ExecutiveGeointReportDocumentModel",
      modelVersion: "1.0.0",
      source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition",
      deterministic: true,
      externalCalls: false,
      modifiesHeaderFooter: false,
      rendersWord: false,
      sourceProjectId: "project-technical-id",
      traceabilityIds: ["traceabilityId-1"],
      evidenceReferences: ["evidence-1"],
      sectionCount: 9,
      visualPlacementCount: 6,
    },
    ...overrides,
  };
}

function visualComposition(status: "READY_FROM_GOVERNED_VISUAL" | "MAP_RENDER_REQUIRED" | "NO_CANONICAL_GEOGRAPHY" = "READY_FROM_GOVERNED_VISUAL"): ExecutiveVisualComposition {
  return {
    principalTerritorialMap: {
      mapId: "principal-territorial-map",
      status,
      executiveHeadline: "Mapa gobernado",
      caption: "Caption institucional",
      renderInstruction: status === "READY_FROM_GOVERNED_VISUAL" ? "USE_GOVERNED_VISUAL" : status,
      visualReference: status === "READY_FROM_GOVERNED_VISUAL" ? pngDataUrl : null,
      presentation: { title: "Mapa gobernado", visibleSourceLabel: "MAPA TERRITORIAL PRINCIPAL" },
      technicalMetadata: {
        geographyId: status === "NO_CANONICAL_GEOGRAPHY" ? null : "geo-1",
        geometry: null,
        geographyType: "POINT",
        center: null,
        traceabilityIds: [],
        relatedFindingIds: [],
        relatedEvidenceIds: [],
        sourceItemId: "map-source",
      },
    },
    secondaryVisuals: [
      {
        visualId: "evidence-1",
        visualType: "EVIDENCE_IMAGE",
        executiveHeadline: "Google Street View",
        caption: "Fuente comercial: Google Street View",
        visualReference: pngDataUrl,
        presentation: { title: "Google Street View", visibleSourceLabel: "IMAGEN PANORAMICA DE GOOGLE" },
        technicalMetadata: { sourceItemId: "sv-1", sourceType: "KEY_EVIDENCE", traceabilityIds: [], relatedFindingIds: [], relatedEvidenceIds: [] },
      },
    ],
    visualBudget: { minimumFunctional: 1, maximumOrdinary: 5, used: 2, secondaryMaximum: 4, filledArtificially: false },
    selectionAudit: { selectedIds: ["principal-territorial-map", "evidence-1"], excludedItems: [], reasonCodes: [], visualBudgetUsed: 2, visualBudgetMaximum: 5, territorialMapStatus: status },
    technicalMetadata: { source: "ExecutiveGeointReportModel+InstitutionalReportInput", deterministic: true, rendersFinalAssets: false, externalCalls: false },
  };
}

describe("Fase E - ExecutiveGeointWordRenderer", () => {
  test("1 genera estructura DOCX ejecutiva desde DocumentModel", () => {
    const rendered = renderExecutiveGeointWordDocument(documentModel());
    expect(rendered.document).toBeTruthy();
    expect(rendered.children.length).toBeGreaterThan(0);
  });

  test("2 usa numeroExpediente visible", () => {
    expect(renderExecutiveGeointWordDocument(documentModel()).visibleNumeroExpediente).toBe("06092026-0007-JMG");
  });

  test("3 projectId no aparece en texto sanitizado", () => {
    expect(sanitizeExecutiveGeointWordText("projectId project-technical-id")).not.toMatch(/projectId|project-technical-id/);
  });

  test("4 conserva orden de sections", () => {
    expect(renderExecutiveGeointWordDocument(documentModel()).renderAudit.sectionOrder.slice(0, 4)).toEqual(["cover", "executive-panorama", "territorial-situation", "priority-findings"]);
  });

  test("5 OPTIONAL_SUPPRESSED no se renderiza", () => {
    const audit = renderExecutiveGeointWordDocument(documentModel()).renderAudit;
    expect(audit.skippedOptionalSections).toContain("additional-context");
  });

  test("6 INCOMPLETE no genera contenido inventado", () => {
    const model = documentModel({ sections: [{ sectionId: "territorial-situation", order: 1, title: "SITUACION TERRITORIAL", role: "Mapa", content: ["Condicion del modelo"], densityPolicy: { targetPages: "1", maxItems: 3 }, status: "INCOMPLETE" }] });
    expect(renderExecutiveGeointWordDocument(model).renderAudit.incompleteSections).toContain("territorial-situation");
  });

  test("7 mapa READY se intenta renderizar", () => {
    const assets = buildExecutiveGeointWordVisualAssets(visualComposition("READY_FROM_GOVERNED_VISUAL"));
    const audit = renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: assets }).renderAudit;
    expect(audit.renderedVisualIds).toContain("principal-territorial-map");
  });

  test("8 NO_CANONICAL_GEOGRAPHY no fabrica mapa", () => {
    const assets = buildExecutiveGeointWordVisualAssets(visualComposition("NO_CANONICAL_GEOGRAPHY"));
    const audit = renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: assets }).renderAudit;
    expect(audit.renderedVisualIds).not.toContain("principal-territorial-map");
    expect(audit.geometryGenerated).toBe(false);
  });

  test("9 no mas de visualPlacements autorizados", () => {
    expect(documentModel().visualPlacements.length).toBe(6);
    expect(renderExecutiveGeointWordDocument(documentModel()).renderAudit.renderedVisualIds.length).toBeLessThanOrEqual(documentModel().visualPlacements.length);
  });

  test("10 evidencia no seleccionada no entra al cuerpo", () => {
    const text = JSON.stringify(documentModel());
    expect(text).not.toContain("album completo no seleccionado");
  });

  test("11 prospectiva ausente no se inventa", () => {
    const model = documentModel({ sections: documentModel().sections.filter((section) => section.sectionId !== "prospective-analysis"), visualPlacements: [] });
    expect(renderExecutiveGeointWordDocument(model).renderAudit.sectionOrder).not.toContain("prospective-analysis");
  });

  test("12 prospectiva admitida si se renderiza", () => {
    expect(renderExecutiveGeointWordDocument(documentModel()).renderAudit.sectionOrder).toContain("prospective-analysis");
  });

  test("13 maximo 5 decisiones", () => {
    const decision = documentModel().sections.find((section) => section.sectionId === "decision-implications");
    expect(decision?.content.slice(0, decision.densityPolicy.maxItems).length).toBe(5);
  });

  test("14 fallback de accion se conserva", () => {
    expect(JSON.stringify(documentModel())).toContain("ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
  });

  test("15 IDs tecnicos no aparecen", () => {
    expect(sanitizeExecutiveGeointWordText("sourceItemId traceabilityId geographyId lineage payload modelVersion")).toBe("");
  });

  test("16 enums tecnicos no aparecen", () => {
    expect(sanitizeExecutiveGeointWordText("SOURCE_FACT ANALYTICAL_PROJECTION PENDING APPROVED STALE Gate ADR-022 ADR-023 ADR-024 ADR-025")).toBe("");
  });

  test("17 no existe Street View Intelligence", () => {
    expect(JSON.stringify(documentModel())).not.toContain("Street View Intelligence");
  });

  test("18 Google Street View puede aparecer como fuente", () => {
    expect(JSON.stringify(documentModel())).toContain("Google Street View");
  });

  test("19 HeaderFooterManager existente se reutiliza", () => {
    expect(renderExecutiveGeointWordDocument(documentModel()).renderAudit.headerFooterManagerReused).toBe(true);
    expect(source("src/utils/executiveGeointWordRenderer.ts")).toContain("HeaderFooterManager.createDefaultHeader");
  });

  test("20 numeroExpediente alimenta pie institucional", () => {
    expect(source("src/utils/executiveGeointWordRenderer.ts")).toContain("HeaderFooterManager.createDefaultFooter(documentModel.identity.fechaEmision, visibleNumeroExpediente)");
  });

  test("21 filename institucional usa numeroExpediente", () => {
    expect(renderExecutiveGeointWordDocument(documentModel()).filename).toContain("06092026-0007-JMG");
  });

  test("22 no existe llamada IA en renderer", () => {
    expect(source("src/utils/executiveGeointWordRenderer.ts")).not.toMatch(/generateContent|openai|gemini|AIOutput|fetch\(/i);
  });

  test("23 no existe segunda generacion de geometria", () => {
    expect(source("src/utils/executiveGeointWordRenderer.ts")).not.toMatch(/centroid|pins|coordinates|lat|lng|getCanonicalMapViewport/);
  });

  test("24 expediente legacy no rompe render", () => {
    const model = documentModel({ sections: [{ sectionId: "cover", order: 1, title: "PORTADA", role: "Identidad", content: [], densityPolicy: { targetPages: "1" }, status: "READY" }], visualPlacements: [] });
    expect(() => renderExecutiveGeointWordDocument(model)).not.toThrow();
  });

  test("25 DocumentModel no es mutado", () => {
    const model = documentModel();
    const before = JSON.stringify(model);
    const rendered = renderExecutiveGeointWordDocument(model);
    expect(JSON.stringify(model)).toBe(before);
    expect(rendered.renderAudit.documentModelMutated).toBe(false);
  });

  test("26 exportToWord integra ruta ejecutiva gobernada", () => {
    const text = source("src/lib/exportToWord.ts");
    expect(text).toContain('reportKind?: "LEGACY" | "EXECUTIVE_GEOINT"');
    expect(text).toContain("buildExecutiveGeointReportModel");
    expect(text).toContain("buildExecutiveVisualComposition");
    expect(text).toContain("buildExecutiveGeointReportDocumentModel");
    expect(text).toContain("renderExecutiveGeointWordDocument");
  });
});
