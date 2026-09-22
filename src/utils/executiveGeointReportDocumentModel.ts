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
  | "initial-hypothesis"
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
    sourceProvenance?: Array<{ source: string; sourceUrl?: string | null; observedAt?: string | null; query?: string | null; traceabilityId?: string | null }>;
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

function linkedHypothesisElements(input: InstitutionalReportInput, evidenceIds: string[], findingIds: string[]): string {
  const evidence = input.evidence
    .filter((item) => evidenceIds.includes(String(item?.evidenceId || item?.id || "")))
    .map((item) => item?.title || item?.caption || item?.summary);
  const findings = input.findings
    .filter((item) => findingIds.includes(String(item?.findingId || item?.id || "")))
    .map((item) => item?.title || item?.summary);
  const labels = visibleList([...evidence, ...findings], 3);
  if (labels.length) return labels.join("; ");
  return evidenceIds.length || findingIds.length
    ? "Referencias registradas sin descripción publicable en el insumo."
    : "No constan elementos vinculados en el insumo institucional.";
}

function observed(item: any): boolean {
  const integrity = item?.epistemicIntegrity || item;
  return integrity?.acquisitionMode === "OBSERVED" && integrity?.acquisitionStatus === "ACQUIRED" &&
    integrity?.isSimulated === false;
}

function scinceContext(input: InstitutionalReportInput): string {
  const source = input.scinceDemographics;
  if (source?.status !== "OBSERVED" || !observed(source) || !source?.provenance?.datasetId) {
    return "Contexto demográfico INEGI: no disponible como dato observado gobernado.";
  }
  const geo = source.geography || {};
  const demographic = source.demographics || {};
  const value = (number: unknown) => typeof number === "number" && Number.isFinite(number) ? String(number) : "No disponible";
  return `Contexto demográfico INEGI (Censo ${visible(String(source.provenance.referenceYear ?? ""), "corte no consignado")}): ` +
    `AGEB ${visible(geo.ageb?.code, "no consignada")}; manzana ${visible(geo.manzana?.code, "no consignada")}; ` +
    `población ${value(demographic.populationTotal)}; viviendas ${value(demographic.housingTotal)}; ` +
    `habitadas ${value(demographic.inhabitedPrivateHousing)}; deshabitadas ${value(demographic.uninhabitedPrivateHousing)}.`;
}

function denueContext(input: InstitutionalReportInput): string {
  const pois = asArray(input.denuePois).filter((item) => item?.source === "DENUE" &&
    item?.provider === "INEGI_DENUE" && item?.territorialStatus === "INSTITUTIONAL" && observed(item));
  const unique = Array.from(new Map(pois.map((item) => [item.traceabilityId || item.sourceEvidenceId || item.id, item])).values());
  if (!unique.length) return "Actividad y entorno DENUE: no constan establecimientos canónicos observados en el insumo.";
  const shown = unique.slice(0, 3);
  const labels = shown.map((item) => visible(`${item.name || "Establecimiento"} (${item.activityCode || "actividad no consignada"})`));
  return `Actividad y entorno DENUE (INEGI): ${unique.length} registro(s) elegible(s); ${shown.length} mostrado(s), ` +
    `primeros en orden del insumo canónico: ${labels.join("; ")}.`;
}

function incidenceContext(input: InstitutionalReportInput): string {
  const contract = input.crimeIncidenceExportContract;
  const query = contract?.queryReference;
  if (contract?.productClassification !== "DESCRIPTIVE_ANALYTICAL_PRODUCT" ||
    contract?.analyticalLevel !== "DESCRIPTIVE" || query?.status !== "EXECUTED" ||
    query?.admission?.accepted !== true || !contract?.datasetReference?.datasetId) {
    return "Incidencia: no consta un producto descriptivo gobernado disponible en el insumo.";
  }
  const total = contract?.projectionReference?.metrics?.frequency?.totalRecords;
  if (!Number.isFinite(total) || total < 0) return "Incidencia: no consta un conteo gobernado válido.";
  const temporal = contract?.datasetReference?.coverage?.temporal;
  const period = temporal?.start && temporal?.end ? `; cobertura ${temporal.start} a ${temporal.end}` : "";
  return `Incidencia (producto descriptivo, no evidencia): ${total} registro(s) en la consulta` +
    `${period}; fuente C5i SSPE Aguascalientes.`;
}

function osintContext(input: InstitutionalReportInput): string[] {
  const seen = new Set<string>();
  return asArray(input.osint).filter((item) => {
    if (!observed(item)) return false;
    const integrity = item.epistemicIntegrity || item;
    const key = String(item.url || item.link || integrity.traceabilityId || item.id || "");
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  }).slice(0, 3).map((item) => {
    const integrity = item.epistemicIntegrity || item;
    const provider = visible(integrity.providerName || integrity.providerId || item.provider || item.source, "Fuente no consignada");
    const label = visible(item.title || item.summary || item.snippet || item.text, "Registro sin descripción publicable");
    return `Registro OSINT observado (${provider}; ${visible(integrity.observedAt || integrity.acquiredAt, "fecha no consignada")}): ${label}`;
  });
}

