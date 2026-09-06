/**
 * IMPLEMENTACIÓN ADR-IMI-001
 * Línea Base Cero y Evaluación Basada en Evidencia Operacional
 * Perfilador Remoto SSPE-CEIPOL v2.4
 */

export type UserDoc = {
  id: string;
  username: string;
  role: string;
  name: string;
  grado?: string;
  id_empleado?: string;
  fecha_ingreso?: string;
  grado_estudio?: string;
  fortalezas?: string;
  debilidades?: string;
  fotografia?: string;
  aniosSspe?: string;
};

export const IMI_OPERATIONAL_MATURITY_LABEL = "NIVEL DE MADUREZ OPERATIVA EN LA PLATAFORMA";
export const INSUFFICIENT_INSTITUTIONAL_COMPARISON = "DATOS INSUFICIENTES PARA COMPARATIVO INSTITUCIONAL";
export const PERFORMANCE_HISTORY_UNAVAILABLE = "HISTÓRICO DE DESEMPEÑO NO DISPONIBLE";

export type ImiResult = {
  totalProjects: number;
  pAbiertos: number;
  pRevision: number;
  pDevueltos: number;
  pValidados: number;
  evidenceCount: number;
  geointProjects: number;
  osintQueriesCount: number;
  correlationActions: number;
  validatedOsintResults: number;
  validatedCorrelationResults: number;
  validatedHypothesisSignals: number;
  validatedContextSignals: number;
  validatedEvidenceCount: number;
  hasOperationalActivity: boolean;
  hasInstitutionalEvaluation: boolean;
  partialMeasurements: string[];

  // Subíndices (0% si no existe evidencia)
  iccScore: number;
  ishScore: number;
  icaScore: number;
  iaaScore: number;
  iceScore: number;
  igeoScore: number;
  iosintScore: number;
  ipiScore: number;

  // Modificadores operacionales
  finalExperiencePoints: number;
  improvementBonus: number;
  penaltyDeductions: number;
  activePenalties: string[];
  trend: "Crecimiento" | "Estable" | "Retroceso";

  // IMI Finales (0% si no existe evidencia)
  imiFinal: number;
  imiOperativo: number;
  imiEstrategico: number;
  currentLevel: "SIN EVALUACIÓN" | "Básico" | "Inicial" | "Intermedio" | "Avanzado" | "Experto";
};

export type InstitutionalComparisonResult = {
  available: boolean;
  message?: typeof INSUFFICIENT_INSTITUTIONAL_COMPARISON;
  institutionalAverage: number | null;
  stdDeviation: number | null;
  percentile: number | null;
  userRankString: string;
  sampleSize: number;
};

export function belongsToUser(project: any, selectedUser: UserDoc): boolean {
  const username = selectedUser.username || "";
  const userId = selectedUser.id || "";
  if (userId && project?.createdById === userId) return true;
  return Boolean(username && (project?.createdBy === username || project?.author === username));
}

function isApproved(value: unknown): boolean {
  return /APPROVED|VALIDADO|VALIDATED|SUPPORTED|ELIGIBLE|ADMITIDO|ADMITTED/i.test(String(value || ""));
}

function isInstitutionallyApproved(value: unknown): boolean {
  return /^(APPROVED|VALIDADO|VALIDATED|ELIGIBLE|ADMITIDO|ADMITTED)$/i.test(String(value || "").trim());
}

function hasInstitutionalApprovalSignal(item: any): boolean {
  return Boolean(
    item?.approved === true ||
    isInstitutionallyApproved(item?.status) ||
    isInstitutionallyApproved(item?.humanValidationStatus) ||
    isInstitutionallyApproved(item?.reviewStatus) ||
    isInstitutionallyApproved(item?.publicationEligibility) ||
    isInstitutionallyApproved(item?.validationStatus)
  );
}

function hasCanonicalGeography(project: any): boolean {
  const geo = project?.canonicalGeography;
  const type = String(geo?.type || project?.canonicalGeographyType || "").toUpperCase();
  const validationStatus = String(geo?.validationStatus || project?.canonicalGeographyValidationStatus || "").toUpperCase();
  return Boolean(
    geo?.geographyId &&
    ["INDIVIDUAL", "POINT", "CORRIDOR", "POLYGON", "MULTIPOLYGON"].includes(type) &&
    validationStatus === "VALID"
  );
}

