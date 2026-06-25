"use client";

import React from "react";
import GeoIntCommandDashboard from "@/components/command/GeoIntCommandDashboard";
import Link from "next/link";

export default function CommandPage() {
  return (
    <div className="w-full space-y-4">
      <header className="flex items-center justify-between py-2">
        <p className="text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300 flex items-center gap-1.5 transition-colors">
            ← Volver al Lobby de Expedientes
          </Link>
        </p>
      </header>

      <GeoIntCommandDashboard />
    </div>
  );
}
