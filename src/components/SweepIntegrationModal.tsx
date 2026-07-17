"use client";

import React, { useState, useEffect } from "react";
import { useProject, SweepIntegrationItem } from "@/context/ProjectContext";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";

export function SweepIntegrationModal() {
  const { activeSweepForModal, updateSweep, setActiveSweepForModal } = useProject();
  const [mode, setMode] = useState<"view" | "adjust" | "reject">("view");
  const [contextInput, setContextInput] = useState("");
  const [justificationInput, setJustificationInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coords, setCoords] = useState({ x: 200, y: 200 });
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

  // Sync inputs when active sweep changes
  useEffect(() => {
    if (activeSweepForModal) {
      setContextInput(activeSweepForModal.context || "");
      setJustificationInput(activeSweepForModal.justification || "");
      setMode("view");
      setErrorMsg("");
    }
  }, [activeSweepForModal]);

  // Track cursor position globally when modal is closed
  useEffect(() => {
    const updateCoords = (e: MouseEvent) => {
      if (!activeSweepForModal) {
        setCoords({ x: e.clientX, y: e.clientY });
      }
    };
    window.addEventListener("mousemove", updateCoords);
    return () => window.removeEventListener("mousemove", updateCoords);
  }, [activeSweepForModal]);

  // Calculate coordinates to keep the modal fully inside the viewport near the cursor
  useEffect(() => {
    if (activeSweepForModal) {
      const modalWidth = 480;
      const modalHeight = 460;
      
      const left = Math.max(15, Math.min(coords.x + 10, window.innerWidth - modalWidth - 15));
      const top = Math.max(15, Math.min(coords.y + 10, window.innerHeight - modalHeight - 15));

      setPositionStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${modalWidth}px`,
        maxHeight: "90vh",
        overflowY: "auto"
      });
    }
  }, [activeSweepForModal, coords]);

  if (!activeSweepForModal) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await updateSweep(activeSweepForModal.id, {
        status: "Integrado",
        context: contextInput.trim()
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Error al confirmar la integración.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjust = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await updateSweep(activeSweepForModal.id, {
        status: "Integrado",
        context: contextInput.trim()
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar el ajuste.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!justificationInput.trim()) {
      setErrorMsg("La justificación de descarte es obligatoria.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await updateSweep(activeSweepForModal.id, {
        status: "Rechazado",
        justification: justificationInput.trim()
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Error al rechazar la integración.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRelevanceColor = (lvl: string) => {
    switch (lvl) {
      case "Alto": return "text-red-400 bg-red-950/60 border-red-900/50";
      case "Medio": return "text-amber-400 bg-amber-950/60 border-amber-900/50";
      default: return "text-sky-400 bg-sky-950/60 border-sky-900/50";
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/20 backdrop-blur-[1px] pointer-events-auto">
      <div 
        role="dialog" 
        aria-modal="true" 
        style={positionStyle}
        className="bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl p-5 relative overflow-hidden flex flex-col gap-5 text-slate-100 animate-fadeIn"
      >
        {/* Decorative glowing gradient arches */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Header */}
        <div className="border-b border-slate-800 pb-3 flex justify-between items-center relative z-10">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Gobernanza Operativa SAI
            </h3>
            <h2 className="text-base font-extrabold text-white">
              VENTANA DE CONFIRMACIÓN DE HIPÓTESIS
            </h2>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-md">
            MANDATORIO
          </span>
        </div>

        {/* System Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-900/50 text-red-300 rounded-lg text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Mode: VIEW DETAILS */}
        {mode === "view" && (
          <div className="space-y-4 relative z-10">
            {/* Meta Table */}
            <div className="grid grid-cols-2 gap-3.5 bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Barrido ejecutado</span>
                <span className="font-extrabold text-slate-200">{activeSweepForModal.engine}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Fuente de datos</span>
                <span className="font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50 inline-block">{activeSweepForModal.source}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tipo de integración</span>
                <span className="font-bold text-slate-300">{activeSweepForModal.type}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Nivel de relevancia</span>
                <span className={`px-2 py-0.5 rounded border inline-block text-[10px] font-black uppercase ${getRelevanceColor(activeSweepForModal.relevance)}`}>
                  {activeSweepForModal.relevance}
                </span>
              </div>
              <div className="col-span-2 space-y-1 border-t border-slate-800/80 pt-2.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estado de integración</span>
                <div className="flex items-center gap-1.5 font-bold">
                  {activeSweepForModal.status === "Integrado" ? (
                    <span className="text-emerald-400 flex items-center gap-1">✔ Integrado a la Hipótesis</span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">⚠ Pendiente de integrar</span>
                  )}
                </div>
              </div>
            </div>

            {/* Injected Content Summary */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Datos Obtenidos del Barrido</span>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-40 overflow-y-auto text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                {activeSweepForModal.data}
              </div>
            </div>

            {/* Actions Panel */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <CEIPOLButton
                variant="secondary"
                onClick={() => setMode("adjust")}
                className="flex-1"
              >
                ✏️ Ajustar contexto
              </CEIPOLButton>
              <CEIPOLButton
                variant="danger"
                onClick={() => setMode("reject")}
              >
                ❌ Rechazar
              </CEIPOLButton>
              <CEIPOLButton
                variant="confirm"
                onClick={handleConfirm}
                loading={isSubmitting}
                className="flex-1"
              >
                {activeSweepForModal.type === "Directa" ? "✔ Confirmar integración" : "✔ Integrar a la Hipótesis"}
              </CEIPOLButton>
            </div>
          </div>
        )}

        {/* Mode: ADJUST CONTEXT */}
        {mode === "adjust" && (
          <div className="space-y-4 relative z-10">
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Ajustar Contexto y Enriquecer Información
              </label>
              <textarea
                spellCheck={true}
                value={contextInput}
                onChange={e => setContextInput(e.target.value)}
                rows={5}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 hover:border-slate-700 transition-all duration-200 font-sans"
                placeholder="Escriba aquí los comentarios, detalles adicionales o el contexto operacional del analista..."
              />
              <p className="text-[10px] text-slate-500 italic">
                El texto ajustado se unificará y se inyectará incrementalmente dentro del bloque del barrido en la hipótesis.
              </p>
            </div>

            {/* Actions Panel */}
            <div className="flex gap-2.5 pt-2">
              <CEIPOLButton
                variant="secondary"
                onClick={() => setMode("view")}
                className="flex-1"
              >
                Volver
              </CEIPOLButton>
              <CEIPOLButton
                variant="confirm"
                onClick={handleAdjust}
                loading={isSubmitting}
                className="flex-[2]"
              >
                ✔ Confirmar Ajuste e Integrar
              </CEIPOLButton>
            </div>
          </div>
        )}

        {/* Mode: REJECT / DISCARD */}
        {mode === "reject" && (
          <div className="space-y-4 relative z-10">
            <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-xl text-xs text-red-300 space-y-1.5">
              <h4 className="font-extrabold uppercase tracking-wide">⚠️ REGLA CRÍTICA DE GOBERNANZA</h4>
              <p className="leading-relaxed">
                Para descartar o rechazar un barrido en la hipótesis activa, es obligatorio ingresar una justificación técnica o de inconsistencia investigativa. Esto quedará registrado de forma inmutable en el historial del expediente.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-red-400 font-bold uppercase tracking-wider">
                Justificación del Descarte (Obligatorio) *
              </label>
              <textarea
                spellCheck={true}
                value={justificationInput}
                onChange={e => setJustificationInput(e.target.value)}
                rows={4}
                className="w-full bg-slate-950/60 border border-red-900/40 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 hover:border-red-800/40 transition-all duration-200 font-sans"
                placeholder="Ejemplo: Inconsistencia con datos GPS de campo, los datos de las placas vehiculares corresponden a otro sector..."
              />
            </div>

            {/* Actions Panel */}
            <div className="flex gap-2.5 pt-2">
              <CEIPOLButton
                variant="secondary"
                onClick={() => setMode("view")}
                className="flex-1"
              >
                Volver
              </CEIPOLButton>
              <CEIPOLButton
                variant="danger"
                onClick={handleReject}
                loading={isSubmitting}
                disabled={!justificationInput.trim()}
                className="flex-[2]"
              >
                ❌ Descartar y Registrar Justificación
              </CEIPOLButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
