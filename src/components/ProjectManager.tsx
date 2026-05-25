"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "./CaptureAndAddPhoto";
import { PhotoAlbum } from "./PhotoAlbum";
import { ProjectMap } from "./ProjectMap";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export function ProjectManager() {
  const router = useRouter();
  const { project, album, createProject, closeProject, updatePhotoCoordinates, analysisResult } = useProject();
  const [nombreInput, setNombreInput] = useState("");
  const [descripcionInput, setDescripcionInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const validPhotos = album.filter((photo) => photo.lat != null && photo.lng != null);

  const requiredPhotos = project?.geometryType === 'poligono' ? 3 : project?.geometryType === 'lineal' ? 2 : 1;
  const hasMinimumPhotos = album.length >= requiredPhotos;

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

  const handleNuevoProyecto = () => {
    setNombreInput("");
    setDescripcionInput("");
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (nombre) {
      try {
        await createProject({
          nombre,
          geometryType,
          descripcion: descripcionInput,
        });
      } catch (e: any) {
        // El error ya lo avisa el context con un alert
      }
    }
  };

  const handleCerrarProyecto = () => {
    closeProject();
    setShowPrompt(false);
    router.push("/");
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

          <div className="mt-2 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="block text-sm font-medium text-slate-200">Explicación del Proyecto</span>
              <button
                type="button"
                onClick={handleToggleDictation}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border ${
                  isListening
                    ? "border-red-500 text-red-300 bg-red-900/40"
                    : "border-slate-600 text-slate-200 bg-slate-900"
                }`}
              >
                <span aria-hidden="true">🎙️</span>
                <span>{isListening ? "Detener grabación" : "Grabar explicación"}</span>
              </button>
            </div>
            <textarea
              value={descripcionInput}
              onChange={(e) => setDescripcionInput(e.target.value)}
              placeholder="Describa el contexto, hipótesis o detalles relevantes. La transcripción aparecerá aquí..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px]"
            />
            <div className="mt-2">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
                <span className={`font-bold ${descripcionInput.length < 20 ? "text-red-400" : descripcionInput.length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                  {descripcionInput.length === 0 ? "Sin contexto" : descripcionInput.length < 20 ? "Básico" : descripcionInput.length < 100 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${descripcionInput.length < 20 ? "bg-red-500" : descripcionInput.length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((descripcionInput.length / 150) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">* Opcional y flexible. Un contexto más amplio guía a la IA a respaldar mejor tus observaciones de campo.</p>
            </div>
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
        <div className="flex items-center gap-2">
          {((project as any).estado === "ABIERTO" || (project as any).estado === "DEVUELTO" || !(project as any).estado) && (
            <button
              type="button"
              onClick={handleEnviarRevision}
              disabled={!hasMinimumPhotos}
              className="text-sm px-4 py-2 rounded-lg font-bold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              Enviar a Revisión
            </button>
          )}
          <button
            type="button"
            onClick={handleCerrarProyecto}
            className="text-sm px-4 py-2 rounded-lg font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors shadow-md"
          >
            Volver al Lobby
          </button>
        </div>
      </div>

      <CaptureAndAddPhoto />

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
