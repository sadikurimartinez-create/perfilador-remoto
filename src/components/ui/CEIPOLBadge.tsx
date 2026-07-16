"use client";

import React from "react";

interface CEIPOLBadgeProps {
  status: "validated" | "pending" | "warning" | "error" | "processing";
  children: React.ReactNode;
  className?: string;
}

export const CEIPOLBadge: React.FC<CEIPOLBadgeProps> = ({
  status,
  children,
  className = ""
}) => {
  // Base classes for badges
  const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border select-none font-mono";

  // State-specific theme configurations
  const statusConfig = {
    validated: {
      classes: "text-emerald-400 bg-emerald-950/40 border-emerald-800/60",
      icon: "🟢"
    },
    pending: {
      classes: "text-slate-400 bg-slate-900 border-slate-800",
      icon: "⚪"
    },
    warning: {
      classes: "text-amber-400 bg-amber-950/40 border-amber-800/60",
      icon: "🟡"
    },
    error: {
      classes: "text-red-400 bg-red-950/40 border-red-800/60",
      icon: "🔴"
    },
    processing: {
      classes: "text-cyan-400 bg-cyan-950/40 border-cyan-800/60 animate-pulse",
      icon: "🛰️"
    }
  };

  const current = statusConfig[status];

  return (
    <span className={`${baseClasses} ${current.classes} ${className}`}>
      <span className="text-[9px] leading-none">{current.icon}</span>
      <span>{children}</span>
    </span>
  );
};
