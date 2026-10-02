import {
  AlignmentType,
  Document,
  ImageRun,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import type {
  ExecutiveGeointTechnicalAnnexModel,
  ExecutiveGeointTechnicalAnnexSection,
  TechnicalAnnexRecord,
} from "@/utils/executiveGeointTechnicalAnnexModel";
import {
  FlowControlManager,
  HeaderFooterManager,
  InstitutionalBrandManager,
  PageFormatManager,
} from "@/utils/documentCompositionEngine";
import { buildNumeroExpedienteFilename } from "@/utils/documentIdentity";
import type { ExecutiveGeointWordVisualAsset } from "@/utils/executiveGeointWordRenderer";
import { sanitizeVisibleDocumentText } from "@/utils/visibleDocumentSanitizer";
import { TECHNICAL_ANNEX_OFFICIAL_TITLE, formatInstitutionalDate } from "@/utils/institutionalDocumentIdentity";
import { renderStructuredTable } from "@/utils/documentTableRenderer";
import { assertReconciledDocumentSemanticAudit, canonicalSemanticValue } from "./institutionalDocumentSemanticIntegrity";

export interface TechnicalAnnexWordRenderResult {
  document: Document;
  children: any[];
  filename: string;
  renderAudit: {
    headerFooterManagerReused: true;
    compactComposition: true;
    externalCalls: false;
    aiCalls: false;
    secondReportEngine: false;
    modelMutated: boolean;
    renderedSectionIds: string[];
    renderedVisualIds: string[];
    missingVisualAssetIds: string[];
  };
}

function clean(value: unknown): string {
  return sanitizeVisibleDocumentText(value);
}

function para(text: string, options: { bold?: boolean; size?: number; color?: string; align?: any } = {}) {
  return new Paragraph(
    FlowControlManager.applyFlowRules({
      alignment: options.align,
      spacing: { after: 90 },
      children: [
        new TextRun({
          text: clean(text) || "NO DISPONIBLE EN EL EXPEDIENTE",
          bold: options.bold,
          size: options.size ?? 18,
          color: options.color ?? "222222",
          font: "Calibri",
        }),
      ],
    }, options.bold ? "TITLE" : "PARAGRAPH")
  );
}

function compactCell(value: unknown): string {
  return clean(value);
}

function visibleRecordLabel(value: string): string {
  if (["FOTOGRAFIA_DE_CAMPO", "FIELD_PHOTO", "FOTOGRAFIA_CAMPO"].includes(value.toUpperCase())) {
    return "Fotografía de campo";
  }
  return value.replace(/_/g, " ");
}

function renderRecords(records: TechnicalAnnexRecord[]): any[] {
  if (!records.length) return [];
  return [
    renderStructuredTable({
      headers: ["ID / REFERENCIA", "TIPO", "FUENTE", "FECHA", "TRAZABILIDAD", "ESTATUS", "INFORME"],
      rows: records.map((record) => [
        compactCell(record.referenceLabel || record.recordId),
        clean(record.contentRole || "OBSERVATION"),
        compactCell(record.sourceType),
        record.capturedAt ? formatInstitutionalDate(record.capturedAt) : "NO CONSIGNADA",
        clean(record.traceabilityStatus || "NO CONSIGNADO"),
        record.visualReference ? "DISPONIBLE" : "SIN ACTIVO VISUAL",
        clean(record.reportUsage || (record.selectedForExecutiveBody ? "SI" : "NO DETERMINADO")),
      ]),
    }, { columnWidths: [16, 12, 17, 15, 15, 13, 12] }),
  ];
}

function renderEvidenceDossier(record: TechnicalAnnexRecord): any[] {
  const children = [
    para(`FICHA DE EVIDENCIA - ${record.referenceLabel || record.recordId}`, { bold: true, size: 20, color: "0D2B52" }),
    para(`Título: ${visibleRecordLabel(record.title)}`),
    para(`Tipo: ${record.contentRole || "OBSERVATION"}. Fuente: ${visibleRecordLabel(record.sourceType)}.`),
    para(`Fecha: ${record.capturedAt ? formatInstitutionalDate(record.capturedAt) : "NO CONSIGNADA"}. Trazabilidad: ${record.traceabilityStatus || "NO CONSIGNADO"}.`),
  ];
  if (record.locationLabel) children.push(para(`Ubicación: ${record.locationLabel}.`));
  if (record.panoramaId) children.push(para(`Panorama: ${record.panoramaId}. Orientación: ${record.heading ?? "NO CONSIGNADA"}°. Inclinación: ${record.pitch ?? "NO CONSIGNADA"}°. FOV: ${record.fov ?? "NO CONSIGNADO"}°.`));
  if (record.contextOriginal) children.push(para(`Contexto original: ${record.contextOriginal}`));
  if (record.instructionOriginal) {
    children.push(para(`Instrucción original de análisis: ${record.instructionOriginal}`));
  } else if (record.narrativeSegmentationStatus === "NOT_SEPARABLE") {
    children.push(para("Clasificación narrativa no separable automáticamente."));
  }
  if (record.validatedAnalysis) {
    children.push(para(`Síntesis analítica validada: ${record.validatedAnalysis}`));
  } else if (!record.contextOriginal && !record.instructionOriginal) {
    children.push(para("Interpretación analítica: NO CONSIGNADA."));
  }
  if (record.limitations.length) children.push(para(`Limitaciones: ${record.limitations.join("; ")}`));
  return children;
}

function renderFactTable(facts: ExecutiveGeointTechnicalAnnexSection["facts"]): any[] {
  if (!facts.length) return [];
  return [renderStructuredTable({
    headers: ["CAMPO", "VALOR"],
    rows: facts.map((fact) => [clean(fact.label), clean(fact.value)]),
  }, { columnWidths: [28, 72] })];
}

function renderGovernedTables(tables: ExecutiveGeointTechnicalAnnexSection["tables"]): any[] {
  return (tables || []).map((table) => renderStructuredTable(table, {
    repeatHeader: true,
    preventRowSplit: true,
  }));
}

function renderAsset(asset: ExecutiveGeointWordVisualAsset, caption: string, map = false, visualId = ""): any[] {
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    keepNext: true,
    children: [new ImageRun({
      altText: { title: visualId, name: visualId, description: caption },
      data: asset.data,
      type: asset.type || "png",
      transformation: { width: asset.width ?? (map ? 500 : 360), height: asset.height ?? (map ? 280 : 220) },
    } as any)],
  }), para(caption, { size: 16, align: AlignmentType.CENTER })];
}

