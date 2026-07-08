"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "@/components/CaptureAndAddPhoto";
import { PhotoAlbum } from "@/components/PhotoAlbum";
import { CopilotOverlay } from "@/components/copilot/CopilotOverlay";
import { db } from "@/lib/localDb";
import { useAuth } from "@/context/AuthContext";
import { PandillasUI } from "@/modules/pandillas/pandillas.ui";
import { PandillasService } from "@/modules/pandillas/pandillas.service";
import { GangGeoSweepPanel } from "@/components/GangGeoSweepPanel";
import { SweepIntegrationModal } from "@/components/SweepIntegrationModal";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { exportToWord } from "@/lib/exportToWord";
import { generatePdfProgrammatic } from "@/lib/reportEngine";

type CloudAnalysis = {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  createdBy?: string;
  /** URLs públicas de las fotografías asociadas a este análisis. */
  attachedPhotos?: string[];
  reportEngineOutput?: boolean;
  source?: string;
  summary?: string;
  editorialPayload?: any;
  briefing?: any;
};

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === "string" ? params.id : null;
  const { project, loadProject, removePhotoFromAlbum, album, renameProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user, loading: loadingAuth } = useAuth();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const [analyses, setAnalyses] = useState<CloudAnalysis[]>([]);
  const [previewAnalysis, setPreviewAnalysis] = useState<CloudAnalysis | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"environmental" | "pandillas">("environmental");

  const handleExitWorkspace = (e: React.MouseEvent, targetUrl: string) => {
    if (project && project.sweeps) {
      const pending = project.sweeps.filter((s: any) => s.status === "Pendiente");
      if (pending.length > 0) {
        e.preventDefault();
        alert(`⚠️ Bloqueo de Gobernanza Operativa:\n\nExisten ${pending.length} barridos de información pendientes de integrar o descartar en la Hipótesis Central.\n\nPor favor, resuélvalos en el panel de Evidencia y Entorno antes de salir.`);
        setActiveWorkspaceTab("environmental");
        return;
      }
    }
    router.push(targetUrl);
  };

  const verifyAndPasswordCheck = async (): Promise<boolean> => {
    if (!user || !user.username) {
      alert("No hay ningún usuario autenticado en la sesión actual.");
      return false;
    }
    const passwordEntered = window.prompt("Por favor, introduzca su contraseña de usuario para autorizar la eliminación:");
    if (passwordEntered === null) return false;
    if (!passwordEntered.trim()) {
      alert("La contraseña no puede estar vacía.");
      return false;
    }
    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const { getDocs, query, where, collection } = await import("firebase/firestore");
      const q = query(
        collection(db, "users"),
        where("username", "==", user.username.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("No se encontró el registro del usuario actual.");
        return false;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data() as { passwordHash?: string };
      if (data.passwordHash !== passwordEntered) {
        alert("Contraseña incorrecta. Autorización denegada.");
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error al validar contraseña:", err);
      alert("Error de comunicación al validar credenciales.");
      return false;
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    const verified = await verifyAndPasswordCheck();
    if (!verified) return;

    const confirm1 = window.confirm("⚠️ PRIMERA CONFIRMACIÓN: ¿Está totalmente seguro de eliminar definitivamente este dictamen oficial guardado de este expediente?");
    if (!confirm1) return;

    const confirm2 = window.confirm("🚨 SEGUNDA CONFIRMACIÓN DE SEGURIDAD: Esta acción es irreversible. ¿Confirmar eliminación definitiva?");
    if (!confirm2) return;

    try {
      const db = getDb();
      await deleteDoc(doc(db, "analyses", analysisId));
      alert("El dictamen oficial ha sido eliminado correctamente.");
    } catch (err: any) {
      alert("Error al eliminar el dictamen: " + err.message);
    }
  };

  const [geoInputId, setGeoInputId] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGeoReport = async (geoId: string) => {
    if (!geoId.trim() || !project) return;
    const trimmedId = geoId.trim();

    // Strict validation for CEIPOL-GEO-[NOMBRE]-[RIESGO]-[ID]
    // Allowing letters, numbers, hyphens, and underscores for the sections
    const geoIdRegex = /^CEIPOL-GEO-[A-Z0-9Ñ_.-]+-[A-Z0-9_.-]+-[A-Z0-9_.-]+$/i;
    if (!geoIdRegex.test(trimmedId)) {
      alert("❌ El ID de geointeligencia ingresado no cumple con el formato obligatorio endurecido:\n\n" +
            "CEIPOL-GEO-[NOMBRE]-[RIESGO]-[ID]\n\n" +
            "Ejemplo válido: CEIPOL-GEO-PANDILLAX-ALTO-ABC12\n\n" +
            "Por favor, verifique el código y vuelva a intentarlo.");
      return;
    }

    setIsLinking(true);
    try {
      const gang = await PandillasService.getGangByGeoReportId(trimmedId);
      if (!gang) {
        alert("❌ No se encontró ningún informe de geointeligencia con ese ID en la base de datos.");
        setIsLinking(false);
        return;
      }
      const db = getDb();
      const projectRef = doc(db, "projects", project.id);
      await updateDoc(projectRef, {
        linkedGeoReportId: trimmedId,
        linkedGangReport: gang,
      });
      await loadProject(project.id);
      setGeoInputId("");
      alert("✅ ¡Informe de Geointeligencia vinculado con éxito!");
    } catch (err) {
      console.error(err);
      alert("❌ Error al vincular el informe.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkGeoReport = async () => {
    if (!project) return;
    if (!confirm("¿Está seguro de desvincular este informe de geointeligencia?")) return;
    setIsLinking(true);
    try {
      const db = getDb();
      const projectRef = doc(db, "projects", project.id);
      await updateDoc(projectRef, {
        linkedGeoReportId: null,
        linkedGangReport: null,
      });
      await loadProject(project.id);
      alert("✅ Informe de Geointeligencia desvinculado con éxito.");
    } catch (err) {
      console.error(err);
      alert("❌ Error al desvincular el informe.");
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    if (!user && !loadingAuth) {
      router.replace("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        await loadProject(projectId);
      } catch (e) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, user, loadingAuth, router]);

  // Suscripción en tiempo real a los análisis guardados en Firestore
  useEffect(() => {
    if (!projectId) return;
    const db = getDb();
    const q = query(
      collection(db, "analyses"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: CloudAnalysis[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            projectId: data.projectId as string,
            content: (data.content as string) ?? "",
            createdAt: (data.createdAt as number) ?? 0,
            createdBy: data.createdBy as string | undefined,
            attachedPhotos: (data.attachedPhotos as CloudAnalysis["attachedPhotos"]) ?? [],
            reportEngineOutput: data.reportEngineOutput === true,
            source: data.source as string | undefined,
            summary: data.summary as string | undefined,
          };
        })
        .filter((analysis) => analysis.reportEngineOutput === true)
        .sort((a, b) => b.createdAt - a.createdAt);
      setAnalyses(list);
    });
    return () => unsub();
  }, [projectId]);

  const handleDeletePhoto = async (id: string) => {
    if (!confirm("¿Eliminar esta fotografía del expediente?")) return;
    const photo = album.find((p) => p.id === id);
    if (photo?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    await db.photos.delete(id);
    removePhotoFromAlbum(id);
  };

  const handleRenameActiveProject = async () => {
    if (!renameInput.trim() || !project) return;
    try {
      await renameProject(project.id, renameInput.trim());
      setIsRenaming(false);
      alert("Nombre del expediente modificado correctamente.");
    } catch (err: any) {
      console.error("Error al renombrar expediente:", err);
      alert("Error al renombrar: " + err.message);
    }
  };

  if (loading || loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        Cargando expediente…
      </div>
    );
  }

  if (notFound || !projectId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-400">Expediente no encontrado.</p>
        <Link
          href="/"
          className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          Volver a Mis Expedientes
        </Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const handleSaveAnalysisToCloud = async (
    content: string,
    attachedPhotos?: CloudAnalysis["attachedPhotos"],
    summary?: string,
    metadata?: { reportEngineOutput?: boolean; source?: string }
  ) => {
    if (!projectId || !user) return;
    if (metadata?.reportEngineOutput !== true || metadata?.source !== "ReportEngine.finalize") {
      console.warn("[ProjectWorkspacePage] Persistencia omitida: solo se guardan salidas finales del Report Engine.");
      return;
    }
    const db = getDb();
    await addDoc(collection(db, "analyses"), {
      projectId,
      content,
      createdAt: Date.now(),
      reportEngineOutput: true,
      source: "ReportEngine.finalize",
      title: "Dictamen Criminológico Ambiental Generado",
      summary: summary ?? "",

      // Trazabilidad institucional
      createdBy: user.username,
      createdById: user.id,
      createdByRole: user.role,

      attachedPhotos: attachedPhotos ?? [],
    });
    // Actualizar contador de fotos del proyecto en Firestore
    try {
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        photoCount: album.length,
      });
    } catch (e) {
      console.error(
        "[ProjectWorkspacePage] No se pudo actualizar photoCount del proyecto:",
        e
      );
    }
  };

  return (
    <div className="w-full p-4 md:p-6 flex flex-col gap-6">
      <header className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div>
            <a
              href="/"
              onClick={(e) => handleExitWorkspace(e, "/")}
              className="text-xs text-slate-500 hover:text-slate-400 mb-1 inline-block"
            >
              ← Volver a Mis Expedientes
            </a>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
                {project.nombre}
              </h2>
              {project.estado !== "CERRADO" && project.estado !== "EN REVISIÓN" && (
                <button
                  type="button"
                  onClick={() => {
                    setRenameInput(project.nombre);
                    setIsRenaming(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800/60 transition-colors text-sm"
                  title="Renombrar expediente"
                >
                  ✏️
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tracking-tight text-blue-300/90">
              ID expediente: {project.id}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => handleExitWorkspace(e, "/")}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            Guardar y Salir a Inicio
          </button>
        </div>
      </header>

      {/* PREMIUM TABS NAVIGATION HEADER */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 gap-1.5 shadow-lg max-w-2xl w-full">
        <button
          onClick={() => setActiveWorkspaceTab("environmental")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black tracking-wide uppercase transition-all whitespace-nowrap ${
            activeWorkspaceTab === "environmental"
              ? "bg-sky-500 text-slate-950 shadow-md font-extrabold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📷 Evidencia y Entorno
        </button>
        <button
          onClick={() => setActiveWorkspaceTab("pandillas")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black tracking-wide uppercase transition-all whitespace-nowrap ${
            activeWorkspaceTab === "pandillas"
              ? "bg-sky-500 text-slate-950 shadow-md font-extrabold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🕵️ Análisis de Pandillas
        </button>
      </div>

      <div className="w-full space-y-6 overflow-y-auto pb-20 lg:pb-0">
        {activeWorkspaceTab === "environmental" && (
          <>
            <CaptureAndAddPhoto />
            <PhotoAlbum
              onDeletePhoto={handleDeletePhoto}
              projectId={project.id}
              onSaveAnalysisToCloud={handleSaveAnalysisToCloud}
            />
          </>
        )}
        {activeWorkspaceTab === "pandillas" && (
          <div className="w-full bg-slate-950/20 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <PandillasUI projectId={project.id} onSaveAnalysisToCloud={handleSaveAnalysisToCloud} />
          </div>
        )}
      </div>

      <div className="w-full" id="c4-right-column">
        <section className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-xl p-4 md:p-6 space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Dictámenes oficiales guardados en este expediente
          </h3>
          {analyses && analyses.length > 0 ? (
            <ul className="space-y-2">
              {analyses.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur-md p-4 text-xs"
                >
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">Fecha y Hora:</span>
                      <span className="text-sky-400 font-mono">
                        {new Date(a.createdAt).toLocaleString("es-MX")}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-200">Nombre del Autor:</span>
                      <span className="text-slate-350 ml-1.5">{a.createdBy || "Desconocido"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!a.editorialPayload) {
                            alert("Este expediente histórico no contiene el dictamen de Word para regenerar.");
                            return;
                          }
                          await exportToWord(
                            a.editorialPayload,
                            project?.nombre || (project as any)?.name || 'Expediente',
                            a.editorialPayload.projectId || project?.id || 'EXP',
                            user
                          );
                        } catch (err: any) {
                          alert("Error al generar Word: " + err.message);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition active:scale-95"
                    >
                      📝 Generar Word
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!a.briefing) {
                            alert("Este expediente histórico no contiene el dictamen de PDF para regenerar.");
                            return;
                          }
                          await generatePdfProgrammatic(a.briefing);
                        } catch (err: any) {
                          alert("Error al generar PDF: " + err.message);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition active:scale-95"
                    >
                      📄 Generar PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnalysis(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-800 hover:bg-red-755 px-3.5 py-2 text-xs font-bold text-white shadow-md transition active:scale-95"
                    >
                      🗑️ Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No se han registrado dictámenes oficiales guardados en este expediente.</p>
          )}
        </section>
      </div>

      <a
        href="#c4-right-column"
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 rounded-full shadow-lg shadow-emerald-900/50 flex items-center justify-center z-50 text-white hover:bg-emerald-500 transition-transform active:scale-95 lg:hidden"
        aria-label="Ir a mapa y análisis"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </a>
      {previewAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setPreviewAnalysis(null)}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 h-8 w-8 text-sm"
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              Vista previa del dictamen
            </h3>
            <div className="prose prose-invert prose-sm max-w-none text-slate-100 whitespace-pre-wrap">
              {previewAnalysis.content}
            </div>
            {previewAnalysis.attachedPhotos && previewAnalysis.attachedPhotos.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-2">
                  Anexo fotográfico
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {previewAnalysis.attachedPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Foto ${idx + 1} del expediente`}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              ✏️ Modificar Nombre de Expediente
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cambia el nombre de identificación de este expediente de manera permanente.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nuevo Nombre:</label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-lg p-2.5 text-sm text-slate-100 outline-none"
                  placeholder="Ej. Aguascalientes Operativo Norte"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRenaming(false);
                  setRenameInput("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRenameActiveProject}
                disabled={!renameInput.trim() || renameInput.trim() === project.nombre}
                className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg shadow-lg transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
      <CopilotOverlay />
      <SweepIntegrationModal />
    </div>
  );
}
