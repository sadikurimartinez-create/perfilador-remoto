"use client";

import * as React from "react";
import GeographicWorkspace from "@/components/GeographicWorkspace";
import { useProject } from "@/context/ProjectContext";
import type { HistoricalGeographyCandidate } from "@/utils/historicalGeographyReconciliation";

const SOURCE_PROJECT_ID = "XLeeM0Xz5bemDlwgn8eP";
const SOURCE_PROJECT_NAME = "Hacienda San Marcos Lineal";
const SOURCE_GEOMETRY_TYPE = "LINEAL";
const RECOVERY_PROJECT_NAME = "Hacienda San Marcos — Recuperación Histórica";
const RECOVERY_REASON = "Recuperación institucional controlada de expediente histórico purgado; reconstrucción de geografía únicamente mediante evidencia GPS histórica y validación humana.";

const HACIENDA_SAN_MARCOS_GPS_POINTS = [
  { lat: 21.8053055556, lng: -102.2704138889, spatialGroupId: "hacienda-node-01" },
  { lat: 21.8055277778, lng: -102.2707416667, spatialGroupId: "hacienda-node-02" },
  { lat: 21.8055277778, lng: -102.2707416667, spatialGroupId: "hacienda-node-02" },
  { lat: 21.8051805556, lng: -102.27055, spatialGroupId: "hacienda-node-03" },
  { lat: 21.8051805556, lng: -102.27055, spatialGroupId: "hacienda-node-03" },
  { lat: 21.8054694444, lng: -102.2701916667, spatialGroupId: "hacienda-node-04" },
  { lat: 21.8070805556, lng: -102.270475, spatialGroupId: "hacienda-node-05" },
] as const;

const CANDIDATE_LIMITATIONS = [
  "HISTORICAL_PROJECT_PURGED",
  `SOURCE_PROJECT_ID:${SOURCE_PROJECT_ID}`,
  "HUMAN_ORDER_REQUIRED",
  "PHOTO_GPS_IS_CANDIDATE_NOT_VERTEX",
] as const;

const FORENSIC_BASIS = "Secuencia temporal de objeto Storage + coincidencia GPS EXIF exacta";

function buildHaciendaSanMarcosHistoricalCandidates(
  projectId: string
): Array<HistoricalGeographyCandidate & {
  forensicSequence: number;
  forensicBasis: string;
  spatialGroupId: string;
}> {
  return HACIENDA_SAN_MARCOS_GPS_POINTS.map((point, index) => ({
    candidateId: `hacienda-gps-${String(index + 1).padStart(2, "0")}`,
    projectId,
    lat: point.lat,
    lng: point.lng,
    sourceType: "IN_SITU_PHOTO_GPS",
    sourceObjectPath: null,
    sourcePhotoId: null,
    sourceEvidenceId: null,
    capturedAt: null,
    status: "DISCOVERED",
    confidence: "HIGH",
    limitations: [...CANDIDATE_LIMITATIONS],
    forensicSequence: index + 1,
    forensicBasis: FORENSIC_BASIS,
    spatialGroupId: point.spatialGroupId,
    sourceRefs: [
      {
        sourceType: "IN_SITU_PHOTO_GPS",
        sourceObjectPath: null,
        sourcePhotoId: null,
        sourceEvidenceId: null,
        capturedAt: null,
      },
    ],
  }));
}

