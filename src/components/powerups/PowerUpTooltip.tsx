"use client";

import React, { useState } from "react";
import { PowerUpConfig } from "./powerups.types";

interface PowerUpTooltipProps {
  config: PowerUpConfig;
}

export function PowerUpTooltip({ config }: PowerUpTooltipProps) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const theme = config.colorTheme;

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-2.5 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Decorative ambient indicator */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${theme.accentBg}`} />

      {/* Title & Level selector */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5 pl-1.5">
        <span className="font-bold text-slate-100 flex items-center gap-1">
          <span>⚙️</span> Explicación de {config.title}
        </span>
        <div className="flex gap-1 bg-slate-900 p-0.5 rounded border border-slate-800/80">
          {( [1, 2, 3] as const ).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevel(lvl)}
              className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase transition-all ${
                level === lvl
                  ? `${theme.accentBg} text-slate-950 shadow-md`
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              Niv {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="pl-1.5 space-y-2 animate-fadeIn min-h-[75px] flex flex-col justify-between">
        {level === 1 && (
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Nivel 1 — Explicación Humana (Simplificado)</span>
            <p className="text-slate-200 leading-normal font-medium italic">
              "{config.tooltip.visibleHuman}"
            </p>
          </div>
        )}

        {level === 2 && (
          <div className="space-y-1.5">
            <span className={`text-[9px] font-bold ${theme.accentText} uppercase tracking-wider block`}>Nivel 2 — Operativa IA & Orígenes de Datos</span>
            <p className="text-slate-300 leading-relaxed">
              {config.tooltip.expandableOperative.process}
            </p>
            <div>
              <span className="text-slate-400 font-bold text-[9px] block mb-0.5">📂 Fuentes Consultadas:</span>
              <ul className="list-disc pl-3.5 space-y-0.5 text-slate-400 text-[10px]">
                {config.tooltip.expandableOperative.sources.map((src, i) => (
                  <li key={i}>{src}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {level === 3 && (
          <div className="space-y-1.5 bg-slate-900/60 p-2 rounded border border-slate-900 font-mono text-[10px]">
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider block font-sans">Nivel 3 — Detalle Arquitectónico Técnico</span>
            <div className="space-y-1">
              <div>
                <span className="text-slate-500 font-bold text-[9px] uppercase">APIs:</span>
                <div className="text-slate-300 overflow-x-auto truncate whitespace-nowrap bg-black/30 p-1 rounded border border-slate-800/50 mt-0.5">
                  {config.tooltip.collapsedTechnical.apis.join(", ")}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-bold text-[9px] uppercase">Modelos:</span>
                <div className="text-slate-300 overflow-x-auto truncate whitespace-nowrap bg-black/30 p-1 rounded border border-slate-800/50 mt-0.5">
                  {config.tooltip.collapsedTechnical.models.join(", ")}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-bold text-[9px] uppercase">Funciones Core:</span>
                <div className="text-slate-400 text-[9.5px] mt-0.5 pl-1.5 space-y-0.5">
                  {config.tooltip.collapsedTechnical.functions.map((fn, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-slate-600">└─</span> <code>{fn}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
