import fs from "node:fs";
import path from "node:path";
import type { ReportReadyAssessment } from "../src/utils/reportReadyGovernance";
import {
  buildInstitutionalProductExportOptions,
  buildInstitutionalProductExportPayload,
  buildInstitutionalProductsViewModel,
  collectInstitutionalReadinessMessages,
  resolveInstitutionalNumeroExpediente,
  translateInstitutionalReadinessStatus,
} from "../src/utils/institutionalProductsUi";

const root = process.cwd();

function source(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function reason(code: string) {
  return { code, message: code, domain: "LINEAGE" as const };
}

function assessment(overrides: Partial<ReportReadyAssessment> = {}): ReportReadyAssessment {
  return {
    projectId: "exp-ui",
    status: "NOT_READY",
    assessedAt: "2026-09-07T00:00:00.000Z",
    geographyReady: false,
    hypothesisReady: false,
    evidenceReady: false,
    findingsReady: true,
    analysisReady: false,
    lineageReady: false,
    humanValidationReady: false,
    forensicIntegrityReady: true,
    sourceIntegrityReady: true,
    blockingReasons: [],
    warnings: [],
    unresolvedItems: [],
    readyForInstitutionalReport: false,
    certified: false,
    published: false,
    ...overrides,
  };
}

function readyAssessment(overrides: Partial<ReportReadyAssessment> = {}): ReportReadyAssessment {
  return assessment({
    status: "REPORT_READY",
    geographyReady: true,
    hypothesisReady: true,
    evidenceReady: true,
    analysisReady: true,
    lineageReady: true,
    humanValidationReady: true,
    readyForInstitutionalReport: true,
    ...overrides,
  });
}

describe("QA-02 / QA-06 / QA-07 - UI productos institucionales", () => {
  test("1 estado NOT_READY traducido al español institucional", () => {
    expect(translateInstitutionalReadinessStatus("NOT_READY")).toBe("EXPEDIENTE NO HABILITADO PARA INFORME INSTITUCIONAL");
  });

  test("2 READY_WITH_WARNINGS traducido", () => {
    expect(translateInstitutionalReadinessStatus("READY_WITH_WARNINGS")).toBe("EXPEDIENTE HABILITADO CON OBSERVACIONES");
  });

  test("3 REPORT_READY traducido", () => {
    expect(translateInstitutionalReadinessStatus("REPORT_READY")).toBe("EXPEDIENTE HABILITADO PARA INFORME INSTITUCIONAL");
  });

  test("4 blockingReasons y unresolvedItems se combinan", () => {
    expect(collectInstitutionalReadinessMessages({
      blockingReasons: [reason("GEOGRAPHY_INVALID_OR_MISSING")],
      unresolvedItems: [reason("MANDATORY_HUMAN_REVIEW_PENDING")],
    })).toEqual([
      "Validar y confirmar la geografía territorial del expediente.",
      "Completar la revisión humana obligatoria.",
    ]);
  });

  test("5 arreglo vacio no oculta unresolvedItems", () => {
    expect(collectInstitutionalReadinessMessages({
      blockingReasons: [],
      unresolvedItems: [reason("REPORT_LINEAGE_UNRESOLVED")],
    })).toEqual(["Resolver la trazabilidad de los elementos utilizados en el informe."]);
  });

  test("6 codigos duplicados no duplican mensajes", () => {
    expect(collectInstitutionalReadinessMessages({
      blockingReasons: [reason("TRACEABILITY_GATE_REQUIRED")],
      unresolvedItems: [reason("TRACEABILITY_GATE_REQUIRED")],
    })).toEqual(["Resolver la trazabilidad institucional antes de emitir el informe."]);
  });

  test("7 boton Informe Ejecutivo deshabilitado si no ready", () => {
    const model = buildInstitutionalProductsViewModel(assessment(), "06092026-0007-JMG");
    expect(model.actions.executiveReport.disabled).toBe(true);
  });

  test("8 boton Anexo Tecnico deshabilitado si no ready", () => {
    const model = buildInstitutionalProductsViewModel(assessment(), "06092026-0007-JMG");
    expect(model.actions.technicalAnnex.disabled).toBe(true);
  });

  test("9 Informe Ejecutivo habilitado si readyForInstitutionalReport true", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { numeroExpediente: "06092026-0007-JMG" });
    expect(model.actions.executiveReport.disabled).toBe(false);
  });

  test("10 Anexo Tecnico habilitado si readyForInstitutionalReport true", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { numeroExpediente: "06092026-0007-JMG" });
    expect(model.actions.technicalAnnex.disabled).toBe(false);
  });

  test("11 Informe Ejecutivo llama reportKind EXECUTIVE_GEOINT", () => {
    expect(buildInstitutionalProductExportOptions("EXECUTIVE_GEOINT").reportKind).toBe("EXECUTIVE_GEOINT");
  });

  test("12 Anexo llama EXECUTIVE_GEOINT_TECHNICAL_ANNEX", () => {
    expect(buildInstitutionalProductExportOptions("EXECUTIVE_GEOINT_TECHNICAL_ANNEX").reportKind).toBe("EXECUTIVE_GEOINT_TECHNICAL_ANNEX");
  });

  test("13 exportMode institucional correcto", () => {
    expect(buildInstitutionalProductExportOptions("EXECUTIVE_GEOINT").exportMode).toBe("INSTITUTIONAL");
  });

  test("14 flujo ejecutivo no llama confirmAndGenerateProfile", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    const handler = photoAlbum.slice(photoAlbum.indexOf("const handleInstitutionalProductExport"), photoAlbum.indexOf("}, [institutionalProducts"));
    expect(handler).not.toContain("confirmAndGenerateProfile");
  });

  test("15 flujo ejecutivo no dispara 11 capitulos", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    const handler = photoAlbum.slice(photoAlbum.indexOf("const handleInstitutionalProductExport"), photoAlbum.indexOf("}, [institutionalProducts"));
    expect(handler).not.toContain("generationChapter");
    expect(handler).not.toContain("KernelGuard");
    expect(handler).not.toContain("handleFinalizeAndExport");
  });

  test("16 flujo legacy permanece disponible", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    expect(photoAlbum).toContain("const handleFinalizeAndExport");
    expect(photoAlbum).toContain('payload: { format, activeId, exportMode: "DRAFT" }');
    expect(photoAlbum).toContain("Producto Histórico / Dictamen Legacy DRAFT");
  });

  test("17 no raw enums visibles en view model", () => {
    const model = buildInstitutionalProductsViewModel(assessment({
      blockingReasons: [reason("GEOGRAPHY_INVALID_OR_MISSING")],
      unresolvedItems: [reason("MANDATORY_HUMAN_REVIEW_PENDING")],
    }), "06092026-0007-JMG");
    const visibleText = [model.statusLabel, ...model.pendingMessages, ...model.readinessChecks.map((item) => item.label)].join(" ");
    expect(visibleText).not.toMatch(/GEOGRAPHY_INVALID_OR_MISSING|MANDATORY_HUMAN_REVIEW_PENDING|NOT_READY|READY_WITH_WARNINGS|REPORT_READY|SOURCE_FACT|ANALYTICAL_PROJECTION|PENDING|APPROVED|STALE|Gate|Payload|Report Engine|ADR/);
  });

  test("18 numeroExpediente visible correcto", () => {
    const model = buildInstitutionalProductsViewModel(assessment(), "06092026-0007-JMG");
    expect(model.numeroExpediente).toBe("06092026-0007-JMG");
  });

  test("19 bloqueadores accionables visibles completos", () => {
    const model = buildInstitutionalProductsViewModel(assessment({
      blockingReasons: [reason("GEOGRAPHY_INVALID_OR_MISSING"), reason("VALID_EVIDENCE_MISSING")],
      unresolvedItems: [reason("SUPPORTED_ANALYSIS_MISSING"), reason("MANDATORY_HUMAN_REVIEW_PENDING")],
    }), "06092026-0007-JMG");
    expect(model.pendingMessages).toHaveLength(4);
    expect(model.pendingMessages).toContain("Validar y confirmar la geografía territorial del expediente.");
    expect(model.pendingMessages).toContain("Incorporar al menos una evidencia utilizable.");
    expect(model.pendingMessages).toContain("Incorporar al menos un análisis soportado y revisado.");
    expect(model.pendingMessages).toContain("Completar la revisión humana obligatoria.");
  });

  test("20 Incidencia no forma parte del wiring de productos institucionales", () => {
    const helper = source("src/utils/institutionalProductsUi.ts");
    expect(helper).not.toMatch(/incidencia|incidence|street-candidates|street-query/i);
  });

  test("21 numeroExpediente real habilita identidad institucional", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { numeroExpediente: "06092026-0007-JMG" });
    expect(resolveInstitutionalNumeroExpediente({ numeroExpediente: "06092026-0007-JMG" })).toBe("06092026-0007-JMG");
    expect(model.hasInstitutionalIdentity).toBe(true);
    expect(model.readinessChecks.find((item) => item.label === "Identidad institucional")?.complete).toBe(true);
  });

  test("22 numeroExpediente ausente marca identidad incompleta", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), {});
    expect(model.hasInstitutionalIdentity).toBe(false);
    expect(model.readinessChecks.find((item) => item.label === "Identidad institucional")?.complete).toBe(false);
    expect(model.pendingMessages).toContain("El expediente no cuenta con número institucional asignado.");
  });

  test("23 ceipolId presente sin numeroExpediente NO satisface identidad", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { ceipolId: "CEIPOL-LEGACY-1" } as any);
    expect(model.hasInstitutionalIdentity).toBe(false);
    expect(model.numeroExpediente).toBe("Identidad institucional pendiente");
  });

  test("24 projectId presente sin numeroExpediente NO satisface identidad", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { projectId: "project-uuid-1" } as any);
    expect(model.hasInstitutionalIdentity).toBe(false);
  });

  test("25 NO ASIGNADO NO satisface identidad", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { numeroExpediente: "NO ASIGNADO" });
    expect(model.hasInstitutionalIdentity).toBe(false);
    expect(resolveInstitutionalNumeroExpediente({ numeroExpediente: "NO ASIGNADO" })).toBeNull();
  });

  test("26 botones institucionales permanecen deshabilitados si falta numeroExpediente aunque readiness sea true", () => {
    const model = buildInstitutionalProductsViewModel(readyAssessment(), { ceipolId: "CEIPOL-LEGACY-1" } as any);
    expect(model.readyForInstitutionalReport).toBe(false);
    expect(model.actions.executiveReport.disabled).toBe(true);
    expect(model.actions.technicalAnnex.disabled).toBe(true);
  });

  test("27 payload institucional usa project.numeroExpediente real", () => {
    const payload = buildInstitutionalProductExportPayload(
      { id: "project-id", ceipolId: "CEIPOL-LEGACY-1", numeroExpediente: "06092026-0007-JMG" },
      { reportReadyAssessment: readyAssessment() }
    );
    expect(payload.numeroExpediente).toBe("06092026-0007-JMG");
  });

  test("28 payload institucional no usa ceipolId como numeroExpediente", () => {
    expect(() => buildInstitutionalProductExportPayload(
      { id: "project-id", ceipolId: "CEIPOL-LEGACY-1" },
      { reportReadyAssessment: readyAssessment() }
    )).toThrow("INSTITUTIONAL_NUMERO_EXPEDIENTE_REQUIRED");
  });

  test("29 flujo legacy conserva resolveVisibleNumeroExpediente donde actualmente sea necesario", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    expect(photoAlbum).toContain("resolveVisibleNumeroExpediente(project)");
    expect(photoAlbum).toContain("resolveVisibleNumeroExpediente(h.editorialPayload || h)");
    expect(photoAlbum).toContain('{ exportMode: "DRAFT" }');
  });

  test("30 Producto Historico permanece disponible", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    expect(photoAlbum).toContain("Producto Histórico / Dictamen Legacy DRAFT");
    expect(photoAlbum).toContain("Editar Dictamen");
    expect(photoAlbum).toContain("Ver Dictamen Actual");
  });

  test("31 CTA legacy queda rotulado como historico y separado del producto ejecutivo", () => {
    const photoAlbum = source("src/components/PhotoAlbum.tsx");
    const helper = source("src/utils/institutionalProductsUi.ts");
    const handler = photoAlbum.slice(photoAlbum.indexOf("const handleInstitutionalProductExport"), photoAlbum.indexOf("}, [institutionalProducts"));
    const canonicalCta = photoAlbum.slice(photoAlbum.indexOf("const [showLegacyReportTools"), photoAlbum.indexOf("<DynamicPopup"));

    expect(helper).toContain("Generar Informe Ejecutivo GEOINT");
    expect(helper).toContain('reportKind: "EXECUTIVE_GEOINT"');
    expect(photoAlbum).toContain("const [showLegacyReportTools, setShowLegacyReportTools] = useState(false)");
    expect(canonicalCta).toContain("Productos Institucionales");
    expect(canonicalCta).toContain("handleInstitutionalProductExport(institutionalProducts.actions.executiveReport.reportKind)");
    expect(canonicalCta).toContain("handleInstitutionalProductExport(institutionalProducts.actions.technicalAnnex.reportKind)");
    expect(canonicalCta).toContain("Mostrar herramientas históricas");
    expect(canonicalCta).toContain("showLegacyReportTools &&");
    expect(photoAlbum).toContain("Regenerar Dictamen Histórico Legacy");
    expect(photoAlbum).toContain("Histórico / Compatibilidad");
    expect(photoAlbum).toContain("PROCESAMIENTO LEGACY DE DICTAMEN HISTÓRICO - GEOINT v8.0");
    expect(photoAlbum).not.toContain("Regenerar / Actualizar Informe Oficial");
    expect(handler).toContain("[REPORT PRODUCT]");
    expect(handler).not.toContain("confirmAndGenerateProfile");
    expect(handler).not.toContain("/api/generate-profile");
    expect(photoAlbum).toContain('[REPORT PRODUCT] LEGACY_DICTAMEN');
  });
});
