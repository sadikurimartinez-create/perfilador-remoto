"use client";

import React, { useState } from "react";

interface StreetViewDisclaimerModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onAccept: (acceptanceDetails: {
    acceptedTerms: boolean;
    acceptedAt: number;
    acceptedBy: string;
  }) => void;
  analystName?: string;
}

export function StreetViewDisclaimerModal({
  isOpen,
  onCancel,
  onAccept,
  analystName = "Analista CEIPOL",
}: StreetViewDisclaimerModalProps) {
  const [agreed, setAgreed] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!agreed) return;
    onAccept({
      acceptedTerms: true,
      acceptedAt: Date.now(),
      acceptedBy: analystName,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 relative overflow-hidden">
        {/* Amber glow accent decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 bg-amber-950/80 border border-amber-800/50 rounded-xl text-amber-400 text-xl shadow-inner">
            🛡️
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
              Deslinde Metodológico e Institucional
            </h3>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              Gobernanza de Evidencia ADR-011
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-amber-200/90 text-[11px] leading-relaxed">
            <strong>Declaración Criminológica de Gabinete:</strong> Esta evidencia será clasificada como trabajo de gabinete (<code className="text-amber-300 font-mono">DESKTOP_ANALYSIS</code>) y tendrá una valoración de confiabilidad asociada. <strong className="text-amber-100">No corresponde a una inspección física in situ en campo.</strong>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
            />
            <span className="text-[11px] text-slate-300">
              Reconozco los términos de acreditación institucional y la clasificación remota del dato.
            </span>
          </label>
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
            disabled={!agreed}
            onClick={handleConfirm}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition rounded-xl shadow-lg border active:scale-95 cursor-pointer ${
              agreed
                ? "bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-400/40 shadow-amber-950/50"
                : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
            }`}
          >
            Aceptar y Abrir Visor 360°
          </button>
        </div>
      </div>
    </div>
  );
}

export default StreetViewDisclaimerModal;
