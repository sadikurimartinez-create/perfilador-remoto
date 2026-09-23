import {
  AlignmentType,
  Document,
  ImageRun,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
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
import { TECHNICAL_ANNEX_OFFICIAL_TITLE } from "@/utils/institutionalDocumentIdentity";

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

function cell(text: string, bold = false) {
  return new TableCell({
    children: [para(text, { bold, size: 16 })],
  });
}

function recordRows(records: TechnicalAnnexRecord[]): TableRow[] {
  return records.map((record) => new TableRow({
    children: [
      cell(record.title),
      cell(record.sourceType),
      cell(record.summary),
      cell(record.referenceLabel || "Referencia no consignada"),
      cell(record.traceabilityStatus || "NO CONSIGNADO"),
      cell(record.reportUsage || (record.selectedForExecutiveBody ? "SI" : "NO DETERMINADO")),
    ],
  }));
}

function renderRecords(records: TechnicalAnnexRecord[]): any[] {
  if (!records.length) return [];
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell("HALLAZGO / ELEMENTO", true), cell("TIPO / FUENTE", true), cell("DETALLE", true), cell("REFERENCIA", true), cell("TRAZABILIDAD", true), cell("INFORME", true)] }),
        ...recordRows(records),
      ],
    }),
  ];
}

function renderFactTable(facts: ExecutiveGeointTechnicalAnnexSection["facts"]): any[] {
  if (!facts.length) return [];
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: facts.map((fact) => new TableRow({ children: [cell(fact.label, true), cell(fact.value)] })),
  })];
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
    ...renderRecords(section.records),
  ];
  if (section.sectionId === "canonical-geography") {
    const id = annexModel.executiveReportReference.principalMapId;
    if (assets[id]?.data) {
      children.push(...renderAsset(assets[id]!, "Mapa territorial principal del expediente.", true));
      renderedVisualIds.push(id);
    } else {
      children.push(para("Activo cartografico no resuelto para este anexo."));
      missingVisualAssetIds.push(id);
    }
  }
  if (section.sectionId === "field-photographs" || section.sectionId === "street-view") {
    for (const record of section.records) {
      const asset = assets[record.recordId];
      if (!asset?.data) {
        if (record.visualReference) missingVisualAssetIds.push(record.recordId);
        continue;
      }
      children.push(...renderAsset(asset, `${record.title}. ${record.sourceType}. ${record.referenceLabel || ""}`));
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
    para(`Numero de expediente: ${annexModel.identity.numeroExpediente}`, { bold: true, align: AlignmentType.CENTER }),
    para(`Nombre del expediente: ${annexModel.identity.nombreExpediente}`, { align: AlignmentType.CENTER }),
    para(`Clasificacion: ${annexModel.identity.clasificacion}`, { align: AlignmentType.CENTER }),
    para(`Fecha de emision: ${annexModel.identity.fecha}`, { align: AlignmentType.CENTER }),
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
