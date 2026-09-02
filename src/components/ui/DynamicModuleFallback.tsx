"use client";

import React from "react";

interface Props {
  moduleName: string;
  loading?: boolean;
}

/**
 * Componente de Degradación Controlada (Resilient Fallback)
 * Evita la propagación de ChunkLoadError hacia el árbol de React
 * manteniendo la funcionalidad del resto del expediente.
 */
export const DynamicModuleFallback: React.FC<Props> = ({ moduleName, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 w-full flex items-center justify-center space-x-3 my-4 animate-pulse">
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-400">
          Cargando módulo analítico {moduleName}...
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-5 w-full my-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {moduleName} — Módulo Analítico Temporalmente Desconectado
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              El servicio no pudo descargar los fragmentos interactivos. El resto del expediente permanece 100% operativo.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 border border-slate-800 px-2 py-1 rounded">
          DEGRADACIÓN CONTROLADA
        </span>
      </div>
    </div>
  );
};
