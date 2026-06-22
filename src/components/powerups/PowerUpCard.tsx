"use client";

import React, { useState } from "react";
import { PowerUpConfig, PowerUpState } from "./powerups.types";

interface PowerUpCardProps {
  config: PowerUpConfig;
  state: PowerUpState;
  isReadOnly?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleTechnical: (e: React.MouseEvent) => void;
  showTechnical: boolean;
}

export function PowerUpCard({
  config,
  state,
  isReadOnly = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onToggleTechnical,
  showTechnical
}: PowerUpCardProps) {
  const theme = config.colorTheme;

  // Status badges & text
  const getStatusIndicator = () => {
    switch (state) {
      case "running":
        return (
          <div className="flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            Ejecutando
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            🟢 Listo
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            🔴 Error
          </div>
        );
      case "idle":
      default:
        return (
          <div className="flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700/80 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            🟡 Inactivo
          </div>
        );
    }
  };

  return (
    <div
      onClick={!isReadOnly && state !== "running" ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group relative p-3 rounded-xl border text-left transition-all duration-300 ${
        isReadOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${theme.bg} ${theme.border} ${theme.hoverBorder} ${
        state === "running" ? "border-sky-500 ring-2 ring-sky-500/20 bg-slate-900/60" : ""
      } shadow-md hover:shadow-xl hover:-translate-y-0.5 overflow-hidden`}
    >
      {/* Dynamic background scanning overlay for "running" state */}
      {state === "running" && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-500/10 to-transparent -translate-x-full animate-scan shrink-0 pointer-events-none" />
      )}

      <div className="flex items-start gap-3">
        {/* Color category icon badge */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-inner ${theme.badge} shrink-0 transition-transform duration-300 group-hover:scale-105`}>
          {config.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <h5 className="font-bold text-xs text-slate-100 group-hover:text-white truncate">
              {config.title}
            </h5>
            {getStatusIndicator()}
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed truncate group-hover:text-slate-200">
            {config.subtitle}
          </p>
        </div>
      </div>

      {/* Mini technical gear trigger */}
      <button
        type="button"
        onClick={onToggleTechnical}
        className="absolute top-2.5 right-2.5 p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
        title="Ver desglose de procesos IA"
      >
        <span className="text-[11px] font-mono select-none">⚙️</span>
      </button>

      {/* Inline Technical level panel */}
      {showTechnical && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[9.5px] font-mono text-slate-400 space-y-1 bg-slate-950/60 p-2 rounded animate-fadeIn">
          <div className="font-bold text-slate-300 font-sans text-[10px]">🛠️ Detalle de Llamada Técnica (v2.0):</div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[8.5px]">APIs de Consulta:</span>
            <div className="text-slate-300 truncate">{config.tooltip.collapsedTechnical.apis.join(", ")}</div>
          </div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[8.5px]">Modelos IA:</span>
            <div className="text-slate-300 truncate">{config.tooltip.collapsedTechnical.models.join(", ")}</div>
          </div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[8.5px]">Método:</span>
            <code className="text-indigo-400 font-bold">{config.tooltip.collapsedTechnical.functions[0]}</code>
          </div>
        </div>
      )}
    </div>
  );
}
