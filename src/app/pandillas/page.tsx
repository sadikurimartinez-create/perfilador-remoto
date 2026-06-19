"use client";

import { PandillasUI } from "@/modules/pandillas/pandillas.ui";
import Link from "next/link";

export default function PandillasPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300 flex items-center gap-1.5 transition-colors">
            ← Volver al Lobby de Expedientes
          </Link>
        </p>
      </header>

      <PandillasUI />
    </div>
  );
}
