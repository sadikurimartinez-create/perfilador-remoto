"use client";

import React from "react";

interface CEIPOLEmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export const CEIPOLEmptyState: React.FC<CEIPOLEmptyStateProps> = ({
  icon = "🔍",
  title,
  description,
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center bg-slate-950/20 border border-slate-900/60 rounded-2xl select-none max-w-md mx-auto ${className}`}>
      <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-xl mb-4 shadow-inner">
        {typeof icon === "string" ? <span>{icon}</span> : icon}
      </div>
      
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5 font-sans">
        {title}
      </h4>
      <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
        {description}
      </p>
    </div>
  );
};
