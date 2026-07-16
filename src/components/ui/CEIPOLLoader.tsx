"use client";

import React from "react";

interface CEIPOLLoaderProps {
  message?: string;
  className?: string;
}

export const CEIPOLLoader: React.FC<CEIPOLLoaderProps> = ({
  message = "Cargando análisis táctico...",
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-10 px-4 text-center space-y-4 select-none ${className}`}>
      {/* Animated premium radar scanning visualization */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-ping" />
        <div className="absolute inset-2 border border-indigo-500/30 rounded-full animate-pulse" />
        <div className="absolute inset-4 border-2 border-dashed border-cyan-500/40 rounded-full animate-spin" />
        <svg className="w-5 h-5 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a6 6 0 00-6-6M2 9h4" />
        </svg>
      </div>
      
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">{message}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">CEIPOL FUSIÓN ANALÍTICA</p>
      </div>
    </div>
  );
};
