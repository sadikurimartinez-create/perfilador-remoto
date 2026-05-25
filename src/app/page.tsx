"use client";

import Link from "next/link";
import { ProjectList } from "@/components/ProjectList";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Evaluamos si el perfil está incompleto (faltan datos base)
  const isProfileIncomplete = user && (
    !(user as any).nombre || 
    !(user as any).apellidoPaterno || 
    !(user as any).apellidoMaterno || 
    !(user as any).grado || 
    !(user as any).id_empleado
  );

  useEffect(() => {
    if (isProfileIncomplete) {
      router.push("/perfil");
    }
  }, [isProfileIncomplete, router]);

  if (isProfileIncomplete) return null; // Evita el parpadeo del dashboard antes de redirigir

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">
          Mis Expedientes
        </h1>
        <Link
          href="/conexiones"
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700 transition-colors"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Centro de Conexiones
        </Link>
      </div>
      <ProjectList />
    </div>
  );
}
