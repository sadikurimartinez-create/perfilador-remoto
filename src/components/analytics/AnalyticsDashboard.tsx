"use client";

import * as React from "react";
import { useState } from "react";
import { AtractorsDensityChart } from "./SpatialCharts/AtractorsDensityChart";
import { ConcentrationScatter } from "./SpatialCharts/ConcentrationScatter";
import { TemporalEvolutionChart } from "./TemporalCharts/TemporalEvolutionChart";
import { TacticalDistribution } from "./StreetViewCharts/TacticalDistribution";
import { EnvironmentProfileRadar } from "./EnvironmentCharts/EnvironmentProfileRadar";
import { useAnalyticsFilter } from "./AnalyticsFilterContext";

interface AnalyticsDashboardProps {
  pois: any[];
  findings: any[];
  historicalCrimes?: any[];
}

type TabType = "spatial" | "temporal" | "streetview" | "environment";

export function AnalyticsDashboard({
  pois = [],
  findings = [],
  historicalCrimes = [],
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("spatial");
  const { filterState, resetFilters } = useAnalyticsFilter();

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 flex flex-col h-full overflow-hidden shadow-2xl gap-5">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase block mb-0.5">Módulo de Inteligencia Táctica</span>
          <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
            <span>📈</span> Análisis Geointeligente de Entorno
          </h2>
        </div>

        {/* Controles de Filtros Activos */}
        <div className="flex items-center gap-3">
          {filterState.categoriaSeleccionada && (
            <div className="flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-800/60 px-3 py-1.5 rounded-full text-[9px] font-bold text-cyan-400 uppercase">
              <span>Categoría: {filterState.categoriaSeleccionada.replace("_", " ")}</span>
              <button
                onClick={() => resetFilters()}
                className="hover:text-cyan-200 transition-all font-mono"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={() => resetFilters()}
            disabled={!filterState.categoriaSeleccionada}
            className="text-[9px] font-black uppercase bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-800 transition-all disabled:opacity-30"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex gap-2 p-1.5 bg-slate-900/50 rounded-2xl border border-slate-900/80 shrink-0">
        <button
          onClick={() => setActiveTab("spatial")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === "spatial"
              ? "bg-slate-950 text-cyan-400 border border-slate-800 shadow-lg shadow-black/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/30"
          }`}
        >
          📍 Análisis Espacial
        </button>
        <button
          onClick={() => setActiveTab("temporal")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === "temporal"
              ? "bg-slate-950 text-cyan-400 border border-slate-800 shadow-lg shadow-black/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/30"
          }`}
        >
          ⏳ Análisis Temporal
        </button>
        <button
          onClick={() => setActiveTab("streetview")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === "streetview"
              ? "bg-slate-950 text-cyan-400 border border-slate-800 shadow-lg shadow-black/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/30"
          }`}
        >
          🏙️ Exploración Street View
        </button>
        <button
          onClick={() => setActiveTab("environment")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === "environment"
              ? "bg-slate-950 text-cyan-400 border border-slate-800 shadow-lg shadow-black/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/30"
          }`}
        >
          🛡️ Perfil del Entorno
        </button>
      </div>

      {/* Contenido Dinámico de Pestañas */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === "spatial" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AtractorsDensityChart pois={pois} />
            <ConcentrationScatter pois={pois} findings={findings} />
          </div>
        )}

        {activeTab === "temporal" && (
          <div className="grid grid-cols-1 gap-4">
            <TemporalEvolutionChart historicalCrimes={historicalCrimes} />
          </div>
        )}

        {activeTab === "streetview" && (
          <div className="grid grid-cols-1 gap-4">
            <TacticalDistribution findings={findings} />
          </div>
        )}

        {activeTab === "environment" && (
          <div className="grid grid-cols-1 gap-4">
            <EnvironmentProfileRadar pois={pois} findings={findings} />
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
