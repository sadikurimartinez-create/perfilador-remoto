"use client";

import React, { useEffect } from "react";

interface CEIPOLToastProps {
  type: "success" | "warning" | "error" | "info";
  message: string;
  duration?: number; // ms
  onClose: () => void;
  className?: string;
}

export const CEIPOLToast: React.FC<CEIPOLToastProps> = ({
  type,
  message,
  duration = 5000,
  onClose,
  className = ""
}) => {
  // Auto close timer
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Icons and borders
  const toastThemes = {
    success: {
      classes: "bg-emerald-950/90 border-emerald-500/30 text-emerald-100",
      icon: "✓",
      iconBg: "bg-emerald-600"
    },
    warning: {
      classes: "bg-amber-950/90 border-amber-500/30 text-amber-100",
      icon: "⚠",
      iconBg: "bg-amber-600"
    },
    error: {
      classes: "bg-red-950/90 border-red-500/30 text-red-100",
      icon: "❌",
      iconBg: "bg-red-600"
    },
    info: {
      classes: "bg-slate-900/90 border-cyan-500/30 text-cyan-100",
      icon: "🛰️",
      iconBg: "bg-cyan-600"
    }
  };

  const theme = toastThemes[type];

  return (
    <div
      className={`fixed bottom-6 right-6 max-w-sm w-full border backdrop-blur-md rounded-xl p-4 shadow-2xl flex items-start gap-3 z-50 animate-slide-in-right ${theme.classes} ${className}`}
    >
      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black text-white shrink-0 ${theme.iconBg}`}>
        {theme.icon}
      </span>
      <div className="flex-1 text-xs font-semibold leading-relaxed font-sans pr-2">
        {message}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-white transition-colors text-[10px] uppercase font-bold tracking-wider leading-none"
      >
        Cerrar
      </button>
    </div>
  );
};
