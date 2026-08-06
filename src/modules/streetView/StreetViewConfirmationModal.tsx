"use client";

import React from "react";

interface StreetViewConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  lat: number;
  lng: number;
}

export function StreetViewConfirmationModal({
  isOpen,
  onCancel,
  onConfirm,
  lat,
  lng,
}: StreetViewConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 relative overflow-hidden">
        {/* Glow accent decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-800/50 rounded-xl text-cyan-400 text-xl shadow-inner">
            🌐
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
              Análisis Remoto Táctico
            </h3>
            <p className="text-[10px] text-cyan-400 font-mono tracking-tight">
              GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p className="font-medium text-slate-200">
            ¿Desea generar evidencia visual mediante análisis remoto Street View para este punto?
          </p>
          <p className="text-[11px] text-slate-400 italic bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
            El sistema inicializará el entorno panorámico 360° para la selección del punto de observación visual (POV).
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition rounded-lg hover:bg-slate-800/50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-black text-white bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition rounded-xl shadow-lg shadow-cyan-950/50 border border-cyan-400/30 uppercase tracking-wider cursor-pointer"
          >
            Continuar y Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default StreetViewConfirmationModal;
