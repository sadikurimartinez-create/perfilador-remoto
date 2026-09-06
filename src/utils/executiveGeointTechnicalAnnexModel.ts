import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import type { ExecutiveGeointReportModel } from "@/utils/executiveGeointReportModel";
import type { ExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import type { ExecutiveGeointReportDocumentModel } from "@/utils/executiveGeointReportDocumentModel";
import { resolveVisibleNumeroExpediente } from "@/utils/documentIdentity";

export const EXECUTIVE_GEOINT_TECHNICAL_ANNEX_MODEL_VERSION = "1.0.0";

export type TechnicalAnnexSectionId =
  | "identity"
  | "canonical-geography"
  | "evidence-inventory"
  | "street-view"
  | "territorial-sources"
  | "osint"
  | "multisource-correlation"
  | "prospective-products"
  | "hypothesis-history"
  | "technical-traceability";

export interface TechnicalAnnexRecord {
  recordId: string;
  title: string;
  summary: string;
  sourceType: string;
  selectedForExecutiveBody: boolean;
  visualReference?: string | null;
  coordinates?: unknown;
  capturedAt?: string;
  heading?: unknown;
  pitch?: unknown;
  traceabilityIds: string[];
  technicalIds: Record<string, unknown>;
  limitations: string[];
}

export interface ExecutiveGeointTechnicalAnnexSection {
  sectionId: TechnicalAnnexSectionId;
  title: string;
  role: "INSTITUTIONAL_IDENTITY" | "TECHNICAL_SUPPORT" | "AUDIT_TRACEABILITY";
  content: string[];
  records: TechnicalAnnexRecord[];
  status: "READY" | "PARTIAL" | "NO DISPONIBLE EN EL EXPEDIENTE";
  technicalSection: boolean;
}

export interface ExecutiveGeointTechnicalAnnexModel {
  identity: {
    numeroExpediente: string;
    nombreExpediente: string;
    fecha: string;
    personaPerfiladora: string;
    clasificacion: string;
    projectId: string;
  };
  sections: ExecutiveGeointTechnicalAnnexSection[];
  technicalInventory: {
    evidenceCount: number;
    streetViewCount: number;
    osintCount: number;
    territorialSourceCount: number;
    selectedVisualCount: number;
  };
  executiveReportReference: {
    documentTitle: string;
    sectionIds: string[];
    visualPlacementIds: string[];
  };
  governance: {
    deterministic: true;
    externalAnalyticalCalls: false;
    aiCalls: false;
    geometryGenerated: false;
    secondReportEngine: false;
    inputMutated: boolean;
  };
  technicalMetadata: {
    modelName: "ExecutiveGeointTechnicalAnnexModel";
    modelVersion: typeof EXECUTIVE_GEOINT_TECHNICAL_ANNEX_MODEL_VERSION;
    source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition+ExecutiveGeointReportDocumentModel";
    sourceProjectId: string;
    traceabilityIds: string[];
    sourceItemIds: string[];
  };
}

interface AnnexContext {
  nombreExpediente?: unknown;
  fecha?: unknown;
  personaPerfiladora?: unknown;
  clasificacion?: unknown;
  numeroExpediente?: unknown;
  ceipolId?: unknown;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function firstText(...values: unknown[]): string {
  return values.map(clean).find(Boolean) || "";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function itemId(item: any, fallback: string): string {
  return firstText(
    item?.id,
    item?.evidenceId,
    item?.findingId,
    item?.analysisId,
    item?.outputId,
    item?.comparisonId,
    item?.productId,
    item?.visualId,
    item?.sourceItemId,
    item?.technicalMetadata?.sourceItemId,
    fallback
  );
}

function traceabilityIds(item: any): string[] {
  return dedupe([
    item?.traceabilityId,
    item?.traceabilityReference,
    ...(asArray<string>(item?.traceabilityIds)),
    ...(asArray<any>(item?.lineage).map((node) => node?.traceabilityId)),
    ...(asArray<any>(item?.evidenceLineage).map((node) => node?.traceabilityId)),
    ...(asArray<any>(item?.multimodalEvidence?.lineage).map((node) => node?.traceabilityId)),
  ]);
}

function lineageSourceIds(item: any): string[] {
  return dedupe([
    item?.sourceItemId,
    item?.technicalMetadata?.sourceItemId,
    ...(asArray<any>(item?.lineage).map((node) => node?.sourceId)),
    ...(asArray<any>(item?.evidenceLineage).map((node) => node?.sourceId)),
  ]);
}

function isTraceable(item: any): boolean {
  return Boolean(traceabilityIds(item).length || lineageSourceIds(item).length || item?.sourceUrl || item?.reference || item?.url);
}

function visualReference(item: any): string | null {
  return firstText(item?.visualReference, item?.reference, item?.assetRef, item?.dataUrl, item?.imageUrl, item?.previewUrl, item?.url) || null;
}

function imageFingerprint(item: any): string {
  return firstText(
    item?.fingerprint,
    item?.sha256,
    item?.pHash,
    item?.imageFingerprint,
    item?.forensicIntegrity?.sha256,
    item?.multimodalEvidence?.forensicIntegrity?.sha256,
    visualReference(item),
    itemId(item, "")
  );
}

function sourceType(item: any, fallback: string): string {
  return firstText(item?.sourceType, item?.providerType, item?.sourceProvider, item?.category, item?.tipo, item?.technicalMetadata?.sourceType, fallback);
}

function summary(item: any, fallback: string): string {
  return firstText(item?.summary, item?.resumen, item?.description, item?.descripcion, item?.caption, item?.title, item?.titulo, fallback);
}

function technicalIds(item: any): Record<string, unknown> {
  return {
    projectId: item?.projectId,
    sourceItemId: item?.sourceItemId || item?.technicalMetadata?.sourceItemId,
    traceabilityIds: traceabilityIds(item),
    geographyId: item?.geographyId || item?.canonicalGeographyId || item?.technicalMetadata?.geographyId,
    lineage: item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage,
    modelVersion: item?.modelVersion || item?.technicalMetadata?.modelVersion,
    timestamp: item?.timestamp || item?.createdAt || item?.capturedAt || item?.generatedAt,
  };
}

function evidenceRecord(item: any, source: string, selectedIds: Set<string>, fallback: string): TechnicalAnnexRecord {
  const id = itemId(item, fallback);
  return {
    recordId: id,
    title: firstText(item?.title, item?.titulo, item?.caption, source),
    summary: summary(item, "NO DISPONIBLE EN EL EXPEDIENTE"),
    sourceType: sourceType(item, source),
    selectedForExecutiveBody: selectedIds.has(id) || selectedIds.has(item?.technicalMetadata?.sourceItemId),
    visualReference: visualReference(item),
    coordinates: item?.coordinates || item?.coords || item?.location || item?.latLng || item?.multimodalEvidence?.coordinates,
    capturedAt: firstText(item?.capturedAt, item?.date, item?.fecha, item?.timestamp),
    heading: item?.heading || item?.pov?.heading,
    pitch: item?.pitch || item?.pov?.pitch,
    traceabilityIds: traceabilityIds(item),
    technicalIds: technicalIds(item),
    limitations: asArray<string>(item?.limitations || item?.limitaciones),
  };
}

function dedupeImageRecords(records: TechnicalAnnexRecord[]): TechnicalAnnexRecord[] {
  const seen = new Set<string>();
  const result: TechnicalAnnexRecord[] = [];
  for (const record of records) {
    const key = imageFingerprint({ ...record, ...record.technicalIds });
    if (record.visualReference && seen.has(key)) continue;
    if (record.visualReference) seen.add(key);
    result.push(record);
  }
  return result;
}

function selectedVisualIds(visualComposition: ExecutiveVisualComposition, documentModel: ExecutiveGeointReportDocumentModel): Set<string> {
  return new Set([
    ...documentModel.visualPlacements.map((placement) => placement.visualId),
    visualComposition.principalTerritorialMap.mapId,
    ...visualComposition.secondaryVisuals.map((visual) => visual.visualId),
    ...visualComposition.secondaryVisuals.map((visual) => visual.technicalMetadata.sourceItemId),
  ].filter(Boolean));
}

function section(
  sectionId: TechnicalAnnexSectionId,
  title: string,
  role: ExecutiveGeointTechnicalAnnexSection["role"],
  content: string[],
  records: TechnicalAnnexRecord[] = [],
  technicalSection = false
): ExecutiveGeointTechnicalAnnexSection {
  const hasData = content.some(Boolean) || records.length > 0;
  return {
    sectionId,
    title,
    role,
    content: hasData ? content.filter(Boolean) : ["NO DISPONIBLE EN EL EXPEDIENTE"],
    records,
    status: hasData ? "READY" : "NO DISPONIBLE EN EL EXPEDIENTE",
    technicalSection,
  };
}

export function buildExecutiveGeointTechnicalAnnexModel(
  institutionalInput: InstitutionalReportInput,
  executiveModel: ExecutiveGeointReportModel,
  visualComposition: ExecutiveVisualComposition,
  documentModel: ExecutiveGeointReportDocumentModel,
  context: AnnexContext = {}
): ExecutiveGeointTechnicalAnnexModel {
  const snapshot = JSON.stringify(institutionalInput);
  const selectedIds = selectedVisualIds(visualComposition, documentModel);
  const numeroExpediente = resolveVisibleNumeroExpediente({
    numeroExpediente: context.numeroExpediente || documentModel.identity.numeroExpediente || executiveModel.identity.numeroExpediente,
    ceipolId: context.ceipolId,
  });
  const evidenceRecords = dedupeImageRecords([
    ...institutionalInput.evidence.map((item, index) => evidenceRecord(item, "EVIDENCIA", selectedIds, `evidence-${index + 1}`)),
    ...executiveModel.keyEvidence.map((item, index) => evidenceRecord(item, "EVIDENCIA_VISUAL_SELECCIONADA", selectedIds, `key-evidence-${index + 1}`)),
    ...visualComposition.secondaryVisuals.map((item, index) => evidenceRecord(item, "VISUAL_EJECUTIVO_SELECCIONADO", selectedIds, `visual-${index + 1}`)),
  ]).filter((item) => isTraceable({ ...item, ...item.technicalIds }));
  const streetViewRecords = dedupeImageRecords(institutionalInput.streetView.map((item, index) => evidenceRecord(item, "GOOGLE_STREET_VIEW", selectedIds, `street-view-${index + 1}`)))
    .filter((item) => isTraceable({ ...item, ...item.technicalIds }));
  const osintRecords = institutionalInput.osint
    .filter(isTraceable)
    .map((item, index) => evidenceRecord(item, "OSINT_TRAZABLE", selectedIds, `osint-${index + 1}`));
  const territorialSourceRecords = [
    ...institutionalInput.osint,
    ...institutionalInput.specializedIntelligence,
    ...institutionalInput.visualProducts,
    ...institutionalInput.temporalComparisons,
  ]
    .filter((item) => /DENUE|PLACE|ROUTE|DIRECTION|ELEVATION|VISION|GEOGRAF|GEOGRAPH|TERRITOR/i.test(sourceType(item, "") + " " + summary(item, "")))
    .map((item, index) => evidenceRecord(item, "FUENTE_TERRITORIAL", selectedIds, `territorial-source-${index + 1}`));

  const allTechnicalRecords = [
    ...evidenceRecords,
    ...streetViewRecords,
    ...osintRecords,
    ...territorialSourceRecords,
    ...institutionalInput.analyses.map((item, index) => evidenceRecord(item, "ANALISIS_MULTIFUENTE", selectedIds, `analysis-${index + 1}`)),
    ...institutionalInput.predictiveAnalyticalProducts.map((item, index) => evidenceRecord(item, "PRODUCTO_PROSPECTIVO", selectedIds, `predictive-product-${index + 1}`)),
    ...executiveModel.findings.map((item, index) => evidenceRecord(item, "HALLAZGO_EJECUTIVO", selectedIds, `finding-${index + 1}`)),
    ...executiveModel.decisionImplications.map((item, index) => evidenceRecord(item, "IMPLICACION_DECISION", selectedIds, `decision-${index + 1}`)),
  ];

  const sections = [
    section("identity", "IDENTIDAD DEL ANEXO TECNICO", "INSTITUTIONAL_IDENTITY", [
      `Numero de expediente: ${numeroExpediente}`,
      `Nombre del expediente: ${firstText(context.nombreExpediente, executiveModel.identity.nombreExpediente, "NO DISPONIBLE EN EL EXPEDIENTE")}`,
      `Fecha: ${firstText(context.fecha, documentModel.identity.fechaEmision, executiveModel.identity.fecha, institutionalInput.generatedAt)}`,
      `Persona perfiladora: ${firstText(context.personaPerfiladora, executiveModel.identity.personaPerfiladora, "NO DISPONIBLE EN EL EXPEDIENTE")}`,
      `Clasificacion: ${firstText(context.clasificacion, documentModel.identity.clasificacion, executiveModel.identity.clasificacion)}`,
    ]),
    section("canonical-geography", "GEOGRAFIA CANONICA", "TECHNICAL_SUPPORT", [
      institutionalInput.geography
        ? `Tipo: ${institutionalInput.geography.type}. Estado: ${institutionalInput.geography.validationStatus}. Descripcion: ${executiveModel.territorialSituation.territorialSummary}`
        : "NO DISPONIBLE EN EL EXPEDIENTE",
      visualComposition.principalTerritorialMap.status === "READY_FROM_GOVERNED_VISUAL"
        ? "Representacion cartografica gobernada disponible."
        : "Representacion cartografica no disponible como activo gobernado.",
    ], [], true),
    section("evidence-inventory", "INVENTARIO DE EVIDENCIA", "TECHNICAL_SUPPORT", [
      `Evidencias inventariadas: ${evidenceRecords.length}`,
    ], evidenceRecords),
    section("street-view", "GOOGLE STREET VIEW", "TECHNICAL_SUPPORT", [
      `Capturas gobernadas: ${streetViewRecords.length}`,
    ], streetViewRecords),
    section("territorial-sources", "FUENTES TERRITORIALES", "TECHNICAL_SUPPORT", [
      `Fuentes territoriales registradas: ${territorialSourceRecords.length}`,
    ], territorialSourceRecords),
    section("osint", "OSINT TRAZABLE", "TECHNICAL_SUPPORT", [
      `Elementos OSINT trazables: ${osintRecords.length}`,
    ], osintRecords),
    section("multisource-correlation", "CORRELACION MULTIFUENTE", "TECHNICAL_SUPPORT", [
      ...executiveModel.multisourceAnalysis.convergencias.map((item) => `Convergencia aceptada: ${item}`),
      ...executiveModel.multisourceAnalysis.contradicciones.map((item) => `Contradiccion: ${item}`),
      ...executiveModel.multisourceAnalysis.dependenciasParciales.map((item) => `Dependencia: ${item}`),
      ...executiveModel.multisourceAnalysis.brechasInformacion.map((item) => `Brecha: ${item}`),
    ], [], true),
    section("prospective-products", "PROSPECTIVA GOBERNADA", "TECHNICAL_SUPPORT", executiveModel.prospectiveAnalysis.technicalMetadata.sourceProductIds.length ? [
      `Tendencia: ${executiveModel.prospectiveAnalysis.tendencia}`,
      `Escenario: ${executiveModel.prospectiveAnalysis.escenario}`,
      `Vigencia: ${executiveModel.prospectiveAnalysis.vigencia}`,
      ...executiveModel.prospectiveAnalysis.limitaciones.map((item) => `Limitacion: ${item}`),
    ] : [] , [], true),
    section("hypothesis-history", "HIPOTESIS E HISTORIAL", "TECHNICAL_SUPPORT", [
      firstText((institutionalInput.hypothesis as any)?.currentHypothesis, (institutionalInput as any)?.initialHypothesis, "NO DISPONIBLE EN EL EXPEDIENTE"),
      ...asArray<any>((institutionalInput as any)?.hypothesisHistory).map((item) => firstText(item?.summary, item?.text, item?.status, JSON.stringify(item))),
    ], [], true),
    section("technical-traceability", "TRAZABILIDAD TECNICA", "AUDIT_TRACEABILITY", [
      `projectId: ${institutionalInput.projectId}`,
      `modelVersion: ${EXECUTIVE_GEOINT_TECHNICAL_ANNEX_MODEL_VERSION}`,
      `sourceItemIds: ${dedupe(allTechnicalRecords.flatMap((record) => Object.values(record.technicalIds).flatMap((value) => Array.isArray(value) ? value.map(String) : [String(value || "")]))).join(", ") || "NO DISPONIBLE EN EL EXPEDIENTE"}`,
      `traceabilityIds: ${dedupe(allTechnicalRecords.flatMap((record) => record.traceabilityIds)).join(", ") || "NO DISPONIBLE EN EL EXPEDIENTE"}`,
    ], allTechnicalRecords, true),
  ];

  const partialSections = sections.map((item) => ({
    ...item,
    status: item.content.includes("NO DISPONIBLE EN EL EXPEDIENTE") && item.records.length === 0 ? "PARTIAL" as const : item.status,
  }));
  const traceIds = dedupe(allTechnicalRecords.flatMap((record) => record.traceabilityIds));
  const sourceItemIds = dedupe(allTechnicalRecords.flatMap((record) => lineageSourceIds({ ...record, ...record.technicalIds })));

  return {
    identity: {
      numeroExpediente,
      nombreExpediente: firstText(context.nombreExpediente, executiveModel.identity.nombreExpediente, "NO DISPONIBLE EN EL EXPEDIENTE"),
      fecha: firstText(context.fecha, documentModel.identity.fechaEmision, executiveModel.identity.fecha, institutionalInput.generatedAt),
      personaPerfiladora: firstText(context.personaPerfiladora, executiveModel.identity.personaPerfiladora, "NO DISPONIBLE EN EL EXPEDIENTE"),
      clasificacion: firstText(context.clasificacion, documentModel.identity.clasificacion, executiveModel.identity.clasificacion),
      projectId: institutionalInput.projectId,
    },
    sections: partialSections,
    technicalInventory: {
      evidenceCount: evidenceRecords.length,
      streetViewCount: streetViewRecords.length,
      osintCount: osintRecords.length,
      territorialSourceCount: territorialSourceRecords.length,
      selectedVisualCount: visualComposition.secondaryVisuals.length + (visualComposition.principalTerritorialMap.status === "READY_FROM_GOVERNED_VISUAL" ? 1 : 0),
    },
    executiveReportReference: {
      documentTitle: documentModel.presentation.documentTitle,
      sectionIds: documentModel.sections.map((item) => item.sectionId),
      visualPlacementIds: documentModel.visualPlacements.map((item) => item.visualId),
    },
    governance: {
      deterministic: true,
      externalAnalyticalCalls: false,
      aiCalls: false,
      geometryGenerated: false,
      secondReportEngine: false,
      inputMutated: JSON.stringify(institutionalInput) !== snapshot,
    },
    technicalMetadata: {
      modelName: "ExecutiveGeointTechnicalAnnexModel",
      modelVersion: EXECUTIVE_GEOINT_TECHNICAL_ANNEX_MODEL_VERSION,
      source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition+ExecutiveGeointReportDocumentModel",
      sourceProjectId: institutionalInput.projectId,
      traceabilityIds: traceIds,
      sourceItemIds,
    },
  };
}
