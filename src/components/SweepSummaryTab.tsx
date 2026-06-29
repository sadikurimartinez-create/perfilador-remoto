"use client";

import React, { useState } from "react";
import { useProject, SweepIntegrationItem } from "@/context/ProjectContext";

export function SweepSummaryTab() {
  const { project, updateProjectDetails, updateSweep, setActiveSweepForModal, isReadOnly } = useProject();
  const [isSavingHypothesis, setIsSavingHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState(project?.hipotesis || "");

  // Sync hypothesis text with context if changed externally
  React.useEffect(() => {
    if (project) {
      setHypothesisText(project.hipotesis || "");
    }
  }, [project?.hipotesis]);

  const sweeps = project?.sweeps || [];
  const totalSweeps = sweeps.length;
  const completedSweeps = sweeps.filter(s => s.status === "Integrado" || s.status === "Rechazado").length;
  const pendingSweeps = sweeps.filter(s => s.status === "Pendiente").length;

  const completenessPercentage = totalSweeps > 0 
    ? Math.round((completedSweeps / totalSweeps) * 100) 
    : 100;

  const handleSaveHypothesis = async () => {
    if (!project || isReadOnly) return;
    setIsSavingHypothesis(true);
    try {
      await updateProjectDetails({ hipotesis: hypothesisText });
      alert("✅ Hipótesis consolidada guardada exitosamente.");
    } catch (err: any) {
      alert("❌ Error al guardar la hipótesis: " + err.message);
    } finally {
      setIsSavingHypothesis(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Integrado":
        return <span className="bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit">✔ Integrado</span>;
      case "Rechazado":
        return <span className="bg-red-950/80 border border-red-900/50 text-red-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit">❌ Descartado</span>;
      default:
        return <span className="bg-amber-950/80 border border-amber-900 text-amber-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit animate-pulse">⚠ Pendiente</span>;
    }
  };

  const getRelevanceBadge = (lvl: string) => {
    switch (lvl) {
      case "Alto":
        return <span className="bg-red-950/40 border border-red-900/40 text-red-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Alta</span>;
      case "Medio":
        return <span className="bg-amber-950/40 border border-amber-900/40 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Media</span>;
      default:
        return <span className="bg-sky-950/40 border border-sky-900/40 text-sky-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Baja</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress Gauge */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center justify-between min-h-[190px] relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Completitud del Análisis</h4>
          
          <div className="relative flex items-center justify-center h-24 w-24">
            {/* SVG Radial Gauge */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                className="stroke-slate-850 fill-none"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                className="stroke-sky-500 fill-none transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * completenessPercentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-black text-white">{completenessPercentage}%</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">Resuelto</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-medium mt-2">
            {totalSweeps === 0 
              ? "No se han ejecutado barridos de información." 
              : `${completedSweeps} de ${totalSweeps} barridos completados.`}
          </p>
        </div>

        {/* Pending Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[190px] relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] pointer-events-none" />
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Elementos Pendientes</h4>
            {pendingSweeps > 0 ? (
              <div className="space-y-1">
                <span className="text-3xl font-black text-amber-400 font-mono leading-none">{pendingSweeps}</span>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  Barridos de información requieren ser integrados o descartados.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-3xl font-black text-emerald-400 font-mono leading-none">0</span>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  Todos los barridos tácticos han sido integrados o descartados correctamente.
                </p>
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-800/80 pt-2.5">
            {pendingSweeps > 0 ? (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase tracking-wide">
                <span className="animate-ping w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                <span>Bloqueo Activo - Resuelva para salir</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Expediente Listo para Cerrar</span>
              </div>
            )}
          </div>
        </div>

        {/* Integration Rules Check */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[190px] relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Gobernanza Criminológica</h4>
            <div className="space-y-1.5 text-xs text-slate-300 font-medium">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <p className="leading-snug">Trazabilidad completa por timestamp</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <p className="leading-snug">Identificador único por bloque inyectado</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <p className="leading-snug">Registro obligatorio de justificación de descarte</p>
              </div>
            </div>
          </div>
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            Normativa Operativa CEIPOL v3.0
          </div>
        </div>
      </div>

      {/* Hypothesis Viewer & Editor */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <header className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
              Hipótesis Central Consolidada del Expediente
            </h3>
            <p className="text-[10px] text-slate-400">
              Vista integrada que almacena la narrativa del analista cruzada con los bloques técnicos de barridos.
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveHypothesis}
              disabled={isSavingHypothesis}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all shadow-md"
            >
              {isSavingHypothesis ? "Guardando..." : "💾 Guardar Hipótesis"}
            </button>
          )}
        </header>

        <textarea
          spellCheck={true}
          value={hypothesisText}
          onChange={e => setHypothesisText(e.target.value)}
          disabled={isReadOnly}
          rows={10}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed outline-none focus:border-sky-500/50 transition-all resize-y select-all shadow-inner"
          placeholder="Escriba o consolide la hipótesis del expediente..."
        />
      </div>

      {/* Sweeps List */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3">
          Historial de Barridos Realizados ({totalSweeps})
        </h3>

        {totalSweeps === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic">
            No se han registrado barridos en este expediente. Utilice las herramientas del álbum, mapas o el panel de pandillas para realizar barridos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-black uppercase tracking-wider border-b border-slate-800 text-[9px]">
                  <th className="p-3">Motor / Tipo</th>
                  <th className="p-3">Fuente</th>
                  <th className="p-3">Tipo de Int.</th>
                  <th className="p-3">Relevancia</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado / Detalle</th>
                  {!isReadOnly && <th className="p-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-200">
                {sweeps.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-3">
                      <div className="font-extrabold">{s.engine}</div>
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">ID: {s.id}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 px-2 py-0.5 rounded text-[10px]">{s.source}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-400">{s.type}</td>
                    <td className="p-3">{getRelevanceBadge(s.relevance)}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-400">
                      {new Date(s.timestamp).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="p-3 space-y-1">
                      {getStatusBadge(s.status)}
                      {s.status === "Rechazado" && s.justification && (
                        <div className="text-[10px] text-red-300 bg-red-950/30 border border-red-900/30 p-2 rounded-lg mt-1 max-w-xs whitespace-pre-wrap leading-relaxed">
                          <span className="font-black">Justificación:</span> {s.justification}
                        </div>
                      )}
                      {s.status === "Integrado" && s.context && (
                        <div className="text-[10px] text-slate-300 bg-slate-950 border border-slate-850 p-2 rounded-lg mt-1 max-w-xs whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-slate-400">Contexto:</span> {s.context}
                        </div>
                      )}
                    </td>
                    {!isReadOnly && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveSweepForModal(s)}
                          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-all border border-slate-750"
                        >
                          ✏️ Modificar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
