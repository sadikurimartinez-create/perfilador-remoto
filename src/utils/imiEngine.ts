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
  hasOperationalActivity: boolean;

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

export function calculateUserImi(
  selectedUser: UserDoc,
  projects: any[] = [],
  auditLogs: any[] = []
): ImiResult {
  const username = selectedUser.username || "";
  const userId = selectedUser.id || "";

  // 1. Filtrado de proyectos pertenecientes al usuario
  const userProjects = projects.filter(
    (p) => p.createdBy === username || p.author === username || p.createdById === userId
  );

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
  const evidenceCount = userProjects.reduce((sum, p) => {
    if (p.photoCount !== undefined && p.photoCount !== null) {
      return sum + Number(p.photoCount);
    }
    if (Array.isArray(p.attachedPhotos)) {
      return sum + p.attachedPhotos.length;
    }
    if (Array.isArray(p.evidenceUrls)) {
      return sum + p.evidenceUrls.length;
    }
    return sum;
  }, 0);

  // 4. Proyectos con georreferenciación/GEOINT real
  const geointProjects = userProjects.filter(
    (p) =>
      (p.geometryType && p.geometryType !== "individual") ||
      p.latitud ||
      p.coordenadas ||
      p.hasGeoint === true
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

  // 6. Acciones de correlación en logs
  const correlationActions = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return (
      act.includes("vínculo") ||
      act.includes("conexion") ||
      act.includes("correlación") ||
      act.includes("pandillas") ||
      act.includes("mapa") ||
      act.includes("asociación") ||
      act.includes("cruce") ||
      act.includes("coincidencia")
    );
  }).length;

  // DETERMINACIÓN DE ACTIVIDAD OPERACIONAL COMPROBABLE (ADR-IMI-001)
  const hasOperationalActivity =
    totalProjects > 0 ||
    evidenceCount > 0 ||
    geointProjects > 0 ||
    osintQueriesCount > 0 ||
    correlationActions > 0 ||
    userLogs.length > 0;

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
      hasOperationalActivity: false,

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

  // A. ICC - Contexto (20%) - Basado en longitud descriptiva y terminología
  const avgDescLen =
    totalProjects > 0
      ? userProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / totalProjects
      : 0;

  const analyticalKeywords = [
    "vulnerabilidad", "atractor", "patrón", "riesgo", "osint", "geoint",
    "hipótesis", "criminógeno", "acecho", "movilidad", "rutina", "rutinas",
    "conexiones", "ambiente", "delictivo", "entorno", "focalizado", "análisis"
  ];
  let keywordMatches = 0;
  userProjects.forEach((p) => {
    const desc = (p.descripcion || "").toLowerCase();
    analyticalKeywords.forEach((kw) => {
      if (desc.includes(kw)) keywordMatches++;
    });
  });

  const iccScore =
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round((avgDescLen / 250) * 50 + Math.min(50, keywordMatches * 5))))
      : 0;

  // B. ISH - Hipótesis (15%) - Conectores causales en descripciones
  let logicalConnectives = 0;
  userProjects.forEach((p) => {
    const desc = (p.descripcion || "").toLowerCase();
    ["porque", "debido a", "consecuencia", "por lo tanto", "causal", "hipótesis", "origen", "foco", "razon", "motivo", "factor"].forEach(
      (conn) => {
        if (desc.includes(conn)) logicalConnectives++;
      }
    );
  });

  const ishScore =
    totalProjects > 0 && logicalConnectives > 0
      ? Math.min(100, Math.max(0, Math.round(logicalConnectives * 15 + pValidados * 20 - pDevueltos * 10)))
      : 0;

  // C. ICA - Correlación (15%) - Vínculos y cruces en logs/proyectos
  const icaScore =
    correlationActions > 0 || totalProjects > 1
      ? Math.min(100, Math.max(0, Math.round(correlationActions * 25 + totalProjects * 10)))
      : 0;

  // D. IAA - Autonomía IA (10%) - Proyectos sin devoluciones por observaciones
  const iaaScore =
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round(100 - pDevueltos * 25)))
      : 0;

  // E. ICE - Evidencia (10%) - Fotografías y documentos georreferenciados reales
  const iceScore =
    totalProjects > 0 && evidenceCount > 0
      ? Math.min(100, Math.max(0, Math.round((evidenceCount / (totalProjects * 2)) * 100)))
      : 0;

  // F. IGEO - GEOINT (10%) - Polígonos y mapas trazados
  const igeoScore =
    geointProjects > 0
      ? Math.min(100, Math.max(0, Math.round(geointProjects * 30 + totalProjects * 10)))
      : 0;

  // G. IOSINT - OSINT (10%) - Consultas en registros externos
  const iosintScore =
    osintQueriesCount > 0
      ? Math.min(100, Math.max(0, Math.round(osintQueriesCount * 30 + totalProjects * 5)))
      : 0;

  // H. IPI - Productividad (10%) - Expedientes cerrados y validados
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  const ipiScore =
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round(completionRate * 60 + pValidados * 20 + totalProjects * 5)))
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
    hasOperationalActivity: true,

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
