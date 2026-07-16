import React from "react";
import { GangProfile } from "../types";

interface IdentityPanelProps {
  profile: GangProfile;
}

export const IdentityPanel: React.FC<IdentityPanelProps> = ({ profile }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Narrative & History Card */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          📖 Historia y Modus Operandi
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Línea de Comportamiento</span>
            <p className="mt-1 text-slate-300 text-sm leading-relaxed">
              {profile.organizacion.descripcion || 
                "No hay una descripción narrativa cargada en este expediente. El modus operandi está bajo análisis a partir del flujo de detenciones y eventos territoriales registrados."}
            </p>
          </div>
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nivel de Organización</span>
            <div className="mt-2 flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-indigo-950/60 text-indigo-300 text-xs border border-indigo-500/20 font-bold uppercase">
                {profile.organizacion.nivel}
              </span>
              <p className="text-xs text-slate-400">
                Determinado por la cohesión jerárquica y el control territorial evaluado.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Identifiers & Symbols Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          🎨 Simbología y Señas
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Firmas de Grafitis</span>
            {profile.identidad.simbolos.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {profile.identidad.simbolos.map((sym, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-950/30 px-3 py-1.5 rounded-lg border border-slate-800/80">
                    <span className="text-cyan-500">★</span> {sym}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-slate-500 text-xs italic">
                Sin firmas o marcas registradas en este perfil.
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identidad Visual</span>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-2xl">🧥</span>
                <span className="block mt-1 text-[10px] text-slate-400 font-bold uppercase">Ropa usual</span>
                <span className="text-xs text-slate-300">Bajo Análisis</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-2xl">🐉</span>
                <span className="block mt-1 text-[10px] text-slate-400 font-bold uppercase">Tatuajes</span>
                <span className="text-xs text-slate-300">C-13, Coronas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
