import type {
  InstitutionalReportInput,
  PublicationExclusion,
  PublicationItemType,
} from "@/utils/institutionalReportPublicationContract";
import { evaluatePredictiveProductAdmission } from "@/utils/institutionalPredictiveProductIntegration";
import { resolveVisibleNumeroExpediente } from "@/utils/documentIdentity";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";

export const EXECUTIVE_GEOINT_REPORT_MODEL_VERSION = "1.0";

export const EXECUTIVE_GEOINT_LIMITS = {
  hallazgosClave: 5,
  decisionesSugeridas: 5,
  evidenciasClave: 4,
  visualCandidates: 5,
  executiveFindings: 5,
} as const;

export type ExecutivePriority = "INMEDIATA" | "CORTO_PLAZO" | "SEGUIMIENTO";
export type ExecutiveConfidenceLabel = "ALTO" | "MEDIO" | "BAJO" | "NO DISPONIBLE";
export type ExecutiveSupportLevel = "ALTO" | "MEDIO" | "BAJO" | "INSUFICIENTE";

export interface ExecutiveGeointReportBuildContext {
  documentIdentity?: {
    numeroExpediente?: unknown;
    ceipolId?: unknown;
    projectId?: unknown;
    name?: unknown;
  } | null;
  nombreExpediente?: unknown;
  fecha?: unknown;
  personaPerfiladora?: unknown;
  clasificacion?: unknown;
  vigenciaAnalisis?: unknown;
  now?: string;
}

export interface ExecutiveDocumentIdentity {
  numeroExpediente: string;
  nombreExpediente: string;
  fecha: string;
  personaPerfiladora: string;
  geografia: string;
  clasificacion: string;
  vigenciaAnalisis: string;
  technicalMetadata: {
    projectId: string;
    geographyId?: string | null;
    ceipolId?: string | null;
    source: "InstitutionalReportInput";
  };
}

export interface ExecutivePanorama {
  situacion: string;
  hallazgosClave: string[];
  escenario: string;
  decisionesSugeridas: string[];
  nivelConfianza: ExecutiveConfidenceLabel;
  incertidumbre: string;
  vigencia: string;
}

export interface ExecutiveTerritorialSituation {
  canonicalGeography: CanonicalProjectGeography | null;
  territorialSummary: string;
  principalMapCandidate: ExecutiveVisualCandidate | null;
  territorialFindings: string[];
  relevantPoi: string[];
  spatialLimitations: string[];
}

export interface ExecutiveFinding {
  findingId: string;
  title: string;
  summary: string;
  evidenceReferences: string[];
  sourceTypes: string[];
  supportingFactors: string[];
  contradictingFactors: string[];
  interpretation: string;
  implication: string;
  governedAction?: string;
  confidence: ExecutiveConfidenceLabel;
  limitations: string[];
  traceabilityIds: string[];
  technicalMetadata: {
    sourceFindingIds: string[];
    sourceEvidenceIds: string[];
    sourceAnalysisIds: string[];
  };
}

export interface ExecutiveEvidenceItem {
  evidenceId: string;
  title: string;
  summary: string;
  visualReference?: string | null;
  evidenceReferences: string[];
  sourceTypes: string[];
  relatedFindingIds: string[];
  selectionReason: string;
  limitations: string[];
  traceabilityIds: string[];
  technicalMetadata: {
    originalItemType: PublicationItemType | "VISUAL_CANDIDATE";
    sourceItemId: string;
  };
}

export interface ExecutiveMultisourceAnalysis {
  convergencias: string[];
  contradicciones: string[];
  fuentesIndependientes: string[];
  dependenciasParciales: string[];
  brechasInformacion: string[];
  nivelSoporte: ExecutiveSupportLevel;
  traceabilityIds: string[];
  technicalMetadata: {
    sourceAnalysisIds: string[];
    sourceEvidenceIds: string[];
  };
}

export interface ExecutiveProspectiveAnalysis {
  tendencia: string;
  escenario: string;
  factoresSoporte: string[];
  factoresContradiccion: string[];
  nivelConfianza: ExecutiveConfidenceLabel;
  incertidumbre: string;
  vigencia: string;
  limitaciones: string[];
  relacionHipotesis: string;
  traceabilityIds: string[];
  excludedProducts: Array<{ productId: string; reasonCode: string; reason: string }>;
  technicalMetadata: {
    sourceProductIds: string[];
  };
}

export interface ExecutiveDecisionImplication {
  hallazgoRelacionado: string;
  implicacion: string;
  accionSugerida: string;
  prioridad: ExecutivePriority;
  fundamento: string;
  limitaciones: string[];
  traceabilityIds: string[];
  technicalMetadata: {
    sourceFindingId?: string;
    sourceAnalysisId?: string;
  };
}

