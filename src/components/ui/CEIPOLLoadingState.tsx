"use client";

import React from "react";

interface CEIPOLLoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: "full-screen" | "inline" | "card";
  className?: string;
}

export const CEIPOLLoadingState: React.FC<CEIPOLLoadingStateProps> = ({
  message = "Cargando datos...",
  subMessage = "CEIPOL FUSIÓN ANALÍTICA",
  variant = "inline",
  className = ""
}) => {
  // Animación dinámica de radar con múltiples capas concéntricas e iluminación HSL táctica
  const radarIcon = (
    <div className="relative w-20 h-20 flex items-center justify-center select-none">
      {/* Esferas de luz pulsantes concéntricas en HSL adaptativo */}
      <div className="absolute inset-0 border border-cyan-500/10 rounded-full animate-ping pointer-events-none" />
      <div className="absolute inset-2 border border-indigo-500/20 rounded-full animate-pulse pointer-events-none" />
      <div className="absolute inset-4 border-2 border-dashed border-cyan-500/30 rounded-full animate-spin [animation-duration:8s] pointer-events-none" />
      <div className="absolute inset-6 border border-indigo-500/40 rounded-full pointer-events-none" />
      
      {/* Ícono central táctico con latido operacional */}
      <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a6 6 0 00-6-6M2 9h4" />
      </svg>
    </div>
  );

  const content = (
    <div className={`flex flex-col items-center justify-center text-center space-y-5 select-none ${className}`}>
      {radarIcon}
      <div className="space-y-1.5 max-w-xs">
        <p className="text-xs font-black uppercase tracking-widest text-slate-100 font-sans leading-relaxed">
          {message}
        </p>
        {subMessage && (
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-black">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );

  // Variante: Bloqueo de Pantalla Completo (Con desenfoque e interacción bloqueada)
  if (variant === "full-screen") {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md animate-fadeIn">
        {content}
      </div>
    );
  }

  // Variante: Superposición de Tarjeta (Para cubrir paneles o pestañas específicas)
  if (variant === "card") {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-2xl animate-fadeIn">
        {content}
      </div>
    );
  }

  // Variante: Cargador en Línea Estándar
  return <div className="py-12 flex justify-center w-full">{content}</div>;
};
