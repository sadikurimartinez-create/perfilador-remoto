"use client";

import React from "react";

interface CEIPOLSectionHeaderProps {
  icon?: string | React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  actions?: React.ReactNode;
}

export const CEIPOLSectionHeader: React.FC<CEIPOLSectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  className = "",
  actions
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-900 select-none ${className}`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-sm shadow-md shrink-0">
            {typeof icon === "string" ? <span>{icon}</span> : icon}
          </div>
        )}
        <div className="space-y-0.5">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-sans flex items-center gap-1.5">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex items-center gap-2 shrink-0 md:self-end">
          {actions}
        </div>
      )}
    </div>
  );
};
