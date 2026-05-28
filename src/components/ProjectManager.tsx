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
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const [isListening, setIsListening] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<{file: File, url: string}[]>([]);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const validPhotos = album.filter((photo) => photo.lat != null && photo.lng != null);

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
      alert("Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android.");
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
      window.alert("Contexto operacional guardado correctamente.");
    } catch (err: any) {
      window.alert("Error al guardar contexto: " + err.message);
    }
  };

  const handleEnviarRevision = async () => {
    if (!project) return;
    if (!window.confirm("¿Estás seguro de enviar este expediente a revisión? Ya no podrás editarlo hasta que un administrador lo evalúe.")) return;
    
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "EN REVISIÓN",
        fechaEnvioRevision: Date.now()
      });
      window.alert("Expediente enviado a revisión correctamente.");
      router.push("/");
    } catch (err: any) {
      window.alert("Error al enviar a revisión: " + err.message);
    }
  };

  const handleIniciarAuditoria = async () => {
    if (!project) return;
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "EN AUDITORÍA",
        auditorId: (user as any)?.id || "",
        auditorNombre: (user as any)?.username || "Administrador",
        fechaInicioAuditoria: Date.now()
      });
    } catch (err: any) {
      window.alert("Error al iniciar auditoría: " + err.message);
    }
  };

  const handleValidarProyecto = async () => {
    if (!project) return;
    if (!window.confirm("¿Estás seguro de VALIDAR y cerrar definitivamente este expediente?")) return;
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "VALIDADO",
        fechaValidacion: Date.now(),
        validadoPor: (user as any)?.username || "Administrador"
      });
      window.alert("Expediente validado y cerrado correctamente.");
    } catch (err: any) {
      window.alert("Error al validar: " + err.message);
    }
  };

  const handleDevolverProyecto = async () => {
    if (!project) return;
    if (!comentariosAdmin.trim()) {
      window.alert("Debes ingresar un comentario justificando la devolución.");
      return;
    }
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id), {
        estado: "DEVUELTO",
        comentariosAuditoria: comentariosAdmin,
        fechaDevolucion: Date.now(),
        devueltoPor: (user as any)?.username || "Administrador"
      });
      setShowDevolverPrompt(false);
      setComentariosAdmin("");
      window.alert("Expediente devuelto al usuario con comentarios.");
    } catch (err: any) {
      window.alert("Error al devolver expediente: " + err.message);
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
            <button
              type="button"
              onClick={handleNuevoProyecto}
              className="btn-primary text-base px-6 py-3"
            >
              Nuevo Proyecto
            </button>
          </div>
        ) : (
          <div className="card p-6 space-y-4 max-w-md">
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
                className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

          <div className="geometry-selector mt-4">
            <label className="block font-semibold mb-2">Tipo de geometría operacional</label>
            <div className="flex flex-col gap-2">
              <label>
                <input
                  type="radio"
                  name="geometryType"
                  value="individual"
                  checked={geometryType === "individual"}
                  onChange={() => setGeometryType("individual")}
              />{" "}
               Individual
              </label>
              <label>
                <input
                  type="radio"
                  name="geometryType"
                  value="lineal"
                  checked={geometryType === "lineal"}
                  onChange={() => setGeometryType("lineal")}
                />{" "}
                Lineal
              </label>
              <label>
                <input
                  type="radio"
                  name="geometryType"
                  value="poligono"
                  checked={geometryType === "poligono"}
                  onChange={() => setGeometryType("poligono")}
              />{" "}
              Polígono
            </label>
          </div>
       </div>

          <div className="mt-4 mb-4">
            <span className="block text-sm font-medium text-slate-200 mb-2">Captura de fotografías (In-Situ)</span>
            <div className="flex gap-2">
              <label className="flex-1 text-center cursor-pointer rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 py-2 text-sm font-semibold hover:bg-emerald-800/50 shadow-md transition-colors">
                📷 Usar Cámara
                <input
                  type="file"
                accept="image/*"
                  capture="environment"
                className="sr-only"
                  onChange={handlePendingPhotosChange}
                />
              </label>
              <label className="flex-1 text-center cursor-pointer rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 py-2 text-sm font-semibold hover:bg-sky-800/50 shadow-md transition-colors">
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
            {pendingPhotos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-emerald-400 mb-2 font-medium">✓ {pendingPhotos.length} fotografía(s) seleccionada(s) lista(s) para ser ingresada(s).</p>
                <div className="grid grid-cols-4 gap-2">
                  {pendingPhotos.map((item, idx) => (
                    <div key={idx} className="relative group rounded-md overflow-hidden border border-slate-600 aspect-square bg-slate-800 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={item.url} 
                        alt="Preview" 
                        className="object-cover w-full h-full"
                      />
                      <button
                        type="button"
                        onClick={() => removePendingPhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow-md"
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmarNombre}
                disabled={!nombreInput.trim()}
                className="btn-primary flex-1"
              >
                Crear e ingresar
              </button>
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
              >
                Cancelar
              </button>
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
            <button
              type="button"
              onClick={handleEnviarRevision}
              disabled={!hasMinimumPhotos}
              className="text-sm px-4 py-2 rounded-lg font-bold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              Enviar a Revisión
            </button>
          )}
        {/* FLUJO ADMIN: INICIAR AUDITORÍA */}
        {isAdmin && estadoProyecto === "EN REVISIÓN" && (
          <button
            type="button"
            onClick={handleIniciarAuditoria}
            className="text-sm px-4 py-2 rounded-lg font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors shadow-md"
          >
            Iniciar Auditoría
          </button>
        )}
        {/* FLUJO ADMIN: DEVOLVER O VALIDAR */}
        {isAdmin && estadoProyecto === "EN AUDITORÍA" && (
          <>
            <button type="button" onClick={() => setShowDevolverPrompt(!showDevolverPrompt)} className="text-sm px-4 py-2 rounded-lg font-bold bg-orange-600 text-white hover:bg-orange-500 transition-colors shadow-md">
              Devolver
            </button>
            <button type="button" onClick={handleValidarProyecto} className="text-sm px-4 py-2 rounded-lg font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-md">
              Validar y Cerrar
            </button>
          </>
        )}
        {/* BOTÓN EXTRA: HABILITAR EDICIÓN EN CUALQUIER ESTADO BLOQUEADO (ADMIN) */}
        {isAdmin && (estadoProyecto === "EN REVISIÓN" || estadoProyecto === "EN AUDITORÍA" || estadoProyecto === "VALIDADO") && (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm("¿Seguro que deseas habilitar la edición manual de este expediente bloqueado?")) {
                try {
                  const firestore = getDb();
                  await updateDoc(doc(firestore, "projects", project.id), { estado: "ABIERTO" });
                  window.alert("Edición habilitada. El expediente ahora está abierto.");
                } catch(err: any) {
                  window.alert("Error: " + err.message);
                }
              }
            }}
            className="text-sm px-4 py-2 rounded-lg font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors shadow-md border border-slate-600"
          >
            🔓 Habilitar Edición
          </button>
        )}
          <button
            type="button"
            onClick={handleGuardarYSalir}
            className="text-sm px-4 py-2 rounded-lg font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors shadow-md"
          >
            💾 Guardar y Salir
          </button>
        </div>
      </div>

    {/* BANNERS Y PROMPTS DE ESTADO */}
    {showDevolverPrompt && (
      <div className="card p-4 border-l-4 border-orange-500 bg-orange-950/20">
        <h3 className="text-orange-400 font-bold mb-2 text-sm">Devolver Expediente a Usuario</h3>
        <textarea
          spellCheck={true}
          value={comentariosAdmin}
          onChange={(e) => setComentariosAdmin(e.target.value)}
          placeholder="Escribe los comentarios, observaciones o correcciones requeridas..."
          className="w-full rounded-lg border border-orange-700/50 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[80px] mb-3"
        />
        <div className="flex gap-2">
          <button onClick={handleDevolverProyecto} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            Confirmar Devolución
          </button>
          <button onClick={() => setShowDevolverPrompt(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    )}
    {estadoProyecto === "DEVUELTO" && (
      <div className="card p-4 border-l-4 border-red-500 bg-red-950/20">
        <h3 className="text-red-400 font-bold text-sm">Expediente Devuelto</h3>
        <p className="text-sm text-slate-300 mt-1"><span className="font-semibold">Comentarios de auditoría ({(project as any).devueltoPor}):</span> {(project as any).comentariosAuditoria}</p>
        <p className="text-xs text-red-300 mt-2">Por favor, subsana las observaciones y vuelve a hacer clic en "Enviar a Revisión".</p>
      </div>
    )}
    {estadoProyecto === "EN REVISIÓN" && (
      <div className="card p-4 border-l-4 border-blue-500 bg-blue-950/20"><h3 className="text-blue-400 font-bold text-sm">En Revisión</h3><p className="text-sm text-slate-300 mt-1">Este expediente ha sido enviado y está en espera de ser auditado.</p></div>
    )}
    {estadoProyecto === "EN AUDITORÍA" && (
      <div className="card p-4 border-l-4 border-purple-500 bg-purple-950/20"><h3 className="text-purple-400 font-bold text-sm">En Auditoría</h3><p className="text-sm text-slate-300 mt-1">Este expediente está siendo auditado actualmente por {(project as any).auditorNombre}.</p></div>
    )}
    {estadoProyecto === "VALIDADO" && (
      <div className="card p-4 border-l-4 border-emerald-500 bg-emerald-950/20"><h3 className="text-emerald-400 font-bold text-sm">Validado y Cerrado</h3><p className="text-sm text-slate-300 mt-1">Este expediente ha sido aprobado definitivamente por {(project as any).validadoPor}.</p></div>
    )}

    {(estadoProyecto === "ABIERTO" || estadoProyecto === "DEVUELTO") ? (
      <div className="card p-4 md:p-6 border border-sky-900/50 bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">1. Contextualizar Geometría Operacional</h3>
          <button
            type="button"
            onClick={handleToggleDictation}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold border ${
              isListening
                ? "border-red-500 text-red-300 bg-red-900/40"
                : "border-slate-600 text-slate-200 bg-slate-900"
            }`}
          >
            <span aria-hidden="true">🎙️</span>
            <span>{isListening ? "Detener grabación" : "Dictar contexto"}</span>
          </button>
        </div>
        <textarea
          spellCheck={true}
          value={descripcionInput}
          onChange={(e) => setDescripcionInput(e.target.value)}
          placeholder="Describa el contexto, hipótesis o detalles relevantes de la geometría seleccionada..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px]"
        />
        <div className="mt-3 flex justify-end">
          <button onClick={handleGuardarContexto} className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors">
            Guardar Contexto
          </button>
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
            lat: photo.lat as number,
            lng: photo.lng as number,
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
        onSaveAnalysisToCloud={async (content) => {
          const { getDb } = await import("@/lib/firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          const firestore = getDb();
          await updateDoc(doc(firestore, "projects", project.id), {
            analysisContent: content,
            iaAnalysis: analysisResult
          });
        }}
      />
    </div>
  );
}
