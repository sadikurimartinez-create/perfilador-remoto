"use client";

import React from "react";
import { CEIPOLButton } from "./CEIPOLButton";

interface CEIPOLErrorStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}

export const CEIPOLErrorState: React.FC<CEIPOLErrorStateProps> = ({
  icon = "⚠️",
  title,
  description,
  onRetry,
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center bg-red-950/10 border border-red-900/40 rounded-2xl select-none max-w-md mx-auto ${className}`}>
      <div className="w-12 h-12 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center justify-center text-xl mb-4 shadow-inner text-red-400">
        {typeof icon === "string" ? <span>{icon}</span> : icon}
      </div>
      
      <h4 className="text-xs font-bold uppercase tracking-wider text-red-200 mb-1.5 font-sans">
        {title}
      </h4>
      <p className="text-[11px] text-red-400/80 font-sans leading-relaxed mb-4">
        {description}
      </p>

      {onRetry && (
        <CEIPOLButton
          variant="danger"
          size="sm"
          onClick={onRetry}
          className="mt-1 shadow-md"
        >
          🔄 Reintentar Operación
        </CEIPOLButton>
      )}
    </div>
  );
};
