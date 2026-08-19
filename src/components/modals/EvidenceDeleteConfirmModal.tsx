"use client";

import React, { useState } from "react";

interface EvidenceDeleteConfirmModalProps {
  isOpen: boolean;
  evidence: any | null;
  onClose: () => void;
  onConfirmDelete: (evidenceId: string) => Promise<void>;
}

export const EvidenceDeleteConfirmModal: React.FC<EvidenceDeleteConfirmModalProps> = ({
  isOpen,
  evidence,
  onClose,
  onConfirmDelete,
}) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !evidence) return null;

  const handleClose = () => {
    setStep(0);
    setIsDeleting(false);
    onClose();
  };

  const handleExecutePurge = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(evidence.id || evidence.hash_md5);
      handleClose();
    } catch (err) {
      console.error("[EvidenceDeleteConfirmModal] Error deleting evidence:", err);
      alert("❌ Ocurrió un error al purgar la evidencia.");
      setIsDeleting(false);
    }
  };

  const imgUrl = evidence.previewUrl || evidence.file_url || evidence.url || evidence.archivo_url;
  const lat = evidence.lat || evidence.latitude;
  const lng = evidence.lng || evidence.longitude;
  const title = evidence.tipo || evidence.categoria_exploracion || evidence.name || "Evidencia Georreferenciada";
  const commentary = evidence.comentario || evidence.description || evidence.contextText;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <h3 className="text-sm font-bold text-white tracking-wide font-sans">
              {step === 0 && "Detalle de Evidencia Táctica"}
              {step === 1 && "⚠️ Ventana Preventiva 1: Impacto en Expediente"}
              {step === 2 && "🚨 Ventana Preventiva 2: Confirmación Final"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* STEP 0: POPUP CON DETALLES E IMAGEN */}
        {step === 0 && (
          <div className="p-5 space-y-4 font-sans">
            {imgUrl && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                <img
                  src={imgUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono font-bold text-[10px]">
                  {title}
                </span>
                {lat && lng && (
                  <span className="font-mono text-slate-400 text-[10px]">
                    📍 {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  </span>
                )}
              </div>

              {commentary && (
                <p className="text-slate-300 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 italic leading-relaxed">
                  "{commentary}"
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-slate-400">
                <div>ID Evidencia: <span className="font-mono text-slate-200">{evidence.id?.substring(0, 12) || "N/A"}</span></div>
                <div>Origen: <span className="text-slate-200 font-bold">{evidence.tipo_origen || "CAPTURA_TERRITORIAL"}</span></div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cerrar
              </button>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center gap-1.5 transition"
              >
                <span>🗑️</span> Borrar del Expediente
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: VENTANA PREVENTIVA 1 (ADVERTENCIA DE IMPACTO) */}
        {step === 1 && (
          <div className="p-5 space-y-4 font-sans">
            <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-4 text-xs space-y-2 text-rose-200">
              <p className="font-extrabold text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⚠️</span> ADVERTENCIA DE RIESGO DE EXPEDIENTE
              </p>
              <p className="leading-relaxed">
                Si borra este PIN del mapa, la evidencia se eliminará <strong className="text-white underline">POR COMPLETO DEL EXPEDIENTE ACTIVO</strong>.
              </p>
              <p className="text-[11px] text-rose-300">
                Esta acción romperá automáticamente todas las interconexiones y relaciones generadas:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[10px] text-rose-300/90 font-mono">
                <li>Relaciones en la Matriz Táctica Criminológica</li>
                <li>Menciones y anexos en Reportes de Inteligencia (Word/PDF)</li>
                <li>Indicadores de Cobertura y Métricas de Amenaza</li>
                <li>Histórico de coordenadas y capas de análisis</li>
              </ul>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                ← Volver
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1"
              >
                Continuar a Confirmación Final →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: VENTANA PREVENTIVA 2 (CONFIRMACIÓN INMUTABLE FINAL) */}
        {step === 2 && (
          <div className="p-5 space-y-4 font-sans">
            <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-xs space-y-3 text-red-100">
              <p className="font-black text-red-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>🚨</span> PURGA DEFINITIVA E INMUTABLE
              </p>
              <p className="leading-relaxed">
                ¿Está completamente seguro de desvincular y purgar la evidencia <span className="font-mono text-white font-bold">{evidence.id}</span>?
              </p>
              <p className="text-[10px] text-red-300 font-mono">
                No será posible recuperar esta imagen ni sus datos contextuales una vez completada la purga.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep(1)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancelar y Conservar
              </button>
              <button
                onClick={handleExecutePurge}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-black shadow-xl shadow-red-950/80 flex items-center gap-2 transition"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Purgando del Expediente...</span>
                  </>
                ) : (
                  <>
                    <span>🔥</span> CONFIRMAR PURGA DEFINITIVA
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
