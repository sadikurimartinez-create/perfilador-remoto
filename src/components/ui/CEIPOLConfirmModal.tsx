"use client";

import React from "react";
import { CEIPOLCard } from "./CEIPOLCard";
import { CEIPOLButton } from "./CEIPOLButton";

interface CEIPOLConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export const CEIPOLConfirmModal: React.FC<CEIPOLConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmación de Seguridad",
  message,
  confirmText = "Confirmar y Proceder",
  cancelText = "Cancelar",
  variant = "warning",
  isLoading = false
}) => {
  if (!isOpen) return null;

  // Variantes estéticas tácticas del sistema de diseño CEIPOL
  const variantStyles = {
    danger: {
      border: "border-red-900/50 shadow-red-950/10",
      button: "danger" as const,
      badge: "bg-red-950 text-red-400 border-red-900/30",
      icon: "⚠️"
    },
    warning: {
      border: "border-amber-800/60 shadow-amber-950/10",
      button: "warning" as const,
      badge: "bg-amber-950 text-amber-400 border-amber-900/30",
      icon: "⚡"
    },
    info: {
      border: "border-sky-800/60 shadow-sky-950/10",
      button: "primary" as const,
      badge: "bg-slate-900 text-cyan-400 border-slate-800/80",
      icon: "🛰️"
    }
  };

  const activeTheme = variantStyles[variant];

  // Determinar la clase de borde izquierdo condicional según variante para no depender de interpolación dinámica
  const borderLeftClass = variant === "danger" 
    ? "border-l-4 border-l-red-500" 
    : variant === "warning" 
    ? "border-l-4 border-l-amber-500" 
    : "border-l-4 border-l-cyan-500";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <CEIPOLCard
        variant="glass"
        className={`w-full max-w-md p-6 rounded-2xl ${borderLeftClass} ${activeTheme.border} relative overflow-hidden`}
      >
        <div className="space-y-4 font-sans">
          {/* Cabecera del Diálogo */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${activeTheme.badge} flex items-center gap-1`}>
              {activeTheme.icon} {title}
            </span>
          </div>

          {/* Mensaje Descriptivo */}
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {message}
          </p>

          {/* Botones de Control de la Acción */}
          <div className="flex gap-3 pt-3 border-t border-slate-900/50">
            <CEIPOLButton
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 font-bold py-2.5 text-xs uppercase"
            >
              {cancelText}
            </CEIPOLButton>
            <CEIPOLButton
              variant={activeTheme.button}
              onClick={onConfirm}
              loading={isLoading}
              className="flex-1 font-bold py-2.5 text-xs uppercase"
            >
              {confirmText}
            </CEIPOLButton>
          </div>
        </div>
      </CEIPOLCard>
    </div>
  );
};
export default CEIPOLConfirmModal;