function gangContext(input: InstitutionalReportInput): string[] {
  const certified = asArray(input.specializedIntelligence).find((item) =>
    item?.schemaVersion === "GIM-REPORT-1.0" && item?.validatedByACE === true &&
    item?.validationStatus !== "NOT_CERTIFIED" && item?.traceabilityReference);
  if (!certified) return ["Pandillas y estructuras relacionadas: no consta un análisis certificado publicable."];
  const content = [
    ...visibleList(asArray(certified.analyticalFindings), 2).map((finding) => `Análisis certificado de pandillas: ${finding}`),
    ...visibleList(asArray(certified.evidenceSummary), 1).map((summary) => `Base de evidencia del análisis de pandillas: ${summary}`),
  ];
  return content.length ? content : ["Pandillas y estructuras relacionadas: payload certificado sin descripción publicable."];
}

function buildSections(
  model: ExecutiveGeointReportModel,
  visualComposition: ExecutiveVisualComposition,
  input: InstitutionalReportInput,
  numeroExpediente: string
): ExecutiveDocumentSection[] {
  const findings = limited(model.findings, EXECUTIVE_DOCUMENT_LIMITS.findings);
  const evidence = limited(model.keyEvidence, EXECUTIVE_DOCUMENT_LIMITS.keyEvidence);
  const decisions = limited(model.decisionImplications, EXECUTIVE_DOCUMENT_LIMITS.decisions);
  const hypothesis = input.hypothesis;
  const initialVersion = asArray(hypothesis?.versions)[0];
  const initialText = initialVersion?.authorType === "HUMAN" && clean(initialVersion.text)
    ? initialVersion.text
    : "No consta una hipótesis inicial humana verificable en el historial del expediente.";
  const currentText = clean(hypothesis?.currentHypothesis)
    ? hypothesis.currentHypothesis
    : "No consta una hipótesis vigente en el insumo institucional.";
  const hypothesisEvidenceIds = [
    ...asArray<string>(hypothesis?.supportingEvidenceIds),
    ...asArray<string>(hypothesis?.contradictingEvidenceIds),
  ];
  const hypothesisFindingIds = [
    ...asArray<string>(hypothesis?.supportingFindingIds),
    ...asArray<string>(hypothesis?.contradictingFindingIds),
  ];
  const linkedFindings = input.findings.filter((item) =>
    hypothesisFindingIds.includes(String(item?.findingId || item?.id || ""))
  );
  const linkedConclusions = input.conclusions.filter((item) =>
    Boolean(hypothesis?.hypothesisId && item?.hypothesisId === hypothesis.hypothesisId) ||
    [...asArray<string>(item?.evidenceIds), ...asArray<string>(item?.publicationEligibility?.lineageRefs?.evidenceIds)]
      .some((id) => hypothesisEvidenceIds.includes(id)) ||
    [...asArray<string>(item?.findingIds), ...asArray<string>(item?.publicationEligibility?.lineageRefs?.findingIds)]
      .some((id) => hypothesisFindingIds.includes(id))
  );
  const conclusionText = visibleList(linkedConclusions.map((item) =>
    item?.text || item?.summary || item?.conclusion || item?.description
  ), 2).join("; ");
  const observedOsint = osintContext(input);
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
      sectionId: "initial-hypothesis",
      order: 3,
      title: "HIPÓTESIS INICIAL",
      role: "Trayectoria de la hipótesis humana y su contraste con evidencia gobernada",
      content: [
        `Hipótesis inicial: ${initialText}`,
        `Hipótesis vigente: ${currentText}`,
        `Hallazgos relevantes: ${visibleList(linkedFindings.map((item) => item.title || item.summary), 3).join("; ") || "No constan hallazgos vinculados y publicables."}`,
        `Elementos de confirmación: ${linkedHypothesisElements(input, asArray<string>(hypothesis?.supportingEvidenceIds), asArray<string>(hypothesis?.supportingFindingIds))}`,
        `Elementos de refutación: ${linkedHypothesisElements(input, asArray<string>(hypothesis?.contradictingEvidenceIds), asArray<string>(hypothesis?.contradictingFindingIds))}`,
        `Conclusión analítica validada: ${conclusionText || "No consta una conclusión validada y vinculada a la hipótesis en el insumo institucional."}`,
      ],
      densityPolicy: { targetPages: "0-1", maxItems: 6 },
      status: initialVersion?.authorType === "HUMAN" && clean(initialVersion.text) ? "READY" : "INCOMPLETE",
    },
    {
      sectionId: "territorial-situation",
      order: 4,
      title: "SITUACION TERRITORIAL",
      role: "Contexto territorial y mapa principal",
      content: [
        visible(model.territorialSituation.territorialSummary, "Resumen territorial gobernado no disponible."),
        visualComposition.principalTerritorialMap.status === "NO_CANONICAL_GEOGRAPHY"
          ? "Mapa territorial principal incompleto por ausencia de geografia canonica."
          : visualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED"
            ? "Mapa territorial principal requerido desde geografia canonica gobernada."
            : "Mapa territorial principal disponible desde visual gobernado.",
        scinceContext(input),
        denueContext(input),
        incidenceContext(input),
      ],
      densityPolicy: { targetPages: "1-2", maxItems: 5 },
      status: visualComposition.principalTerritorialMap.status === "NO_CANONICAL_GEOGRAPHY" ? "INCOMPLETE" : "READY",
    },
    {
      sectionId: "priority-findings",
      order: 5,
      title: "HALLAZGOS Y PATRONES PRIORITARIOS",
      role: "Hallazgos subordinados a evidencia e implicacion",
      content: findings.map((finding) => findingContent(finding, model.keyEvidence)),
      densityPolicy: { targetPages: "1-2", maxItems: EXECUTIVE_DOCUMENT_LIMITS.findings },
      status: "READY",
    },
    {
      sectionId: "key-evidence",
      order: 6,
      title: "EVIDENCIA CLAVE",
      role: "Evidencia estrictamente seleccionada para cuerpo ejecutivo",
      content: evidence.map(evidenceContent),
      densityPolicy: { targetPages: "1-2", maxItems: EXECUTIVE_DOCUMENT_LIMITS.keyEvidence },
      status: "READY",
    },
    {
      sectionId: "multisource-analysis",
      order: 7,
      title: "ANALISIS MULTIFUENTE",
      role: "Sintesis de convergencia, contradiccion y brechas",
      content: [
        ...observedOsint,
        ...(observedOsint.length ? [] : ["Inteligencia de fuentes abiertas: no constan registros observados adquiridos y publicables."]),
        ...gangContext(input),
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
      order: 8,
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
    order: hasGovernedProspective(model) ? 9 : 8,
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
    ...sections.flatMap((section) => [
      visible(section.title),
      visible(section.role),
      ...section.content.map((item, index) => section.sectionId === "initial-hypothesis" && index < 2 ? item : visible(item)),
    ]),
    ...placements.flatMap((placement) => [visible(placement.headline), visible(placement.caption)]),
  ].filter(Boolean);
}

