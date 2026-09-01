import React from "react";
import { GangProfile, GangMemberCandidate } from "../types";

interface OrganizationPanelProps {
  profile: GangProfile;
  members: any[]; // Supports both legacy GangMember and GangMemberCandidate
  candidates: GangMemberCandidate[];
  onCertifyCandidate?: (candidateId: string) => void;
  onRejectCandidate?: (candidateId: string) => void;
}

export const OrganizationPanel: React.FC<OrganizationPanelProps> = ({
  profile,
  members = [],
  candidates = [],
  onCertifyCandidate,
  onRejectCandidate
}) => {
  const getRoleStyle = (rol: string) => {
    switch (rol?.toLowerCase()) {
      case "líder":
      case "segundo al mando":
        return "bg-rose-950/40 text-rose-400 border-rose-900/30";
      case "sicario":
      case "distribuidor":
        return "bg-amber-950/40 text-amber-400 border-amber-900/30";
      case "vigilante":
      case "halcón":
        return "bg-sky-950/40 text-sky-400 border-sky-900/30";
      default:
        return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  const getCandidateStatusStyle = (status: string) => {
    switch (status) {
      case "propuesto":
        return "bg-indigo-950/50 text-indigo-400 border-indigo-500/30";
      case "validando":
        return "bg-cyan-950/50 text-cyan-400 border-cyan-500/30";
      case "certificado":
        return "bg-emerald-950/50 text-emerald-400 border-emerald-500/40";
      case "descartado":
        return "bg-red-950/50 text-red-400 border-red-500/30";
      default:
        return "bg-slate-850 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Members Dossier */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>👥 Estructura y Dossier de Integrantes Certificados ({members.length})</span>
          <span className="text-xs text-slate-500">Mesa Técnica CEIPOL</span>
        </h3>

        {members.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No hay integrantes certificados registrados en este expediente.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3.5 p-3.5 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 rounded-xl transition-all hover:scale-[1.01]"
              >
                <img
                  src={m.fotografiaUrl || (m.sexo === "Femenino" ? "/avatars/avatar_fem.png" : "/avatars/avatar_male.png")}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-slate-800 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 justify-between">
                    <p className="text-sm font-bold text-slate-200 truncate">
                      "{m.alias || "Sin alias"}"
                    </p>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded ${getRoleStyle(m.estatusPandilla || m.rol || "Sin rol registrado")}`}>
                      {m.estatusPandilla || m.rol || "SIN ROL REGISTRADO"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {m.nombre || "Nombre sin registrar"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold truncate">
                    📍 {m.domicilioConocido || "Domicilio sin registrar"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationship Candidates */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>🧠 Candidatos a Integrante (Vínculos Analíticos Pendientes)</span>
          <span className="text-[10px] bg-sky-950/60 text-sky-400 border border-sky-850 px-2 py-0.5 rounded font-bold">
            Algoritmo de Interoperabilidad ILE
          </span>
        </h3>

        {candidates.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No hay candidatos o propuestas de vinculación pendientes para este expediente.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-800/60 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/30">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-slate-900/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg shadow-inner">
                    👤
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-200">
                        "{cand.personaAlias || "Sin alias"}"
                      </span>
                      <span className="text-xs text-slate-400 font-medium">({cand.personaNombre})</span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded ${getCandidateStatusStyle(cand.estado)}`}>
                        {cand.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-1">
                      <span>CURP/ID: <strong className="text-slate-400 font-mono">{cand.personaId}</strong></span>
                      <span>Propuesto como: <strong className="text-slate-400 font-semibold uppercase">{cand.rolPropuesto}</strong></span>
                      <span>Registrado: <strong className="text-slate-400 font-medium">{new Date(cand.fechaRegistro).toLocaleDateString()}</strong></span>
                    </div>
                  </div>
                </div>

                {cand.estado === "propuesto" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onRejectCandidate?.(cand.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-950/60 hover:border-red-900/80 bg-red-950/20 hover:bg-red-950/40 text-[10px] font-black text-red-400 uppercase tracking-wider transition-all"
                    >
                      ✕ Descartar
                    </button>
                    <button
                      onClick={() => onCertifyCandidate?.(cand.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black text-slate-950 uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10"
                    >
                      🛡️ Certificar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
