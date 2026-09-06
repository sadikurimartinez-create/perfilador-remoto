import type {
  ExecutiveDecisionImplication,
  ExecutiveEvidenceItem,
  ExecutiveFinding,
  ExecutiveGeointReportModel,
  TechnicalAnnexReference,
} from "@/utils/executiveGeointReportModel";
import type { ExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";

export const EXECUTIVE_GEOINT_DOCUMENT_MODEL_VERSION = "1.0.0";
export const EXECUTIVE_DOCUMENT_MAX_VISUALS = 5;
export const EXECUTIVE_DOCUMENT_LIMITS = {
  findings: 5,
  keyEvidence: 4,
  decisions: 5,
  panoramaFindings: 5,
  panoramaDecisions: 5,
} as const;

export type ExecutiveDocumentSectionId =
  | "cover"
  | "executive-panorama"
  | "territorial-situation"
  | "priority-findings"
  | "key-evidence"
  | "multisource-analysis"
  | "prospective-analysis"
  | "decision-implications"
  | "additional-context";

export interface ExecutiveDocumentSection {
  sectionId: ExecutiveDocumentSectionId;
  order: number;
  title: string;
  role: string;
  content: string[];
  densityPolicy: {
    targetPages: string;
    maxItems?: number;
  };
  status: "READY" | "OPTIONAL_SUPPRESSED" | "INCOMPLETE";
}

export interface ExecutiveVisualPlacement {
  visualId: string;
  sectionId: ExecutiveDocumentSectionId;
  placementRole: "PRINCIPAL_TERRITORIAL_MAP" | "SUPPORTING_EVIDENCE" | "ANALYTICAL_SUPPORT";
  headline: string;
  caption: string;
}

export interface ExecutiveGeointReportDocumentModel {
  identity: {
    numeroExpediente: string;
    clasificacion: string;
    fechaEmision: string;
  };
  sections: ExecutiveDocumentSection[];
  visualPlacements: ExecutiveVisualPlacement[];
  annexReferences: TechnicalAnnexReference["references"];
  paginationPolicy: {
    targetPageRange: "7-9";
    ordinaryMaximumPages: 10;
    guidance: Record<Exclude<ExecutiveDocumentSectionId, "additional-context">, string>;
    note: string;
  };
  presentation: {
    documentTitle: string;
    visibleText: string[];
    headerFooterPolicy: {
      preserveExistingInstitutionalHeaderFooter: true;
      onlyFeedNumeroExpediente: true;
    };
  };
  technicalMetadata: {
    modelName: "ExecutiveGeointReportDocumentModel";
    modelVersion: typeof EXECUTIVE_GEOINT_DOCUMENT_MODEL_VERSION;
    source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition";
    deterministic: true;
    externalCalls: false;
    modifiesHeaderFooter: false;
    rendersWord: false;
    sourceProjectId: string;
    traceabilityIds: string[];
    evidenceReferences: string[];
    sectionCount: number;
    visualPlacementCount: number;
  };
}

const FALLBACK_ACTION_UNAVAILABLE = "ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL";
const FALLBACK_INTERPRETATION_UNAVAILABLE = "INTERPRETACION NO DISPONIBLE EN EL INSUMO INSTITUCIONAL";
const FALLBACK_IMPLICATION_UNAVAILABLE = "IMPLICACION NO DISPONIBLE EN EL INSUMO INSTITUCIONAL";
const FALLBACK_FOUNDATION_UNAVAILABLE = "FUNDAMENTO NO DISPONIBLE EN EL INSUMO INSTITUCIONAL";
const FALLBACK_LINKED_EVIDENCE = "Evidencia gobernada vinculada al hallazgo.";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function limited<T>(items: T[], max: number): T[] {
  return items.slice(0, max);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function visible(value: unknown, fallback = ""): string {
  const text = clean(value) || fallback;
  return text
    .replace(/\b(projectId|sourceItemId|traceabilityId|geographyId|lineage|publicationEligibility|reasonCode|modelVersion|payload)\b/gi, "")
    .replace(/\b(?:ev|evidence|finding|trace|sourceItem|geo)-[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\b(Confidence|Score|Trend|Scenario|Finding|Review|Reviewer|SOURCE_FACT|ANALYTICAL_PROJECTION|PENDING|APPROVED|STALE|Gate|ADR)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleList(values: unknown[], max: number): string[] {
  return limited(values.map((item) => visible(item)).filter(Boolean), max);
}

function resolveNumeroExpediente(model: ExecutiveGeointReportModel, options?: { numeroExpediente?: string; ceipolId?: string }): string {
  return visible(options?.numeroExpediente || model.identity.numeroExpediente || options?.ceipolId || "NO ASIGNADO", "NO ASIGNADO");
}

function describeFindingEvidence(finding: ExecutiveFinding, keyEvidence: ExecutiveEvidenceItem[]): string {
  const relatedEvidence = keyEvidence.filter((item) =>
    finding.evidenceReferences.some((reference) => item.evidenceId === reference || item.evidenceReferences.includes(reference))
  );
  const descriptions = visibleList(
    relatedEvidence.map((item) => item.title || item.summary || item.selectionReason),
    3
  );
  return descriptions.join("; ") || FALLBACK_LINKED_EVIDENCE;
}

function findingContent(finding: ExecutiveFinding, keyEvidence: ExecutiveEvidenceItem[]): string {
  const evidence = describeFindingEvidence(finding, keyEvidence);
  const contradictions = visibleList([...finding.contradictingFactors, ...finding.limitations], 3).join("; ") || "Sin contradicciones determinantes registradas.";
  return [
    `Hallazgo: ${visible(finding.title || finding.summary, "Configuracion territorial relevante.")}`,
    `Evidencia que lo sustenta: ${evidence}`,
    `Interpretacion: ${visible(finding.interpretation, FALLBACK_INTERPRETATION_UNAVAILABLE)}`,
    `Contradicciones y limitaciones: ${contradictions}`,
    `Implicacion: ${visible(finding.implication, FALLBACK_IMPLICATION_UNAVAILABLE)}`,
  ].join(" ");
}

function evidenceContent(evidence: ExecutiveEvidenceItem): string {
  return [
    visible(evidence.title, "Evidencia clave"),
    visible(evidence.summary, "Evidencia visual gobernada."),
    visible(evidence.selectionReason),
  ].filter(Boolean).join(" ");
}

function decisionContent(decision: ExecutiveDecisionImplication): string {
  return [
    `Hallazgo relacionado: ${visible(decision.hallazgoRelacionado, "Hallazgo gobernado")}`,
    `Implicacion: ${visible(decision.implicacion, FALLBACK_IMPLICATION_UNAVAILABLE)}`,
    `Accion sugerida: ${visible(decision.accionSugerida, FALLBACK_ACTION_UNAVAILABLE)}`,
    `Fundamento: ${visible(decision.fundamento, FALLBACK_FOUNDATION_UNAVAILABLE)}`,
  ].join(" ");
}

function hasGovernedProspective(model: ExecutiveGeointReportModel): boolean {
  return model.prospectiveAnalysis.technicalMetadata.sourceProductIds.length > 0;
}

function buildSections(
  model: ExecutiveGeointReportModel,
  visualComposition: ExecutiveVisualComposition,
  numeroExpediente: string
): ExecutiveDocumentSection[] {
  const findings = limited(model.findings, EXECUTIVE_DOCUMENT_LIMITS.findings);
  const evidence = limited(model.keyEvidence, EXECUTIVE_DOCUMENT_LIMITS.keyEvidence);
  const decisions = limited(model.decisionImplications, EXECUTIVE_DOCUMENT_LIMITS.decisions);
  const sections: ExecutiveDocumentSection[] = [
    {
      sectionId: "cover",
      order: 1,
      title: "PORTADA",
      role: "Identidad institucional del informe",
      content: [
        "INFORME EJECUTIVO GEOINT",
        `Numero de expediente: ${numeroExpediente}`,
        `Clasificacion: ${visible(model.identity.clasificacion, "CONFIDENCIAL - USO INSTITUCIONAL")}`,
      ],
      densityPolicy: { targetPages: "1" },
      status: "READY",
    },
    {
      sectionId: "executive-panorama",
      order: 2,
      title: "PANORAMA EJECUTIVO",
      role: "Sintesis ejecutiva para decision",
      content: [
        `Situacion: ${visible(model.panorama.situacion, "Situacion institucional sintetizada.")}`,
        ...visibleList(model.panorama.hallazgosClave, EXECUTIVE_DOCUMENT_LIMITS.panoramaFindings).map((item) => `Hallazgo clave: ${item}`),
        ...(visible(model.panorama.escenario) ? [`Escenario: ${visible(model.panorama.escenario)}`] : []),
        ...visibleList(model.panorama.decisionesSugeridas, EXECUTIVE_DOCUMENT_LIMITS.panoramaDecisions).map((item) => `Decision sugerida: ${item}`),
        `Nivel institucional de confianza: ${visible(model.panorama.nivelConfianza, "NO DETERMINADO")}`,
        `Incertidumbre: ${visible(model.panorama.incertidumbre, "NO DETERMINADA")}`,
        `Vigencia: ${visible(model.panorama.vigencia, "NO DEFINIDA")}`,
      ],
      densityPolicy: { targetPages: "1", maxItems: 14 },
      status: "READY",
    },
    {
      sectionId: "territorial-situation",
      order: 3,
      title: "SITUACION TERRITORIAL",
      role: "Contexto territorial y mapa principal",
      content: [
        visible(model.territorialSituation.territorialSummary, "Resumen territorial gobernado no disponible."),
        visualComposition.principalTerritorialMap.status === "NO_CANONICAL_GEOGRAPHY"
          ? "Mapa territorial principal incompleto por ausencia de geografia canonica."
          : visualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED"
            ? "Mapa territorial principal requerido desde geografia canonica gobernada."
            : "Mapa territorial principal disponible desde visual gobernado.",
      ],
      densityPolicy: { targetPages: "1", maxItems: 4 },
      status: visualComposition.principalTerritorialMap.status === "NO_CANONICAL_GEOGRAPHY" ? "INCOMPLETE" : "READY",
    },
    {
      sectionId: "priority-findings",
      order: 4,
      title: "HALLAZGOS Y PATRONES PRIORITARIOS",
      role: "Hallazgos subordinados a evidencia e implicacion",
      content: findings.map((finding) => findingContent(finding, model.keyEvidence)),
      densityPolicy: { targetPages: "1-2", maxItems: EXECUTIVE_DOCUMENT_LIMITS.findings },
      status: "READY",
    },
    {
      sectionId: "key-evidence",
      order: 5,
      title: "EVIDENCIA CLAVE",
      role: "Evidencia estrictamente seleccionada para cuerpo ejecutivo",
      content: evidence.map(evidenceContent),
      densityPolicy: { targetPages: "1-2", maxItems: EXECUTIVE_DOCUMENT_LIMITS.keyEvidence },
      status: "READY",
    },
    {
      sectionId: "multisource-analysis",
      order: 6,
      title: "ANALISIS MULTIFUENTE",
      role: "Sintesis de convergencia, contradiccion y brechas",
      content: [
        ...visibleList(model.multisourceAnalysis.convergencias, 5).map((item) => `Convergencia: ${item}`),
        ...visibleList(model.multisourceAnalysis.contradicciones, 5).map((item) => `Contradiccion: ${item}`),
        ...visibleList(model.multisourceAnalysis.fuentesIndependientes, 5).map((item) => `Fuente independiente: ${item}`),
        ...visibleList(model.multisourceAnalysis.dependenciasParciales, 5).map((item) => `Dependencia parcial: ${item}`),
        ...visibleList(model.multisourceAnalysis.brechasInformacion, 5).map((item) => `Brecha de informacion: ${item}`),
        `Nivel de soporte: ${visible(model.multisourceAnalysis.nivelSoporte, "NO DETERMINADO")}`,
      ],
      densityPolicy: { targetPages: "1", maxItems: 18 },
      status: "READY",
    },
  ];

  if (hasGovernedProspective(model)) {
    sections.push({
      sectionId: "prospective-analysis",
      order: 7,
      title: "ANALISIS PROSPECTIVO",
      role: "Escenario prospectivo gobernado",
      content: [
        `Tendencia: ${visible(model.prospectiveAnalysis.tendencia, "NO DETERMINADA")}`,
        `Escenario: ${visible(model.prospectiveAnalysis.escenario, "NO DETERMINADO")}`,
        ...visibleList(model.prospectiveAnalysis.factoresSoporte, 5).map((item) => `Factor de soporte: ${item}`),
        ...visibleList(model.prospectiveAnalysis.factoresContradiccion, 5).map((item) => `Factor de contradiccion: ${item}`),
        `Nivel de confianza: ${visible(model.prospectiveAnalysis.nivelConfianza, "NO DETERMINADO")}`,
        `Incertidumbre: ${visible(model.prospectiveAnalysis.incertidumbre, "NO DETERMINADA")}`,
        `Vigencia: ${visible(model.prospectiveAnalysis.vigencia, "NO DEFINIDA")}`,
        ...visibleList(model.prospectiveAnalysis.limitaciones, 5).map((item) => `Limitacion: ${item}`),
        `Relacion con hipotesis: ${visible(model.prospectiveAnalysis.relacionHipotesis, "NO DETERMINADA")}`,
      ],
      densityPolicy: { targetPages: "0-1", maxItems: 20 },
      status: "READY",
    });
  }

  sections.push({
    sectionId: "decision-implications",
    order: hasGovernedProspective(model) ? 8 : 7,
    title: "IMPLICACIONES PARA LA DECISION",
    role: "Acciones derivadas de implicaciones gobernadas",
    content: decisions.map(decisionContent),
    densityPolicy: { targetPages: "1", maxItems: EXECUTIVE_DOCUMENT_LIMITS.decisions },
    status: "READY",
  });

  return sections.sort((a, b) => a.order - b.order);
}

function placementSectionForVisual(visualType: string): ExecutiveDocumentSectionId {
  if (visualType === "EVIDENCE_IMAGE") return "key-evidence";
  if (visualType === "PROSPECTIVE_SCENARIO") return "prospective-analysis";
  if (visualType === "MULTISOURCE_CONVERGENCE" || visualType === "STATISTICAL_CHART" || visualType === "TREND_VISUAL") return "multisource-analysis";
  return "key-evidence";
}

function buildVisualPlacements(visualComposition: ExecutiveVisualComposition): ExecutiveVisualPlacement[] {
  const placements: ExecutiveVisualPlacement[] = [{
    visualId: visualComposition.principalTerritorialMap.mapId,
    sectionId: "territorial-situation",
    placementRole: "PRINCIPAL_TERRITORIAL_MAP",
    headline: visible(visualComposition.principalTerritorialMap.executiveHeadline, "CONFIGURACION TERRITORIAL DEL AREA ANALIZADA"),
    caption: visible(visualComposition.principalTerritorialMap.caption, "Mapa territorial principal."),
  }];
  const seen = new Set(placements.map((item) => item.visualId));
  for (const visual of visualComposition.secondaryVisuals) {
    if (seen.has(visual.visualId) || placements.length >= EXECUTIVE_DOCUMENT_MAX_VISUALS) continue;
    placements.push({
      visualId: visual.visualId,
      sectionId: placementSectionForVisual(visual.visualType),
      placementRole: visual.visualType === "EVIDENCE_IMAGE" ? "SUPPORTING_EVIDENCE" : "ANALYTICAL_SUPPORT",
      headline: visible(visual.executiveHeadline, "CONFIGURACION TERRITORIAL DEL AREA ANALIZADA"),
      caption: visible(visual.caption, "Visual ejecutivo gobernado."),
    });
    seen.add(visual.visualId);
  }
  return placements;
}

function collectTraceabilityIds(model: ExecutiveGeointReportModel, visualComposition: ExecutiveVisualComposition): string[] {
  return dedupe([
    ...model.findings.flatMap((item) => item.traceabilityIds),
    ...model.keyEvidence.flatMap((item) => item.traceabilityIds),
    ...model.multisourceAnalysis.traceabilityIds,
    ...model.prospectiveAnalysis.traceabilityIds,
    ...model.decisionImplications.flatMap((item) => item.traceabilityIds),
    ...visualComposition.principalTerritorialMap.technicalMetadata.traceabilityIds,
    ...visualComposition.secondaryVisuals.flatMap((item) => item.technicalMetadata.traceabilityIds),
  ]);
}

function collectEvidenceReferences(model: ExecutiveGeointReportModel): string[] {
  return dedupe([
    ...model.findings.flatMap((item) => item.evidenceReferences),
    ...model.keyEvidence.flatMap((item) => [item.evidenceId, ...item.evidenceReferences]),
  ]);
}

function flattenVisibleText(sections: ExecutiveDocumentSection[], placements: ExecutiveVisualPlacement[]): string[] {
  return [
    ...sections.flatMap((section) => [section.title, section.role, ...section.content]),
    ...placements.flatMap((placement) => [placement.headline, placement.caption]),
  ].map((item) => visible(item)).filter(Boolean);
}

export function buildExecutiveGeointReportDocumentModel(
  executiveModel: ExecutiveGeointReportModel,
  visualComposition: ExecutiveVisualComposition,
  institutionalInput: InstitutionalReportInput,
  options: { numeroExpediente?: string; ceipolId?: string } = {}
): ExecutiveGeointReportDocumentModel {
  const numeroExpediente = resolveNumeroExpediente(executiveModel, options);
  const sections = buildSections(executiveModel, visualComposition, numeroExpediente);
  const visualPlacements = buildVisualPlacements(visualComposition);
  return {
    identity: {
      numeroExpediente,
      clasificacion: visible(executiveModel.identity.clasificacion, "CONFIDENCIAL - USO INSTITUCIONAL"),
      fechaEmision: visible(executiveModel.identity.fecha || institutionalInput.generatedAt),
    },
    sections,
    visualPlacements,
    annexReferences: executiveModel.technicalAnnex.references,
    paginationPolicy: {
      targetPageRange: "7-9",
      ordinaryMaximumPages: 10,
      guidance: {
        cover: "1",
        "executive-panorama": "1",
        "territorial-situation": "1",
        "priority-findings": "1-2",
        "key-evidence": "1-2",
        "multisource-analysis": "1",
        "prospective-analysis": "0-1",
        "decision-implications": "1",
      },
      note: "Politica editorial de densidad; no mide paginas fisicas.",
    },
    presentation: {
      documentTitle: "INFORME EJECUTIVO GEOINT",
      visibleText: flattenVisibleText(sections, visualPlacements),
      headerFooterPolicy: {
        preserveExistingInstitutionalHeaderFooter: true,
        onlyFeedNumeroExpediente: true,
      },
    },
    technicalMetadata: {
      modelName: "ExecutiveGeointReportDocumentModel",
      modelVersion: EXECUTIVE_GEOINT_DOCUMENT_MODEL_VERSION,
      source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition",
      deterministic: true,
      externalCalls: false,
      modifiesHeaderFooter: false,
      rendersWord: false,
      sourceProjectId: institutionalInput.projectId,
      traceabilityIds: collectTraceabilityIds(executiveModel, visualComposition),
      evidenceReferences: collectEvidenceReferences(executiveModel),
      sectionCount: sections.length,
      visualPlacementCount: visualPlacements.length,
    },
  };
}
