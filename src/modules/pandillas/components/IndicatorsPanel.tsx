import React from "react";
import { GangProfile } from "../types";

interface IndicatorsPanelProps {
  profile: GangProfile;
}

export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({ profile }) => {
  const { riesgo = 50, cohesion = 50, expansion = 50 } = profile.indicadores || {};

  const getIndicatorCard = (
    label: string,
    value: number,
    color: string,
    glowColor: string,
    description: string,
    subItems: string[]
  ) => {
    // SVG radial variables
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between h-full">
        {/* Soft background radial glow */}
        <div className={`absolute -right-12 -bottom-12 w-24 h-24 rounded-full ${glowColor} opacity-5 blur-2xl`} />

        <div className="space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Metodología CEIPOL</span>
              <h4 className="text-lg font-black text-white mt-1 uppercase tracking-tight">{label}</h4>
            </div>

            {/* Radial gauge */}
            <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  className="stroke-slate-800"
                  strokeWidth="6"
                  fill="transparent"
                />
                {/* Colored circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  className={`${color} transition-all duration-1000 ease-out`}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-black text-slate-200 tracking-tighter">{value}%</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            {description}
          </p>
        </div>

        {/* Detailed qualitative audits list */}
        <div className="mt-5 border-t border-slate-800/60 pt-4 space-y-2">
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Variables de Influencia</span>
          <div className="grid grid-cols-1 gap-1.5 text-[10px] font-semibold text-slate-350">
            {subItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 1. Risk Meter */}
      {getIndicatorCard(
        "Nivel de Criminogénesis / Riesgo",
        riesgo,
        riesgo >= 80 ? "stroke-red-500" : riesgo >= 50 ? "stroke-amber-500" : "stroke-emerald-500",
        riesgo >= 80 ? "bg-red-500" : riesgo >= 50 ? "bg-amber-500" : "bg-emerald-500",
        "Puntuación predictiva de la peligrosidad general, cruzando reincidencia de integrantes, asaltos con violencia, detenciones y uso de armamento documentado.",
        [
          `Peligrosidad global: ${riesgo >= 80 ? "Crítica" : riesgo >= 50 ? "Alta" : "Mediana"}`,
          "Presencia de detenidos reincidentes",
          "Severidad de ilícitos violentos"
        ]
      )}

      {/* 2. Cohesion Meter */}
      {getIndicatorCard(
        "Cohesión y Estructura Organizativa",
        cohesion,
        "stroke-indigo-500",
        "bg-indigo-500",
        "Evaluación del nivel de disciplina interna de la pandilla, constancia de liderazgo, delimitación jerárquica clara de mandos, sicarios, vigilantes y distribuidores.",
        [
          "Estructura jerárquica definida",
          "Comunicación interna fluida",
          "Consistencia en liderazgos"
        ]
      )}

      {/* 3. Expansion Meter */}
      {getIndicatorCard(
        "Nivel de Expansión Territorial",
        expansion,
        "stroke-cyan-500",
        "bg-cyan-500",
        "Tasa de colonias colonizadas, expansión de firmas grafitadas de la clica, fricción con bandas rivales colindantes y volumen de puntos de venta localizados.",
        [
          "Delineación de áreas colindantes",
          "Densidad espacial de firmas (DBSCAN)",
          "Volumen de marcas fronterizas"
        ]
      )}
    </div>
  );
};
