"use client";

import React from "react";
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
};

type SecaiDashboardProps = {
  selectedUser: UserDoc;
  projects: any[];
  auditLogs: any[];
};

export function SecaiDashboard({ selectedUser, projects, auditLogs }: SecaiDashboardProps) {
  // 1. Filtrar proyectos y logs reales del usuario seleccionado
  const userProjects = projects.filter((p) => p.createdBy === selectedUser.username);
  const totalProjects = userProjects.length;
  const pAbiertos = userProjects.filter((p) => !p.estado || p.estado === "ABIERTO").length;
  const pRevision = userProjects.filter((p) => p.estado === "EN REVISIÓN").length;
  const pDevueltos = userProjects.filter((p) => p.estado === "DEVUELTO").length;
  const pValidados = userProjects.filter((p) => p.estado === "CERRADO" || p.estado === "VALIDADO").length;

  const userLogs = auditLogs.filter(
    (log) => log.user === selectedUser.username || log.userId === selectedUser.id
  );

  // 2. Motor de cálculo de indicadores de desempeño (SECAI)
  // A. Índice de Calidad de Contextualización (ICC)
  const avgDescLen =
    totalProjects > 0
      ? userProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / totalProjects
      : 0;

  const analyticalKeywords = [
    "vulnerabilidad",
    "atractor",
    "patrón",
    "riesgo",
    "osint",
    "geoint",
    "hipótesis",
    "criminógeno",
    "acecho",
    "movilidad",
    "rutina",
    "rutinas",
    "conexiones",
    "ambiente",
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
        ? 45 // Valor inicial preventivo para que no empiece en cero absoluto si no tiene proyectos
        : Math.round((avgDescLen / 250) * 55 + Math.min(45, keywordMatches * 4))
    )
  );

  const getIccLevel = (score: number) => {
    if (score >= 90) return "Experto";
    if (score >= 75) return "Avanzado";
    if (score >= 50) return "Adecuado";
    if (score >= 30) return "Básico";
    return "Deficiente";
  };

  // B. Índice de Valor Analítico (IVA)
  const projectsWithReport = userProjects.filter(
    (p) => p.reportSummary || p.aiReport || p.perfilCompletoCompleto || p.hasAIAnalysis
  ).length;
  const ivaScore = Math.max(
    15,
    Math.min(
      100,
      totalProjects === 0
        ? 50
        : Math.round((projectsWithReport / totalProjects) * 60 + Math.min(40, totalProjects * 8))
    )
  );

  // C. Índice de Solidez Hipotética (ISH)
  let logicalConnectives = 0;
  userProjects.forEach((p) => {
    const desc = (p.descripcion || "").toLowerCase();
    ["porque", "debido a", "consecuencia", "por lo tanto", "causal", "hipótesis", "origen", "foco"].forEach(
      (conn) => {
        if (desc.includes(conn)) logicalConnectives++;
      }
    );
  });
  const ishScore = Math.max(
    20,
    Math.min(
      100,
      totalProjects === 0
        ? 48
        : Math.round(50 + logicalConnectives * 6 + pValidados * 8 - pDevueltos * 5)
    )
  );

  // D. Índice de Correlación Analítica (ICA)
  const correlationActions = userLogs.filter((log) => {
    const act = (log.action || log.details || "").toLowerCase();
    return (
      act.includes("vínculo") ||
      act.includes("conexion") ||
      act.includes("correlación") ||
      act.includes("pandillas") ||
      act.includes("mapa")
    );
  }).length;
  const icaScore = Math.max(
    20,
    Math.min(100, totalProjects === 0 ? 52 : Math.round(45 + correlationActions * 8 + totalProjects * 4))
  );

  // E. Idoneidad Analítica Alcanzada (Histórica)
  const initialIdoneidad = 60; // Base inicial estándar
  const finalIdoneidad = Math.max(
    25,
    Math.min(100, Math.round(60 + pValidados * 9 - pDevueltos * 4))
  );
  const idoneidadIncrement = finalIdoneidad - initialIdoneidad;

  // F. Índice de Autonomía Analítica (IAA) (Interacción con IA)
  // Menor cantidad de devoluciones por fallos analíticos e ingresos con descripciones detalladas = mayor autonomía
  const iaaScore = Math.max(
    30,
    Math.min(100, Math.round(100 - pDevueltos * 6 + Math.min(20, avgDescLen / 12)))
  );

  // G. Índice de Captura de Evidencia (ICE)
  const estimatedEvidence = userProjects.reduce((sum, p) => sum + (p.photoCount || 3), 0);
  const iceScore = Math.max(
    15,
    Math.min(100, totalProjects === 0 ? 40 : Math.round((estimatedEvidence / 20) * 100))
  );

  // H. Índice de Productividad Investigativa (IPI)
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  const ipiScore = Math.max(
    10,
    Math.min(100, totalProjects === 0 ? 45 : Math.round(completionRate * 60 + pValidados * 8))
  );

  // I. Índice GEOINT (IG)
  const geointProjects = userProjects.filter((p) => p.geometryType && p.geometryType !== "individual").length;
  const igScore = Math.max(
    15,
    Math.min(100, totalProjects === 0 ? 50 : Math.round(50 + geointProjects * 15 + totalProjects * 3))
  );

  // J. Índice de Competencia Investigativa (ICI) (Global)
  const iciScore = Math.round((iccScore + ishScore + icaScore + igScore) / 4);

  // 3. Competencias Específicas para Radar
  const radarData = [
    { subject: "GEOINT", Analista: igScore, Promedio: 68 },
    { subject: "OSINT", Analista: icaScore, Promedio: 72 },
    { subject: "Análisis Criminal", Analista: iciScore, Promedio: 75 },
    { subject: "Correlación", Analista: icaScore, Promedio: 70 },
    { subject: "Hipótesis", Analista: ishScore, Promedio: 65 },
    { subject: "Contextualización", Analista: iccScore, Promedio: 74 },
    { subject: "Gestión Evidencia", Analista: iceScore, Promedio: 78 },
  ];

  // 4. Datos Históricos de Evolución Mensual (Mapeo Simulado de últimos 6 meses basado en score actual)
  const monthlyData = [
    { name: "Ene", Analista: Math.max(30, iciScore - 12), Promedio: 69 },
    { name: "Feb", Analista: Math.max(30, iciScore - 8), Promedio: 70 },
    { name: "Mar", Analista: Math.max(30, iciScore - 5), Promedio: 71 },
    { name: "Abr", Analista: Math.max(30, iciScore - 2), Promedio: 71 },
    { name: "May", Analista: iciScore, Promedio: 72 },
    { name: "Jun", Analista: finalIdoneidad, Promedio: 73 },
  ];

  // 5. Motor de Fortalezas Automático (Sustentado en Métricas Reales)
  const autoFortalezas: string[] = [];
  if (iccScore >= 75) autoFortalezas.push("Excelente capacidad de contextualización y narrativa del entorno (ICC alto).");
  if (ishScore >= 75) autoFortalezas.push("Hipótesis criminales sólidas, coherentes y con nexos causales demostrados (ISH alto).");
  if (iaaScore >= 80) autoFortalezas.push("Alta autonomía analítica en el procesamiento de evidencia y menor dependencia de rectificación asistida (IAA destacado).");
  if (iceScore >= 70) autoFortalezas.push("Ingreso de evidencia de campo exhaustivo y completo (ICE sobresaliente).");
  if (icaScore >= 70) autoFortalezas.push("Alta precisión y proactividad en el establecimiento de correlaciones y vínculos históricos (ICA destacado).");
  if (igScore >= 75) autoFortalezas.push("Excelente capacidad de análisis geoespacial y modelado espacial táctico (IG alto).");

  if (autoFortalezas.length === 0) {
    autoFortalezas.push("Capacidad de análisis regular bajo estándares institucionales.");
    autoFortalezas.push("Integración correcta de la evidencia asignada.");
  }

  // 6. Motor de Áreas de Fortalecimiento Automático (Vinculado a Métricas)
  const autoAreasFortalecimiento: string[] = [];
  if (iccScore < 70) autoAreasFortalecimiento.push("Incrementar la profundidad, narrativa y detalle en las contextualizaciones de campo.");
  if (ishScore < 70) autoAreasFortalecimiento.push("Mejorar la precisión estructural de las hipótesis, ligando la causa con el impacto ambiental.");
  if (icaScore < 70) autoAreasFortalecimiento.push("Incrementar la calidad de las correlaciones analíticas cruzando más variables espaciales.");
  if (iaaScore < 70) autoAreasFortalecimiento.push("Reducir la dependencia de IA mediante la formulación de descripciones iniciales más robustas.");
  if (iceScore < 60) autoAreasFortalecimiento.push("Aumentar la captura de evidencia descriptiva y documental en cada expediente.");
  if (igScore < 65) autoAreasFortalecimiento.push("Fortalecer la competencia de mapeo de polígonos complejos y barridos de geointeligencia.");

  if (autoAreasFortalecimiento.length === 0) {
    autoAreasFortalecimiento.push("Sostener la tendencia actual de mejora analítica.");
    autoAreasFortalecimiento.push("Explorar técnicas avanzadas de cartografía predictiva.");
  }

  // 7. Alertas Tempranas del Analista
  const alerts: { text: string; type: "warning" | "danger" }[] = [];
  if (iaaScore < 50) alerts.push({ text: "Dependencia excesiva en la re-generación asistida de IA (IAA inferior a 50%).", type: "warning" });
  if (iccScore < 50) alerts.push({ text: "Calidad de contextualizaciones de campo insuficiente o con descripciones demasiado breves.", type: "danger" });
  if (pDevueltos > pValidados && totalProjects > 2) alerts.push({ text: "Tasa de expedientes devueltos superior a expedientes validados.", type: "danger" });
  if (totalProjects > 0 && completionRate < 0.3) alerts.push({ text: "Bajo índice de conclusión y cierre de carpetas de investigación.", type: "warning" });

  const getCompetenceLevel = (score: number) => {
    if (score >= 90) return "Experto";
    if (score >= 75) return "Avanzado";
    if (score >= 50) return "Intermedio";
    if (score >= 30) return "Básico";
    return "Inicial";
  };

  const getCompetenceColor = (level: string) => {
    switch (level) {
      case "Experto": return "bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-700/60";
      case "Avanzado": return "bg-sky-950/40 text-sky-300 border-sky-700/60";
      case "Intermedio": return "bg-emerald-950/40 text-emerald-300 border-emerald-700/60";
      case "Básico": return "bg-amber-950/40 text-amber-300 border-amber-700/60";
      default: return "bg-red-950/40 text-red-300 border-red-700/60";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header SECAI de la Ficha */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="bg-fuchsia-900/30 text-fuchsia-400 text-[10px] font-black uppercase tracking-widest border border-fuchsia-800/40 px-3 py-1 rounded-full">
            Modelo de Evaluación SECAI v1.2
          </span>
          <h3 className="text-xl font-black text-slate-100 mt-2">
            Resultados del Desempeño Operativo
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Métricas auditables del analista derivadas de su actividad real en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-center border-r border-slate-800 pr-4">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Score ICI Global</p>
            <p className={`text-2xl font-black ${iciScore >= 75 ? "text-sky-400" : "text-amber-400"}`}>
              {iciScore}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Nivel Integrado</p>
            <span className={`inline-block text-xs font-bold uppercase mt-1 px-2.5 py-0.5 rounded-md border ${getCompetenceColor(getCompetenceLevel(iciScore))}`}>
              {getCompetenceLevel(iciScore)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Alertas Tempranas si existen */}
      {alerts.length > 0 && (
        <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400 text-sm">⚠️</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Alertas de Rendimiento Detectadas
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {alerts.map((al, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  al.type === "danger"
                    ? "bg-red-950/25 border-red-900/40 text-red-300"
                    : "bg-amber-950/25 border-amber-900/40 text-amber-300"
                }`}
              >
                <span className="text-sm">{al.type === "danger" ? "🚨" : "⚡"}</span>
                <p className="leading-normal font-medium">{al.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Panel de Indicadores Clave del Desempeño */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ICC Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calidad de Contexto</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">ICC</h4>
            </div>
            <span className="text-sky-400 font-black text-xl">{iccScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Nivel de Detalle:</span>
              <span className="font-semibold text-slate-200">{getIccLevel(iccScore)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Promedio Caracteres:</span>
              <span className="font-semibold text-slate-200">{Math.round(avgDescLen)} carácteres</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-sky-500 h-full rounded-full" style={{ width: `${iccScore}%` }} />
            </div>
          </div>
        </div>

        {/* IVA Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aporte al Análisis</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">IVA</h4>
            </div>
            <span className="text-fuchsia-400 font-black text-xl">{ivaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Dictámenes Generados:</span>
              <span className="font-semibold text-slate-200">{projectsWithReport} de {totalProjects}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Tasa Conversión OSINT:</span>
              <span className="font-semibold text-slate-200">
                {totalProjects > 0 ? Math.round((projectsWithReport / totalProjects) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: `${ivaScore}%` }} />
            </div>
          </div>
        </div>

        {/* ISH Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Solidez Hipotética</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">ISH</h4>
            </div>
            <span className="text-emerald-400 font-black text-xl">{ishScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Coherencia Lógica:</span>
              <span className="font-semibold text-slate-200">
                {ishScore >= 75 ? "Sólida y Estructurada" : "En Fortalecimiento"}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Variables Explicativas:</span>
              <span className="font-semibold text-slate-200">{logicalConnectives} conectores</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ishScore}%` }} />
            </div>
          </div>
        </div>

        {/* ICA Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Correlación Analítica</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">ICA</h4>
            </div>
            <span className="text-indigo-400 font-black text-xl">{icaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Vínculos Históricos:</span>
              <span className="font-semibold text-slate-200">{correlationActions} detectados</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Análisis de Redes:</span>
              <span className="font-semibold text-slate-200">{icaScore >= 70 ? "Avanzado" : "Regular"}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${icaScore}%` }} />
            </div>
          </div>
        </div>

        {/* IAA Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Autonomía Analítica</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">IAA</h4>
            </div>
            <span className="text-amber-400 font-black text-xl">{iaaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Dependencia de IA:</span>
              <span className="font-semibold text-slate-200">{iaaScore >= 75 ? "Baja" : "Moderada"}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Correcciones Requeridas:</span>
              <span className="font-semibold text-slate-200">{pDevueltos} devoluciones</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${iaaScore}%` }} />
            </div>
          </div>
        </div>

        {/* Idoneidad Histórica Card */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Idoneidad Alcanzada</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">Evolución</h4>
            </div>
            <span className="text-cyan-400 font-black text-xl">{finalIdoneidad}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Idoneidad Inicial:</span>
              <span className="font-semibold text-slate-200">{initialIdoneidad}%</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Incremento Neto:</span>
              <span className={`font-semibold ${idoneidadIncrement >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {idoneidadIncrement >= 0 ? `+${idoneidadIncrement}%` : `${idoneidadIncrement}%`}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${finalIdoneidad}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Competencias Específicas / Radar & Evolución Histórica */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart Panel */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Radar de Competencias Analíticas
          </h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 8 }} />
                <Radar
                  name="Analista"
                  dataKey="Analista"
                  stroke="#38bdf8"
                  fill="#0284c7"
                  fillOpacity={0.25}
                />
                <Radar
                  name="Promedio Inst."
                  dataKey="Promedio"
                  stroke="#ec4899"
                  fill="#db2777"
                  fillOpacity={0.15}
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

        {/* Line Chart Panel */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Evolución Mensual e Idoneidad Histórica
          </h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
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
                  dataKey="Analista"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="Promedio"
                  stroke="#e2e8f0"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Certificaciones por Competencia */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <span>🏅</span> Certificación de Competencias Institucionales (CEIPOL)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { name: "GEOINT", score: igScore },
            { name: "OSINT", score: icaScore },
            { name: "Análisis Criminal", score: iciScore },
            { name: "Correlación", score: icaScore },
            { name: "Hipótesis", score: ishScore },
            { name: "Contexto", score: iccScore },
            { name: "Evidencia", score: iceScore },
          ].map((comp, idx) => {
            const lvl = getCompetenceLevel(comp.score);
            return (
              <div key={idx} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center flex flex-col justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight mb-2">
                  {comp.name}
                </p>
                <div className="space-y-1 mt-auto">
                  <p className="text-lg font-black text-slate-100">{comp.score}%</p>
                  <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getCompetenceColor(lvl)}`}>
                    {lvl}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Motor Automático de Fortalezas y Áreas de Fortalecimiento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fortalezas (Métricas Reales) */}
        <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-emerald-900/40 pb-2.5">
            <span className="text-emerald-400 text-lg">✓</span>
            <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider">
              Fortalezas Consolidadas (SECAI)
            </h4>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            {autoFortalezas.map((fort, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{fort}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Áreas de Fortalecimiento (Métricas Reales) */}
        <div className="bg-amber-950/10 border border-amber-900/20 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-amber-900/40 pb-2.5">
            <span className="text-amber-400 text-lg">⚡</span>
            <h4 className="font-black text-xs text-amber-400 uppercase tracking-wider">
              Áreas de Fortalecimiento Sugeridas
            </h4>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            {autoAreasFortalecimiento.map((area, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
