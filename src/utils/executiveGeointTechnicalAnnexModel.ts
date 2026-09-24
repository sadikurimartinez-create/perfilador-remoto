import {
  isCertifiedGimAnalysisPayload,
  type InstitutionalReportInput,
} from "@/utils/institutionalReportPublicationContract";
import type { ExecutiveGeointReportModel } from "@/utils/executiveGeointReportModel";
import type { ExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import type { ExecutiveGeointReportDocumentModel } from "@/utils/executiveGeointReportDocumentModel";
import { resolveVisibleNumeroExpediente } from "@/utils/documentIdentity";
import { hasStreetViewProvenance } from "@/utils/visualEvidenceEngine/streetViewCollector";
import { isValidStreetViewImage } from "@/utils/streetViewValidator";
import {
  classifyInstitutionalContentRole,
  type InstitutionalContentRole,
} from "@/utils/analyticalNarrativeGovernance";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";

export const EXECUTIVE_GEOINT_TECHNICAL_ANNEX_MODEL_VERSION = "1.0.0";

export type TechnicalAnnexSectionId =
  | "identity"
  | "canonical-geography"
  | "evidence-inventory"
  | "field-photographs"
  | "street-view"
  | "territorial-sources"
  | "scince"
  | "denue"
  | "incidence"
  | "osint"
  | "gang-intelligence"
  | "findings-matrix"
  | "multisource-correlation"
  | "prospective-products"
  | "hypothesis-history"
  | "technical-traceability"
  | "sources-limitations";

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
  referenceLabel?: string;
  traceabilityStatus?: string;
  reportUsage?: "SI" | "NO" | "NO DETERMINADO";
  contentRole?: InstitutionalContentRole;
  contextOriginal?: string;
  validatedAnalysis?: string;
  locationLabel?: string;
}

