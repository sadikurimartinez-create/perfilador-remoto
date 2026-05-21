"use client";

import { useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "./CaptureAndAddPhoto";
import { PhotoAlbum } from "./PhotoAlbum";
import { ProjectMap } from "./ProjectMap";

export function ProjectManager() {
  const { project, album, createProject, closeProject, updatePhotoCoordinates } = useProject();
  const [nombreInput, setNombreInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const validPhotos = album.filter((photo) => photo.lat != null && photo.lng != null);

  const handleNuevoProyecto = () => {
    setNombreInput("");
    setShowPrompt(true);
  };

  const handleConfirmarNombre = () => {
    const nombre = nombreInput.trim();
    if (nombre) {
      createProject({
        nombre,
        geometryType,
      });
    }
  };

  const handleCerrarProyecto = () => {
    closeProject();
    setShowPrompt(false);
  };

  // ==========================
  // FASE 4 - Generación de análisis IA
  // ==========================
  const handleGenerateAIAnalysis = async () => {
    if (!project) return;

    // 1️⃣ Construir payload unificado
    const payload = {
      projectId: project.id,
      geometryType: project.geometryType,
      photos: album.map(photo => ({
        url: photo.previewUrl, // Adaptado al modelo actual (previewUrl y lat/lng)
        lat: photo.lat,
        lng: photo.lng
      })),
      objectives: (project as any).objectives || [],       // checkbox
      notes: {
        text: (project as any).textNotes || "",           // texto tecleado
        voice: (project as any).voiceNotes || ""          // dictado de micrófono
      }
    };

    try {
      // 2️⃣ Llamar al endpoint de IA
      const response = await fetch("/api/analyze-environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Error en análisis IA");

      const result = await response.json();

      // 3️⃣ Guardar resultados en project (Firestore y Dexie ya implementados)
      (project as any).iaAnalysis = result;

      // Actualizar UI (por ejemplo, alert o panel lateral)
      alert("Análisis de IA completado correctamente.");
    } catch (error) {
      console.error("Error al generar análisis IA:", error);
      alert("Ocurrió un error al generar el análisis de IA.");
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
            Espacio de trabajo · Agregue fotos y genere el análisis de selección.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCerrarProyecto}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          Cerrar Proyecto / Nuevo Proyecto
        </button>
      </div>

      <CaptureAndAddPhoto />
      <PhotoAlbum />
      
      {album.length > 0 && (
        <ProjectMap
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

    </div>
  );
}