export function buildExecutiveGeointReportDocumentModel(
  executiveModel: ExecutiveGeointReportModel,
  visualComposition: ExecutiveVisualComposition,
  institutionalInput: InstitutionalReportInput,
  options: { numeroExpediente?: string; ceipolId?: string } = {}
): ExecutiveGeointReportDocumentModel {
  const numeroExpediente = resolveNumeroExpediente(executiveModel, options);
  const sections = buildSections(executiveModel, visualComposition, institutionalInput, numeroExpediente);
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
        "initial-hypothesis": "0-1",
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
      evidenceReferences: dedupe([
        ...collectEvidenceReferences(executiveModel),
        ...asArray<string>(institutionalInput.hypothesis?.supportingEvidenceIds),
        ...asArray<string>(institutionalInput.hypothesis?.contradictingEvidenceIds),
      ]),
      sourceProvenance: [
        ...(institutionalInput.scinceDemographics?.status === "OBSERVED" && observed(institutionalInput.scinceDemographics) ? [{
          source: "INEGI SCINCE", sourceUrl: institutionalInput.scinceDemographics.provenance?.censusSourceUrl,
          observedAt: institutionalInput.scinceDemographics.epistemicIntegrity?.acquiredAt,
          query: institutionalInput.scinceDemographics.epistemicIntegrity?.query,
          traceabilityId: institutionalInput.scinceDemographics.provenance?.datasetId,
        }] : []),
        ...asArray(institutionalInput.denuePois).filter((item) => item?.source === "DENUE" && observed(item)).map((item) => ({
          source: "INEGI DENUE", sourceUrl: item.epistemicIntegrity?.sourceUrl,
          observedAt: item.observedAt || item.acquiredAt, query: item.epistemicIntegrity?.query,
          traceabilityId: item.traceabilityId,
        })),
        ...asArray(institutionalInput.osint).filter(observed).map((item) => {
          const integrity = item.epistemicIntegrity || item;
          return { source: integrity.providerName || integrity.providerId || item.provider || "OSINT",
            sourceUrl: item.url || item.link || integrity.sourceUrl, observedAt: integrity.observedAt || integrity.acquiredAt,
            query: integrity.query, traceabilityId: integrity.traceabilityId };
        }),
        ...asArray(institutionalInput.specializedIntelligence).filter((item) =>
          item?.schemaVersion === "GIM-REPORT-1.0" && item?.validatedByACE === true &&
          item?.validationStatus !== "NOT_CERTIFIED" && item?.traceabilityReference).map((item) => ({
          source: "GIM ACE", traceabilityId: item.traceabilityReference,
        })),
        ...(institutionalInput.crimeIncidenceExportContract?.queryReference?.status === "EXECUTED" &&
          institutionalInput.crimeIncidenceExportContract?.queryReference?.admission?.accepted === true ? [{
          source: "C5i SSPE Aguascalientes",
          traceabilityId: institutionalInput.crimeIncidenceExportContract.exportId || institutionalInput.crimeIncidenceExportContract.datasetReference?.datasetId,
        }] : []),
      ],
      sectionCount: sections.length,
      visualPlacementCount: visualPlacements.length,
    },
  };
}