function validatedEvidenceItems(project: any): any[] {
  const candidates = [
    ...([] as any[]).concat(Array.isArray(project?.evidence) ? project.evidence : []),
    ...([] as any[]).concat(Array.isArray(project?.attachedPhotos) ? project.attachedPhotos : []),
    ...([] as any[]).concat(Array.isArray(project?.photoEvidence) ? project.photoEvidence : []),
  ];
  return candidates.filter((item) =>
    item?.traceabilityIds?.length ||
    item?.sourceEvidenceId ||
    item?.geographyId ||
    item?.lineage?.length ||
    isApproved(item?.humanValidationStatus) ||
    isApproved(item?.publicationEligibility)
  );
}

function realEvidenceCount(project: any): number {
  if (typeof project?.photoCount === "number") return Math.max(0, project.photoCount);
  if (Array.isArray(project?.attachedPhotos)) return project.attachedPhotos.length;
  if (Array.isArray(project?.evidenceUrls)) return project.evidenceUrls.length;
  if (Array.isArray(project?.evidence)) return project.evidence.length;
  return 0;
}

function hasValidatedContext(project: any): boolean {
  return Boolean(
    project?.contextualizationOutput ||
    project?.reportReadyAssessment?.ready === true ||
    isApproved(project?.institutionalReportEligibility) ||
    isApproved(project?.publicationEligibility) ||
    project?.findings?.some?.((finding: any) => finding?.traceabilityIds?.length || isApproved(finding?.humanValidationStatus))
  );
}

function hasValidatedHypothesis(project: any): boolean {
  const hypothesis = project?.canonicalHypothesis || project?.hypothesis;
  return Boolean(
    hypothesis?.supportingEvidenceIds?.length ||
    hypothesis?.supportingFindingIds?.length ||
    isApproved(hypothesis?.validationStatus) ||
    isApproved(project?.hypothesisValidationStatus) ||
    project?.hypothesisHistory?.some?.((item: any) => item?.supportingEvidenceIds?.length || isApproved(item?.validationStatus)) ||
    project?.contradictions?.length
  );
}

function validatedCorrelationCount(projects: any[], logs: any[]): number {
  const fromProjects = projects.reduce((sum, project) => {
    const convergence = project?.institutionalMultisourceConvergence || project?.multisourceAnalysis || {};
    const approvedConvergences = Array.isArray(convergence?.convergencias)
      ? convergence.convergencias.filter(hasInstitutionalApprovalSignal).length
      : 0;
    const approvedContradictions = Array.isArray(convergence?.contradicciones)
      ? convergence.contradicciones.filter(hasInstitutionalApprovalSignal).length
      : 0;
    const approvedIndependentSources = Array.isArray(convergence?.fuentesIndependientes)
      ? convergence.fuentesIndependientes.filter(hasInstitutionalApprovalSignal).length
      : 0;
    return sum + (
      approvedConvergences +
      approvedContradictions +
      approvedIndependentSources +
      (Array.isArray(project?.approvedCorrelations) ? project.approvedCorrelations.length : 0)
    );
  }, 0);
  const fromLogs = logs.filter((log) => isInstitutionallyApproved(log?.validationStatus) && /correlaci|convergencia|contradicci/i.test(String(log?.action || log?.details || ""))).length;
  return fromProjects + fromLogs;
}

function validatedOsintCount(projects: any[], logs: any[]): number {
  const fromProjects = projects.reduce((sum, project) => {
    const osintItems = Array.isArray(project?.osintEvidence) ? project.osintEvidence : Array.isArray(project?.osint) ? project.osint : [];
    return sum + osintItems.filter((item: any) => item?.traceabilityIds?.length || item?.relatedFindingIds?.length || isApproved(item?.publicationEligibility)).length;
  }, 0);
  const fromLogs = logs.filter((log) => isApproved(log?.validationStatus) && /osint/i.test(String(log?.action || log?.details || ""))).length;
  return fromProjects + fromLogs;
}

function humanValidationScore(projects: any[], returnedProjects: number): number {
  const validated = projects.filter((project) =>
    isApproved(project?.humanValidationStatus) ||
    isApproved(project?.reviewStatus) ||
    isApproved(project?.ppcDecisionStatus) ||
    project?.reportReadyAssessment?.ready === true
  ).length;
  if (validated === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((validated / projects.length) * 100 - returnedProjects * 10)));
}

