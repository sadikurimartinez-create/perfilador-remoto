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

function compactCell(value: unknown, maxLength = 160): string {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : candidate.length).trim()}…`;
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

function renderAsset(asset: ExecutiveGeointWordVisualAsset, caption: string, map = false): any[] {
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new ImageRun({
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
    ...(section.sectionId === "field-photographs" || section.sectionId === "street-view"
      ? []
      : renderRecords(section.records)),
  ];
  if (section.sectionId === "canonical-geography") {
    const id = annexModel.executiveReportReference.principalMapId;
    if (assets[id]?.data) {
      const scaleLabel = annexModel.executiveReportReference.principalMapScaleLabel;
      const caption = scaleLabel
        ? `Mapa territorial principal del expediente. Escala: ${scaleLabel}.`
        : "Mapa territorial principal del expediente.";
      children.push(...renderAsset(assets[id]!, caption, true));
      renderedVisualIds.push(id);
    } else {
      children.push(para("Activo cartografico no resuelto para este anexo."));
      missingVisualAssetIds.push(id);
    }
  }
  if (section.sectionId === "field-photographs" || section.sectionId === "street-view") {
    for (const record of section.records) {
      children.push(...renderEvidenceDossier(record));
      const asset = assets[record.recordId];
      if (!asset?.data) {
        if (record.visualReference) missingVisualAssetIds.push(record.recordId);
        continue;
      }
      children.push(...renderAsset(asset, `${visibleRecordLabel(record.title)}. Fuente: ${visibleRecordLabel(record.sourceType)}. Referencia: ${record.referenceLabel || record.recordId}.`));
      renderedVisualIds.push(record.recordId);
    }
  }
  return children;
}

export function renderExecutiveGeointTechnicalAnnexWordDocument(
  annexModel: ExecutiveGeointTechnicalAnnexModel,
  options: {
    projectName?: string;
    visualAssetsById?: Record<string, ExecutiveGeointWordVisualAsset | null | undefined>;
    institutionalLogos?: { sspe?: ArrayBuffer | Uint8Array | null; ceipol?: ArrayBuffer | Uint8Array | null };
  } = {}
): TechnicalAnnexWordRenderResult {
  const snapshot = JSON.stringify(annexModel);
  FlowControlManager.reset();
  const renderedVisualIds: string[] = [];
  const missingVisualAssetIds: string[] = [];
  const bodySections = annexModel.sections.filter((section) => section.sectionId !== "identity");
  const children = [
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
