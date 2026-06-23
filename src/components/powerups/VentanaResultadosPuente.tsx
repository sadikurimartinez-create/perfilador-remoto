"use client";

import React, { useState } from "react";

export interface PowerUpExecutionResultData {
  insumoId: string;
  insumoName: string;
  insumoText: string;
  powerUpId: string;
  powerUpTitle: string;
  powerUpIcon?: string;
  detectedEntities: string[];
  detectedObjects: string[];
  detectedPlaces: string[];
  detectedActivities: string[];
  riskLevel: "Bajo" | "Medio" | "Alto";
  analysisPerformed: string;
  userValidation: {
    searchRadius?: number;
    analysisPriority?: "Baja" | "Media" | "Alta";
    catalogTypes?: Record<string, boolean>;
    extraContext?: string;
    finalText: string;
  };
  finalFindings: {
    entitiesFound?: string[];
    correlations?: string[];
    summary: string;
  };
  timestamp?: string;
}

interface VentanaResultadosPuenteProps {
  data: PowerUpExecutionResultData;
  onRemove?: () => void;
  isInsideEvidencias?: boolean;
}

export function VentanaResultadosPuente({
  data,
  onRemove,
  isInsideEvidencias = false,
}: VentanaResultadosPuenteProps) {
  const [activeTab, setActiveTab] = useState<"puente" | "validacion" | "analisis">("puente");

  const {
    insumoName,
    insumoText,
    powerUpTitle,
    powerUpIcon = "⚡",
    detectedEntities = [],
    detectedObjects = [],
    detectedPlaces = [],
    detectedActivities = [],
    riskLevel = "Medio",
    analysisPerformed,
    userValidation = { finalText: "" },
    finalFindings = { summary: "" },
    timestamp,
  } = data;

  const riskColor =
    riskLevel === "Alto"
      ? "text-red-400 bg-red-950/40 border-red-500/30"
      : riskLevel === "Medio"
      ? "text-amber-400 bg-amber-950/40 border-amber-500/30"
      : "text-emerald-400 bg-emerald-950/40 border-emerald-500/30";

  return (
    <div className={`w-full rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl transition-all duration-300 hover:border-indigo-500/40 ${
      isInsideEvidencias ? "ring-1 ring-slate-900/50" : "mt-3 animate-fadeIn"
    }`}>
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl shrink-0 p-1.5 bg-indigo-950/40 border border-indigo-500/20 rounded-lg animate-pulse">
            {powerUpIcon}
          </span>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                🧩 RESULTADO DEL PUENTE CONTEXTUAL
              </span>
              {timestamp && (
                <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded">
                  {timestamp}
                </span>
              )}
            </div>
            <h5 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              PowerUp Ejecutado: <span className="text-indigo-300">{powerUpTitle}</span>
            </h5>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskColor}`}>
            Riesgo {riskLevel}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase ml-1 px-1.5 py-0.5 bg-red-950/20 rounded border border-red-500/15"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-900/60 pb-1 mb-3.5 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("puente")}
          className={`px-3 py-1 rounded text-[10.5px] font-semibold transition-all shrink-0 ${
            activeTab === "puente"
              ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🔍 1. Resultados Puente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("validacion")}
          className={`px-3 py-1 rounded text-[10.5px] font-semibold transition-all shrink-0 ${
            activeTab === "validacion"
              ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          👤 2. Validación de Parámetros
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analisis")}
          className={`px-3 py-1 rounded text-[10.5px] font-semibold transition-all shrink-0 ${
            activeTab === "analisis"
              ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🤖 3. Resultado de Inteligencia IA
        </button>
      </div>

      {/* Content Panels */}
      <div className="space-y-3.5 min-h-[140px] text-xs leading-relaxed">
        {/* TAB 1: PUENTE CONTEXTUAL */}
        {activeTab === "puente" && (
          <div className="space-y-3 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-900/40 border border-slate-900 p-2.5 rounded-lg space-y-1">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block tracking-wider">
                  Insumo de Origen ({insumoName})
                </span>
                <p className="text-slate-300 italic line-clamp-3" title={insumoText}>
                  "{insumoText || "Sin narrativa previa..."}"
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-2.5 rounded-lg space-y-1">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block tracking-wider">
                  Análisis Operativo Ejecutado
                </span>
                <code className="text-[10px] text-amber-300 font-mono block leading-relaxed bg-black/30 p-1.5 rounded border border-slate-900">
                  {analysisPerformed}
                </code>
              </div>
            </div>

            {/* Extraction Tag Blocks */}
            <div className="bg-slate-900/20 border border-slate-900/80 p-3 rounded-lg space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Indicios de Interés Identificados en el Puente (NLP)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Entities */}
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-indigo-400 uppercase block">Actores/Alias</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedEntities.length > 0 ? (
                      detectedEntities.map((e, idx) => (
                        <span key={idx} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.2 rounded font-medium">
                          {e}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-600 text-[9px]">Ninguno</span>
                    )}
                  </div>
                </div>

                {/* Objects */}
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-pink-400 uppercase block">Vehículos/Objetos</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedObjects.length > 0 ? (
                      detectedObjects.map((o, idx) => (
                        <span key={idx} className="bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[9px] px-1.5 py-0.2 rounded font-medium">
                          {o}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-600 text-[9px]">Ninguno</span>
                    )}
                  </div>
                </div>

                {/* Places */}
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-emerald-400 uppercase block">Lugares/Vías</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedPlaces.length > 0 ? (
                      detectedPlaces.map((p, idx) => (
                        <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded font-medium">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-600 text-[9px]">Ninguno</span>
                    )}
                  </div>
                </div>

                {/* Activities */}
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-cyan-400 uppercase block">Modus Operandi</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedActivities.length > 0 ? (
                      detectedActivities.map((a, idx) => (
                        <span key={idx} className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[9px] px-1.5 py-0.2 rounded font-medium">
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-600 text-[9px]">Ninguno</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VALIDACION DEL USUARIO */}
        {activeTab === "validacion" && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-900/30 border border-slate-900/80 p-3 rounded-lg space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-900 pb-1">
                Parámetros Validados y Ajustados por el Usuario
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {userValidation.searchRadius !== undefined && (
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-500 text-[9px] uppercase font-bold block">Radio de Búsqueda</span>
                    <span className="text-slate-200 font-mono font-bold text-[11px]">
                      📍 {userValidation.searchRadius} metros
                    </span>
                  </div>
                )}
                {userValidation.analysisPriority !== undefined && (
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-500 text-[9px] uppercase font-bold block">Prioridad de Análisis</span>
                    <span className="text-slate-200 font-bold text-[11px] flex items-center gap-1">
                      🚨 {userValidation.analysisPriority}
                    </span>
                  </div>
                )}
                {userValidation.catalogTypes !== undefined && (
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-500 text-[9px] uppercase font-bold block">Categorías Activas</span>
                    <span className="text-slate-300 text-[10px] font-bold">
                      {Object.entries(userValidation.catalogTypes)
                        .filter(([_, v]) => v)
                        .map(([k]) => k.toUpperCase())
                        .join(", ") || "Ninguna"}
                    </span>
                  </div>
                )}
              </div>

              {userValidation.extraContext && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60 space-y-0.5">
                  <span className="text-slate-500 text-[9px] uppercase font-bold block">Directrices de Inteligencia Táctica (Analista)</span>
                  <p className="text-slate-300 italic text-[10.5px]">
                    "{userValidation.extraContext}"
                  </p>
                </div>
              )}
            </div>

            <div className="bg-indigo-950/10 border border-indigo-950/60 p-2.5 rounded-lg">
              <span className="text-emerald-400 font-bold text-[10px] uppercase block mb-1">
                ✓ Confirmación de Estado
              </span>
              <p className="text-slate-300 text-[10.5px]">
                El analista auditó las sugerencias, validó los parámetros anteriores y autorizó la ejecución del pipeline para robustecer la carpeta de geointeligencia.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: RESULTADOS DEL ANALISIS FINAL IA */}
        {activeTab === "analisis" && (
          <div className="space-y-3 animate-fadeIn">
            <div className="bg-indigo-950/10 border border-indigo-950/60 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-1 border-b border-indigo-950 pb-1">
                <span className="text-amber-400">🤖</span>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  Síntesis del Dictamen de Inteligencia IA
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed font-sans text-[11px] whitespace-pre-line bg-black/20 p-2.5 rounded border border-slate-900">
                {finalFindings.summary || userValidation.finalText}
              </p>
            </div>

            {/* Extra Findings or Correlations if they exist */}
            {((finalFindings.entitiesFound && finalFindings.entitiesFound.length > 0) ||
              (finalFindings.correlations && finalFindings.correlations.length > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {finalFindings.entitiesFound && finalFindings.entitiesFound.length > 0 && (
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-900 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Entidades Estructuradas por IA
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
                      {finalFindings.entitiesFound.map((ent, idx) => (
                        <li key={idx}>{ent}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {finalFindings.correlations && finalFindings.correlations.length > 0 && (
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-900 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Correlaciones / Vínculos Detectados
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
                      {finalFindings.correlations.map((corr, idx) => (
                        <li key={idx} className="text-amber-300/90">{corr}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
