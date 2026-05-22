"use client";

import { useRef, useState } from "react";
import exifr from "exifr";
import { useProject } from "@/context/ProjectContext";

function getFallbackLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (typeof navigator?.geolocation?.getCurrentPosition !== "function") {
      resolve({ lat: 0, lng: 0 });
      return;
    }
    const timeout = setTimeout(() => resolve({ lat: 0, lng: 0 }), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        clearTimeout(timeout);
        resolve({ lat: 0, lng: 0 });
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
    );
  });
}

function generateSafeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function CaptureAndAddPhoto() {
  const { uploadAndAddPhoto, project, album } = useProject();
  const minimumPhotos = {
    individual: 1,
    lineal: 2,
    poligono: 3,
  } as const;

  const geom = (project?.geometryType as keyof typeof minimumPhotos) || "individual";
  const requiredPhotos =
    minimumPhotos[geom] || 1;

  const currentPhotos = album.length;

  const remainingPhotos =
    requiredPhotos - currentPhotos;

  const hasMinimumPhotos =
    currentPhotos >= requiredPhotos;
  const [error, setError] = useState<string | null>(null);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const isIndividual = project?.geometryType === 'individual';

  const handleGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    let files = Array.from(e.target.files ?? []);
    if (!project || files.length === 0) return;

    // REGLA DE NEGOCIO: Forzar una sola foto para modo 'individual'
    if (isIndividual) {
      if (album.length >= 1) {
        setError("El modo 'Individual' solo permite una fotografía. Borre la existente para agregar una nueva.");
        e.target.value = ""; // Limpiar el input para permitir nueva selección
        return;
      }
      // Si el usuario seleccionó varias, solo tomamos la primera.
      files = files.slice(0, 1);
    }

    setError(null);
    setIsFetchingGPS(true);

    for (const selected of files) {
      // IMPORTANTE: Extraer GPS de la imagen ORIGINAL antes de comprimir, 
      // ya que la compresión borra los metadatos EXIF.
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const exifGps = await exifr.gps(selected).catch(() => null);
        if (
          exifGps &&
          typeof exifGps.latitude === "number" &&
          typeof exifGps.longitude === "number"
        ) {
          lat = exifGps.latitude;
          lng = exifGps.longitude;
        } else {
          const fullExif = (await exifr
            .parse(selected, { gps: true })
            .catch(() => null)) as Record<string, unknown> | null;
          if (fullExif?.latitude != null && fullExif?.longitude != null) {
            lat = fullExif.latitude as number;
            lng = fullExif.longitude as number;
          }
        }
      } catch {
        // ignorar error EXIF; lat/lng siguen null
      }

      if (lat == null || lng == null) {
        const fallback = await getFallbackLocation();
        lat = fallback.lat;
        lng = fallback.lng;
      }

      try {
        await uploadAndAddPhoto(selected, lat, lng);
      } catch (err) {
        console.error("[CaptureAndAddPhoto] Error subiendo foto:", err);
        setError(err instanceof Error ? err.message : "Error al subir la fotografía.");
        // Detener el bucle si una foto falla
        break;
      }
    }

    setIsFetchingGPS(false);
    e.target.value = "";
  };

  return (
  <>

    {project && !hasMinimumPhotos && (
      <div className="mb-4 rounded-lg border border-amber-500 bg-amber-950/40 p-3 text-sm text-amber-200">
        
        <div className="font-semibold mb-1">
          Validación de geometría operacional
        </div>

        <div>
          La geometría{" "}
          <strong>{project.geometryType?.toUpperCase()}</strong>{" "}
          requiere mínimo{" "}
          <strong>{requiredPhotos}</strong>{" "}
          evidencia(s) fotográfica(s) georreferenciada(s).
        </div>

        <div className="mt-1">
          Actualmente hay{" "}
          <strong>{currentPhotos}</strong>{" "}
          evidencia(s) cargada(s).
        </div>

        {remainingPhotos > 0 && (
          <div className="mt-1">
            Faltan{" "}
            <strong>{remainingPhotos}</strong>{" "}
            fotografía(s) para continuar.
          </div>
        )}

      </div>
    )}

    <section className="card p-4 md:p-6 space-y-4">
      {isFetchingGPS && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-lg text-slate-200 font-semibold tracking-tight">Procesando imagen...</p>
            <p className="text-sm text-slate-400 mt-1">Comprimiendo y extrayendo GPS</p>
          </div>
        </div>
      )}
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-100">
          Evidencia Fotográfica
        </h3>
        <p className="text-sm text-slate-400">
          Tome las fotos con la cámara normal de su teléfono (para que se guarden en su carrete) y luego súbalas aquí. El sistema extraerá el GPS original de las fotografías.
        </p>
      </header>

      {!project && (
        <p className="text-sm text-amber-400">
          Cree o abra un proyecto para poder agregar fotos.
        </p>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={!isIndividual}
        className="hidden"
        onChange={handleGalleryUpload}
      />

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={!project}
          onClick={() => project && galleryInputRef.current?.click()}
          className="w-full rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 px-3 py-3 text-base font-semibold hover:bg-sky-800/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors"
        >
          📸 Seleccionar fotos del Carrete / Galería
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  </>
  );
}
