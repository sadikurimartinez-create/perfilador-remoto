"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { CaptureAndAddPhoto } from "./CaptureAndAddPhoto";
import { PhotoAlbum } from "./PhotoAlbum";
import { ProjectMap } from "./ProjectMap";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { CEIPOLButton } from "./ui/CEIPOLButton";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import { CEIPOLToast } from "./ui/CEIPOLToast";

export function ProjectManager() {
  const router = useRouter();
  const { project, album, createProject, closeProject, updatePhotoCoordinates, analysisResult } = useProject();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "SUPERADMIN" || (user as any)?.role === "SUPER_ADMIN" || (user as any)?.role === "ADMIN";
  const estadoProyecto = (project as any)?.estado || "ABIERTO";
  const [nombreInput, setNombreInput] = useState("");
  const [descripcionInput, setDescripcionInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDevolverPrompt, setShowDevolverPrompt] = useState(false);
  const [comentariosAdmin, setComentariosAdmin] = useState("");
  const [plazoDevolucion, setPlazoDevolucion] = useState<number>(24);
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<{file: File, url: string}[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "warning" | "error" | "info"; message: string } | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const validPhotos = album.filter(
  (photo) =>
    photo.lat != null &&
    photo.lng != null &&
    Number.isFinite(Number(photo.lat)) &&
    Number.isFinite(Number(photo.lng))
);

  const requiredPhotos = project?.geometryType === 'poligono' ? 3 : project?.geometryType === 'lineal' ? 2 : 1;
  const hasMinimumPhotos = album.length >= requiredPhotos;

  useEffect(() => {
    if (project && project.descripcion && !descripcionInput) {
      setDescripcionInput(project.descripcion);
    }
  }, [project, descripcionInput]);

  const handleToggleDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast({ type: "warning", message: "Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android." });
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.lang = "es-MX";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = (event: any) => {
          console.error("Error en micrófono:", event?.error);
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = (res[0]?.transcript as string | undefined)?.trim();
            if (!text) continue;
            if (res.isFinal) {
              finalTranscript += text + " ";
            }
          }
          if (finalTranscript) {
            const normalized = finalTranscript.trim();
            if (!normalized) return;
            if (normalized === lastTranscriptRef.current) return;
            lastTranscriptRef.current = normalized;
            setDescripcionInput((prev) => prev ? `${prev.trim()} ${normalized}` : normalized);
          }
        };
        recognitionRef.current = recognition;
      }
      const recognition = recognitionRef.current as any;
      if (isListening) {
        recognition.stop();
      } else {
        lastTranscriptRef.current = "";
        recognition.start();
      }
    } catch (e) {
      console.error("Error al iniciar reconocimiento de voz:", e);
      setIsListening(false);
    }
  };

  const handlePendingPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setPendingPhotos(prev => [...prev, ...newItems]);
    }
    e.target.value = "";
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleNuevoProyecto = () => {
    setNombreInput("");
    pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
    setPendingPhotos([]);
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (nombre) {
      try {
        if (pendingPhotos.length > 0) {
          (window as any).pendingProjectPhotos = pendingPhotos.map(p => p.file);
        }
        await createProject({
          nombre,
          geometryType,
          descripcion: "",
          latitude: null,
          longitude: null,
          locationSource: "UNKNOWN",
          analysisRadius: 500,
        });
        pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
        setNombreInput("");
        setPendingPhotos([]);
      } catch (e: any) {
        delete (window as any).pendingProjectPhotos;
        // El error ya lo avisa el context con un alert
      }
    }
  };

  const handleCerrarProyecto = () => {
    closeProject();
    setShowPrompt(false);
    router.push("/");
  };

  const handleGuardarContexto = async () => {
    if (!project) return;
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        descripcion: descripcionInput
      });
      setToast({ type: "success", message: "Contexto operacional guardado correctamente." });
    } catch (err: any) {
      setToast({ type: "error", message: "Error al guardar contexto: " + err.message });
    }
  };

  const handleEnviarRevision = async () => {
    if (!project) return;
    if (!window.confirm("¿Estás seguro de enviar este expediente a revisión? Ya no podrás editarlo hasta que un administrador lo evalúe.")) return;
    
    try {
      setIsProcessing(true);
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "EN REVISIÓN",
        fechaEnvioRevision: Date.now()
      });
      setToast({ type: "success", message: "Expediente enviado a revisión correctamente." });
      router.push("/");
    } catch (err: any) {
      setToast({ type: "error", message: "Error al enviar a revisión: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIniciarAuditoria = async () => {
    if (!project) return;
    try {
      setIsProcessing(true);
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "EN AUDITORÍA",
        auditorId: (user as any)?.id || "",
        auditorNombre: (user as any)?.username || "Administrador",
        fechaInicioAuditoria: Date.now()
      });
    } catch (err: any) {
      setToast({ type: "error", message: "Error al iniciar auditoría: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidarProyecto = async () => {
    if (!project) return;
    if (!window.confirm("¿Estás seguro de VALIDAR y cerrar definitivamente este expediente?")) return;
    try {
      setIsProcessing(true);
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "VALIDADO",
        fechaValidacion: Date.now(),
        validadoPor: (user as any)?.username || "Administrador"
      });
      setToast({ type: "success", message: "Expediente validado y cerrado correctamente." });
    } catch (err: any) {
      setToast({ type: "error", message: "Error al validar: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDevolverProyecto = async () => {
    if (!project) return;
    if (!comentariosAdmin.trim()) {
      setToast({ type: "warning", message: "Debes ingresar un comentario justificando la devolución." });
      return;
    }
    try {
      setIsProcessing(true);
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "DEVUELTO",
        comentariosAuditoria: comentariosAdmin,
        fechaDevolucion: Date.now(),
        deadlineAt: Date.now() + (plazoDevolucion * 60 * 60 * 1000),
        devueltoPor: (user as any)?.username || "Administrador"
      });
      setShowDevolverPrompt(false);
      setComentariosAdmin("");
      setToast({ type: "success", message: `Expediente devuelto al usuario con un término de ${plazoDevolucion} horas.` });
    } catch (err: any) {
      setToast({ type: "error", message: "Error al devolver expediente: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHabilitarEdicion = async () => {
    if (!project) return;
    if (!window.confirm("¿Seguro que deseas habilitar la edición manual de este expediente bloqueado?")) return;
    try {
      setIsProcessing(true);
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), { estado: "ABIERTO" });
      setToast({ type: "success", message: "Edición habilitada. El expediente ahora está abierto." });
    } catch (err: any) {
      setToast({ type: "error", message: "Error: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGuardarYSalir = async () => {
    if (project) {
      try {
        const firestore = getDb();
        const { writeBatch } = await import("firebase/firestore");
        const batch = writeBatch(firestore);

        // 1. Guardar contexto general
        if (descripcionInput !== project.descripcion) {
          batch.update(doc(firestore, "projects", project.id), { descripcion: descripcionInput });
        }

        // 2. Guardar TODAS las contextualizaciones fotográficas del álbum
        album.forEach((photo) => {
          const photoRef = doc(firestore, "projects", project.id, "photos", photo.id);
          batch.update(photoRef, {
            tipo: photo.tipo || "",
            comentario: photo.comentario || ""
          });
        });

        await batch.commit();
      } catch (err) {
        console.error("Error al autoguardar contexto y álbum:", err);
      }
    }
    handleCerrarProyecto();
  };

  if (!project) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
            Captura y análisis ambiental
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Etapa 1 · Cree un proyecto para comenzar a capturar fotografías
            georreferenciadas y generar el perfil criminológico ambiental.
          </p>
        </header>

        {!showPrompt ? (
          <div className="card p-6 flex flex-col items-center justify-center min-h-[200px] gap-4">
            <p className="text-sm text-slate-400 text-center">
              Flujo por proyectos: cree un proyecto, agregue fotos al álbum y genere el análisis. Aquí verá Proyecto, Álbum y Perfil generado.
            </p>
            <CEIPOLButton
              type="button"
              variant="primary"
              onClick={handleNuevoProyecto}
              className="text-base px-6 py-3"
            >
              Nuevo Proyecto
            </CEIPOLButton>
          </div>
        ) : (
          <div className="card p-6 space-y-4 max-w-6xl w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda: Identificación del Proyecto */}
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-200 mb-1">
                    Nombre del Proyecto
                  </span>
                  <input
                    type="text"
                    spellCheck={true}
                    value={nombreInput}
                    onChange={(e) => setNombreInput(e.target.value)}
                    placeholder="Ej. Diagnóstico Polígono VNSA"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 hover:border-slate-700 transition-all duration-200"
                  />
                </label>

                <div className="geometry-selector">
                  <span className="block text-sm font-medium text-slate-200 mb-2">Tipo de geometría operacional</span>
                  <div className="flex flex-col gap-2.5 text-sm text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="radio"
                        name="geometryType"
                        value="individual"
                        checked={geometryType === "individual"}
                        onChange={() => setGeometryType("individual")}
                        className="form-radio h-4 w-4 text-cyan-500 focus:ring-cyan-500/30 bg-slate-950 border-slate-800 hover:border-slate-700 checked:bg-cyan-500 checked:border-cyan-500 transition-all cursor-pointer focus:ring-offset-slate-950"
                      />{" "}
                      Individual (Punto + Radio operacional)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="radio"
                        name="geometryType"
                        value="lineal"
                        checked={geometryType === "lineal"}
                        onChange={() => setGeometryType("lineal")}
                        className="form-radio h-4 w-4 text-cyan-500 focus:ring-cyan-500/30 bg-slate-950 border-slate-800 hover:border-slate-700 checked:bg-cyan-500 checked:border-cyan-500 transition-all cursor-pointer focus:ring-offset-slate-950"
                      />{" "}
                      Lineal (Rutas de patrullaje / Proyecciones)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="radio"
                        name="geometryType"
                        value="poligono"
                        checked={geometryType === "poligono"}
                        onChange={() => setGeometryType("poligono")}
                        className="form-radio h-4 w-4 text-cyan-500 focus:ring-cyan-500/30 bg-slate-950 border-slate-800 hover:border-slate-700 checked:bg-cyan-500 checked:border-cyan-500 transition-all cursor-pointer focus:ring-offset-slate-950"
                      />{" "}
                      Polígono (Áreas de interés / Zonas calientes)
                    </label>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Evidencia y Multimedia */}
              <div className="space-y-4">
                <div>
                  <span className="block text-sm font-medium text-slate-200 mb-2">Captura de fotografías (In-Situ)</span>
                  <div className="flex gap-3">
                    <label className="flex-1 text-center cursor-pointer rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 py-2.5 text-sm font-semibold hover:bg-emerald-800/50 shadow-md transition-colors flex items-center justify-center gap-2">
                      📷 Usar Cámara
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={handlePendingPhotosChange}
                      />
                    </label>
                    <label className="flex-1 text-center cursor-pointer rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 py-2.5 text-sm font-semibold hover:bg-sky-800/50 shadow-md transition-colors flex items-center justify-center gap-2">
                      📸 Usar Galería
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={handlePendingPhotosChange}
                      />
                    </label>
                  </div>
                </div>

                {pendingPhotos.length > 0 && (
                  <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                    <p className="text-xs text-emerald-400 mb-2 font-medium">✓ {pendingPhotos.length} fotografía(s) seleccionada(s) lista(s) para ser ingresada(s).</p>
                    <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {pendingPhotos.map((item, idx) => (
                        <div key={idx} className="relative group rounded-md overflow-hidden border border-slate-700 aspect-square bg-slate-800 flex items-center justify-center shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={item.url} 
                            alt="Preview" 
                            className="object-cover w-full h-full"
                          />
                          <button
                            type="button"
                            onClick={() => removePendingPhoto(idx)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-90 hover:opacity-100 shadow-md"
                            title="Borrar fotografía"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <CEIPOLButton
                type="button"
                variant="primary"
                onClick={handleConfirmarNombre}
                disabled={!nombreInput.trim()}
                className="flex-1 py-2.5 text-sm font-semibold"
              >
                Crear e ingresar
              </CEIPOLButton>
              <CEIPOLButton
                type="button"
                variant="secondary"
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </CEIPOLButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
            {project.nombre}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Espacio de trabajo · Modo Campo (celular) o Modo Gabinete (PC).
          </p>
        </div>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {/* FLUJO USUARIO */}
        {(estadoProyecto === "ABIERTO" || estadoProyecto === "DEVUELTO") && (
            <CEIPOLButton
              type="button"
              variant="primary"
              loading={isProcessing}
              disabled={isProcessing || !hasMinimumPhotos}
              onClick={handleEnviarRevision}
            >
              Enviar a Revisión
            </CEIPOLButton>
          )}
        {/* FLUJO ADMIN: INICIAR AUDITORÍA (En revisión o cerrados por 24h) */}
        {isAdmin && (estadoProyecto === "EN REVISIÓN" || estadoProyecto === "ABIERTO") && (
          <CEIPOLButton
            type="button"
            variant="primary"
            loading={isProcessing}
            disabled={isProcessing}
            onClick={handleIniciarAuditoria}
          >
            Iniciar Auditoría
          </CEIPOLButton>
        )}
        {/* FLUJO ADMIN: DEVOLVER O VALIDAR */}
        {isAdmin && estadoProyecto === "EN AUDITORÍA" && (
          <>
             <CEIPOLButton
               type="button"
               variant="warning"
               onClick={() => setShowDevolverPrompt(!showDevolverPrompt)}
             >
               Devolver
             </CEIPOLButton>
             <CEIPOLButton
               type="button"
               variant="confirm"
               size="md"
               loading={isProcessing}
               disabled={isProcessing}
               onClick={handleValidarProyecto}
             >
               Validar y Cerrar
             </CEIPOLButton>
           </>
        )}
        {/* BOTÓN EXTRA: HABILITAR EDICIÓN EN CUALQUIER ESTADO BLOQUEADO (ADMIN) */}
        {isAdmin && (estadoProyecto === "EN REVISIÓN" || estadoProyecto === "EN AUDITORÍA" || estadoProyecto === "VALIDADO") && (
           <CEIPOLButton
             type="button"
             variant="secondary"
             size="md"
             loading={isProcessing}
             disabled={isProcessing}
             onClick={handleHabilitarEdicion}
           >
             🔓 Habilitar Edición
           </CEIPOLButton>
        )}
          <CEIPOLButton
            type="button"
            variant="secondary"
            onClick={handleGuardarYSalir}
          >
            💾 Guardar y Salir
          </CEIPOLButton>
        </div>
      </div>

    {/* BANNERS Y PROMPTS DE ESTADO */}
    {showDevolverPrompt && (
      <CEIPOLCard
        variant="alert"
        className="p-4 border-l-4 border-orange-500 bg-orange-950/20 w-full max-w-none"
      >
        <h3 className="text-orange-400 font-bold mb-2 text-sm">Devolver Expediente a Usuario</h3>
        <textarea
          spellCheck={true}
          value={comentariosAdmin}
          onChange={(e) => setComentariosAdmin(e.target.value)}
          placeholder="Escribe los comentarios, observaciones o correcciones requeridas..."
          className="w-full bg-slate-950/60 border border-orange-900/40 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 hover:border-orange-800/40 transition-all duration-200 min-h-[80px] mb-3"
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <label className="text-sm text-slate-300 font-medium">Término para subsanar:</label>
          <select
            value={plazoDevolucion}
            onChange={(e) => setPlazoDevolucion(Number(e.target.value))}
            className="bg-slate-950/80 text-slate-100 border border-orange-900/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 hover:border-orange-800/40 cursor-pointer transition-all duration-200"
          >
            <option value={24}>24 horas</option>
            <option value={48}>48 horas</option>
            <option value={72}>72 horas</option>
          </select>
        </div>
        <div className="flex gap-2">
           <CEIPOLButton
             type="button"
             variant="danger"
             size="md"
             loading={isProcessing}
             disabled={isProcessing}
             onClick={handleDevolverProyecto}
           >
             Confirmar Devolución
           </CEIPOLButton>
          <CEIPOLButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowDevolverPrompt(false)}
          >
            Cancelar
          </CEIPOLButton>
        </div>
      </CEIPOLCard>
    )}
    {estadoProyecto === "DEVUELTO" && (
      <CEIPOLCard variant="alert" className="border-l-4 border-l-red-500 bg-red-950/20 p-4 rounded-xl">
        <h3 className="text-red-400 font-bold text-sm flex items-center justify-between">
          <span>Expediente Devuelto</span>
          {(project as any).deadlineAt && (
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${((project as any).deadlineAt - Date.now()) <= 5 * 3600 * 1000 ? "bg-red-600 text-white animate-pulse" : "bg-red-900/50 text-red-200"}`}>
              {((project as any).deadlineAt - Date.now()) > 0 
                ? `Vence en: ${Math.floor(((project as any).deadlineAt - Date.now()) / (3600 * 1000))}h ${Math.floor((((project as any).deadlineAt - Date.now()) % (3600 * 1000)) / 60000)}m`
                : "¡Término vencido!"}
            </span>
          )}
        </h3>
        <p className="text-sm text-slate-300 mt-1"><span className="font-semibold">Comentarios de auditoría ({(project as any).devueltoPor}):</span> {(project as any).comentariosAuditoria}</p>
        <p className="text-xs text-red-300 mt-2">Por favor, subsana las observaciones y vuelve a hacer clic en &quot;Enviar a Revisión&quot;.</p>
      </CEIPOLCard>
    )}
    {estadoProyecto === "EN REVISIÓN" && (
      <CEIPOLCard variant="glass" className="border-l-4 border-l-blue-500 bg-blue-950/20 p-4 rounded-xl">
        <h3 className="text-blue-400 font-bold text-sm">En Revisión</h3>
        <p className="text-sm text-slate-300 mt-1">Este expediente ha sido enviado y está en espera de ser auditado.</p>
      </CEIPOLCard>
    )}
    {estadoProyecto === "EN AUDITORÍA" && (
      <CEIPOLCard variant="glass" className="border-l-4 border-l-purple-500 bg-purple-950/20 p-4 rounded-xl">
        <h3 className="text-purple-400 font-bold text-sm">En Auditoría</h3>
        <p className="text-sm text-slate-300 mt-1">Este expediente está siendo auditado actualmente por {(project as any).auditorNombre}.</p>
      </CEIPOLCard>
    )}
    {estadoProyecto === "VALIDADO" && (
      <CEIPOLCard variant="glass" className="border-l-4 border-l-emerald-500 bg-emerald-950/20 p-4 rounded-xl">
        <h3 className="text-emerald-400 font-bold text-sm">Validado y Cerrado</h3>
        <p className="text-sm text-slate-300 mt-1">Este expediente ha sido aprobado definitivamente por {(project as any).validadoPor}.</p>
      </CEIPOLCard>
    )}

    {(estadoProyecto === "ABIERTO" || estadoProyecto === "DEVUELTO") ? (
      <div className="card p-4 md:p-6 border border-sky-900/50 bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">1. Contextualizar Geometría Operacional</h3>
          <CEIPOLButton
            type="button"
            variant={isListening ? "danger" : "ghost"}
            size="sm"
            onClick={handleToggleDictation}
          >
            🎙️ {isListening ? "Detener dictado" : "Dictar contexto"}
          </CEIPOLButton>
        </div>
        <textarea
          spellCheck={true}
          value={descripcionInput}
          onChange={(e) => setDescripcionInput(e.target.value)}
          placeholder="Describa el contexto, hipótesis o detalles relevantes de la geometría seleccionada..."
          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 hover:border-slate-700 transition-all duration-200 min-h-[80px]"
        />
        <div className="mt-3 flex justify-end">
          <CEIPOLButton
            type="button"
            variant="primary"
            onClick={handleGuardarContexto}
          >
            Guardar Contexto
          </CEIPOLButton>
        </div>
      </div>
    ) : (
      <div className="card p-4 md:p-6 border border-slate-700 bg-slate-900/40">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">Contexto Operacional</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{project.descripcion || "Sin contexto definido."}</p>
      </div>
    )}

      {(estadoProyecto === "ABIERTO" || estadoProyecto === "DEVUELTO") && (
        <CaptureAndAddPhoto />
      )}

      {album.length > 0 && (
        <ProjectMap
          project={project}
          album={validPhotos}
          geometryType={project.geometryType}
          coordinates={validPhotos.map((photo) => ({
            lat: Number(photo.lat),
            lng: Number(photo.lng),
          }))}
          onUpdateCoordinates={(newCoords) => {
            newCoords.forEach((coord, idx) => {
              const photo = validPhotos[idx];
              if (photo && (photo.lat !== coord.lat || photo.lng !== coord.lng)) {
                void updatePhotoCoordinates(photo.id, coord.lat, coord.lng);
              }
            });
          }}
        />
      )}

      <PhotoAlbum 
        projectId={project.id}
        onSaveAnalysisToCloud={async (content: string, _photos?: string[], summary?: string) => {
          const { getDb } = await import("@/lib/firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          const firestore = getDb();
          await updateDoc(doc(firestore, "projects", project.id), {
            analysisContent: content,
            iaAnalysis: analysisResult,
            reportSummary: summary || ""
          });
        }}
      />

      {toast && (
        <CEIPOLToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
