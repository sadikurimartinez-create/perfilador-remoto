"use client";

import React from "react";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from "recharts";
import {
  calculateUserImi,
  IMI_OPERATIONAL_MATURITY_LABEL,
  PERFORMANCE_HISTORY_UNAVAILABLE,
} from "../utils/imiEngine";

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
  const imi = calculateUserImi(selectedUser, projects, auditLogs);
  const {
    totalProjects,
    pDevueltos,
    pValidados,
    evidenceCount,
    validatedEvidenceCount,
    validatedContextSignals,
    validatedHypothesisSignals,
    validatedCorrelationResults,
    validatedOsintResults,
    iccScore,
    ishScore,
    icaScore,
    iaaScore,
    iceScore,
    igeoScore,
    iosintScore,
    ipiScore,
    imiFinal,
    hasInstitutionalEvaluation,
    partialMeasurements,
  } = imi;
  const iciScore = imiFinal;
  const igScore = igeoScore;
  const ivaScore = hasInstitutionalEvaluation ? Math.round((iceScore + iosintScore + icaScore) / 3) : 0;
  const finalIdoneidad = imiFinal;

  const getIccLevel = (score: number) => {
    if (score === 0) return "NO EVALUADO";
    if (score >= 90) return "MADUREZ AVANZADA";
    if (score >= 75) return "Avanzado";
    if (score >= 50) return "Adecuado";
    if (score >= 30) return "Básico";
    return "Deficiente";
  };

  // 3. Competencias Específicas para Radar
  const radarData = [
    { subject: "GEOINT", Analista: igScore },
    { subject: "OSINT", Analista: iosintScore },
    { subject: "Análisis", Analista: iciScore },
    { subject: "Correlación", Analista: icaScore },
    { subject: "Hipótesis", Analista: ishScore },
    { subject: "Contexto", Analista: iccScore },
    { subject: "Evidencia", Analista: iceScore },
  ];

  // 5. Motor de Fortalezas Automático (Sustentado en Métricas Reales)
  const autoFortalezas: string[] = [];
  if (iccScore >= 75) autoFortalezas.push("Contextualización gobernada disponible en expedientes evaluados.");
  if (ishScore >= 75) autoFortalezas.push("Hipótesis con soporte o validación institucional registrada.");
  if (iaaScore >= 80) autoFortalezas.push("Gobernanza de validación analítica con revisión humana registrada.");
  if (iceScore >= 70) autoFortalezas.push("Evidencia trazable disponible en expedientes evaluados.");
  if (icaScore >= 70) autoFortalezas.push("Correlaciones institucionales validadas disponibles.");
  if (igScore >= 75) autoFortalezas.push("Geografía canónica válida en expedientes evaluados.");

  if (autoFortalezas.length === 0) {
    autoFortalezas.push("SIN EVALUACIÓN: no existen señales gobernadas suficientes para emitir fortalezas automáticas.");
  }

  // 6. Motor de Áreas de Fortalecimiento Automático (Vinculado a Métricas)
  const autoAreasFortalecimiento: string[] = [];
  if (iccScore < 70) autoAreasFortalecimiento.push("Registrar contextualizaciones gobernadas o elegibilidad institucional verificable.");
  if (ishScore < 70) autoAreasFortalecimiento.push("Vincular hipótesis con evidencias, hallazgos o validación humana registrada.");
  if (icaScore < 70) autoAreasFortalecimiento.push("Formalizar convergencias, contradicciones o correlaciones institucionales aprobadas.");
  if (iaaScore < 70) autoAreasFortalecimiento.push("Completar revisión humana, validación y cierre de flujo institucional.");
  if (iceScore < 60) autoAreasFortalecimiento.push("Registrar evidencia real con trazabilidad, geografía o validación humana.");
  if (igScore < 65) autoAreasFortalecimiento.push("Asociar geografía canónica válida al expediente.");

  if (autoAreasFortalecimiento.length === 0) {
    autoAreasFortalecimiento.push("Mantener captura de señales gobernadas en expedientes posteriores.");
  }

  // 7. Alertas Tempranas del Analista
  const alerts: { text: string; type: "warning" | "danger" }[] = [];
  const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
  if (iaaScore < 50) alerts.push({ text: "Gobernanza de validación analítica insuficiente o no evaluada.", type: "warning" });
  if (iccScore < 50) alerts.push({ text: "Contextualización gobernada insuficiente o no evaluada.", type: "danger" });
  if (pDevueltos > pValidados && totalProjects > 2) alerts.push({ text: "Tasa de expedientes devueltos superior a expedientes validados.", type: "danger" });
  if (totalProjects > 0 && completionRate < 0.3) alerts.push({ text: "Bajo índice de conclusión y cierre de carpetas de investigación.", type: "warning" });

  const getCompetenceLevel = (score: number) => {
    if (score === 0) return "NO EVALUADO";
    if (score >= 90) return "MADUREZ AVANZADA";
    if (score >= 75) return "Avanzado";
    if (score >= 50) return "Intermedio";
    if (score >= 30) return "Básico";
    return "Inicial";
  };

  const getCompetenceColor = (level: string) => {
    switch (level) {
      case "MADUREZ AVANZADA": return "bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-700/60";
      case "Avanzado": return "bg-sky-950/40 text-sky-300 border-sky-700/60";
      case "Intermedio": return "bg-emerald-950/40 text-emerald-300 border-emerald-700/60";
      case "Básico": return "bg-amber-950/40 text-amber-300 border-amber-700/60";
      default: return "bg-red-950/40 text-red-300 border-red-700/60";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header SECAI de la Ficha */}
      <CEIPOLCard variant="glass" className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{IMI_OPERATIONAL_MATURITY_LABEL}</p>
            <span className={`inline-block text-xs font-bold uppercase mt-1 px-2.5 py-0.5 rounded-md border ${getCompetenceColor(getCompetenceLevel(iciScore))}`}>
              {getCompetenceLevel(iciScore)}
            </span>
          </div>
        </div>
      </CEIPOLCard>

      {/* 2. Alertas Tempranas si existen */}
      {alerts.length > 0 && (
        <CEIPOLCard variant="glass" className="p-4">
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
        </CEIPOLCard>
      )}

      {/* 3. Panel de Indicadores Clave del Desempeño */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ICC Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
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
              <span>Señales gobernadas:</span>
              <span className="font-semibold text-slate-200">{validatedContextSignals}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-sky-500 h-full rounded-full" style={{ width: `${iccScore}%` }} />
            </div>
          </div>
        </CEIPOLCard>

        {/* IVA Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aporte al Análisis</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">IVA</h4>
            </div>
            <span className="text-fuchsia-400 font-black text-xl">{ivaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Resultados validados:</span>
              <span className="font-semibold text-slate-200">{validatedOsintResults + validatedCorrelationResults}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Tasa Conversión OSINT:</span>
              <span className="font-semibold text-slate-200">
                {ivaScore}%
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: `${ivaScore}%` }} />
            </div>
          </div>
        </CEIPOLCard>

        {/* ISH Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Solidez Hipotética</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">ISH</h4>
            </div>
            <span className="text-emerald-400 font-black text-xl">{ishScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Soporte gobernado:</span>
              <span className="font-semibold text-slate-200">
                {ishScore > 0 ? "Disponible" : "NO EVALUADO"}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Hipótesis verificadas:</span>
              <span className="font-semibold text-slate-200">{validatedHypothesisSignals}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ishScore}%` }} />
            </div>
          </div>
        </CEIPOLCard>

        {/* ICA Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Correlación Analítica</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">ICA</h4>
            </div>
            <span className="text-indigo-400 font-black text-xl">{icaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Relaciones validadas:</span>
              <span className="font-semibold text-slate-200">{validatedCorrelationResults}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Estado:</span>
              <span className="font-semibold text-slate-200">{icaScore > 0 ? "Evaluado" : "NO EVALUADO"}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${icaScore}%` }} />
            </div>
          </div>
        </CEIPOLCard>

        {/* IAA Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gobernanza de Validación Analítica</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">IAA</h4>
            </div>
            <span className="text-amber-400 font-black text-xl">{iaaScore}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Validación humana:</span>
              <span className="font-semibold text-slate-200">{iaaScore > 0 ? "Registrada" : "NO EVALUADA"}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Devoluciones:</span>
              <span className="font-semibold text-slate-200">{pDevueltos} devoluciones</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${iaaScore}%` }} />
            </div>
          </div>
        </CEIPOLCard>

        {/* Idoneidad Histórica Card */}
        <CEIPOLCard variant="glass" className="p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Madurez Operativa</p>
              <h4 className="text-lg font-black text-slate-100 tracking-tight">Evaluación</h4>
            </div>
            <span className="text-cyan-400 font-black text-xl">{finalIdoneidad}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Estado:</span>
              <span className="font-semibold text-slate-200">{hasInstitutionalEvaluation ? "EVALUADO" : "SIN EVALUACIÓN"}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Medición:</span>
              <span className="font-semibold text-amber-300">{partialMeasurements.length > 0 ? "PARCIAL" : "COMPLETA"}</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${finalIdoneidad}%` }} />
            </div>
          </div>
        </CEIPOLCard>
      </div>

      {/* 4. Competencias Específicas / Radar & Evolución Histórica */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart Panel */}
        <CEIPOLCard variant="glass" className="p-5 shadow-lg space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Radar de Indicadores Operativos
          </h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#64748b" tick={{ fontSize: 10, fontWeight: "bold" }} />
                <PolarRadiusAxis stroke="#334155" angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                <Radar
                  name="Analista"
                  dataKey="Analista"
                  stroke="#c084fc"
                  fill="#c084fc"
                  fillOpacity={0.25}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CEIPOLCard>

        {/* Line Chart Panel */}
        <CEIPOLCard variant="glass" className="p-5 shadow-lg space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Histórico de Desempeño
          </h4>
          <div className="h-[280px] flex items-center justify-center text-center rounded-xl border border-slate-800 bg-slate-950/40 px-6">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {PERFORMANCE_HISTORY_UNAVAILABLE}
            </p>
          </div>
        </CEIPOLCard>
      </div>

      {/* 5. Certificaciones por Competencia */}
      <CEIPOLCard variant="glass" className="p-5 shadow-lg">
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
      </CEIPOLCard>

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
