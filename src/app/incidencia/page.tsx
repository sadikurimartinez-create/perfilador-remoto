"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { CrimeIncidenceProductionWorkspace } from "@/components/crime-incidence/CrimeIncidenceProductionWorkspace";
import { CEIPOLEmptyState } from "@/components/ui/CEIPOLEmptyState";

export default function CrimeIncidencePage() {
  const { user } = useAuth();
  const { project } = useProject();

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ← Volver al Lobby
          </Link>

          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-100">
            Incidencia Delictiva
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Módulo independiente de análisis territorial de incidencia delictiva.
          </p>
        </div>
      </div>

      {project ? (
        <CrimeIncidenceProductionWorkspace
          project={project}
          requestedBy={user?.username}
          user={user}
        />
      ) : (
        <CEIPOLEmptyState
          icon="🚔"
          title="Sin expediente territorial de referencia"
          description="Seleccione un expediente territorial para utilizar su geografía como referencia analítica. Las fotografías del expediente no forman parte del mapa de Incidencia Delictiva."
        />
      )}
    </div>
  );
}