function renderSection(
  section: ExecutiveGeointTechnicalAnnexSection,
  annexModel: ExecutiveGeointTechnicalAnnexModel,
  assets: Record<string, ExecutiveGeointWordVisualAsset | null | undefined>,
  renderedVisualIds: string[],
  missingVisualAssetIds: string[]
): any[] {
  const children: any[] = [
    para(section.title, { bold: true, size: 22, color: "0D2B52" }),
    ...section.content.map((item) => para(item)),
    ...renderFactTable(section.facts),
    ...renderGovernedTables(section.tables),
    ...(section.sectionId === "field-photographs" || section.sectionId === "street-view"
      ? []
      : renderRecords(section.records)),
  ];
  if (section.sectionId === "canonical-geography") {
    const id = annexModel.executiveReportReference.principalMapId;
    if (assets[id]?.data?.byteLength) {
      const scaleLabel = annexModel.executiveReportReference.principalMapScaleLabel;
      const caption = scaleLabel
        ? `Mapa territorial principal del expediente. Escala: ${scaleLabel}.`
        : "Mapa territorial principal del expediente.";
      children.push(...renderAsset(assets[id]!, caption, true, id));
      renderedVisualIds.push(id);
    } else {
      children.push(para("Activo cartografico no resuelto para este anexo."));
      missingVisualAssetIds.push(id);
    }
  }
  if (section.sectionId === "field-photographs" || section.sectionId === "street-view") {
    for (const record of section.records) {
      const asset = assets[record.recordId];
      if (!asset?.data?.byteLength) {
        children.push(...renderEvidenceDossier(annexModel.technicalMetadata.semanticIntegrity?.enforced
          ? { ...record, title: "Registro visual", contextOriginal: "", instructionOriginal: record.instructionOriginal, validatedAnalysis: "" }
          : record));
        children.push(para("Activo visual no disponible para publicación; la ficha conserva únicamente su contexto y trazabilidad."));
        if (record.visualReference) missingVisualAssetIds.push(record.recordId);
        continue;
      }
      children.push(...renderEvidenceDossier(record));
      children.push(...renderAsset(asset, `${visibleRecordLabel(record.title)}. Fuente: ${visibleRecordLabel(record.sourceType)}. Referencia: ${record.referenceLabel || record.recordId}.`, false, record.recordId));
      renderedVisualIds.push(record.recordId);
    }
  }
  return children;
}

