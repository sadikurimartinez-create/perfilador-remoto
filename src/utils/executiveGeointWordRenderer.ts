import {
  AlignmentType,
  Document,
  ImageRun,
  Paragraph,
  TextRun,
} from "docx";
import type {
  ExecutiveDocumentSection,
  ExecutiveDocumentSectionId,
  ExecutiveGeointReportDocumentModel,
} from "@/utils/executiveGeointReportDocumentModel";
import type { ExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import {
  FlowControlManager,
  HeaderFooterManager,
  InstitutionalBrandManager,
  PageFormatManager,
} from "@/utils/documentCompositionEngine";
import { buildNumeroExpedienteFilename, resolveVisibleNumeroExpediente } from "@/utils/documentIdentity";

export interface ExecutiveGeointWordVisualAsset {
  data: ArrayBuffer | Uint8Array;
  type?: "png" | "jpg" | "jpeg" | "gif" | "bmp";
  width?: number;
  height?: number;
}

export interface ExecutiveGeointWordRenderResult {
  document: Document;
  children: any[];
  filename: string;
  visibleNumeroExpediente: string;
  renderAudit: {
    sectionOrder: ExecutiveDocumentSectionId[];
    skippedOptionalSections: ExecutiveDocumentSectionId[];
    incompleteSections: ExecutiveDocumentSectionId[];
    renderedVisualIds: string[];
    missingVisualAssetIds: string[];
    headerFooterManagerReused: true;
    externalCalls: false;
    aiCalls: false;
    geometryGenerated: false;
    documentModelMutated: boolean;
  };
}

interface RenderOptions {
  projectName?: string;
  ceipolId?: string;
  visualAssetsById?: Record<string, ExecutiveGeointWordVisualAsset | null | undefined>;
}

const TECHNICAL_VISIBLE_TERMS =
  /\b(projectId|sourceItemId|traceabilityId|traceabilityIds|geographyId|lineage|payload|modelVersion|SOURCE_FACT|ANALYTICAL_PROJECTION|PENDING|APPROVED|STALE|Gate|ADR-022|ADR-023|ADR-024|ADR-025)\b/gi;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function sanitizeExecutiveGeointWordText(value: unknown, fallback = ""): string {
  const text = clean(value) || fallback;
  return text
    .replace(TECHNICAL_VISIBLE_TERMS, "")
    .replace(/\b(?:project|sourceItem|traceability|trace|geo|evidence|finding)-[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; align?: any; spacingAfter?: number } = {}) {
  return new Paragraph(
    FlowControlManager.applyFlowRules({
      alignment: options.align,
      spacing: { after: options.spacingAfter ?? 120 },
      children: [
        new TextRun({
          text: sanitizeExecutiveGeointWordText(text, "Condicion institucional no disponible."),
          bold: options.bold,
          size: options.size ?? 20,
          color: options.color ?? "222222",
          font: "Calibri",
        }),
      ],
    }, options.bold ? "TITLE" : "PARAGRAPH")
  );
}

function sectionTitle(section: ExecutiveDocumentSection) {
  return paragraph(section.title.toUpperCase(), { bold: true, size: 24, color: "0D2B52", spacingAfter: 90 });
}

function renderCover(documentModel: ExecutiveGeointReportDocumentModel, visibleNumeroExpediente: string): any[] {
  return [
    paragraph(documentModel.presentation.documentTitle || "INFORME EJECUTIVO GEOINT", {
      bold: true,
      size: 32,
      color: "0D2B52",
      align: AlignmentType.CENTER,
      spacingAfter: 220,
    }),
    paragraph(`Numero de expediente: ${visibleNumeroExpediente}`, { bold: true, align: AlignmentType.CENTER }),
    paragraph(`Clasificacion: ${documentModel.identity.clasificacion}`, { align: AlignmentType.CENTER }),
    paragraph(`Fecha de emision: ${documentModel.identity.fechaEmision}`, { align: AlignmentType.CENTER }),
  ];
}

function renderSectionContent(section: ExecutiveDocumentSection): any[] {
  if (section.status === "OPTIONAL_SUPPRESSED") return [];
  const items = section.status === "INCOMPLETE"
    ? section.content.slice(0, Math.max(1, section.densityPolicy.maxItems ?? section.content.length))
    : section.content.slice(0, section.densityPolicy.maxItems ?? section.content.length);
  return [
    sectionTitle(section),
    ...items.map((item) => paragraph(item)),
  ];
}

function renderVisualPlacement(
  placement: ExecutiveGeointReportDocumentModel["visualPlacements"][number],
  visualAssetsById: RenderOptions["visualAssetsById"],
  audit: ExecutiveGeointWordRenderResult["renderAudit"]
): any[] {
  const asset = visualAssetsById?.[placement.visualId];
  if (!asset?.data) {
    audit.missingVisualAssetIds.push(placement.visualId);
    return [
      paragraph(placement.headline, { bold: true, size: 20, color: "0D2B52" }),
      paragraph(placement.caption),
    ];
  }

  audit.renderedVisualIds.push(placement.visualId);
  return [
    paragraph(placement.headline, { bold: true, size: 20, color: "0D2B52" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new ImageRun({
          data: asset.data,
          type: asset.type || "png",
          transformation: {
            width: asset.width ?? (placement.placementRole === "PRINCIPAL_TERRITORIAL_MAP" ? 500 : 420),
            height: asset.height ?? (placement.placementRole === "PRINCIPAL_TERRITORIAL_MAP" ? 280 : 240),
          },
        } as any),
      ],
    }),
    paragraph(placement.caption, { size: 16, color: "5B6573", align: AlignmentType.CENTER }),
  ];
}

function placementsForSection(documentModel: ExecutiveGeointReportDocumentModel, sectionId: ExecutiveDocumentSectionId) {
  return documentModel.visualPlacements
    .filter((placement) => placement.sectionId === sectionId)
    .slice(0, 5);
}

function visualAssetFromDataUrl(reference: string | null | undefined): ExecutiveGeointWordVisualAsset | null {
  if (!reference || !reference.startsWith("data:image/")) return null;
  const match = reference.match(/^data:image\/(png|jpg|jpeg|gif|bmp);base64,(.+)$/i);
  if (!match) return null;
  const [, type, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  return {
    data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    type: type.toLowerCase() as ExecutiveGeointWordVisualAsset["type"],
  };
}

export function buildExecutiveGeointWordVisualAssets(
  visualComposition: ExecutiveVisualComposition
): Record<string, ExecutiveGeointWordVisualAsset> {
  const assets: Record<string, ExecutiveGeointWordVisualAsset> = {};
  const principalAsset = visualAssetFromDataUrl(visualComposition.principalTerritorialMap.visualReference);
  if (principalAsset && visualComposition.principalTerritorialMap.status === "READY_FROM_GOVERNED_VISUAL") {
    assets[visualComposition.principalTerritorialMap.mapId] = principalAsset;
  }
  for (const visual of visualComposition.secondaryVisuals) {
    const asset = visualAssetFromDataUrl(visual.visualReference);
    if (asset) assets[visual.visualId] = asset;
  }
  return assets;
}

export function renderExecutiveGeointWordDocument(
  documentModel: ExecutiveGeointReportDocumentModel,
  options: RenderOptions = {}
): ExecutiveGeointWordRenderResult {
  const snapshot = JSON.stringify(documentModel);
  const visibleNumeroExpediente = resolveVisibleNumeroExpediente({
    numeroExpediente: documentModel.identity.numeroExpediente,
    ceipolId: options.ceipolId,
  });
  const audit: ExecutiveGeointWordRenderResult["renderAudit"] = {
    sectionOrder: [],
    skippedOptionalSections: [],
    incompleteSections: [],
    renderedVisualIds: [],
    missingVisualAssetIds: [],
    headerFooterManagerReused: true,
    externalCalls: false,
    aiCalls: false,
    geometryGenerated: false,
    documentModelMutated: false,
  };
  FlowControlManager.reset();

  const children: any[] = [];
  const orderedSections = [...documentModel.sections].sort((a, b) => a.order - b.order);
  for (const section of orderedSections) {
    audit.sectionOrder.push(section.sectionId);
    if (section.status === "OPTIONAL_SUPPRESSED") {
      audit.skippedOptionalSections.push(section.sectionId);
      continue;
    }
    if (section.status === "INCOMPLETE") audit.incompleteSections.push(section.sectionId);
    if (section.sectionId === "cover") {
      children.push(...renderCover(documentModel, visibleNumeroExpediente));
    } else {
      children.push(...renderSectionContent(section));
    }
    for (const placement of placementsForSection(documentModel, section.sectionId)) {
      children.push(...renderVisualPlacement(placement, options.visualAssetsById, audit));
    }
  }

  audit.documentModelMutated = JSON.stringify(documentModel) !== snapshot;
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
          default: HeaderFooterManager.createDefaultFooter(documentModel.identity.fechaEmision, visibleNumeroExpediente),
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
      numeroExpediente: visibleNumeroExpediente,
      ceipolId: options.ceipolId,
      projectName: options.projectName || documentModel.presentation.documentTitle,
      extension: "docx",
    }),
    visibleNumeroExpediente,
    renderAudit: audit,
  };
}