export function calculateInstitutionalComparison(
  selectedUser: UserDoc,
  projects: any[] = [],
  auditLogs: any[] = [],
  allUsers: UserDoc[] = []
): InstitutionalComparisonResult {
  const evaluated = allUsers
    .map((user) => ({ user, result: calculateUserImi(user, projects, auditLogs) }))
    .filter(({ result }) => result.hasInstitutionalEvaluation);
  const selectedResult = calculateUserImi(selectedUser, projects, auditLogs);
  if (!selectedResult.hasInstitutionalEvaluation || evaluated.length < 2) {
    return {
      available: false,
      message: INSUFFICIENT_INSTITUTIONAL_COMPARISON,
      institutionalAverage: null,
      stdDeviation: null,
      percentile: null,
      userRankString: INSUFFICIENT_INSTITUTIONAL_COMPARISON,
      sampleSize: evaluated.length,
    };
  }
  const scores = evaluated.map(({ result }) => result.imiFinal).sort((a, b) => a - b);
  const institutionalAverage = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - institutionalAverage, 2), 0) / scores.length;
  const stdDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
  const position = scores.indexOf(selectedResult.imiFinal);
  const percentile = scores.length > 1 ? Math.round((position / (scores.length - 1)) * 100) : 0;
  const rank = scores.length - position;
  return {
    available: true,
    institutionalAverage,
    stdDeviation,
    percentile,
    userRankString: `${rank} de ${scores.length} analistas evaluados`,
    sampleSize: scores.length,
  };
}