export function renderExecutiveGeointTechnicalAnnexWordDocument(
  annexModel: ExecutiveGeointTechnicalAnnexModel,
  options: {
    exportMode?: "INSTITUTIONAL" | "DRAFT";
    projectName?: string;
    visualAssetsById?: Record<string, ExecutiveGeointWordVisualAsset | null | undefined>;
    institutionalLogos?: { sspe?: ArrayBuffer | Uint8Array | null; ceipol?: ArrayBuffer | Uint8Array | null };
  } = {}
): TechnicalAnnexWordRenderResult {
  if (options.exportMode !== "DRAFT") {
    assertReconciledDocumentSemanticAudit(annexModel.technicalMetadata.semanticIntegrity);
    if (annexModel.technicalMetadata.reservedSections !== canonicalSemanticValue(annexModel.sections)) throw new Error("P5_BLOCKED:ANNEX_CONTENT_CHANGED");
  }
  const snapshot = JSON.stringify(annexModel);
  FlowControlManager.reset();
  const renderedVisualIds: string[] = [];
  const missingVisualAssetIds: string[] = [];
  const bodySections = annexModel.sections.filter((section) => section.sectionId !== "identity");
  const children = [
    ...(options.exportMode === "DRAFT" ? [para("BORRADOR — NO ES PAQUETE INSTITUCIONAL")] : []),
    ...InstitutionalBrandManager.createCoverIdentity(TECHNICAL_ANNEX_OFFICIAL_TITLE, options.institutionalLogos),
    para(`Número de expediente: ${annexModel.identity.numeroExpediente}`, { bold: true, align: AlignmentType.CENTER }),
    para(`Nombre del expediente: ${annexModel.identity.nombreExpediente}`, { align: AlignmentType.CENTER }),
    para(`Clasificación: ${annexModel.identity.clasificacion}`, { align: AlignmentType.CENTER }),
    para(`Fecha de emisión: ${formatInstitutionalDate(annexModel.identity.fecha)}`, { align: AlignmentType.CENTER }),
    para("Soporte técnico, trazabilidad ampliada y evidencia complementaria del Informe Ejecutivo GEOINT.", { align: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
    ...bodySections.flatMap((section) => renderSection(section, annexModel, options.visualAssetsById || {}, renderedVisualIds, missingVisualAssetIds)),
  ];
  const watermarkBuffer = InstitutionalBrandManager.generateWatermarkBuffer();
  if (options.exportMode !== "DRAFT") {
    const required = annexModel.technicalMetadata.semanticIntegrity!.requiredVisualIds;
    const nativeIds = annexModel.sections.filter(section => ["field-photographs", "street-view"].includes(section.sectionId)).flatMap(section => section.records.map(record => record.recordId));
    for (const id of [annexModel.executiveReportReference.principalMapId, ...nativeIds.filter(id => required.includes(id))]) {
      if (!renderedVisualIds.includes(id) || missingVisualAssetIds.includes(id)) throw new Error(`P5_BLOCKED:REQUIRED_VISUAL_NOT_RENDERED:${id}`);
    }
  }
  const document = new Document({
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: PageFormatManager.width, height: PageFormatManager.height },
            margin: PageFormatManager.margins,
          },
        },
        headers: {
          default: HeaderFooterManager.createDefaultHeader(watermarkBuffer, TECHNICAL_ANNEX_OFFICIAL_TITLE),
          first: HeaderFooterManager.createFirstPageHeader(),
        },
        footers: {
          default: HeaderFooterManager.createDefaultFooter(annexModel.identity.fecha, annexModel.identity.numeroExpediente, { includeDate: false }),
          first: HeaderFooterManager.createFirstPageFooter(),
        },
        children,
      },
    ],
  });

  return {
    document,
    children,
    filename: buildNumeroExpedienteFilename({
      numeroExpediente: annexModel.identity.numeroExpediente,
      projectName: `ANEXO_TECNICO_${options.projectName || annexModel.identity.nombreExpediente}`,
      extension: "docx",
    }),
    renderAudit: {
      headerFooterManagerReused: true,
      compactComposition: true,
      externalCalls: false,
      aiCalls: false,
      secondReportEngine: false,
      modelMutated: JSON.stringify(annexModel) !== snapshot,
      renderedSectionIds: bodySections.map((section) => section.sectionId),
      renderedVisualIds,
      missingVisualAssetIds,
    },
  };
}
