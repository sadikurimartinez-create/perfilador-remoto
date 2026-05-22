"use client";

import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import imageCompression from "browser-image-compression";
import { useProject } from "@/context/ProjectContext";
import { TIPOS_IMAGEN } from "@/context/ProjectContext";
import { db } from "@/lib/localDb";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.7,
  alwaysKeepResolution: true,
} as const;

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
  const { addPhotoToAlbum, project, album } = useProject();
  const [file, setFile] = useState<File | null>(null);
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [tipo, setTipo] = useState<string>(TIPOS_IMAGEN[0]);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || !project) return;

    setError(null);
    setIsReading(true);
    setIsFetchingGPS(true);

    let compressed: File = selected;
    try {
      compressed = await imageCompression(selected, COMPRESSION_OPTIONS);
    } catch (err) {
      console.error(err);
      setError("No se pudo comprimir la imagen. Se usará la foto original.");
    }

    try {
      const exifGps = await exifr.gps(compressed).catch(() => null);
      let lat: number | null = null;
      let lng: number | null = null;
      if (exifGps && typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number") {
        lat = exifGps.latitude;
        lng = exifGps.longitude;
      } else {
        const fullExif = await exifr.parse(compressed, { gps: true }).catch(() => null) as Record<string, unknown> | null;
        if (fullExif?.latitude != null && fullExif?.longitude != null) {
          lat = fullExif.latitude as number;
          lng = fullExif.longitude as number;
        }
      }
      if (lat == null || lng == null) {
        const fallback = await getFallbackLocation();
        lat = fallback.lat;
        lng = fallback.lng;
        if (lat === 0 && lng === 0) {
           setError("No se encontraron coordenadas GPS. Se agregó la foto con ubicación (0, 0).");
        }
      }

      const photoId = generateSafeId();
      const projectId = project.id;
      const preview = URL.createObjectURL(compressed);

      await db.transaction("rw", db.projects, db.photos, async () => {
        const existing = await db.projects.get(projectId);
        if (!existing) {
          await db.projects.add({
            id: projectId,
            name: project.nombre,
            createdAt: Date.now(),
          });
        }
        await db.photos.add({
          id: photoId,
          projectId,
          imageBlob: compressed,
          tag: TIPOS_IMAGEN[0],
          comments: "",
          lat,
          lng,
          timestamp: Date.now(),
        });
      });

      addPhotoToAlbum(
        {
          previewUrl: preview,
          lat,
          lng,
          tipo: TIPOS_IMAGEN[0],
          comentario: "",
          file: compressed,
        },
        photoId
      );
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al guardar la foto.");
    } finally {
      setIsReading(false);
      setIsFetchingGPS(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (!project || files.length === 0) return;

    setError(null);
    setIsFetchingGPS(true);

    for (const selected of files) {
      let compressed: File = selected;
      try {
        compressed = await imageCompression(selected, COMPRESSION_OPTIONS);
      } catch (err) {
        console.error("[CaptureAndAddPhoto] Error comprimiendo:", err);
        // Fallback: mantener la imagen original para no bloquear la subida
        setError("No se pudo comprimir una imagen. Se usará la foto original.");
      }

      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const exifGps = await exifr.gps(compressed).catch(() => null);
        if (
          exifGps &&
          typeof exifGps.latitude === "number" &&
          typeof exifGps.longitude === "number"
        ) {
          lat = exifGps.latitude;
          lng = exifGps.longitude;
        } else {
          const fullExif = (await exifr
            .parse(compressed, { gps: true })
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

      const photoId = generateSafeId();
      const projectId = project.id;
      const preview = URL.createObjectURL(compressed);

      try {
        await db.transaction("rw", db.projects, db.photos, async () => {
          const existing = await db.projects.get(projectId);
          if (!existing) {
            await db.projects.add({
              id: projectId,
              name: project.nombre,
              createdAt: Date.now(),
            });
          }
          await db.photos.add({
            id: photoId,
            projectId,
            imageBlob: compressed,
            tag: tipo,
            comments: comentario.trim(),
            lat,
            lng,
            timestamp: Date.now(),
          });
        });
      } catch (err) {
        console.error("[CaptureAndAddPhoto] Error guardando en IndexedDB:", err);
        if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
        setError("No se pudo guardar en el dispositivo (poca memoria o espacio). Libere espacio e intente con menos fotos.");
        e.target.value = "";
        return;
      }

      addPhotoToAlbum(
        {
          previewUrl: preview,
          lat,
          lng,
          tipo,
          comentario: comentario.trim(),
          file: compressed,
        },
        photoId
      );
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
          Captura / Subida de fotografía
        </h3>
        <p className="text-sm text-slate-400">
          Tome una foto con la cámara o suba desde la galería. Si la imagen no tiene ubicación, se usará su posición actual o (0, 0).
        </p>
      </header>

      {!project && (
        <p className="text-sm text-amber-400">
          Cree o abra un proyecto para poder agregar fotos.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryUpload}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!project}
          onClick={() => project && fileInputRef.current?.click()}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tomar foto (Cámara)
        </button>
        <button
          type="button"
          disabled={!project}
          onClick={() => project && galleryInputRef.current?.click()}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Subir desde galería
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  </>
  );
}