export function calculateUserImi(
  selectedUser: UserDoc,
  projects: any[] = [],
  auditLogs: any[] = []
): ImiResult {
  const username = selectedUser.username || "";
  const userId = selectedUser.id || "";

  // 1. Filtrado de proyectos pertenecientes al usuario
  const userProjects = projects.filter((p) => belongsToUser(p, selectedUser));

  const totalProjects = userProjects.length;
  const pAbiertos = userProjects.filter((p) => !p.estado || p.estado === "ABIERTO").length;
  const pRevision = userProjects.filter((p) => p.estado === "EN REVISIÓN").length;
  const pDevueltos = userProjects.filter((p) => p.estado === "DEVUELTO").length;
  const pValidados = userProjects.filter(
    (p) => p.estado === "CERRADO" || p.estado === "VALIDADO"
  ).length;

  // 2. Filtrado de logs de auditoría pertenecientes al usuario
  const userLogs = auditLogs.filter(
    (log) => log.user === username || log.userId === userId || log.userName === username
  );

  // 3. Conteo de evidencias fotográficas reales
  const evidenceCount = userProjects.reduce((sum, p) => sum + realEvidenceCount(p), 0);
  const validatedEvidenceCount = userProjects.reduce((sum, p) => sum + validatedEvidenceItems(p).length, 0);

  // 4. Proyectos con georreferenciación/GEOINT real
  const geointProjects = userProjects.filter(
    (p) =>
      hasCanonicalGeography(p)
  ).length;

  // 5. Consultas OSINT en logs
  const osintKeywords = [
    "osint",
    "curp",
    "rfc",
    "denue",
    "registro",
    "búsqueda",
    "consulta",
    "fuente",
    "osint-query"
  ];
  const osintQueriesCount = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return osintKeywords.some((kw) => act.includes(kw));
  }).length;
  const validatedOsintResults = validatedOsintCount(userProjects, userLogs);

  // 6. Acciones de correlación en logs
  const correlationActions = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return (
      act.includes("vínculo") ||
      act.includes("conexion") ||
      act.includes("correlación") ||
      act.includes("pandillas") ||
      act.includes("asociación") ||
      act.includes("cruce") ||
      act.includes("coincidencia")
    );
  }).length;
  const validatedCorrelationResults = validatedCorrelationCount(userProjects, userLogs);
  const validatedContextSignals = userProjects.filter(hasValidatedContext).length;
  const validatedHypothesisSignals = userProjects.filter(hasValidatedHypothesis).length;

  // DETERMINACIÓN DE ACTIVIDAD OPERACIONAL COMPROBABLE (ADR-IMI-001)
  const hasOperationalActivity =
    totalProjects > 0 ||
    evidenceCount > 0 ||
    geointProjects > 0 ||
    osintQueriesCount > 0 ||
    correlationActions > 0 ||
    validatedOsintResults > 0 ||
    validatedCorrelationResults > 0 ||
    validatedContextSignals > 0 ||
    validatedHypothesisSignals > 0 ||
    userLogs.length > 0;
  const hasInstitutionalEvaluation =
    validatedEvidenceCount > 0 ||
    geointProjects > 0 ||
    validatedOsintResults > 0 ||
    validatedCorrelationResults > 0 ||
    validatedContextSignals > 0 ||
    validatedHypothesisSignals > 0 ||
    pValidados > 0;
  const partialMeasurements: string[] = [];

  // REGLA OBLIGATORIA ADR-IMI-001: Si NO tiene evidencia operacional -> TODO ES 0%
  if (!hasOperationalActivity) {
    return {
      totalProjects: 0,
      pAbiertos: 0,
      pRevision: 0,
      pDevueltos: 0,
      pValidados: 0,
      evidenceCount: 0,
      geointProjects: 0,
      osintQueriesCount: 0,
      correlationActions: 0,
      validatedOsintResults: 0,
      validatedCorrelationResults: 0,
      validatedHypothesisSignals: 0,
      validatedContextSignals: 0,
      validatedEvidenceCount: 0,
      hasOperationalActivity: false,
      hasInstitutionalEvaluation: false,
      partialMeasurements: [],

      // Subíndices en línea base cero (0%)
      iccScore: 0,
      ishScore: 0,
      icaScore: 0,
      iaaScore: 0,
      iceScore: 0,
      igeoScore: 0,
      iosintScore: 0,
      ipiScore: 0,

      // Modificadores en cero
      finalExperiencePoints: 0,
      improvementBonus: 0,
      penaltyDeductions: 0,
      activePenalties: [],
      trend: "Estable",

      // IMI General/Operativo/Estratégico en 0%
      imiFinal: 0,
      imiOperativo: 0,
      imiEstrategico: 0,
      currentLevel: "SIN EVALUACIÓN"
    };
  }

  // --- CÁLCULO BASADO ÚNICAMENTE EN EVIDENCIA OPERACIONAL DEMOSTRADA ---

  // A. ICC - Contexto (20%) - Fuentes gobernadas de contextualización
  const avgDescLen =
    totalProjects > 0
      ? userProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / totalProjects
      : 0;

  const iccScore = validatedContextSignals > 0
    ? Math.min(100, Math.round((validatedContextSignals / totalProjects) * 100))
    : 0;
  if (totalProjects > 0 && validatedContextSignals === 0) partialMeasurements.push("ICC: MEDICIÓN PARCIAL");

  // B. ISH - Hipótesis (15%) - Validación y soporte gobernado
  const ishScore = validatedHypothesisSignals > 0
    ? Math.min(100, Math.max(0, Math.round((validatedHypothesisSignals / totalProjects) * 100 + pValidados * 5 - pDevueltos * 10)))
    : 0;
  if (totalProjects > 0 && validatedHypothesisSignals === 0) partialMeasurements.push("ISH: NO EVALUADO");

  // C. ICA - Correlación (15%) - Relaciones institucionales reales
  const icaScore =
    validatedCorrelationResults > 0
      ? Math.min(100, Math.max(0, Math.round(validatedCorrelationResults * 25)))
      : 0;
  if (correlationActions > 0 && validatedCorrelationResults === 0) partialMeasurements.push("ICA: actividad sin correlación validada");

  // D. IAA - Gobernanza de Validación Analítica (10%)
  const iaaScore = totalProjects > 0 ? humanValidationScore(userProjects, pDevueltos) : 0;
  if (totalProjects > 0 && iaaScore === 0) partialMeasurements.push("IAA: MEDICIÓN PARCIAL");

  // E. ICE - Evidencia (10%) - Fotografías y documentos georreferenciados reales
  const iceScore =
    totalProjects > 0 && validatedEvidenceCount > 0
      ? Math.min(100, Math.max(0, Math.round((validatedEvidenceCount / Math.max(1, evidenceCount)) * 100)))
      : 0;
  if (evidenceCount > 0 && validatedEvidenceCount === 0) partialMeasurements.push("ICE: conteo real sin calidad trazable");

  // F. IGEO - GEOINT (10%) - Geografía canónica válida
  const igeoScore =
    geointProjects > 0
      ? Math.min(100, Math.max(0, Math.round((geointProjects / totalProjects) * 100)))
      : 0;

  // G. IOSINT - OSINT (10%) - Resultados explotados y validados
  const iosintScore =
    validatedOsintResults > 0
      ? Math.min(100, Math.max(0, Math.round(validatedOsintResults * 25)))
      : 0;
  if (osintQueriesCount > 0 && validatedOsintResults === 0) partialMeasurements.push("IOSINT: consulta registrada sin resultado validado");

  // H. IPI - Productividad (10%) - Expedientes cerrados y validados
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  const ipiScore =
    pValidados > 0
      ? Math.min(100, Math.max(0, Math.round(completionRate * 70 + pValidados * 10)))
      : 0;

  // --- MODIFICADORES BASADOS ÚNICAMENTE EN VOLUMEN DE TRABAJO OPERATIVO (SIN ANTIGÜEDAD) ---
  const rawExperiencePoints = totalProjects * 1.5 + pValidados * 2.5;
  const finalExperiencePoints = Math.min(15, Math.round(rawExperiencePoints * 10) / 10);

  // Tendencia de calidad
  const recentProjects = userProjects.filter((p) => {
    if (!p.createdAt) return false;
    const diffMs = Date.now() - p.createdAt;
    return diffMs <= 30 * 24 * 60 * 60 * 1000;
  });

  let trend: "Crecimiento" | "Estable" | "Retroceso" = "Estable";
  let improvementBonus = 0;

  if (totalProjects > 2 && recentProjects.length > 0) {
    const avgRecentDesc =
      recentProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / recentProjects.length;
    if (avgRecentDesc > avgDescLen * 1.1) {
      trend = "Crecimiento";
      improvementBonus = 4;
    } else if (avgRecentDesc < avgDescLen * 0.9) {
      trend = "Retroceso";
    }
  }

  // Penalizaciones por trabajo de baja calidad
  let penaltyDeductions = 0;
  const activePenalties: string[] = [];

  if (avgDescLen < 120 && totalProjects > 0) {
    penaltyDeductions += 4;
    activePenalties.push("Contextualización superficial (descripciones breves): -4 pts");
  }
  if (pDevueltos > pValidados && totalProjects > 1) {
    penaltyDeductions += 5;
    activePenalties.push("Alto índice de expedientes devueltos con observaciones: -5 pts");
  }
  if (evidenceCount < totalProjects && totalProjects > 0) {
    penaltyDeductions += 3;
    activePenalties.push("Insuficiente recolección de evidencia en campo: -3 pts");
  }

  const componentsBaseScore =
    iccScore * 0.20 +
    ishScore * 0.15 +
    icaScore * 0.15 +
    iaaScore * 0.10 +
    iceScore * 0.10 +
    igeoScore * 0.10 +
    iosintScore * 0.10 +
    ipiScore * 0.10;

  const imiBase = componentsBaseScore * 0.85 + finalExperiencePoints;
  const imiFinal = Math.max(0, Math.min(100, Math.round(imiBase + improvementBonus - penaltyDeductions)));

  const imiOperativo = Math.round(iccScore * 0.40 + iceScore * 0.30 + ipiScore * 0.30);
  const imiEstrategico = Math.round(
    ishScore * 0.25 + icaScore * 0.25 + igeoScore * 0.20 + iosintScore * 0.20 + iaaScore * 0.10
  );

  const getImiLevel = (score: number): "SIN EVALUACIÓN" | "Básico" | "Inicial" | "Intermedio" | "Avanzado" | "Experto" => {
    if (score === 0) return "SIN EVALUACIÓN";
    if (score >= 81) return "Experto";
    if (score >= 61) return "Avanzado";
    if (score >= 41) return "Intermedio";
    if (score >= 21) return "Inicial";
    return "Básico";
  };

  return {
    totalProjects,
    pAbiertos,
    pRevision,
    pDevueltos,
    pValidados,
    evidenceCount,
    geointProjects,
    osintQueriesCount,
    correlationActions,
    validatedOsintResults,
    validatedCorrelationResults,
    validatedHypothesisSignals,
    validatedContextSignals,
    validatedEvidenceCount,
    hasOperationalActivity: true,
    hasInstitutionalEvaluation,
    partialMeasurements,

    iccScore,
    ishScore,
    icaScore,
    iaaScore,
    iceScore,
    igeoScore,
    iosintScore,
    ipiScore,

    finalExperiencePoints,
    improvementBonus,
    penaltyDeductions,
    activePenalties,
    trend,

    imiFinal,
    imiOperativo,
    imiEstrategico,
    currentLevel: getImiLevel(imiFinal)
  };
}
