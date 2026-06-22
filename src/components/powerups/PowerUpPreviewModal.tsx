"use client";

import React from "react";
import { PowerUpConfig } from "./powerups.types";
import { PowerUpTooltip } from "./PowerUpTooltip";

interface PowerUpPreviewModalProps {
  config: PowerUpConfig;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PowerUpPreviewModal({ config, isOpen, onClose, onConfirm }: PowerUpPreviewModalProps) {
  if (!isOpen) return null;
  const theme = config.colorTheme;
  const preview = config.preview;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-fadeIn">
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl w-full max-w-lg p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
        {/* Top visual accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.accentBg}`} />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-inner ${theme.badge} shrink-0`}>
              {config.icon}
            </div>
            <div>
              <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Panel Pre-Ejecución (v2.0)
              </span>
              <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                Confirmación de Análisis Operativo
              </h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg font-bold"
          >
            ×
          </button>
        </div>

        {/* Pre-execution Analysis Panel */}
        <div className="space-y-3">
          {/* Action Summary */}
          <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-lg space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Resumen de la Acción IA:</span>
            <p className="text-[11px] text-slate-200 leading-relaxed font-semibold">
              {preview.summary}
            </p>
          </div>

          {/* Quick analysis telemetry cards */}
          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <div className="bg-slate-900/30 p-2.5 rounded border border-slate-900/60">
              <span className="text-slate-500 block font-medium">Tipo de Análisis:</span>
              <span className="text-slate-200 font-bold block truncate" title={preview.analysisType}>
                {preview.analysisType}
              </span>
            </div>
            <div className="bg-slate-900/30 p-2.5 rounded border border-slate-900/60 flex flex-col justify-between">
              <span className="text-slate-500 block font-medium">Impacto en el Expediente:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${
                  preview.estimatedImpact === "alto" ? "bg-red-500 animate-pulse" :
                  preview.estimatedImpact === "medio" ? "bg-purple-500" : "bg-emerald-500"
                }`} />
                <span className={`font-bold uppercase text-[9px] ${
                  preview.estimatedImpact === "alto" ? "text-red-400" :
                  preview.estimatedImpact === "medio" ? "text-purple-400" : "text-emerald-400"
                }`}>
                  Impacto {preview.estimatedImpact}
                </span>
              </div>
            </div>
          </div>

          {/* Target Data to Process */}
          <div className="bg-slate-900/30 border border-slate-900 p-3 rounded-lg space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Datos que serán Procesados:</span>
            <p className="text-[11.5px] text-indigo-300 font-medium leading-relaxed">
              👉 {preview.dataToProcess}
            </p>
          </div>

          {/* Embed the Multi-level Explanatory Tooltip directly so the user can query details right there! */}
          <div className="pt-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Centro de Explicabilidad Inteligente:</span>
            <PowerUpTooltip config={config} />
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex gap-2.5 pt-2 border-t border-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold py-2 px-3 rounded-lg text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 ${theme.accentBg} hover:opacity-90 text-slate-950 font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-1.5`}
          >
            ⚡ Confirmar y Procesar
          </button>
        </div>
      </div>
    </div>
  );
}