export default function HaciendaSanMarcosHistoricalRecoveryPage() {
  const { project, createHistoricalRecoveryProject, findHistoricalRecoveryProjectsBySource, loadProject } = useProject();
  const [createdProjectId, setCreatedProjectId] = React.useState<string | null>(null);
  const [resumedProjectId, setResumedProjectId] = React.useState<string | null>(null);
  const [resumeNumeroExpediente, setResumeNumeroExpediente] = React.useState<string | null>(null);
  const [recoveryCount, setRecoveryCount] = React.useState(0);
  const [isLookingUpRecovery, setIsLookingUpRecovery] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationArmed, setCreationArmed] = React.useState(false);
  const [error, setError] = React.useState("");
  const createInFlightRef = React.useRef(false);
  const activeRecoveryProjectId = resumedProjectId || createdProjectId;
  const hasExistingRecovery = Boolean(resumedProjectId);

  const candidates = React.useMemo(
    () => activeRecoveryProjectId ? buildHaciendaSanMarcosHistoricalCandidates(activeRecoveryProjectId) : [],
    [activeRecoveryProjectId]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function resumeExistingRecovery() {
      setIsLookingUpRecovery(true);
      setError("");
      try {
        const recoveries = await findHistoricalRecoveryProjectsBySource(SOURCE_PROJECT_ID);
        if (cancelled) return;
        setRecoveryCount(recoveries.length);
        const recovery = recoveries[0] || null;
        if (recovery) {
          setResumedProjectId(recovery.id);
          setResumeNumeroExpediente(recovery.numeroExpediente || null);
          await loadProject(recovery.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No fue posible buscar recuperaciones historicas existentes.");
        }
      } finally {
        if (!cancelled) setIsLookingUpRecovery(false);
      }
    }

    void resumeExistingRecovery();

    return () => {
      cancelled = true;
    };
  }, [findHistoricalRecoveryProjectsBySource, loadProject]);

  const handleCreateRecoveryProject = async () => {
    if (!creationArmed || hasExistingRecovery || isCreating || createInFlightRef.current || createdProjectId) return;
    createInFlightRef.current = true;
    setIsCreating(true);
    setError("");
    try {
      const newProjectId = await createHistoricalRecoveryProject({
        nombre: RECOVERY_PROJECT_NAME,
        geometryType: "lineal",
        sourceProjectId: SOURCE_PROJECT_ID,
        sourceProjectName: SOURCE_PROJECT_NAME,
        sourceGeometryType: SOURCE_GEOMETRY_TYPE,
        recoveryReason: RECOVERY_REASON,
        descripcion: "Caller operativo temporal QA-06.03E.3 para reconciliacion historica con validacion humana.",
      });
      setCreatedProjectId(newProjectId);
      await loadProject(newProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear el expediente de recuperacion.");
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800 px-6 py-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-cyan-300">
          RECUPERACIÓN HISTÓRICA CONTROLADA
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
          Hacienda San Marcos
        </h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-300">
          El expediente histórico fue purgado. Las coordenadas GPS se presentan como candidatos de revisión,
          no como vértices. El orden requiere decisión humana y la geometría no se persistirá hasta la
          confirmación expresa dentro del flujo de reconciliación.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex max-w-xl items-center gap-2 border border-amber-800 bg-amber-950/30 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-100">
            <input
              type="checkbox"
              checked={creationArmed}
              disabled={isLookingUpRecovery || hasExistingRecovery || isCreating || Boolean(createdProjectId)}
              onChange={(event) => setCreationArmed(event.target.checked)}
            />
            Confirmo crear un expediente institucional nuevo de recuperación histórica
          </label>
          <button
            type="button"
            onClick={handleCreateRecoveryProject}
            disabled={isLookingUpRecovery || hasExistingRecovery || !creationArmed || isCreating || Boolean(createdProjectId)}
            className="border border-cyan-700 bg-cyan-950 px-4 py-2 font-black uppercase tracking-wide text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLookingUpRecovery ? "Buscando recuperación..." : isCreating ? "Creando..." : "Crear expediente de recuperacion"}
          </button>
          {error && <span className="font-semibold text-red-300">{error}</span>}
        </div>
        {hasExistingRecovery && (
          <div className="mt-4 border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
            <strong className="block font-black uppercase">RECUPERACIÓN EXISTENTE REANUDADA</strong>
            <span>{resumeNumeroExpediente || project?.numeroExpediente || "Numero expediente no disponible"}</span>
            {recoveryCount > 1 && (
              <span className="ml-3 font-black text-amber-200">MULTIPLE_RECOVERIES_DETECTED: se usa la más antigua por recoveredAt/createdAt/secuencia.</span>
            )}
          </div>
        )}
        {activeRecoveryProjectId && (
          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="block text-slate-500">Nuevo projectId</span>
              <strong className="break-all text-slate-100">{activeRecoveryProjectId}</strong>
            </div>
            <div>
              <span className="block text-slate-500">Numero expediente</span>
              <strong className="text-slate-100">{project?.id === activeRecoveryProjectId ? project.numeroExpediente || resumeNumeroExpediente || "Asignado no disponible" : resumeNumeroExpediente || "Pendiente"}</strong>
            </div>
            <div>
              <span className="block text-slate-500">Source projectId</span>
              <strong className="break-all text-slate-100">{SOURCE_PROJECT_ID}</strong>
            </div>
            <div>
              <span className="block text-slate-500">Estado</span>
              <strong className="text-amber-300">PENDIENTE DE RECONCILIACION HUMANA</strong>
            </div>
          </div>
        )}
      </section>

      {activeRecoveryProjectId && (
        <GeographicWorkspace historicalGeographyCandidatesInput={candidates} />
      )}
    </main>
  );
}
