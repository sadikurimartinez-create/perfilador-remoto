import React from "react";
import { GangProfile } from "../types";

interface GangHeaderProps {
  profile: GangProfile;
  onEdit?: () => void;
}

export const GangHeader: React.FC<GangHeaderProps> = ({ profile, onEdit }) => {
  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    if (score >= 50) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  };

  const getStateBadge = (state: string) => {
    const statesMap: Record<string, { label: string; style: string }> = {
      descubierto: { label: "🔍 Descubierto", style: "bg-slate-800 text-slate-400 border-slate-700" },
      hipotesis: { label: "💡 Hipótesis", style: "bg-indigo-950/40 text-indigo-400 border-indigo-500/30" },
      validacion: { label: "⚖️ En Validación", style: "bg-cyan-950/40 text-cyan-400 border-cyan-500/30" },
      corroborado: { label: "🎯 Corroborado", style: "bg-teal-950/40 text-teal-400 border-teal-500/30" },
      certificado: { label: "🛡️ Certificado", style: "bg-emerald-950/50 text-emerald-400 border-emerald-500/40 animate-pulse" },
      vigente: { label: "🔥 Vigente Táctico", style: "bg-amber-950/40 text-amber-400 border-amber-500/30" },
      historico: { label: "📚 Histórico", style: "bg-zinc-800 text-zinc-500 border-zinc-700" }
    };
    
    const config = statesMap[state] || { label: state, style: "bg-slate-800 text-slate-400 border-slate-700" };
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${config.style}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
      {/* Dynamic background glow based on risk */}
      <div 
        className={`absolute -right-24 -top-24 h-48 w-48 rounded-full opacity-10 blur-3xl transition-all duration-1000 ${
          profile.indicadores.riesgo >= 80 ? "bg-rose-500" : profile.indicadores.riesgo >= 50 ? "bg-amber-500" : "bg-emerald-500"
        }`} 
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {/* Main Title and Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase">
              {profile.identidad.nombre}
            </h1>
            <div className="flex gap-2">
              {getStateBadge(profile.estadoInteligencia)}
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRiskColor(profile.indicadores.riesgo)}`}>
                Riesgo: {profile.indicadores.riesgo}%
              </span>
            </div>
          </div>

          {/* Alias list */}
          {profile.identidad.alias.length > 0 && (
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-500">A.K.A: </span>
              {profile.identidad.alias.map((a, i) => (
                <span key={i} className="inline-block px-2 py-0.5 mr-1.5 rounded bg-slate-800/60 text-slate-300 text-xs border border-slate-700/40">
                  {a}
                </span>
              ))}
            </p>
          )}

          {/* Symbols / Distinctive tags */}
          {profile.identidad.simbolos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Marcas:</span>
              {profile.identidad.simbolos.map((s, i) => (
                <span key={i} className="px-2.5 py-0.5 rounded-md bg-slate-950/40 text-cyan-400 text-xs border border-cyan-500/20">
                  👑 {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Buttons actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-800/40 text-slate-300 hover:text-white transition"
          >
            ✏️ Editar Perfil
          </button>
        </div>
      </div>
    </div>
  );
};
