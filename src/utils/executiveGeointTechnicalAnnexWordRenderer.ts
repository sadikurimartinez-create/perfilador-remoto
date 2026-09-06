import {
  AlignmentType,
  Document,
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
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
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
    width: { size: 25, type: WidthType.PERCENTAGE },
    children: [para(text, { bold, size: 16 })],
  });
}

function recordRows(records: TechnicalAnnexRecord[]): TableRow[] {
  return records.slice(0, 40).map((record) => new TableRow({
    children: [
      cell(record.recordId),
      cell(record.sourceType),
      cell(record.selectedForExecutiveBody ? "SI" : "NO"),
      cell(record.traceabilityIds.join(", ") || "NO DISPONIBLE"),
    ],
  }));
}

function renderRecords(records: TechnicalAnnexRecord[]): any[] {
  if (!records.length) return [];
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell("ID", true), cell("FUENTE", true), cell("CUERPO EJECUTIVO", true), cell("TRAZABILIDAD", true)] }),
        ...recordRows(records),
      ],
    }),
  ];
}

function renderSection(section: ExecutiveGeointTechnicalAnnexSection): any[] {
  return [
    para(section.title, { bold: true, size: 22, color: "0D2B52" }),
    ...section.content.map((item) => para(item)),
    ...renderRecords(section.records),
  ];
}

export function renderExecutiveGeointTechnicalAnnexWordDocument(
  annexModel: ExecutiveGeointTechnicalAnnexModel,
  options: { projectName?: string } = {}
): TechnicalAnnexWordRenderResult {
  const snapshot = JSON.stringify(annexModel);
  FlowControlManager.reset();
  const children = [
    para("ANEXO TECNICO DEL EXPEDIENTE", { bold: true, size: 30, color: "0D2B52", align: AlignmentType.CENTER }),
    para(`Numero de expediente: ${annexModel.identity.numeroExpediente}`, { bold: true, align: AlignmentType.CENTER }),
    para(`Clasificacion: ${annexModel.identity.clasificacion}`, { align: AlignmentType.CENTER }),
    para("Este anexo contiene soporte tecnico, trazabilidad ampliada y evidencia complementaria del informe ejecutivo GEOINT.", { align: AlignmentType.CENTER }),
    ...annexModel.sections.flatMap(renderSection),
  ];
  const watermarkBuffer = InstitutionalBrandManager.generateWatermarkBuffer();
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PageFormatManager.width, height: PageFormatManager.height },
            margin: PageFormatManager.margins,
          },
        },
        headers: {
          default: HeaderFooterManager.createDefaultHeader(watermarkBuffer),
          first: HeaderFooterManager.createFirstPageHeader(),
        },
        footers: {
          default: HeaderFooterManager.createDefaultFooter(annexModel.identity.fecha, annexModel.identity.numeroExpediente),
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
      renderedSectionIds: annexModel.sections.map((section) => section.sectionId),
    },
  };
}
