"use client";

import React from "react";

interface CEIPOLCardProps {
  children: React.ReactNode;
  variant?: "default" | "glass" | "alert" | "analysis";
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const CEIPOLCard: React.FC<CEIPOLCardProps> = ({
  children,
  variant = "default",
  className = "",
  onClick
}) => {
  // Base classes for tactical design
  const baseClasses = "relative rounded-2xl p-5 border shadow-2xl overflow-hidden transition-all duration-300";

  // Variant themes
  const variantClasses = {
    default: "bg-slate-950 border-slate-850",
    glass: "bg-slate-950/70 border-slate-800/80 backdrop-blur-md",
    alert: "bg-red-950/20 border-red-900/40 shadow-red-950/5",
    analysis: "bg-gradient-to-br from-slate-950 to-slate-900 border-indigo-950/60"
  };

  const cursorClass = onClick ? "cursor-pointer hover:border-slate-700 hover:scale-[1.005]" : "";

  return (
    <div
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${cursorClass} ${className}`}
    >
      {/* Absolute ambient light effect for premium aesthetics */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10">{children}</div>
    </div>
  );
};
