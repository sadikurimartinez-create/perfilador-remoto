import {
  AlignmentType,
  Document,
  ImageRun,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import type {
  ExecutiveDocumentSection,
  ExecutiveDocumentSectionId,
  ExecutiveGeointReportDocumentModel,
} from "@/utils/executiveGeointReportDocumentModel";
import type { ExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import type { ExecutiveCanonicalTerritorialMapSpec } from "@/utils/executiveCanonicalTerritorialMap";
import {
  FlowControlManager,
  HeaderFooterManager,
  InstitutionalBrandManager,
  PageFormatManager,
} from "@/utils/documentCompositionEngine";
import { buildNumeroExpedienteFilename, resolveVisibleNumeroExpediente } from "@/utils/documentIdentity";
import { sanitizeVisibleDocumentText } from "@/utils/visibleDocumentSanitizer";
import { reconcileDocumentSemanticAudit, assertReconciledDocumentSemanticAudit } from "./institutionalDocumentSemanticIntegrity";
import { EXECUTIVE_GEOINT_OFFICIAL_TITLE, formatInstitutionalDate } from "@/utils/institutionalDocumentIdentity";
import { renderStructuredTable } from "@/utils/documentTableRenderer";

export interface ExecutiveGeointWordVisualAsset {
  data: ArrayBuffer | Uint8Array;
  type?: "png" | "jpg" | "jpeg" | "gif" | "bmp";
  width?: number;
  height?: number;
}

export type ExecutiveGeointWordImageResolver = (
  reference: string,
  maxWidth: number,
  maxHeight: number,
  narrative?: string,
  evidenceId?: string
) => Promise<ExecutiveGeointWordVisualAsset | null>;

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
  exportMode?: "INSTITUTIONAL" | "DRAFT";
  projectName?: string;
  ceipolId?: string;
  visualAssetsById?: Record<string, ExecutiveGeointWordVisualAsset | null | undefined>;
  institutionalLogos?: { sspe?: ArrayBuffer | Uint8Array | null; ceipol?: ArrayBuffer | Uint8Array | null };
}

interface VisualAssetBuildOptions {
  onAssetState?: (visualId: string, state: "ASSET_RENDERED" | "ASSET_MISSING" | "ASSET_UNAVAILABLE" | "ASSET_INVALID" | "ASSET_EXCLUDED") => void;
  resolveImage?: ExecutiveGeointWordImageResolver;
  resolvePrincipalMapImage?: ExecutiveGeointWordImageResolver;
  strictPrincipalMapAssets?: boolean;
  principalMapSpec?: ExecutiveCanonicalTerritorialMapSpec | null;
}

const TECHNICAL_VISIBLE_TERMS =
  /\b(projectId|sourceItemId|traceabilityId|traceabilityIds|geographyId|lineage|payload|modelVersion|SOURCE_FACT|ANALYTICAL_PROJECTION|PENDING|APPROVED|STALE|Gate|ADR-022|ADR-023|ADR-024|ADR-025)\b/gi;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function sanitizeExecutiveGeointWordText(value: unknown, fallback = ""): string {
  const text = clean(value) || fallback;
  return sanitizeVisibleDocumentText(text
    .replace(TECHNICAL_VISIBLE_TERMS, "")
    .replace(/\b(?:project|sourceItem|traceability|trace|geo|evidence|finding)-[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim(), fallback);
}

function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; align?: any; spacingAfter?: number; preserveText?: boolean } = {}) {
  return new Paragraph(
    FlowControlManager.applyFlowRules({
      alignment: options.align,
      spacing: { after: options.spacingAfter ?? 120 },
      children: [
        new TextRun({
          text: options.preserveText
            ? sanitizeVisibleDocumentText(text, "Condicion institucional no disponible.", { preserveWhitespace: true })
            : sanitizeExecutiveGeointWordText(text, "Condicion institucional no disponible."),
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

function renderCover(documentModel: ExecutiveGeointReportDocumentModel, visibleNumeroExpediente: string, options: RenderOptions, audit: ExecutiveGeointWordRenderResult['renderAudit']): any[] {
  const cover = documentModel.scinceCover;
  const children: any[] = [
    ...InstitutionalBrandManager.createCoverIdentity(
      documentModel.presentation.documentTitle || EXECUTIVE_GEOINT_OFFICIAL_TITLE,
      options.institutionalLogos,
      !!cover
    ),
    paragraph(`Número de expediente: ${visibleNumeroExpediente}`, { bold: true, align: AlignmentType.CENTER, spacingAfter: cover ? 40 : 120 }),
    paragraph(`Clasificación: ${documentModel.identity.clasificacion}`, { align: AlignmentType.CENTER, spacingAfter: cover ? 40 : 120 }),
    paragraph(`Fecha de emisión: ${formatInstitutionalDate(documentModel.identity.fechaEmision)}`, { align: AlignmentType.CENTER, spacingAfter: cover ? 40 : 120 }),
  ];
  if (!cover) return children; // Previously generated immutable models keep their original cover.
  if (cover.status !== 'READY') return [...children, paragraph('CONTEXTUALIZACIÓN SCINCE INCOMPLETA', { bold: true, color: '0D2B52' }),
    paragraph(cover.limitations.join(' ')), paragraph(`Estado documental: ${cover.reason}`, { preserveText: true })];
  const mapId = 'scince-cover-territorial-map';
  const asset = options.visualAssetsById?.[mapId];
  if (!asset?.data?.byteLength) throw new Error('SCINCE_COVER_REQUIRED_MAP_MISSING');
  audit.renderedVisualIds.push(mapId);
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new ImageRun({ data: asset.data, type: asset.type, transformation: { width: 480, height: 360 },
      altText: { title: mapId, name: mapId, description: 'Geografía canónica y área SCINCE; sin evidencias.' } } as any)] }));
  children.push(paragraph('PERFIL SOCIODEMOGRÁFICO DE LA GEOGRAFÍA ANALIZADA', { bold: true, size: 20, color: '0D2B52', spacingAfter: 60 }));
  const rows: string[][] = [];
  for (let i = 0; i < cover.indicators.length; i += 2) {
    const left = cover.indicators[i], right = cover.indicators[i + 1];
    rows.push([left.label, left.displayValue, right?.label || '—', right?.displayValue || '—']);
  }
  children.push(renderStructuredTable({ headers: ['Indicador', 'Valor 2020', 'Indicador', 'Valor 2020'], rows }, { columnWidths: [30, 20, 30, 20], repeatHeader: false }));
  children.push(...cover.methodology.map(text => paragraph(text, { size: 18, spacingAfter: 35, preserveText: true })));
  return children;
}

function renderSectionContent(section: ExecutiveDocumentSection): any[] {
  if (section.status === "OPTIONAL_SUPPRESSED") return [];
  const items = section.content;
  return [
    sectionTitle(section),
    ...items.map((item, index) => paragraph(item, {
      preserveText: section.sectionId === "initial-hypothesis" && index < 2,
    })),
  ];
}

function renderVisualPlacement(
  placement: ExecutiveGeointReportDocumentModel["visualPlacements"][number],
  visualAssetsById: RenderOptions["visualAssetsById"],
  audit: ExecutiveGeointWordRenderResult["renderAudit"]
): any[] {
  const captionParts = [
    placement.caption,
    placement.visualClass ? `Tipo de visual: ${placement.visualClass.replace(/_/g, " ")}.` : "",
    placement.visibleSourceLabel ? `Fuente: ${placement.visibleSourceLabel}.` : "",
    placement.cartographicMetadata?.geometryLabel ? `Geometría representada: ${placement.cartographicMetadata.geometryLabel}.` : "",
    placement.cartographicMetadata?.legendLabel ? `Leyenda: ${placement.cartographicMetadata.legendLabel}.` : "",
    placement.cartographicMetadata?.scaleLabel ? `Escala: ${placement.cartographicMetadata.scaleLabel}.` : "",
    placement.cartographicMetadata?.orientationLabel ? `Orientación: ${placement.cartographicMetadata.orientationLabel}.` : "",
  ].filter(Boolean).join(" ");
  const asset = visualAssetsById?.[placement.visualId];
  if (!asset?.data?.byteLength) {
    audit.missingVisualAssetIds.push(placement.visualId);
    return [];
  }

  audit.renderedVisualIds.push(placement.visualId);
  const rendered: any[] = [
    paragraph(placement.headline, { bold: true, size: 20, color: "0D2B52" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      keepNext: true,
      children: [
        new ImageRun({
          altText: { title: placement.visualId, name: placement.visualId, description: placement.caption },
          data: asset.data,
          type: asset.type || "png",
          transformation: {
            width: asset.width ?? (placement.placementRole === "PRINCIPAL_TERRITORIAL_MAP" ? 500 : 420),
            height: asset.height ?? (placement.placementRole === "PRINCIPAL_TERRITORIAL_MAP" ? 280 : 240),
          },
        } as any),
      ],
    }),
    paragraph(captionParts, { size: 16, color: "5B6573", align: AlignmentType.CENTER }),
  ];
  if (placement.companionTable) {
    rendered.push(renderStructuredTable(placement.companionTable, {
      columnWidths: [6, 16, 13, 13, 9, 14, 15, 14],
      repeatHeader: true,
      preventRowSplit: true,
    }));
  }
  return rendered;
}

function placementsForSection(documentModel: ExecutiveGeointReportDocumentModel, sectionId: ExecutiveDocumentSectionId) {
  return documentModel.visualPlacements
    .filter((placement) => placement.sectionId === sectionId)
    .slice(0, 5);
}

function fitImageWithin(
  width: number | undefined,
  height: number | undefined,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function visualAssetFromDataUrl(
  reference: string | null | undefined,
  maxWidth: number,
  maxHeight: number
): ExecutiveGeointWordVisualAsset | null {
  if (!reference || !reference.startsWith("data:image/")) return null;
  const match = reference.match(/^data:image\/(png|jpg|jpeg|gif|bmp);base64,(.+)$/i);
  if (!match) return null;
  const [, type, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const format = type.toLowerCase();
  const validSignature = format === "png" ? buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    format === "jpg" || format === "jpeg" ? buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 :
    format === "gif" ? /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6)) : buffer.toString("ascii", 0, 2) === "BM";
  if (!validSignature) return null;
  const pngWidth = buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG" ? buffer.readUInt32BE(16) : undefined;
  const pngHeight = buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG" ? buffer.readUInt32BE(20) : undefined;
  const fitted = fitImageWithin(pngWidth, pngHeight, maxWidth, maxHeight);
  return {
    data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    type: type.toLowerCase() as ExecutiveGeointWordVisualAsset["type"],
    width: fitted.width,
    height: fitted.height,
  };
}

function isResolvableExternalReference(reference: string | null | undefined): reference is string {
  return Boolean(reference && /^(https?:\/\/|blob:|\/|\.\/|\.\.\/|[A-Za-z]:\\)/.test(reference));
}

async function resolveGovernedVisualReference(
  reference: string | null | undefined,
  options: VisualAssetBuildOptions,
  maxWidth: number,
  maxHeight: number,
  narrative: string,
  evidenceId: string
): Promise<ExecutiveGeointWordVisualAsset | null> {
  try {
    const dataUrlAsset = visualAssetFromDataUrl(reference, maxWidth, maxHeight);
    if (dataUrlAsset) { options.onAssetState?.(evidenceId, "ASSET_RENDERED"); return dataUrlAsset; }
    if (!reference) { options.onAssetState?.(evidenceId, "ASSET_MISSING"); return null; }
    if (!isResolvableExternalReference(reference)) { options.onAssetState?.(evidenceId, "ASSET_INVALID"); return null; }
    if (!options.resolveImage) { options.onAssetState?.(evidenceId, "ASSET_UNAVAILABLE"); return null; }
    const asset = await options.resolveImage(reference, maxWidth, maxHeight, narrative, evidenceId);
    options.onAssetState?.(evidenceId, asset?.data?.byteLength ? "ASSET_RENDERED" : "ASSET_MISSING");
    return asset?.data?.byteLength ? asset : null;
  } catch { options.onAssetState?.(evidenceId, "ASSET_UNAVAILABLE"); return null; }
}

function principalMapAssetLooksReal(asset: ExecutiveGeointWordVisualAsset | null): asset is ExecutiveGeointWordVisualAsset {
  if (!asset?.data) return false;
  const byteLength = asset.data instanceof Uint8Array ? asset.data.byteLength : asset.data.byteLength;
  if (byteLength < 1024) return false;
  if (asset.width !== undefined && asset.width < 300) return false;
  if (asset.height !== undefined && asset.height < 180) return false;
  return true;
}

async function resolvePrincipalTerritorialMapReference(
  reference: string | null | undefined,
  options: VisualAssetBuildOptions,
  narrative: string,
  evidenceId: string
): Promise<ExecutiveGeointWordVisualAsset | null> {
  const resolverOptions = {
    ...options,
    resolveImage: options.resolvePrincipalMapImage || options.resolveImage,
  };
  const asset = await resolveGovernedVisualReference(reference, resolverOptions, 500, 280, narrative, evidenceId);
  if (!options.strictPrincipalMapAssets) return asset;
  if (!principalMapAssetLooksReal(asset)) { options.onAssetState?.(evidenceId, "ASSET_INVALID"); return null; }
  return asset;
}

export async function buildExecutiveGeointWordVisualAssets(
  visualComposition: ExecutiveVisualComposition,
  options: VisualAssetBuildOptions = {}
): Promise<Record<string, ExecutiveGeointWordVisualAsset>> {
  const assets: Record<string, ExecutiveGeointWordVisualAsset> = {};
  visualComposition.selectionAudit.excludedItems.forEach(item => options.onAssetState?.(item.itemId, "ASSET_EXCLUDED"));
  if (visualComposition.principalTerritorialMap.status === "NO_CANONICAL_GEOGRAPHY" ||
    (visualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED" && !options.principalMapSpec)) {
    options.onAssetState?.(visualComposition.principalTerritorialMap.mapId, "ASSET_MISSING");
  }
  if (options.principalMapSpec && options.principalMapSpec.technicalMetadata.geographyId !== visualComposition.principalTerritorialMap.technicalMetadata.geographyId) {
    throw new Error("EXECUTIVE_GEOINT_BLOCKED:MAP_ASSET_GEOGRAPHY_MISMATCH");
  }
  if (visualComposition.principalTerritorialMap.status === "READY_FROM_GOVERNED_VISUAL") {
    const principalAsset = await resolvePrincipalTerritorialMapReference(
      visualComposition.principalTerritorialMap.visualReference,
      options,
      visualComposition.principalTerritorialMap.caption,
      visualComposition.principalTerritorialMap.mapId
    );
    if (principalAsset) assets[visualComposition.principalTerritorialMap.mapId] = principalAsset;
  }
  if (visualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED" && options.principalMapSpec) {
    const mapSpec = options.principalMapSpec;
    console.info("[EXECUTIVE MAP] SPEC_REUSED=OK");
    const principalAsset = await resolvePrincipalTerritorialMapReference(
      mapSpec.imageUrl,
      options,
      visualComposition.principalTerritorialMap.caption,
      visualComposition.principalTerritorialMap.mapId
    );
    if (principalAsset) assets[visualComposition.principalTerritorialMap.mapId] = principalAsset;
  }
  for (const visual of visualComposition.secondaryVisuals) {
    const asset = await resolveGovernedVisualReference(
      visual.visualReference,
      options,
      420,
      240,
      visual.caption,
      visual.visualId
    );
    if (asset) assets[visual.visualId] = asset;
  }
  return assets;
}

export function assertExecutiveGeointPrincipalMapRendered(renderResult: ExecutiveGeointWordRenderResult) {
  const rendered = renderResult.renderAudit.renderedVisualIds.includes("principal-territorial-map");
  const missing = renderResult.renderAudit.missingVisualAssetIds.includes("principal-territorial-map");
  if (!rendered || missing) {
    throw new Error("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");
  }
}

export function renderExecutiveGeointWordDocument(
  documentModel: ExecutiveGeointReportDocumentModel,
  options: RenderOptions = {}
): ExecutiveGeointWordRenderResult {
  if (options.exportMode !== "DRAFT") assertReconciledDocumentSemanticAudit(documentModel.semanticIntegrity);
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

  const children: any[] = options.exportMode === "DRAFT" ? [new Paragraph("BORRADOR — NO ES PAQUETE INSTITUCIONAL")] : [];
  const orderedSections = [...documentModel.sections].sort((a, b) => a.order - b.order);
  for (const section of orderedSections) {
    audit.sectionOrder.push(section.sectionId);
    if (section.status === "OPTIONAL_SUPPRESSED") {
      audit.skippedOptionalSections.push(section.sectionId);
      continue;
    }
    if (section.status === "INCOMPLETE") audit.incompleteSections.push(section.sectionId);
    if (section.sectionId === "cover") {
      children.push(...renderCover(documentModel, visibleNumeroExpediente, options, audit));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } else {
      children.push(...renderSectionContent(section));
    }
    for (const placement of placementsForSection(documentModel, section.sectionId).filter(p => p.visualId !== 'scince-cover-territorial-map')) {
      children.push(...renderVisualPlacement(placement, options.visualAssetsById, audit));
    }
  }

  if (documentModel.semanticIntegrity?.enforced) {
    reconcileDocumentSemanticAudit(documentModel.semanticIntegrity, audit, documentModel.sections, documentModel.visualPlacements);
  }
  audit.documentModelMutated = JSON.stringify(documentModel) !== snapshot;
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
          default: HeaderFooterManager.createDefaultHeader(watermarkBuffer, EXECUTIVE_GEOINT_OFFICIAL_TITLE),
          first: HeaderFooterManager.createFirstPageHeader(),
        },
        footers: {
          default: HeaderFooterManager.createDefaultFooter(documentModel.identity.fechaEmision, visibleNumeroExpediente, { includeDate: false }),
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
