import React from "react";
import { GangProfile, ILEMemory, Evidence } from "../types";

interface IntelligencePanelProps {
  profile: GangProfile;
  ileMemories: ILEMemory[];
  evidences: Evidence[];
  onAddEvidence?: (evidence: Omit<Evidence, "id" | "fecha">) => void;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({
  profile,
  ileMemories = [],
  evidences = [],
  onAddEvidence
}) => {
  const getEvidenceBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case "grafiti":
        return "bg-rose-950/40 text-rose-400 border-rose-900/30";
      case "tatuaje":
        return "bg-amber-950/40 text-amber-400 border-amber-900/30";
      case "red_social":
        return "bg-indigo-950/40 text-indigo-400 border-indigo-900/30";
      case "arma":
        return "bg-red-950/50 text-red-400 border-red-900/40";
      default:
        return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ILE Analytical Explanatory Memories (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🧠 Memoria Explicativa del Motor Inteligente (ILE)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registro del proceso de ponderación relacional bidireccional y emparejamiento con el ecosistema de Perfilador.
            </p>
          </div>

          {ileMemories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              No hay memorias explicativas calculadas en el ILE para este expediente.
            </div>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
              {ileMemories.map((mem) => (
                <div
                  key={mem.id}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-3 relative overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest font-mono">
                      Algoritmo: {mem.algoritmo}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded">
                      Confianza: {mem.confianza}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-normal font-semibold">
                    Evaluación de coincidencia de {mem.tipoRelacion} entre{" "}
                    <strong className="text-sky-300 font-extrabold uppercase">
                      {mem.entidadOrigen.substring(0, 15)}
                    </strong>{" "}
                    y{" "}
                    <strong className="text-sky-300 font-extrabold uppercase">
                      {mem.entidadDestino.substring(0, 15)}
                    </strong>
                  </p>

                  <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-900 text-[11px] leading-relaxed text-slate-400 font-medium">
                    <span className="text-[9px] font-extrabold text-slate-500 block uppercase mb-1">
                      Resultado Técnico
                    </span>
                    {mem.resultado}
                  </div>

                  {mem.variablesEvaluadas && mem.variablesEvaluadas.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-900 pt-2.5">
                      <span className="text-[9px] font-extrabold text-slate-500 block uppercase">
                        Variables de Ponderación Auditadas
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {mem.variablesEvaluadas.map((variable, i) => (
                          <div
                            key={i}
                            className="flex justify-between bg-slate-900/50 px-2 py-1 rounded"
                          >
                            <span className="text-slate-500 uppercase truncate">
                              {variable.name}
                            </span>
                            <span className="text-slate-350 font-bold">
                              W: {variable.weight}% | V: {String(variable.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 text-right mt-1 font-medium">
                    Calculado el {new Date(mem.fecha).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Vault (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-md space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🛡️ Bóveda de Evidencias e Integridad Documental
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registro inalterable con hashes SHA-256 para validación de origen físico de marcas y registros.
            </p>
          </div>

          {evidences.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              No hay registros de evidencias cargados para este expediente.
            </div>
          ) : (
            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {evidences.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded ${getEvidenceBadgeStyle(ev.tipo)}`}>
                      {ev.tipo}
                    </span>
                    <span className="text-[9px] font-extrabold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 uppercase">
                      {ev.confianza}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-bold truncate">
                    Fuente: <span className="font-semibold text-slate-350">{ev.fuente}</span>
                  </p>

                  <div className="bg-slate-950/80 p-2 rounded border border-slate-900">
                    <span className="text-[8px] text-slate-500 font-black block uppercase tracking-wider">
                      SHA-256 Checksum
                    </span>
                    <p className="text-[9px] font-mono text-cyan-400 break-all select-all font-semibold mt-0.5">
                      {ev.hash}
                    </p>
                  </div>

                  <div className="text-[8px] text-slate-500 text-right">
                    Reg: {new Date(ev.fecha).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
