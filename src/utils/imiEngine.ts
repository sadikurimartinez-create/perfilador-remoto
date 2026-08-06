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
  hasOperationalActivity: boolean;

  // Subíndices
  iccScore: number;
  ishScore: number;
  icaScore: number;
  iaaScore: number;
  iceScore: number;
  igeoScore: number;
  iosintScore: number;
  ipiScore: number;

  // Modificadores
  finalExperiencePoints: number;
  improvementBonus: number;
  penaltyDeductions: number;
  activePenalties: string[];
  trend: "Crecimiento" | "Estable" | "Retroceso";

  // IMI Generales
  imiFinal: number;
  imiOperativo: number;
  imiEstrategico: number;
  currentLevel: string;
};

export function calculateUserImi(
  selectedUser: UserDoc,
  projects: any[] = [],
  auditLogs: any[] = []
): ImiResult {
  const username = selectedUser.username || "";
  const userId = selectedUser.id || "";

  // 1. Filtrado estricto de proyectos pertenecientes al usuario
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

  // 5. Consultas OSINT en logs de auditoría
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

  // Verificación de actividad operacional comprobable
  const hasOperationalActivity = totalProjects > 0 || userLogs.length > 0;

  // REGLA ABSOLUTA: Si no existe actividad operática comprobable, todo inicia en CERO (0)
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
      hasOperationalActivity: false,

      // Subíndices = 0%
      iccScore: 0,
      ishScore: 0,
      icaScore: 0,
      iaaScore: 0,
      iceScore: 0,
      igeoScore: 0,
      iosintScore: 0,
      ipiScore: 0,

      // Modificadores = 0
      finalExperiencePoints: 0,
      improvementBonus: 0,
      penaltyDeductions: 0,
      activePenalties: [],
      trend: "Estable",

      // IMI Finales = 0%
      imiFinal: 0,
      imiOperativo: 0,
      imiEstrategico: 0,
      currentLevel: "Sin evaluación"
    };
  }

  // --- CÁLCULO BASADO EN EVIDENCIA REAL (Cuando SÍ existe actividad) ---

  // A. ICC - Contexto (20%)
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

  // B. ISH - Hipótesis (15%)
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
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round((logicalConnectives > 0 ? 30 : 0) + logicalConnectives * 10 + pValidados * 15 - pDevueltos * 10)))
      : 0;

  // C. ICA - Correlación (15%)
  const icaScore =
    totalProjects > 0 || correlationActions > 0
      ? Math.min(100, Math.max(0, Math.round(correlationActions * 20 + totalProjects * 10)))
      : 0;

  // D. IAA - Autonomía IA (10%)
  const iaaScore =
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round(100 - pDevueltos * 20 + pValidados * 5)))
      : 0;

  // E. ICE - Evidencia (10%)
  const iceScore =
    totalProjects > 0 && evidenceCount > 0
      ? Math.min(100, Math.max(0, Math.round((evidenceCount / (totalProjects * 2)) * 100)))
      : 0;

  // F. IGEO - GEOINT (10%)
  const igeoScore =
    geointProjects > 0
      ? Math.min(100, Math.max(0, Math.round(geointProjects * 25 + totalProjects * 10)))
      : 0;

  // G. IOSINT - OSINT (10%)
  const iosintScore =
    osintQueriesCount > 0
      ? Math.min(100, Math.max(0, Math.round(osintQueriesCount * 25 + totalProjects * 5)))
      : 0;

  // H. IPI - Productividad (10%)
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  const ipiScore =
    totalProjects > 0
      ? Math.min(100, Math.max(0, Math.round(completionRate * 60 + pValidados * 20 + totalProjects * 5)))
      : 0;

  // --- EXPERIENCIA Y MODIFICADORES ---
  const componentsBaseScore =
    iccScore * 0.20 +
    ishScore * 0.15 +
    icaScore * 0.15 +
    iaaScore * 0.10 +
    iceScore * 0.10 +
    igeoScore * 0.10 +
    iosintScore * 0.10 +
    ipiScore * 0.10;

  const rawExperiencePoints = totalProjects * 1.5 + pValidados * 2.5;
  const finalExperiencePoints = Math.min(15, Math.round(rawExperiencePoints * 10) / 10);

  // Tendencia
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

  // Penalizaciones
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

  const imiBase = componentsBaseScore * 0.85 + finalExperiencePoints;
  const imiFinal = Math.max(0, Math.min(100, Math.round(imiBase + improvementBonus - penaltyDeductions)));

  const imiOperativo = Math.round(iccScore * 0.40 + iceScore * 0.30 + ipiScore * 0.30);
  const imiEstrategico = Math.round(
    ishScore * 0.25 + icaScore * 0.25 + igeoScore * 0.20 + iosintScore * 0.20 + iaaScore * 0.10
  );

  const getImiLevel = (score: number) => {
    if (score === 0) return "Sin evaluación";
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