export interface ExecutiveVisualCandidate {
  visualId: string;
  title: string;
  summary: string;
  visualType: string;
  reference?: string | null;
  relatedFindingIds: string[];
  traceabilityIds: string[];
  technicalMetadata: {
    sourceItemId: string;
    sourceType: PublicationItemType | "VISUAL_CANDIDATE";
  };
}

export interface TechnicalAnnexReference {
  available: boolean;
  references: Array<{
    kind:
      | "ALBUM_COMPLETO"
      | "STREET_VIEW_DETALLADO"
      | "OSINT_COMPLETO"
      | "TABLAS"
      | "MATRICES"
      | "POI"
      | "LINEAGE"
      | "TRACEABILITY"
      | "AUDITORIA_IA"
      | "HISTORIAL_HIPOTESIS"
      | "MAPAS_SECUNDARIOS";
    label: string;
    itemCount: number;
    traceabilityIds: string[];
  }>;
}

export interface ExecutiveGeointReportModel {
  identity: ExecutiveDocumentIdentity;
  panorama: ExecutivePanorama;
  territorialSituation: ExecutiveTerritorialSituation;
  findings: ExecutiveFinding[];
  keyEvidence: ExecutiveEvidenceItem[];
  multisourceAnalysis: ExecutiveMultisourceAnalysis;
  prospectiveAnalysis: ExecutiveProspectiveAnalysis;
  decisionImplications: ExecutiveDecisionImplication[];
  visualCandidates: ExecutiveVisualCandidate[];
  technicalAnnex: TechnicalAnnexReference;
  selectionAudit: {
    exclusions: PublicationExclusion[];
    executiveExclusions: Array<{ itemId: string; itemType: string; reasonCode: string; reason: string }>;
    limits: typeof EXECUTIVE_GEOINT_LIMITS;
  };
  presentation: {
    labels: Record<string, string>;
    visibleText: string[];
  };
  technicalMetadata: {
    modelName: "ExecutiveGeointReportModel";
    modelVersion: typeof EXECUTIVE_GEOINT_REPORT_MODEL_VERSION;
    sourceProjectId: string;
    generatedAt: string;
    source: "InstitutionalReportInput";
  };
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

function limited<T>(values: T[], count: number): T[] {
  return values.slice(0, count);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function itemId(item: any, fallback: string): string {
  return firstText(
    item?.findingId,
    item?.evidenceId,
    item?.analysisId,
    item?.conclusionId,
    item?.productId,
    item?.outputId,
    item?.comparisonId,
    item?.visualId,
    item?.id,
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
    item?.publicationEligibility?.itemId,
  ]);
}

function evidenceIds(item: any): string[] {
  return dedupe([
    item?.evidenceId,
    item?.sourceEvidenceId,
    item?.multimodalEvidence?.evidenceId,
    ...(asArray<string>(item?.evidenceIds)),
    ...(asArray<string>(item?.supportingEvidenceIds)),
    ...(asArray<string>(item?.sourceEvidenceIds)),
    ...(asArray<string>(item?.publicationEligibility?.lineageRefs?.evidenceIds)),
  ]);
}

function findingIds(item: any): string[] {
  return dedupe([
    item?.findingId,
    item?.id,
    ...(asArray<string>(item?.findingIds)),
    ...(asArray<string>(item?.relatedFindingIds)),
    ...(asArray<string>(item?.publicationEligibility?.lineageRefs?.findingIds)),
  ]);
}

function analysisIds(item: any): string[] {
  return dedupe([
    item?.analysisId,
    item?.outputId,
    item?.productId,
    ...(asArray<string>(item?.analysisIds)),
    ...(asArray<string>(item?.publicationEligibility?.lineageRefs?.analysisIds)),
  ]);
}

function sourceType(item: any, fallback = "FUENTE_GOBERNADA"): string {
  return firstText(
    item?.sourceType,
    item?.providerType,
    item?.sourceKind,
    item?.sourceProvider,
    item?.category,
    item?.tipo,
    item?.publicationEligibility?.itemType,
    fallback
  );
}

function isAdmitted(item: any): boolean {
  const eligibility = item?.publicationEligibility;
  if (!eligibility) return true;
  return eligibility.eligibility !== "INELIGIBLE" && eligibility.role !== "AI_SUGGESTION";
}

function confidenceLabel(value: unknown): ExecutiveConfidenceLabel {
  if (typeof value === "number") {
    if (value >= 0 && value <= 1) {
      if (value >= 0.7) return "ALTO";
      if (value >= 0.45) return "MEDIO";
      return "BAJO";
    }
    if (value > 1 && value <= 100) {
      if (value >= 70) return "ALTO";
      if (value >= 45) return "MEDIO";
      return "BAJO";
    }
    return "NO DISPONIBLE";
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return confidenceLabel(Number(value));
  }
  const text = clean(value).toUpperCase();
  if (["HIGH", "ALTO", "ROBUST", "ROBUSTO"].includes(text)) return "ALTO";
  if (["MEDIUM", "MODERATE", "MEDIO", "MODERADO"].includes(text)) return "MEDIO";
  if (["LOW", "BAJO"].includes(text)) return "BAJO";
  return "NO DISPONIBLE";
}

function predictiveGeographyType(type: CanonicalProjectGeography["type"] | null | undefined) {
  if (type === "INDIVIDUAL") return "POINT";
  return type ?? null;
}

function institutionalLabel(value: unknown): string {
  const text = clean(value).toUpperCase();
  const labels: Record<string, string> = {
    APPROVED: "APROBADO",
    PENDING_REVIEW: "PENDIENTE DE REVISION",
    STALE: "VIGENCIA VENCIDA",
    ANALYTICAL_PROJECTION: "PROYECCION ANALITICA",
    CONFIDENCE: "NIVEL DE CONFIANZA",
    UNCERTAINTY: "INCERTIDUMBRE",
    TREND: "TENDENCIA",
    SCENARIO: "ESCENARIO",
    INCREASING: "CRECIENTE",
    DECREASING: "DECRECIENTE",
    STABLE: "ESTABLE",
    INTERMITTENT: "INTERMITENTE",
    INSUFFICIENT_DATA: "INFORMACION INSUFICIENTE",
    UNKNOWN: "NO DISPONIBLE",
    PERSISTENCE: "PERSISTENCIA",
    INTENSIFICATION: "INTENSIFICACION",
    REDUCTION: "REDUCCION",
    DISPLACEMENT: "DESPLAZAMIENTO",
    RECONFIGURATION: "RECONFIGURACION",
    INSUFFICIENT_EVIDENCE: "EVIDENCIA INSUFICIENTE",
    LOW: "BAJA",
    MODERATE: "MODERADA",
    HIGH: "ALTA",
    VERY_HIGH: "MUY ALTA",
    SUPPORTS: "SOPORTA LA HIPOTESIS",
    CONTRADICTS: "CONTRADICE LA HIPOTESIS",
    NEUTRAL: "NEUTRAL",
    INSUFFICIENT: "INSUFICIENTE",
  };
  return labels[text] || clean(value) || "NO DISPONIBLE";
}

function visibleSummary(item: any, fallback: string): string {
  return firstText(
    item?.summary,
    item?.resumen,
    item?.description,
    item?.descripcion,
    item?.interpretation,
    item?.analyticalFinding,
    item?.finding,
    item?.note,
    item?.caption,
    item?.text,
    fallback
  );
}

function sanitizeVisibleText(value: string): string {
  return value
    .replace(/\bSOURCE_FACT\b/g, "hecho fuente")
    .replace(/\bPENDING_REVIEW\b/g, "pendiente de revision")
    .replace(/\bAPPROVED\b/g, "aprobado")
    .replace(/\bSTALE\b/g, "vigencia vencida")
    .replace(/\bANALYTICAL_PROJECTION\b/g, "proyeccion analitica")
    .replace(/\bReportEngine\b/g, "motor documental")
    .replace(/\bPublicationGate\b/g, "control de publicacion")
    .replace(/\bADR-\d+(?:\.\d+)?\b/g, "referencia interna")
    .replace(/\bv\d+\.\d+\.\d+\b/g, "version interna")
    .replace(/\bpayload\b/gi, "insumo")
    .replace(/\bclaim\b/gi, "afirmacion")
    .replace(/\bmock\b/gi, "registro no reportable")
    .replace(/\blegacy\b/gi, "registro historico")
    .replace(/\s+/g, " ")
    .trim();
}

function visible(value: string): string {
  return sanitizeVisibleText(value);
}

function visibleList(values: string[]): string[] {
  return values.map(visible).filter(Boolean);
}

function governedAction(item: any): string {
  const direct = firstText(
    item?.recommendation,
    item?.action,
    item?.suggestedAction,
    item?.decisionImplication,
    item?.operationalRecommendation,
    item?.accionSugerida,
    item?.recomendacionOperativa
  );
  const fromLists = firstText(
    ...asArray<string>(item?.recommendations),
    ...asArray<string>(item?.recommendedActions),
    ...asArray<string>(item?.accionesSugeridas),
    ...asArray<string>(item?.recomendaciones)
  );
  return direct || fromLists;
}

function buildIdentity(input: InstitutionalReportInput, context: ExecutiveGeointReportBuildContext): ExecutiveDocumentIdentity {
  const numeroExpediente = resolveVisibleNumeroExpediente({
    numeroExpediente: context.documentIdentity?.numeroExpediente,
    ceipolId: context.documentIdentity?.ceipolId,
    projectId: input.projectId,
  });
  const geographyId = input.geography?.geographyId ?? input.lineageSummary?.geographyId ?? null;
  return {
    numeroExpediente: visible(numeroExpediente),
    nombreExpediente: visible(firstText(context.nombreExpediente, context.documentIdentity?.name, "Nombre de expediente no disponible")),
    fecha: visible(firstText(context.fecha, input.generatedAt, context.now, "Fecha no disponible")),
    personaPerfiladora: visible(firstText(context.personaPerfiladora, "Persona perfiladora no disponible")),
    geografia: input.geography
      ? visible(`${institutionalLabel(input.geography.type)} / ${input.geography.validationStatus === "VALID" ? "GEOGRAFIA VALIDADA" : "GEOGRAFIA PARCIAL"}`)
      : "Geografia no disponible",
    clasificacion: visible(firstText(context.clasificacion, "CONFIDENCIAL - USO INSTITUCIONAL")),
    vigenciaAnalisis: visible(firstText(context.vigenciaAnalisis, input.predictiveAnalyticalProducts[0]?.validUntil, "Vigencia no disponible")),
    technicalMetadata: {
      projectId: input.projectId,
      geographyId,
      ceipolId: clean(context.documentIdentity?.ceipolId) || null,
      source: "InstitutionalReportInput",
    },
  };
}

function buildFindings(input: InstitutionalReportInput): ExecutiveFinding[] {
  const grouped = new Map<string, any[]>();
  const admittedFindings = input.findings.filter(isAdmitted);
  admittedFindings.forEach((finding, index) => {
    const id = itemId(finding, `finding-${index + 1}`);
    grouped.set(id, [...(grouped.get(id) || []), finding]);
  });

  return limited(Array.from(grouped.entries()), EXECUTIVE_GEOINT_LIMITS.executiveFindings).map(([id, items], index) => {
    const primary = items[0];
    const relatedEvidence = input.evidence.filter((evidence) => findingIds(evidence).includes(id) || evidenceIds(primary).some((ref) => evidenceIds(evidence).includes(ref)));
    const relatedAnalyses = input.analyses.filter((analysis) => findingIds(analysis).includes(id));
    const sourceTypes = dedupe([
      ...items.map((item) => sourceType(item, "HALLAZGO_GOBERNADO")),
      ...relatedEvidence.map((item) => sourceType(item, "EVIDENCIA_GOBERNADA")),
      ...relatedAnalyses.map((item) => sourceType(item, "ANALISIS_GOBERNADO")),
    ]);
    const supportingFactors = dedupe([
      ...(asArray<string>(primary?.supportingFactors)),
      ...(asArray<string>(primary?.supportFactors)),
      ...(asArray<string>(primary?.evidenceReferences)),
      ...relatedEvidence.map((item) => visibleSummary(item, "")),
    ]);
    const contradictingFactors = dedupe([
      ...(asArray<string>(primary?.contradictingFactors)),
      ...(asArray<string>(primary?.contradictions)),
      ...(asArray<string>(primary?.evidenceConflicts)),
    ]);
    const limitations = dedupe([
      ...(asArray<string>(primary?.limitations)),
      ...(asArray<string>(primary?.limitaciones)),
      ...(asArray<string>(primary?.publicationEligibility?.disclosures).map((item: any) => item?.message)),
    ]);
    const action = governedAction(primary);
    return {
      findingId: id,
      title: visible(firstText(primary?.title, primary?.titulo, `Hallazgo ejecutivo ${index + 1}`)),
      summary: visible(visibleSummary(primary, "Informacion insuficiente para sintetizar el hallazgo.")),
      evidenceReferences: dedupe([...items.flatMap(evidenceIds), ...relatedEvidence.flatMap(evidenceIds)]),
      sourceTypes,
      supportingFactors: visibleList(supportingFactors.length ? supportingFactors : ["Soporte no disponible en el insumo institucional."]),
      contradictingFactors: visibleList(contradictingFactors),
      interpretation: visible(firstText(primary?.interpretation, primary?.analysis, primary?.analisis, "Interpretacion no disponible en el insumo institucional.")),
      implication: visible(firstText(primary?.implication, primary?.impacto, "Implicacion no disponible; requiere decision humana.")),
      ...(action ? { governedAction: visible(action) } : {}),
      confidence: confidenceLabel(primary?.confidence ?? primary?.confidenceLevel ?? primary?.nivelConfianza),
      limitations: visibleList(limitations),
      traceabilityIds: dedupe([...items.flatMap(traceabilityIds), ...relatedEvidence.flatMap(traceabilityIds), ...relatedAnalyses.flatMap(traceabilityIds)]),
      technicalMetadata: {
        sourceFindingIds: dedupe(items.flatMap(findingIds)),
        sourceEvidenceIds: dedupe([...items.flatMap(evidenceIds), ...relatedEvidence.flatMap(evidenceIds)]),
        sourceAnalysisIds: dedupe(relatedAnalyses.flatMap(analysisIds)),
      },
    };
  });
}

function buildKeyEvidence(input: InstitutionalReportInput, findings: ExecutiveFinding[]): ExecutiveEvidenceItem[] {
  const priorityFindingIds = findings.map((finding) => finding.findingId);
  const candidates = [
    ...input.visualProducts.map((item) => ({ item, type: "VISUAL_CANDIDATE" as const })),
    ...input.evidence.map((item) => ({ item, type: "EVIDENCE" as const })),
    ...input.streetView.map((item) => ({ item, type: "STREET_VIEW" as const })),
    ...input.temporalComparisons.map((item) => ({ item, type: "TEMPORAL_COMPARISON" as const })),
  ].filter(({ item }) => isAdmitted(item));

  const scored = candidates.map((candidate, index) => {
    const ids = findingIds(candidate.item);
    const traces = traceabilityIds(candidate.item);
    const visual = firstText(candidate.item?.dataUrl, candidate.item?.imageUrl, candidate.item?.previewUrl, candidate.item?.url, candidate.item?.assetRef);
    const relatedPriority = ids.some((id) => priorityFindingIds.includes(id));
    const score =
      (relatedPriority ? 40 : 0) +
      (traces.length ? 25 : 0) +
      (visual ? 20 : 0) +
      (candidate.type === "VISUAL_CANDIDATE" ? 10 : 0) +
      Math.max(0, 4 - index);
    return { ...candidate, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const seen = new Set<string>();
  const selected: typeof scored = [];
  for (const candidate of scored) {
    const id = itemId(candidate.item, `${candidate.type}-${candidate.index + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    selected.push(candidate);
    if (selected.length >= EXECUTIVE_GEOINT_LIMITS.evidenciasClave) break;
  }

  return selected.map(({ item, type }, index) => ({
    evidenceId: itemId(item, `evidence-${index + 1}`),
    title: visible(firstText(item?.title, item?.titulo, item?.caption, `Evidencia clave ${index + 1}`)),
    summary: visible(visibleSummary(item, "Evidencia seleccionada sin sintesis disponible.")),
    visualReference: firstText(item?.dataUrl, item?.imageUrl, item?.previewUrl, item?.url, item?.assetRef) || null,
    evidenceReferences: evidenceIds(item),
    sourceTypes: dedupe([sourceType(item, type)]),
    relatedFindingIds: findingIds(item).filter((id) => priorityFindingIds.includes(id)),
    selectionReason: "Seleccionada por relevancia ejecutiva, trazabilidad y disponibilidad visual gobernada.",
    limitations: visibleList(dedupe([...(asArray<string>(item?.limitations)), ...(asArray<string>(item?.limitaciones))])),
    traceabilityIds: traceabilityIds(item),
    technicalMetadata: {
      originalItemType: type,
      sourceItemId: itemId(item, `${type}-${index + 1}`),
    },
  }));
}

function buildVisualCandidates(input: InstitutionalReportInput): ExecutiveVisualCandidate[] {
  return limited(input.visualProducts.filter(isAdmitted), EXECUTIVE_GEOINT_LIMITS.visualCandidates).map((item, index) => ({
    visualId: itemId(item, `visual-${index + 1}`),
    title: visible(firstText(item?.title, item?.titulo, `Candidato visual ${index + 1}`)),
    summary: visible(visibleSummary(item, "Producto visual gobernado sin descripcion disponible.")),
    visualType: institutionalLabel(firstText(item?.visualType, item?.kind, item?.type, "VISUAL")),
    reference: firstText(item?.dataUrl, item?.imageUrl, item?.previewUrl, item?.url, item?.assetRef) || null,
    relatedFindingIds: findingIds(item),
    traceabilityIds: traceabilityIds(item),
    technicalMetadata: {
      sourceItemId: itemId(item, `visual-${index + 1}`),
      sourceType: "VISUAL_CANDIDATE",
    },
  }));
}

function buildMultisourceAnalysis(input: InstitutionalReportInput): ExecutiveMultisourceAnalysis {
  const analyses = input.analyses.filter(isAdmitted);
  const convergences = dedupe([
    ...analyses.flatMap((item) => asArray<string>(item?.convergences)),
    ...analyses.flatMap((item) => asArray<string>(item?.supportingConvergences)),
    ...asArray<any>((input as any).convergences).map((item) => firstText(item?.summary, item?.phenomenon, item?.convergenceId)),
  ]);
  const contradictions = dedupe([
    ...analyses.flatMap((item) => asArray<string>(item?.contradictions)),
    ...analyses.flatMap((item) => asArray<string>(item?.contradictingFactors)),
    ...input.predictiveAnalyticalProducts.flatMap((item) => asArray<string>(item?.contradictingFactors)),
  ]);
  const dependencies = dedupe([
    ...analyses.flatMap((item) => asArray<any>(item?.sourceDependencies).map((dep) => firstText(dep?.reason, dep?.independence))),
    ...asArray<any>((input as any).convergences).flatMap((item) => asArray<any>(item?.sourceDependencies).map((dep) => firstText(dep?.reason, dep?.independence))),
  ]);
  const independent = dedupe([
    ...analyses.flatMap((item) => asArray<string>(item?.independentSources)),
    ...input.lineageSummary.sourceIds,
  ]);
  const gaps = dedupe([
    ...analyses.flatMap((item) => asArray<string>(item?.informationGaps)),
    ...analyses.flatMap((item) => asArray<string>(item?.limitations)),
    ...input.disclosures.map((item) => item.message),
  ]);
  const support: ExecutiveSupportLevel =
    input.lineageSummary.itemCount >= 6 && independent.length >= 3 ? "ALTO" :
    input.lineageSummary.itemCount >= 3 ? "MEDIO" :
    input.lineageSummary.itemCount > 0 ? "BAJO" : "INSUFICIENTE";

  return {
    convergencias: visibleList(convergences.length ? convergences : ["Convergencias no disponibles en el insumo institucional."]),
    contradicciones: visibleList(contradictions),
    fuentesIndependientes: visibleList(independent),
    dependenciasParciales: visibleList(dependencies),
    brechasInformacion: visibleList(gaps),
    nivelSoporte: support,
    traceabilityIds: dedupe([...analyses.flatMap(traceabilityIds), ...input.predictiveAnalyticalProducts.flatMap(traceabilityIds)]),
    technicalMetadata: {
      sourceAnalysisIds: dedupe(analyses.flatMap(analysisIds)),
      sourceEvidenceIds: input.lineageSummary.evidenceIds,
    },
  };
}

function buildProspectiveAnalysis(input: InstitutionalReportInput, context: ExecutiveGeointReportBuildContext): ExecutiveProspectiveAnalysis {
  const excludedProducts: ExecutiveProspectiveAnalysis["excludedProducts"] = [];
  const admitted = input.predictiveAnalyticalProducts.filter((product) => {
    const admission = evaluatePredictiveProductAdmission(product, {
      expedienteId: input.projectId,
      geographyId: input.geography?.geographyId ?? input.lineageSummary.geographyId ?? null,
      canonicalGeographyType: predictiveGeographyType(input.geography?.type),
      now: new Date(context.now || input.generatedAt),
    });
    if (admission.admissible) return true;
    admission.reasons.forEach((reason) => excludedProducts.push({ productId: admission.productId, reasonCode: reason, reason }));
    return false;
  });

  const product = admitted[0];
  if (!product) {
    return {
      tendencia: "Informacion insuficiente",
      escenario: "Evidencia insuficiente",
      factoresSoporte: [],
      factoresContradiccion: [],
      nivelConfianza: "NO DISPONIBLE",
      incertidumbre: "No disponible",
      vigencia: "No disponible",
      limitaciones: ["No existe producto prospectivo admitido para el informe ejecutivo."],
      relacionHipotesis: "Insuficiente",
      traceabilityIds: [],
      excludedProducts,
      technicalMetadata: { sourceProductIds: [] },
    };
  }

  return {
    tendencia: visible(institutionalLabel(product.trend)),
    escenario: visible(institutionalLabel(product.scenario)),
    factoresSoporte: visibleList(limited(dedupe(asArray<string>(product.supportingFactors)), 5)),
    factoresContradiccion: visibleList(limited(dedupe(asArray<string>(product.contradictingFactors)), 5)),
    nivelConfianza: confidenceLabel(product.confidence),
    incertidumbre: visible(institutionalLabel(product.uncertaintyLevel)),
    vigencia: visible(firstText(product.validUntil, product.temporalWindow?.validUntil, "No disponible")),
    limitaciones: visibleList(dedupe(asArray<string>(product.limitations))),
    relacionHipotesis: visible(institutionalLabel(product.hypothesisRelation)),
    traceabilityIds: traceabilityIds(product),
    excludedProducts,
    technicalMetadata: {
      sourceProductIds: admitted.map((item) => itemId(item, "predictive-product")),
    },
  };
}

function buildDecisionImplications(findings: ExecutiveFinding[], prospective: ExecutiveProspectiveAnalysis): ExecutiveDecisionImplication[] {
  const fromFindings = findings.map((finding, index): ExecutiveDecisionImplication => ({
    hallazgoRelacionado: finding.title,
    implicacion: finding.implication,
    accionSugerida: finding.governedAction || "ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL",
    prioridad: index === 0 ? "INMEDIATA" : index <= 2 ? "CORTO_PLAZO" : "SEGUIMIENTO",
    fundamento: finding.summary,
    limitaciones: finding.limitations,
    traceabilityIds: finding.traceabilityIds,
    technicalMetadata: {
      sourceFindingId: finding.findingId,
    },
  }));

  return limited(fromFindings, EXECUTIVE_GEOINT_LIMITS.decisionesSugeridas);
}

function buildPanorama(
  input: InstitutionalReportInput,
  findings: ExecutiveFinding[],
  decisions: ExecutiveDecisionImplication[],
  prospective: ExecutiveProspectiveAnalysis,
  multisource: ExecutiveMultisourceAnalysis,
  identity: ExecutiveDocumentIdentity
): ExecutivePanorama {
  return {
    situacion: visible(firstText(
      (input as any).governedExecutiveSummary?.text,
      (input as any).executiveSummary,
      input.hypothesis?.currentHypothesis,
      "Situacion insuficiente/no disponible en el insumo institucional."
    )),
    hallazgosClave: limited(findings.map((finding) => finding.summary), EXECUTIVE_GEOINT_LIMITS.hallazgosClave),
    escenario: prospective.escenario,
    decisionesSugeridas: limited(decisions.map((decision) => decision.accionSugerida), EXECUTIVE_GEOINT_LIMITS.decisionesSugeridas),
    nivelConfianza: findings[0]?.confidence || (multisource.nivelSoporte === "ALTO" ? "ALTO" : multisource.nivelSoporte === "MEDIO" ? "MEDIO" : "BAJO"),
    incertidumbre: prospective.incertidumbre,
    vigencia: identity.vigenciaAnalisis,
  };
}

function buildTerritorialSituation(input: InstitutionalReportInput, visualCandidates: ExecutiveVisualCandidate[], findings: ExecutiveFinding[]): ExecutiveTerritorialSituation {
  const geography = input.geography;
  return {
    canonicalGeography: geography,
    territorialSummary: geography
      ? visible(`Unidad territorial ${institutionalLabel(geography.type)} con estado ${geography.validationStatus === "VALID" ? "validado" : "parcial"}.`)
      : "Geografia canonica no disponible.",
    principalMapCandidate: visualCandidates.find((visual) => /MAP|MAPA/i.test(visual.visualType)) || visualCandidates[0] || null,
    territorialFindings: findings.map((finding) => finding.summary),
    relevantPoi: visibleList(dedupe([
      ...input.osint.map((item) => firstText(item?.poiName, item?.placeName, item?.name, item?.title)),
      ...input.evidence.map((item) => firstText(item?.poiName, item?.placeName, item?.locationName)),
    ])),
    spatialLimitations: visibleList(dedupe([
      ...(geography?.limitations || []),
      ...input.disclosures.filter((item) => /GEOGRAPHY|SPATIAL|VISUAL/i.test(item.code)).map((item) => item.message),
    ])),
  };
}

function buildAnnex(input: InstitutionalReportInput): TechnicalAnnexReference {
  const references: TechnicalAnnexReference["references"] = ([
    { kind: "ALBUM_COMPLETO", label: "Album completo", itemCount: input.evidence.length, traceabilityIds: dedupe(input.evidence.flatMap(traceabilityIds)) },
    { kind: "STREET_VIEW_DETALLADO", label: "IMAGENES PANORAMICAS DE GOOGLE - DETALLE TECNICO", itemCount: input.streetView.length, traceabilityIds: dedupe(input.streetView.flatMap(traceabilityIds)) },
    { kind: "OSINT_COMPLETO", label: "OSINT completo", itemCount: input.osint.length, traceabilityIds: dedupe(input.osint.flatMap(traceabilityIds)) },
    { kind: "MATRICES", label: "Matrices multifuente", itemCount: input.analyses.length, traceabilityIds: dedupe(input.analyses.flatMap(traceabilityIds)) },
    { kind: "TRACEABILITY", label: "Trazabilidad institucional", itemCount: input.lineageSummary.itemCount, traceabilityIds: input.lineageSummary.sourceIds },
    { kind: "MAPAS_SECUNDARIOS", label: "Mapas secundarios", itemCount: input.visualProducts.length, traceabilityIds: dedupe(input.visualProducts.flatMap(traceabilityIds)) },
  ] as TechnicalAnnexReference["references"]).filter((item) => item.itemCount > 0);
  return { available: references.length > 0, references };
}

function visiblePresentationText(model: Omit<ExecutiveGeointReportModel, "presentation">): string[] {
  return [
    model.identity.numeroExpediente,
    model.identity.nombreExpediente,
    model.identity.fecha,
    model.identity.personaPerfiladora,
    model.identity.geografia,
    model.panorama.situacion,
    ...model.panorama.hallazgosClave,
    model.panorama.escenario,
    ...model.panorama.decisionesSugeridas,
    model.territorialSituation.territorialSummary,
    ...model.findings.flatMap((finding) => [
      finding.title,
      finding.summary,
      finding.interpretation,
      finding.implication,
      ...finding.supportingFactors,
      ...finding.contradictingFactors,
      ...finding.limitations,
    ]),
    ...model.keyEvidence.flatMap((item) => [item.title, item.summary, item.selectionReason, ...item.limitations]),
    ...model.multisourceAnalysis.convergencias,
    ...model.multisourceAnalysis.contradicciones,
    ...model.multisourceAnalysis.brechasInformacion,
    model.prospectiveAnalysis.tendencia,
    model.prospectiveAnalysis.escenario,
    ...model.prospectiveAnalysis.factoresSoporte,
    ...model.prospectiveAnalysis.factoresContradiccion,
    ...model.prospectiveAnalysis.limitaciones,
    ...model.decisionImplications.flatMap((item) => [item.hallazgoRelacionado, item.implicacion, item.accionSugerida, item.fundamento, ...item.limitaciones]),
  ].filter(Boolean).map(sanitizeVisibleText);
}

export function buildExecutiveGeointReportModel(
  institutionalInput: InstitutionalReportInput,
  context: ExecutiveGeointReportBuildContext = {}
): ExecutiveGeointReportModel {
  const input = institutionalInput;
  const identity = buildIdentity(input, context);
  const findings = buildFindings(input);
  const keyEvidence = buildKeyEvidence(input, findings);
  const visualCandidates = buildVisualCandidates(input);
  const multisourceAnalysis = buildMultisourceAnalysis(input);
  const prospectiveAnalysis = buildProspectiveAnalysis(input, context);
  const decisionImplications = buildDecisionImplications(findings, prospectiveAnalysis);
  const territorialSituation = buildTerritorialSituation(input, visualCandidates, findings);
  const panorama = buildPanorama(input, findings, decisionImplications, prospectiveAnalysis, multisourceAnalysis, identity);
  const executiveExclusions = [
    ...input.evidence.filter((item) => !isAdmitted(item)).map((item) => ({
      itemId: itemId(item, "evidence"),
      itemType: "EVIDENCE",
      reasonCode: "NOT_ADMITTED_BY_EXISTING_GOVERNANCE",
      reason: "Item excluded because existing institutional governance did not admit it.",
    })),
    ...prospectiveAnalysis.excludedProducts.map((item) => ({
      itemId: item.productId,
      itemType: "PREDICTIVE_ANALYTICAL_PRODUCT",
      reasonCode: item.reasonCode,
      reason: item.reason,
    })),
  ];
  const modelWithoutPresentation = {
    identity,
    panorama,
    territorialSituation,
    findings,
    keyEvidence,
    multisourceAnalysis,
    prospectiveAnalysis,
    decisionImplications,
    visualCandidates,
    technicalAnnex: buildAnnex(input),
    selectionAudit: {
      exclusions: input.exclusions,
      executiveExclusions,
      limits: EXECUTIVE_GEOINT_LIMITS,
    },
    technicalMetadata: {
      modelName: "ExecutiveGeointReportModel" as const,
      modelVersion: EXECUTIVE_GEOINT_REPORT_MODEL_VERSION as typeof EXECUTIVE_GEOINT_REPORT_MODEL_VERSION,
      sourceProjectId: input.projectId,
      generatedAt: input.generatedAt,
      source: "InstitutionalReportInput" as const,
    },
  };

  return {
    ...modelWithoutPresentation,
    presentation: {
      labels: {
        approved: "APROBADO",
        pendingReview: "PENDIENTE DE REVISION",
        stale: "VIGENCIA VENCIDA",
        analyticalProjection: "PROYECCION ANALITICA",
        confidence: "NIVEL DE CONFIANZA",
        uncertainty: "INCERTIDUMBRE",
        trend: "TENDENCIA",
        scenario: "ESCENARIO",
      },
      visibleText: visiblePresentationText(modelWithoutPresentation),
    },
  };
}
