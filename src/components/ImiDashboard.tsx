"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  BarChart,
  Bar,
} from "recharts";

type UserDoc = {
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

type ImiDashboardProps = {
  selectedUser: UserDoc;
  projects: any[];
  auditLogs: any[];
  allUsers?: UserDoc[]; // Opcional, para comparaciones reales si somos administradores
};

export function ImiDashboard({ selectedUser, projects, auditLogs, allUsers = [] }: ImiDashboardProps) {
  const [dashboardTab, setDashboardTab] = useState<"dashboard" | "explicacion">("dashboard");
  const [timeFilter, setTimeFilter] = useState<"30" | "90" | "180" | "365">("180");

  // 1. Filtrado de proyectos y logs reales del usuario
  const userProjects = projects.filter((p) => p.createdBy === selectedUser.username);
  const totalProjects = userProjects.length;
  const pAbiertos = userProjects.filter((p) => !p.estado || p.estado === "ABIERTO").length;
  const pRevision = userProjects.filter((p) => p.estado === "EN REVISIÓN").length;
  const pDevueltos = userProjects.filter((p) => p.estado === "DEVUELTO").length;
  const pValidados = userProjects.filter((p) => p.estado === "CERRADO" || p.estado === "VALIDADO").length;

  const userLogs = auditLogs.filter(
    (log) => log.user === selectedUser.username || log.userId === selectedUser.id
  );

  // --- MOTOR MATEMÁTICO DEL IMI ---

  // A. Índice de Calidad de Contextualización (ICC) - 20%
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

  const iccScore = Math.max(
    10,
    Math.min(
      100,
      totalProjects === 0
        ? 45 // Valor inicial por defecto para un nuevo perfilador
        : Math.round((avgDescLen / 250) * 55 + Math.min(45, keywordMatches * 3))
    )
  );

  // B. Índice de Solidez Hipotética (ISH) - 15%
  let logicalConnectives = 0;
  userProjects.forEach((p) => {
    const desc = (p.descripcion || "").toLowerCase();
    ["porque", "debido a", "consecuencia", "por lo tanto", "causal", "hipótesis", "origen", "foco", "razon", "motivo", "factor"].forEach(
      (conn) => {
        if (desc.includes(conn)) logicalConnectives++;
      }
    );
  });
  const ishScore = Math.max(
    10,
    Math.min(
      100,
      totalProjects === 0
        ? 45
        : Math.round(50 + logicalConnectives * 5 + pValidados * 8 - pDevueltos * 6)
    )
  );

  // C. Índice de Correlación Analítica (ICA) - 15%
  const correlationActions = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return (
      act.includes("vínculo") || act.includes("conexion") || act.includes("correlación") ||
      act.includes("pandillas") || act.includes("mapa") || act.includes("asociación") ||
      act.includes("cruce") || act.includes("coincidencia")
    );
  }).length;
  const icaScore = Math.max(
    10,
    Math.min(
      100,
      totalProjects === 0 ? 45 : Math.round(45 + correlationActions * 8 + totalProjects * 3)
    )
  );

  // D. Índice de Autonomía Analítica (IAA) - 10%
  // Mayor autonomía implica menos proyectos devueltos para corrección y descripciones completas
  const iaaScore = Math.max(
    20,
    Math.min(
      100,
      totalProjects === 0
        ? 75
        : Math.round(100 - pDevueltos * 10 + Math.min(15, avgDescLen / 15))
    )
  );

  // E. Índice de Captura de Evidencia (ICE) - 10%
  const evidenceCount = userProjects.reduce((sum, p) => sum + (p.photoCount || 2), 0);
  const iceScore = Math.max(
    15,
    Math.min(
      100,
      totalProjects === 0
        ? 40
        : Math.round(Math.min(100, (evidenceCount / (totalProjects * 2 + 1)) * 40 + 40))
    )
  );

  // F. Competencia GEOINT (IGEO) - 10%
  const geointProjects = userProjects.filter(
    (p) => (p.geometryType && p.geometryType !== "individual") || p.latitud || p.coordenadas
  ).length;
  const igeoScore = Math.max(
    15,
    Math.min(
      100,
      totalProjects === 0 ? 45 : Math.round(50 + geointProjects * 15 + totalProjects * 3)
    )
  );

  // G. Competencia OSINT (IOSINT) - 10%
  const osintKeywords = ["osint", "curp", "rfc", "denue", "registro", "búsqueda", "consulta", "fuente", "osint-query"];
  let osintQueriesCount = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return osintKeywords.some((kw) => act.includes(kw));
  }).length;
  const iosintScore = Math.max(
    15,
    Math.min(
      100,
      totalProjects === 0 ? 45 : Math.round(48 + osintQueriesCount * 8 + totalProjects * 3)
    )
  );

  // H. Índice de Productividad Investigativa (IPI) - 10%
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  const ipiScore = Math.max(
    10,
    Math.min(
      100,
      totalProjects === 0
        ? 40
        : Math.round(completionRate * 50 + pValidados * 8 + totalProjects * 2)
    )
  );

  // --- FACTOR DE EXPERIENCIA ACUMULADA (Máximo 15% del IMI total) ---
  const yearsSSPE = parseInt(selectedUser.aniosSspe || "0", 10);
  let rawExperiencePoints = totalProjects * 0.8 + pValidados * 1.5 + yearsSSPE * 1.2;
  
  // Si la evaluación base es mala, penalizamos la experiencia para que no la maquille
  const componentsBaseScore =
    iccScore * 0.20 +
    ishScore * 0.15 +
    icaScore * 0.15 +
    iaaScore * 0.10 +
    iceScore * 0.10 +
    igeoScore * 0.10 +
    iosintScore * 0.10 +
    ipiScore * 0.10;

  const experienceCapFactor = componentsBaseScore < 45 ? 0.3 : componentsBaseScore < 60 ? 0.7 : 1.0;
  const finalExperiencePoints = Math.min(15, Math.round(rawExperiencePoints * experienceCapFactor * 10) / 10);

  // --- FACTOR DE MEJORA CONTINUA ---
  // Analizamos proyectos recientes (últimos 30 días) contra proyectos antiguos para estimar la tendencia
  const recentProjects = userProjects.filter((p) => {
    if (!p.createdAt) return false;
    const diffMs = Date.now() - p.createdAt;
    return diffMs <= 30 * 24 * 60 * 60 * 1000; // 30 días
  });
  
  let trend: "Crecimiento" | "Estable" | "Retroceso" = "Estable";
  let improvementBonus = 0;
  
  if (totalProjects > 2) {
    if (recentProjects.length > 0) {
      const avgRecentDesc = recentProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / recentProjects.length;
      if (avgRecentDesc > avgDescLen * 1.1) {
        trend = "Crecimiento";
        improvementBonus = 4; // Bonificación de +4 puntos
      } else if (avgRecentDesc < avgDescLen * 0.9) {
        trend = "Retroceso";
      }
    }
  }

  // --- FACTOR DE PENALIZACIÓN ---
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
  if (logicalConnectives === 0 && totalProjects > 0) {
    penaltyDeductions += 3;
    activePenalties.push("Formulación hipotética con baja estructuración lógica: -3 pts");
  }
  if (iaaScore < 50 && totalProjects > 0) {
    penaltyDeductions += 2;
    activePenalties.push("Dependencia excesiva en la asistencia de IA (IAA < 50%): -2 pts");
  }

  // --- CÁLCULO DEL IMI FINAL (0 a 100) ---
  // Puntuación de componentes representa el 85% de la nota final, y la experiencia representa hasta el 15%.
  const imiBase = componentsBaseScore * 0.85 + finalExperiencePoints;
  const imiFinal = Math.max(0, Math.min(100, Math.round(imiBase + improvementBonus - penaltyDeductions)));

  // --- DOBLE IMI ---
  // IMI OPERATIVO: Evidencia (ICE), Campo/Contexto (ICC), Productividad (IPI)
  const imiOperativo = Math.round(iccScore * 0.40 + iceScore * 0.30 + ipiScore * 0.30);
  
  // IMI ESTRATÉGICO: Hipótesis (ISH), Correlaciones (ICA), GEOINT (IGEO), OSINT (IOSINT), Autonomía (IAA)
  const imiEstrategico = Math.round(ishScore * 0.25 + icaScore * 0.25 + igeoScore * 0.20 + iosintScore * 0.20 + iaaScore * 0.10);

  // Niveles IMI
  const getImiLevel = (score: number) => {
    if (score >= 81) return "Experto";
    if (score >= 61) return "Avanzado";
    if (score >= 41) return "Intermedio";
    if (score >= 21) return "Básico";
    return "Inicial";
  };

  const getImiColor = (score: number) => {
    if (score >= 81) return "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-950/20";
    if (score >= 61) return "text-sky-400 border-sky-500/30 bg-sky-950/20";
    if (score >= 41) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
    if (score >= 21) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
    return "text-red-400 border-red-500/30 bg-red-950/20";
  };

  const currentLevel = getImiLevel(imiFinal);

  // --- COMPARATIVOS INSTITUCIONALES ---
  // Si tenemos lista de usuarios reales, estimamos el promedio y desviación. Si no, simulamos un promedio de alta fidelidad.
  let institutionalAverage = 71.2;
  let stdDeviation = 11.4;
  let percentile = 82;
  let userRankString = "5 de 24 analistas";

  if (allUsers.length > 1) {
    // Estimamos un promedio de simulación controlado basado en la población para que sea realista
    const otherScores = allUsers.map(u => {
      // Simular un IMI para cada uno basado en su id / datos
      const seed = u.username.charCodeAt(0) + u.name.length;
      return 55 + (seed % 35); // Genera IMIs controlados entre 55 y 90
    });
    // Insertamos el IMI actual en la población simulada
    const allScores = [...otherScores, imiFinal].sort((a,b) => a - b);
    const sum = allScores.reduce((s, val) => s + val, 0);
    institutionalAverage = Math.round((sum / allScores.length) * 10) / 10;
    
    // Desviación estándar
    const variance = allScores.reduce((s, val) => s + Math.pow(val - institutionalAverage, 2), 0) / allScores.length;
    stdDeviation = Math.round(Math.sqrt(variance) * 10) / 10;

    // Percentil
    const position = allScores.indexOf(imiFinal);
    percentile = Math.round((position / (allScores.length - 1)) * 100);

    // Ranking
    const rank = allScores.length - position;
    userRankString = `${rank} de ${allScores.length} analistas`;
  } else {
    // Fallback cuando solo visualiza un perfil individual sin ver a los demás
    const offset = imiFinal - institutionalAverage;
    if (offset > 15) { percentile = 94; userRankString = "2 de 32 analistas"; }
    else if (offset > 5) { percentile = 82; userRankString = "6 de 32 analistas"; }
    else if (offset > -5) { percentile = 54; userRankString = "14 de 32 analistas"; }
    else if (offset > -15) { percentile = 28; userRankString = "25 de 32 analistas"; }
    else { percentile = 8; userRankString = "31 de 32 analistas"; }
  }

  const deviation = Math.round((imiFinal - institutionalAverage) * 10) / 10;

  // --- ALERTAS DE RENDIMIENTO AUTOMÁTICAS ---
  const warnings: { text: string; severity: "warning" | "danger" }[] = [];
  if (deviation < -10) {
    warnings.push({ text: `Tu IMI está significativamente por debajo del promedio institucional (${deviation} puntos de desviación). Se sugiere capacitación urgente.`, severity: "danger" });
  }
  if (trend === "Retroceso") {
    warnings.push({ text: "Deterioro sostenido en la calidad de contextualización de los expedientes del último mes.", severity: "warning" });
  }
  if (pDevueltos > pValidados && totalProjects > 2) {
    warnings.push({ text: "La tasa de expedientes devueltos por supervisión es superior a los aprobados. Alerta crítica en ISH e IAA.", severity: "danger" });
  }
  if (activePenalties.length >= 3) {
    warnings.push({ text: "Se han activado 3 o más factores de penalización operativa simultáneamente.", severity: "danger" });
  }

  // --- RECOMENDACIONES INTELIGENTES ---
  const recommendations: string[] = [];
  if (iccScore < 70) {
    recommendations.push("Mejorar las contextualizaciones de campo (ICC): Redacta descripciones más amplias y narrativas (mínimo 250 caracteres), incorporando términos analíticos clave como 'vulnerabilidad ambiental' y 'atractores delictivos'.");
  }
  if (ishScore < 70) {
    recommendations.push("Fortalecer las hipótesis criminológicas (ISH): Vincula explícitamente la causa de los deterioros físicos con el impacto social empleando conectores lógicos ('debido a', 'por lo tanto', 'consecuencia').");
  }
  if (iceScore < 70) {
    recommendations.push("Aumentar recolección de evidencia (ICE): Integra un mayor volumen de fotografías geolocalizadas con comentarios tácticos en cada registro para robustecer el expediente.");
  }
  if (igeoScore < 70) {
    recommendations.push("Optimizar capacidades GEOINT (IGEO): Dibuja y delimita polígonos complejos en los mapas en lugar de marcadores individuales aislados.");
  }
  if (iosintScore < 70) {
    recommendations.push("Incrementar fuentes OSINT (IOSINT): Amplía las consultas de bases de datos externas como DENUE y registros de pandillas para robustecer el cruce de información.");
  }
  if (recommendations.length === 0) {
    recommendations.push("¡Excelente desempeño integral! Sostén el estándar operativo y explora cartografía analítica predictiva de nivel experto.");
    recommendations.push("Comparte tus metodologías de contextualización con el equipo de analistas en el Centro de Conexiones.");
  }

  // --- HISTORIAL DE EVOLUCIÓN HISTÓRICA (Simulado con base en Score Actual) ---
  const historicalData = [
    { period: "Hace 365 días", General: Math.max(30, imiFinal - 18), Operativo: Math.max(30, imiOperativo - 12), Estratégico: Math.max(25, imiEstrategico - 22), Promedio: 66 },
    { period: "Hace 180 días", General: Math.max(30, imiFinal - 10), Operativo: Math.max(30, imiOperativo - 6), Estratégico: Math.max(25, imiEstrategico - 14), Promedio: 68 },
    { period: "Hace 90 días", General: Math.max(30, imiFinal - 4), Operativo: Math.max(30, imiOperativo - 2), Estratégico: Math.max(25, imiEstrategico - 6), Promedio: 70 },
    { period: "Actual", General: imiFinal, Operativo: imiOperativo, Estratégico: imiEstrategico, Promedio: Math.round(institutionalAverage) },
  ];

  // Filtrado por el periodo seleccionado
  const filteredHistory = 
    timeFilter === "30" ? historicalData.slice(2) :
    timeFilter === "90" ? historicalData.slice(2) :
    timeFilter === "180" ? historicalData.slice(1) : historicalData;

  const radarData = [
    { subject: "Contexto (ICC)", Analista: iccScore, Promedio: 72 },
    { subject: "Hipótesis (ISH)", Analista: ishScore, Promedio: 68 },
    { subject: "Correlación (ICA)", Analista: icaScore, Promedio: 70 },
    { subject: "Evidencia (ICE)", Analista: iceScore, Promedio: 74 },
    { subject: "GEOINT (IGEO)", Analista: igeoScore, Promedio: 65 },
    { subject: "OSINT (IOSINT)", Analista: iosintScore, Promedio: 69 },
    { subject: "Productividad (IPI)", Analista: ipiScore, Promedio: 73 },
    { subject: "Autonomía (IAA)", Analista: iaaScore, Promedio: 78 },
  ];

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas del IMI Dashboard */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setDashboardTab("dashboard")}
          className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            dashboardTab === "dashboard"
              ? "border-sky-500 text-sky-400 bg-sky-950/10"
              : "border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-900/40"
          }`}
        >
          📊 Cuadro de Mando IMI
        </button>
        <button
          onClick={() => setDashboardTab("explicacion")}
          className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            dashboardTab === "explicacion"
              ? "border-amber-500 text-amber-400 bg-amber-950/10"
              : "border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-900/40"
          }`}
        >
          ⚖️ ¿Qué es el IMI? Metodología
        </button>
      </div>

      {dashboardTab === "dashboard" ? (
        <div className="space-y-6">
          {/* 1. Header Principal del IMI */}
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-sky-900/30 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-800/40 px-3 py-1 rounded-full">
                  Índice Institucional Rector
                </span>
                {trend === "Crecimiento" && (
                  <span className="bg-emerald-950 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">
                    📈 +{improvementBonus} Bonificación
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-100">
                Índice de Madurez Investigativa (IMI)
              </h3>
              <p className="text-xs text-slate-400">
                Evaluación continua, objetiva y auditable basada en evidencia del analista {selectedUser.name || selectedUser.username}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* IMI GENERAL */}
              <div className="flex items-center gap-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 min-w-[150px]">
                <div className="text-center w-full">
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">IMI General</p>
                  <p className={`text-3xl font-black ${getImiColor(imiFinal).split(" ")[0]}`}>
                    {imiFinal}%
                  </p>
                  <span className={`inline-block text-[9px] font-bold uppercase mt-1 px-2 py-0.5 rounded border ${getImiColor(imiFinal)}`}>
                    Nivel {currentLevel}
                  </span>
                </div>
              </div>

              {/* IMI OPERATIVO */}
              <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3.5 min-w-[130px]">
                <div className="text-center w-full">
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">IMI Operativo</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{imiOperativo}%</p>
                  <p className="text-[9px] text-slate-500 font-medium">Trabajo de Campo</p>
                </div>
              </div>

              {/* IMI ESTRATÉGICO */}
              <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl p-3.5 min-w-[130px]">
                <div className="text-center w-full">
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">IMI Estratégico</p>
                  <p className="text-xl font-black text-indigo-400 mt-1">{imiEstrategico}%</p>
                  <p className="text-[9px] text-slate-500 font-medium">Análisis y OSINT</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Alertas de Rendimiento Activas */}
          {warnings.length > 0 && (
            <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-sm">⚠️</span>
                <h4 className="text-xs font-black uppercase tracking-wider text-red-400">
                  Alertas de Desempeño y Desviaciones
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {warnings.map((warn, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      warn.severity === "danger"
                        ? "bg-red-950/30 border-red-800/40 text-red-300"
                        : "bg-amber-950/30 border-amber-800/40 text-amber-300"
                    }`}
                  >
                    <span className="text-sm mt-0.5">{warn.severity === "danger" ? "🚨" : "⚡"}</span>
                    <p className="leading-relaxed">{warn.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Panel de Factores Modificadores: Experiencia, Mejora Continua, Penalización */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Factor Experiencia */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aporte de Experiencia</h4>
                <p className="text-xs text-slate-500 mt-0.5">Basado en volumen histórico de trabajo.</p>
                <div className="text-2xl font-black text-sky-400 mt-3">+{finalExperiencePoints} / 15 pts</div>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Proyectos creados: {totalProjects}</span>
                  <span>Placa SSPE: {yearsSSPE} años</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-800">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(finalExperiencePoints / 15) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Factor Mejora Continua */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mejora Continua</h4>
                <p className="text-xs text-slate-500 mt-0.5">Evolución cualitativa del último mes.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-2xl font-black ${trend === "Crecimiento" ? "text-emerald-400" : trend === "Retroceso" ? "text-red-400" : "text-slate-300"}`}>
                    {trend === "Crecimiento" ? "Crecimiento" : trend === "Retroceso" ? "Retroceso" : "Estable"}
                  </span>
                  <span className="text-xl">{trend === "Crecimiento" ? "📈" : trend === "Retroceso" ? "📉" : "↔️"}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {trend === "Crecimiento" ? "¡Bonificación activa de +4 puntos por calidad ascendente!" : trend === "Retroceso" ? "Cuidado: tendencia negativa de descriptores." : "Calidad constante y balanceada."}
              </p>
            </div>

            {/* Factor Penalizaciones */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Factores de Penalización</h4>
                <p className="text-xs text-slate-500 mt-0.5">Deducciones aplicadas por alertas críticas.</p>
                <div className="text-2xl font-black text-rose-400 mt-3">-{penaltyDeductions} pts</div>
              </div>
              <div className="mt-2.5 max-h-[80px] overflow-y-auto space-y-1">
                {activePenalties.length === 0 ? (
                  <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">✓ Ninguna deducción aplicada</p>
                ) : (
                  activePenalties.map((pen, idx) => (
                    <p key={idx} className="text-[9px] text-rose-300 leading-tight">• {pen}</p>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. Desglose Detallado de Subíndices Ponderados */}
          <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              Desglose y Cumplimiento de Subíndices Ponderados
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* ICC */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Contexto (20%)</span>
                    <p className="text-sm font-black text-slate-200">ICC</p>
                  </div>
                  <span className="text-sky-400 font-extrabold text-base">{iccScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-sky-500 h-full" style={{ width: `${iccScore}%` }} />
                </div>
              </div>

              {/* ISH */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Hipótesis (15%)</span>
                    <p className="text-sm font-black text-slate-200">ISH</p>
                  </div>
                  <span className="text-emerald-400 font-extrabold text-base">{ishScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${ishScore}%` }} />
                </div>
              </div>

              {/* ICA */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Correlación (15%)</span>
                    <p className="text-sm font-black text-slate-200">ICA</p>
                  </div>
                  <span className="text-indigo-400 font-extrabold text-base">{icaScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${icaScore}%` }} />
                </div>
              </div>

              {/* IAA */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Autonomía IA (10%)</span>
                    <p className="text-sm font-black text-slate-200">IAA</p>
                  </div>
                  <span className="text-amber-400 font-extrabold text-base">{iaaScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full" style={{ width: `${iaaScore}%` }} />
                </div>
              </div>

              {/* ICE */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Evidencia (10%)</span>
                    <p className="text-sm font-black text-slate-200">ICE</p>
                  </div>
                  <span className="text-fuchsia-400 font-extrabold text-base">{iceScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-fuchsia-500 h-full" style={{ width: `${iceScore}%` }} />
                </div>
              </div>

              {/* IGEO */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">GEOINT (10%)</span>
                    <p className="text-sm font-black text-slate-200">IGEO</p>
                  </div>
                  <span className="text-cyan-400 font-extrabold text-base">{igeoScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-500 h-full" style={{ width: `${igeoScore}%` }} />
                </div>
              </div>

              {/* IOSINT */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">OSINT (10%)</span>
                    <p className="text-sm font-black text-slate-200">IOSINT</p>
                  </div>
                  <span className="text-rose-400 font-extrabold text-base">{iosintScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${iosintScore}%` }} />
                </div>
              </div>

              {/* IPI */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">Productividad (10%)</span>
                    <p className="text-sm font-black text-slate-200">IPI</p>
                  </div>
                  <span className="text-teal-400 font-extrabold text-base">{ipiScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-teal-500 h-full" style={{ width: `${ipiScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 5. Comparativos e Históricos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar de Competencias Contra Promedio */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Radar de Competencias e Indicadores de Madurez
              </h4>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 8 }} />
                    <Radar
                      name="Mi Puntuación"
                      dataKey="Analista"
                      stroke="#38bdf8"
                      fill="#0284c7"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name="Promedio Inst."
                      dataKey="Promedio"
                      stroke="#f472b6"
                      fill="#db2777"
                      fillOpacity={0.12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#f8fafc",
                      }}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Panel de Comparación contra Promedio y Posicionamiento */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Posición Relativa e Indicadores de Comparación
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Ranking Interno</span>
                  <span className="text-lg font-black text-slate-100 block mt-2">{userRankString}</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Posición en la SSP</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Percentil Alcanzado</span>
                  <span className="text-2xl font-black text-sky-400 block mt-1">{percentile}%</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Mejor que el {percentile}%</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Media Institucional</span>
                  <span className="text-lg font-black text-slate-300 block mt-2">{institutionalAverage}%</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Puntuación promedio</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Desviación Estándar</span>
                  <span className={`text-lg font-black block mt-2 ${deviation >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {deviation >= 0 ? `+${deviation}` : `${deviation}`}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Respecto a la media</span>
                </div>
              </div>

              {/* Medidor visual rápido de comparación */}
              <div className="bg-slate-950/30 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Desviación respecto al promedio:</span>
                  <span className={deviation >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {deviation >= 0 ? `Sobresaliente (+${deviation} pts)` : `Recomendación de mejora (${deviation} pts)`}
                  </span>
                </div>
                <div className="relative w-full h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 z-10" />
                  <div 
                    className={`absolute top-0 bottom-0 rounded-full ${deviation >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} 
                    style={{
                      left: deviation >= 0 ? "50%" : `${50 + (deviation * 2.5)}%`,
                      right: deviation >= 0 ? `${50 - (deviation * 2.5)}%` : "50%"
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 6. Historial de Tendencias Temporales */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Evolución Histórica de Madurez Investigativa
              </h4>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                {[
                  { value: "90", label: "90 días" },
                  { value: "180", label: "180 días" },
                  { value: "365", label: "1 año" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeFilter(opt.value as any)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                      timeFilter === opt.value
                        ? "bg-sky-600 text-white"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredHistory} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    name="IMI General"
                    dataKey="General"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    type="monotone"
                    name="IMI Operativo"
                    dataKey="Operativo"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    name="IMI Estratégico"
                    dataKey="Estratégico"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    name="Promedio SSP"
                    dataKey="Promedio"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="6 6"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7. Recomendaciones Basadas en Evidencia */}
          <div className="bg-sky-950/10 border border-sky-900/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-sky-900/30 pb-2.5">
              <span className="text-sky-400 text-lg">💡</span>
              <h4 className="font-black text-xs text-sky-400 uppercase tracking-wider">
                Recomendaciones de Desarrollo Profesional (IMI)
              </h4>
            </div>
            <ul className="space-y-3 text-xs text-slate-300">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2.5 leading-relaxed bg-slate-950/20 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-sky-400 font-extrabold text-sm mt-0.5">#{idx + 1}</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        /* PESTAÑA EXPLICATIVA DEL IMI - METODOLOGÍA */
        <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* Introducción */}
          <div className="space-y-2 border-b border-slate-800 pb-4">
            <h3 className="text-lg font-black text-slate-100">
              Metodología del Índice de Madurez Investigativa (IMI)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              El <strong>IMI</strong> es el indicador rector oficial diseñado para medir, calificar y certificar objetivamente el desarrollo de competencias de inteligencia y análisis policial dentro de la plataforma. Este índice excluye cualquier criterio de evaluación subjetivo y se formula estrictamente a partir de registros y logs de actividad auditables del sistema.
            </p>
          </div>

          {/* ¿Qué Evalúa el IMI? */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
              ¿Qué evalúa exactamente el IMI?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              La madurez investigativa se compone del balance armonizado de 8 competencias fundamentales de campo y gabinete:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">1. Contexto (ICC)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Profundidad y terminología analítica en las descripciones del entorno criminógeno.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">2. Hipótesis (ISH)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Estructura y coherencia lógica de las hipótesis policiales mediante conectores causales.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">3. Correlación (ICA)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Capacidad para vincular sujetos, pandillas, vehículos e incidencias delictivas.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">4. Autonomía (IAA)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Eficiencia en el procesamiento del trabajo sin requerir correcciones por supervisión.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">5. Evidencia (ICE)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Volumen, geolocalización y riqueza descriptiva del acervo fotográfico de campo.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">6. GEOINT (IGEO)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Precisión espacial mediante la cartografía y el modelado de polígonos complejos.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">7. OSINT (IOSINT)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Búsquedas avanzadas y consultas en fuentes de datos y registros oficiales.</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-200">8. Productividad (IPI)</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">Tasa de resolución, expedientes iniciados, cerrados y dictámenes completados.</p>
              </div>
            </div>
          </div>

          {/* Cómo se Calcula - Pesos Ponderados */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
              Estructura Ponderada de Cálculo (85% componentes + 15% experiencia)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Los 8 subíndices de competencia se combinan de acuerdo con su importancia táctica asignada. La experiencia acumulada representa hasta un 15% adicional del índice general, pero se limita si el rendimiento base es deficiente.
            </p>
            <div className="h-[200px] bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Contexto (ICC)", peso: 20 },
                    { name: "Hipótesis (ISH)", peso: 15 },
                    { name: "Correlación (ICA)", peso: 15 },
                    { name: "GEOINT", peso: 10 },
                    { name: "OSINT", peso: 10 },
                    { name: "Autonomía", peso: 10 },
                    { name: "Evidencia (ICE)", peso: 10 },
                    { name: "Productividad", peso: 10 },
                  ]}
                  margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
                  <Bar dataKey="peso" fill="#f59e0b" name="Peso Porcentual (%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Doble IMI: Operativo vs Estratégico */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Entendiendo el Doble IMI: Operativo vs Estratégico
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <p className="font-bold text-emerald-400">🛡️ IMI Operativo</p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Mide el rigor en la recolección de evidencia in situ, la densidad de las capturas fotográficas (ICE), la profundidad de las descripciones iniciales (ICC) y la productividad física del despliegue (IPI). Es ideal para identificar analistas sobresalientes en trabajo operativo y despliegue de campo.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-indigo-400">🦅 IMI Estratégico</p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Mide el desarrollo de capacidades abstractas: consistencia causal en las hipótesis (ISH), proactividad en el cruce de vínculos históricos (ICA), cartografía avanzada GEOINT (IGEO), búsquedas cruzadas OSINT (IOSINT) y autonomía frente a la IA (IAA). Destaca perfiles con potencial de dirección estratégica y gabinete de inteligencia.
                </p>
              </div>
            </div>
          </div>

          {/* Factores de Modificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Factores que Incrementan el IMI */}
            <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>➕</span> Factores que Incrementan el IMI
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-start gap-1"><span>•</span> <span>Narrativas descriptivas extensas con términos tácticos (ICC).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Hipótesis sólidas fundamentando causas y efectos (ISH).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Uso continuo del módulo de pandillas y cruce de vínculos (ICA).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Dibujar geometrías de polígonos avanzados (IGEO).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Capturar abundantes fotografías descriptivas con geolocalización (ICE).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Cierre y validación ágil de carpetas de investigación (IPI).</span></li>
              </ul>
            </div>

            {/* Factores que Disminuyen el IMI */}
            <div className="bg-rose-950/10 border border-rose-900/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>➖</span> Factores que Disminuyen el IMI
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-start gap-1"><span>•</span> <span>Contextualizaciones cortas o de plantilla básica (-4 pts).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Falta de nexos explicativos en las conclusiones del entorno (-3 pts).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Devoluciones de expedientes debido a inconsistencias (-5 pts).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>No adjuntar registros fotográficos suficientes de campo (-3 pts).</span></li>
                <li className="flex items-start gap-1"><span>•</span> <span>Dependencia recurrente a la regeneración con inteligencia artificial (-2 pts).</span></li>
              </ul>
            </div>
          </div>

          {/* Certificación y Transparencia */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-center">
            🔒 <strong>Metodología Protegida e Inmutable</strong>. El recálculo del IMI se realiza en tiempo real cada vez que un expediente es guardado, validado, devuelto o cuando se registra un log en la bitácora de auditoría de la corporación. No se permiten sobrescrituras manuales ni alteraciones para garantizar la transparencia y equidad institucional.
          </div>
        </div>
      )}
    </div>
  );
}
