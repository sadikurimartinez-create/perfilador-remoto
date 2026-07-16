"use client";

import React from "react";

interface CEIPOLButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "confirm" | "warning" | "danger" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const CEIPOLButton: React.FC<CEIPOLButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  type = "button",
  ...props
}) => {
  // Base classes
  let baseClasses = "relative font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50 select-none font-sans";

  // Size variations
  const sizeClasses = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-4 py-2 text-xs",
    lg: "px-6 py-3 text-sm"
  };

  // Variant classes (Dark tactical themed)
  const variantClasses = {
    primary: "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg border border-cyan-500/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30",
    confirm: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg border border-emerald-500/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30",
    warning: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg border border-amber-500/20 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/30",
    danger: "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg border border-red-500/20 focus:border-red-400 focus:ring-1 focus:ring-red-500/30",
    secondary: "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white hover:border-slate-700",
    ghost: "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
  };

  const isButtonDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span className="flex items-center gap-1.5">{children}</span>
    </button>
  );
};