export interface ExecutiveGeointTechnicalAnnexSection {
  sectionId: TechnicalAnnexSectionId;
  title: string;
  role: "INSTITUTIONAL_IDENTITY" | "TECHNICAL_SUPPORT" | "AUDIT_TRACEABILITY";
  content: string[];
  records: TechnicalAnnexRecord[];
  facts: Array<{ label: string; value: string }>;
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
    principalMapId: string;
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
  if (typeof value !== "string") return "";
  return value
    .replace(/https?:\/\/\S+|blob:\S+|data:\S+/gi, "[referencia reservada]")
    .replace(/\bBearer\s+\S+/gi, "[credencial reservada]")
    .replace(/\b(?:token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[credencial reservada]")
    .replace(/\b[A-Za-z]:\\[^\s]+|(?:^|\s)(?:gs:\/\/|projects\/)[^\s]+/gi, " [ruta reservada]")
    .replace(/\s+/g, " ").trim();
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
  const candidates = [item?.visualReference, item?.imageReference, item?.assetRef, item?.dataUrl, item?.imageUrl, item?.previewUrl, item?.url, item?.reference];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function imageFingerprint(item: any): string {
  return firstText(
    item?.fingerprint,
    item?.sha256,
    item?.pHash,
    item?.imageFingerprint,
    item?.forensicIntegrity?.sha256,
    item?.multimodalEvidence?.forensicIntegrity?.sha256
  ) || visualReference(item) || itemId(item, "");
}

function sourceType(item: any, fallback: string): string {
  return firstText(item?.sourceType, item?.providerType, item?.sourceProvider, item?.category, item?.tipo, item?.technicalMetadata?.sourceType, fallback);
}

function summary(item: any, fallback: string): string {
  return firstText(item?.summary, item?.resumen, item?.description, item?.descripcion, item?.snippet, item?.caption, item?.title, item?.titulo, fallback);
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

function observedFact(item: any): boolean {
  const integrity = item?.epistemicIntegrity || item;
  return integrity?.acquisitionMode === "OBSERVED" && integrity?.acquisitionStatus === "ACQUIRED" &&
    integrity?.isSimulated === false && item?.isSimulated !== true &&
    !["AI_SYNTHESIS", "AI_GENERATED"].includes(String(integrity?.semanticRole || item?.semanticRole || "")) &&
    (!integrity?.semanticRole || integrity.semanticRole === "SOURCE_FACT");
}

function governedStreetView(item: any): boolean {
  const integrity = item?.epistemicIntegrity || item;
  if (integrity?.isSimulated === true || item?.isSimulated === true ||
    ["SIMULATED", "MOCK", "AI_GENERATED"].includes(String(integrity?.acquisitionMode || ""))) return false;
  const provider = firstText(item?.sourceProvider, item?.source, item?.streetViewMetadata?.provider).toUpperCase();
  const typed = [item?.tipo, item?.evidenceType, item?.sourceType].some((value) =>
    ["STREET_VIEW", "GOOGLE_STREET_VIEW", "VIRTUAL_STREET_VIEW"].includes(String(value || "").toUpperCase()));
  return (hasStreetViewProvenance(item) || String(item?.sourceType || "").toUpperCase() === "GOOGLE_STREET_VIEW") &&
    (provider === "GOOGLE_STREET_VIEW" || provider === "GOOGLE STREET VIEW" || typed || Boolean(item?.streetViewMetadata?.panoId)) &&
    isValidStreetViewImage({ ...item, previewUrl: visualReference(item) }) && isTraceable(item);
}

function displayedNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "No disponible";
}

function availableNarrative(values: string[]): string[] {
  return values.filter((value) => !/\bno disponibles?\b|\bno consta\b/i.test(value));
}

function safeReference(item: any, fallback: string): string {
  const value = firstText(item?.evidenceId, item?.findingId, item?.traceabilityId);
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) && !/token|secret|apikey|password/i.test(value) ? value : fallback;
}

function evidenceRecord(item: any, source: string, selectedIds: Set<string>, fallback: string): TechnicalAnnexRecord {
  const id = itemId(item, fallback);
  const contentRole = classifyInstitutionalContentRole(item);
  const rawSummary = summary(item, "NO DISPONIBLE EN EL EXPEDIENTE");
  const humanApproved = evaluateHumanValidation(item?.multimodalEvidence || item).status === "APPROVED";
  return {
    recordId: id,
    title: firstText(item?.title, item?.titulo, item?.caption, source),
    summary: rawSummary,
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
    referenceLabel: safeReference(item, fallback),
    traceabilityStatus: firstText(item?.lineageStatus, item?.multimodalEvidence?.lineageStatus,
      traceabilityIds(item).length ? "TRAZABLE" : "NO CONSIGNADO"),
    reportUsage: selectedIds.has(id) ? "SI" : "NO DETERMINADO",
    contentRole,
    contextOriginal: firstText(
      item?.context,
      item?.comentario,
      contentRole === "INSTRUCTION" ? rawSummary : ""
    ),
    validatedAnalysis: humanApproved && (contentRole === "ANALYSIS" || contentRole === "CONCLUSION")
      ? firstText(item?.analysis, item?.analyticalFinding, item?.interpretation)
      : "",
    locationLabel: firstText(item?.locationName, item?.address, item?.location?.name),
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
  technicalSection = false,
  facts: Array<{ label: string; value: string }> = []
): ExecutiveGeointTechnicalAnnexSection {
  const hasData = content.some(Boolean) || records.length > 0 || facts.length > 0;
  return {
    sectionId,
    title,
    role,
    content: hasData ? content.filter(Boolean) : ["NO DISPONIBLE EN EL EXPEDIENTE"],
    records,
    facts,
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
    ...institutionalInput.evidence.filter((item) => !hasStreetViewProvenance(item))
      .map((item, index) => evidenceRecord(item, "EVIDENCIA", selectedIds, `evidence-${index + 1}`)),
    ...executiveModel.keyEvidence.filter((item) => !item.sourceTypes?.includes("STREET_VIEW"))
      .map((item, index) => evidenceRecord(item, "EVIDENCIA_VISUAL_SELECCIONADA", selectedIds, `key-evidence-${index + 1}`)),
  ]).filter((item) => isTraceable({ ...item, ...item.technicalIds }));
  const fieldPhotoRecords = dedupeImageRecords(institutionalInput.evidence
    .filter((item) => visualReference(item) && !hasStreetViewProvenance(item) && item?.sourceType !== "GOOGLE_STREET_VIEW")
    .map((item, index) => evidenceRecord(item, "FOTOGRAFIA_DE_CAMPO", selectedIds, `foto-${index + 1}`)))
    .filter((item) => isTraceable({ ...item, ...item.technicalIds }));
  const streetViewRecords = dedupeImageRecords(institutionalInput.streetView.filter(governedStreetView)
    .map((item, index) => ({
      ...evidenceRecord(item, "GOOGLE_STREET_VIEW", selectedIds, `street-view-${index + 1}`),
      sourceType: "GOOGLE_STREET_VIEW",
    })))
    .filter((item) => isTraceable({ ...item, ...item.technicalIds }));
  const osintRecords = institutionalInput.osint
    .filter((item) => isTraceable(item) && observedFact(item))
    .map((item, index) => {
      const record = evidenceRecord(item, "OSINT_TRAZABLE", selectedIds, `osint-${index + 1}`);
      const integrity = item.epistemicIntegrity || item;
      return {
        ...record,
        sourceType: firstText(integrity.providerName, integrity.providerId, item.provider, item.source, record.sourceType),
        summary: `${record.summary}; fecha: ${firstText(integrity.observedAt, integrity.acquiredAt, "No disponible")}; estado: OBSERVADO / ADQUIRIDO`,
      };
    });

  const scince = institutionalInput.scinceDemographics;
  const scinceReady = scince?.status === "OBSERVED" && observedFact(scince) && Boolean(scince?.provenance?.datasetId);
  const scinceFacts = scinceReady ? [
    { label: "Conjunto de datos", value: clean(scince.provenance.datasetId) },
    { label: "Año de referencia", value: displayedNumber(scince.provenance.referenceYear) },
    { label: "AGEB", value: firstText(scince.geography?.ageb?.code, "No disponible") },
    { label: "Manzana", value: firstText(scince.geography?.manzana?.code, "No disponible") },
    { label: "Población", value: displayedNumber(scince.demographics?.populationTotal) },
    { label: "Viviendas", value: displayedNumber(scince.demographics?.housingTotal) },
    { label: "Viviendas habitadas", value: displayedNumber(scince.demographics?.inhabitedPrivateHousing) },
    { label: "Viviendas deshabitadas", value: displayedNumber(scince.demographics?.uninhabitedPrivateHousing) },
  ] : [];
  const denueRecords = asArray<any>(institutionalInput.denuePois)
    .filter((item) => item?.source === "DENUE" && item?.provider === "INEGI_DENUE" &&
      item?.territorialStatus === "INSTITUTIONAL" && observedFact(item) &&
      (isTraceable(item) || Boolean(item?.sourceEvidenceId)))
    .map((item, index) => ({
      ...evidenceRecord(item, "INEGI_DENUE", selectedIds, `denue-${index + 1}`),
      sourceType: "INEGI_DENUE",
      title: firstText(item?.name, "Establecimiento sin nombre"),
      summary: [
        `Actividad: ${firstText(item?.activityCode, "No disponible")}`,
        `Categoria: ${firstText(item?.category, item?.activityCategory, "No disponible")}`,
        `Distancia: ${typeof item?.distanceMeters === "number" && Number.isFinite(item.distanceMeters) ? `${item.distanceMeters} m` : "No disponible"}`,
        `Ubicacion: ${firstText(item?.address, item?.locationName, "No disponible")}`,
      ].join("; "),
    }));
  const territorialSourceRecords = denueRecords;
  const incidence = institutionalInput.crimeIncidenceExportContract;
  const incidenceReady = incidence?.productClassification === "DESCRIPTIVE_ANALYTICAL_PRODUCT" &&
    incidence?.analyticalLevel === "DESCRIPTIVE" && incidence?.queryReference?.status === "EXECUTED" &&
    incidence?.queryReference?.admission?.accepted === true && Boolean(incidence?.datasetReference?.datasetId) &&
    Number.isFinite(incidence?.projectionReference?.metrics?.frequency?.totalRecords) &&
    incidence.projectionReference.metrics.frequency.totalRecords >= 0;
  const incidenceFacts = incidenceReady ? [
    { label: "Naturaleza", value: "Producto analitico descriptivo; no evidencia primaria" },
    { label: "Conjunto de datos", value: clean(incidence.datasetReference.datasetId) },
    { label: "Registros", value: displayedNumber(incidence.projectionReference.metrics.frequency.totalRecords) },
    { label: "Periodo inicial", value: firstText(incidence.datasetReference.coverage?.temporal?.start, "No disponible") },
    { label: "Periodo final", value: firstText(incidence.datasetReference.coverage?.temporal?.end, "No disponible") },
  ] : [];
  const gim = institutionalInput.specializedIntelligence.find(isCertifiedGimAnalysisPayload);
  const findingRecords = executiveModel.findings.map((item, index) => {
    const record = evidenceRecord(item, "HALLAZGO_GOBERNADO", selectedIds, `hallazgo-${index + 1}`);
    const evidenceRefs = [...asArray<string>(item?.evidenceReferences), ...asArray<string>(item?.technicalMetadata?.sourceEvidenceIds)];
    const related = evidenceRecords.filter((evidence) => evidenceRefs.includes(evidence.recordId));
    return {
      ...record,
      sourceType: related.map((evidence) => evidence.sourceType).join(", ") || "EVIDENCIA NO VINCULADA EN EL INSUMO",
      referenceLabel: related.map((evidence) => evidence.referenceLabel).filter(Boolean).join(", ") || record.referenceLabel,
      selectedForExecutiveBody: true,
      reportUsage: "SI" as const,
    };
  });

  const allTechnicalRecords = [
    ...evidenceRecords,
    ...streetViewRecords,
    ...osintRecords,
    ...denueRecords,
    ...findingRecords,
    ...institutionalInput.analyses.map((item, index) => evidenceRecord(item, "ANALISIS_MULTIFUENTE", selectedIds, `analysis-${index + 1}`)),
    ...institutionalInput.predictiveAnalyticalProducts.map((item, index) => evidenceRecord(item, "PRODUCTO_PROSPECTIVO", selectedIds, `predictive-product-${index + 1}`)),
    ...executiveModel.decisionImplications.map((item, index) => evidenceRecord(item, "IMPLICACION_DECISION", selectedIds, `decision-${index + 1}`)),
  ];

  const sections = [
    section("identity", "IDENTIDAD DEL ANEXO TÉCNICO", "INSTITUTIONAL_IDENTITY", [
      `Número de expediente: ${numeroExpediente}`,
      `Nombre del expediente: ${firstText(context.nombreExpediente, executiveModel.identity.nombreExpediente, "NO DISPONIBLE EN EL EXPEDIENTE")}`,
      `Fecha: ${firstText(context.fecha, documentModel.identity.fechaEmision, executiveModel.identity.fecha, institutionalInput.generatedAt)}`,
      `Persona perfiladora: ${firstText(context.personaPerfiladora, executiveModel.identity.personaPerfiladora, "NO DISPONIBLE EN EL EXPEDIENTE")}`,
      `Clasificación: ${firstText(context.clasificacion, documentModel.identity.clasificacion, executiveModel.identity.clasificacion)}`,
    ]),
    section("canonical-geography", "GEOGRAFÍA CANÓNICA", "TECHNICAL_SUPPORT", [
      institutionalInput.geography
        ? `Tipo: ${institutionalInput.geography.type}. Estado: ${institutionalInput.geography.validationStatus}. Descripcion: ${executiveModel.territorialSituation.territorialSummary}`
        : "NO DISPONIBLE EN EL EXPEDIENTE",
      visualComposition.principalTerritorialMap.status === "READY_FROM_GOVERNED_VISUAL"
        ? "Representacion cartografica gobernada disponible."
        : visualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED"
          ? "Cartografía canónica disponible y representada mediante mapa territorial gobernado."
          : "Representación cartográfica no disponible como activo gobernado.",
    ], [], true),
    section("evidence-inventory", "INVENTARIO DE EVIDENCIA", "TECHNICAL_SUPPORT",
      evidenceRecords.length ? [`Evidencias inventariadas: ${evidenceRecords.length}`] : [], evidenceRecords),
    section("field-photographs", "EVIDENCIA FOTOGRÁFICA DE CAMPO", "TECHNICAL_SUPPORT",
      fieldPhotoRecords.length ? [`Fotografías de campo elegibles: ${fieldPhotoRecords.length}`] : [], fieldPhotoRecords),
    section("street-view", "GOOGLE STREET VIEW", "TECHNICAL_SUPPORT",
      streetViewRecords.length ? [`Capturas gobernadas: ${streetViewRecords.length}`] : [], streetViewRecords),
    section("territorial-sources", "FUENTES TERRITORIALES", "TECHNICAL_SUPPORT",
      territorialSourceRecords.length ? [`Fuentes territoriales registradas: ${territorialSourceRecords.length}`] : [], territorialSourceRecords),
    section("scince", "CONTEXTO TERRITORIAL SCINCE", "TECHNICAL_SUPPORT", [], [], true, scinceFacts),
    section("denue", "ACTIVIDAD ECONÓMICA DENUE", "TECHNICAL_SUPPORT",
      denueRecords.length ? [`Establecimientos observados: ${denueRecords.length}`] : [], denueRecords),
    section("incidence", "INCIDENCIA DELICTIVA", "TECHNICAL_SUPPORT", [], [], true, incidenceFacts),
    section("osint", "CEFI - FUENTES ABIERTAS", "TECHNICAL_SUPPORT",
      osintRecords.length ? [`Registros observados, adquiridos y trazables: ${osintRecords.length}`] : [], osintRecords),
    ...(gim ? [section("gang-intelligence", "PANDILLAS / GIM", "TECHNICAL_SUPPORT",
      ["Producto especializado certificado y admitido por ACE.",
        ...asArray<string>(gim.analyticalFindings).map((item) => `Hallazgo analitico: ${clean(item)}`)],
      [evidenceRecord(gim, "GIM_CERTIFICADO", selectedIds, "gim-1")])] : []),
    section("findings-matrix", "MATRIZ DE HALLAZGOS Y EVIDENCIA", "TECHNICAL_SUPPORT",
      findingRecords.length ? [`Hallazgos gobernados: ${findingRecords.length}`] : [], findingRecords),
    section("multisource-correlation", "CORRELACIÓN MULTIFUENTE", "TECHNICAL_SUPPORT", [
      ...availableNarrative(executiveModel.multisourceAnalysis.convergencias).map((item) => `Convergencia aceptada: ${item}`),
      ...availableNarrative(executiveModel.multisourceAnalysis.contradicciones).map((item) => `Contradicción: ${item}`),
      ...availableNarrative(executiveModel.multisourceAnalysis.dependenciasParciales).map((item) => `Dependencia: ${item}`),
      ...availableNarrative(executiveModel.multisourceAnalysis.brechasInformacion).map((item) => `Brecha: ${item}`),
    ], [], true),
    section("prospective-products", "PROSPECTIVA GOBERNADA", "TECHNICAL_SUPPORT", executiveModel.prospectiveAnalysis.technicalMetadata.sourceProductIds.length ? [
      `Tendencia: ${executiveModel.prospectiveAnalysis.tendencia}`,
      `Escenario: ${executiveModel.prospectiveAnalysis.escenario}`,
      `Vigencia: ${executiveModel.prospectiveAnalysis.vigencia}`,
      ...executiveModel.prospectiveAnalysis.limitaciones.map((item) => `Limitacion: ${item}`),
    ] : [] , [], true),
    section("hypothesis-history", "HIPÓTESIS E HISTORIAL", "TECHNICAL_SUPPORT", [
      firstText((institutionalInput.hypothesis as any)?.currentHypothesis, (institutionalInput as any)?.initialHypothesis, "NO DISPONIBLE EN EL EXPEDIENTE"),
      ...asArray<any>((institutionalInput as any)?.hypothesisHistory).map((item) => firstText(item?.summary, item?.text, item?.status)),
    ], [], true),
    section("technical-traceability", "TRAZABILIDAD TÉCNICA", "AUDIT_TRACEABILITY", [
      `Expediente: ${numeroExpediente}`,
      `Registros con trazabilidad: ${allTechnicalRecords.filter((record) => record.traceabilityIds.length).length}`,
      `Fuentes vinculadas: ${dedupe(allTechnicalRecords.map((record) => record.sourceType)).join(", ") || "NO DISPONIBLE EN EL EXPEDIENTE"}`,
    ], [], true),
    section("sources-limitations", "FUENTES, EXCLUSIONES Y LIMITACIONES", "AUDIT_TRACEABILITY", [
      `Elementos excluidos por gobernanza: ${institutionalInput.exclusions.length}`,
      `Declaraciones de limite: ${institutionalInput.disclosures.length}`,
      ...institutionalInput.exclusions.map((item) => `Exclusion ${firstText(item.itemType)}: ${firstText(item.reason)}`),
      ...institutionalInput.disclosures.map((item) => `Declaracion ${firstText(item.itemType)}: ${firstText(item.message)}`),
    ], [], true),
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
      principalMapId: visualComposition.principalTerritorialMap.mapId,
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
