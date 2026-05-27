"use client";

import { useRef, useState, useEffect } from "react";
import exifr from "exifr";
import { useProject } from "@/context/ProjectContext";

function getFallbackLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator?.geolocation?.getCurrentPosition !== "function") {
      reject(new Error("El navegador de este celular no soporta geolocalización."));
      return;
    }
    const timeout = setTimeout(() => reject(new Error("Tiempo de espera agotado buscando satélites GPS. Acérquese a un área despejada.")), 10000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        clearTimeout(timeout);
        reject(new Error("Permiso de ubicación DENEGADO. Por favor, permita el acceso al GPS en la configuración de su navegador (Chrome/Safari)."));
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  
  // Estados para el Fallback Manual
  const [manualQueue, setManualQueue] = useState<File[]>([]);
  const [manualCoords, setManualCoords] = useState({ lat: "", lng: "" });

  // FASE 1: Secuencialidad. Validar que el proyecto tenga Nombre, Geometría y Explicación.
  const isProjectReady = Boolean(
    // Utilizamos type assertion (any) y fallback para evitar errores de TS y empatar con la DB
    ((project as any)?.nombre || (project as any)?.name)?.trim() &&
    project?.geometryType
  );

  const isIndividual = project?.geometryType === 'individual';

  const processFiles = async (files: File[], isLiveCapture: boolean = false) => {
    if (!project || files.length === 0) return;

    setError(null);
    setIsFetchingGPS(true);

    // Si es captura en vivo desde la cámara del perfilador, obtenemos el GPS del navegador 
    // inmediatamente, ya que iOS/Android a veces borran el EXIF en el navegador por privacidad.
    let liveLat: number | null = null;
    let liveLng: number | null = null;
    if (isLiveCapture) {
      try {
        const fallback = await getFallbackLocation();
        liveLat = fallback.lat;
        liveLng = fallback.lng;
      } catch (err) {
        console.warn("No se pudo obtener GPS en vivo, se intentará leer el EXIF de la foto.", err);
      }
    }

    const needsManual: File[] = [];
    for (const selected of files) {
      // IMPORTANTE: Extraer GPS de la imagen ORIGINAL antes de comprimir, 
      // ya que la compresión borra los metadatos EXIF.
      let lat: number | null = liveLat;
      let lng: number | null = liveLng;
      
      // Si la captura NO fue en vivo o falló el GPS del navegador, intentamos leer el EXIF de la imagen
      if (lat == null || lng == null) {
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
      }

      if (lat == null || lng == null) {
        try {
          const fallback = await getFallbackLocation();
          lat = fallback.lat;
          lng = fallback.lng;
        } catch (fbErr: any) {
          // SI FALLA EL GPS DEL NAVEGADOR, MOSTRAMOS EL FORMULARIO MANUAL
          needsManual.push(selected);
          continue;
        }
      }

      if (lat != null && lng != null) {
        try {
          await uploadAndAddPhoto(selected, lat, lng);
        } catch (err) {
          console.error("[CaptureAndAddPhoto] Error subiendo foto:", err);
          setError(err instanceof Error ? err.message : "Error al subir la fotografía.");
          break;
        }
      }
    }

    setIsFetchingGPS(false);
    
    if (needsManual.length > 0) {
      setManualQueue(needsManual);
      setError(`No se pudo obtener la ubicación automáticamente para ${needsManual.length} foto(s). Ingrese las coordenadas manualmente.`);
    }
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isLiveCapture: boolean = false
  ) => {
    let files = e.target.files ? Array.from(e.target.files) : [];
    await processFiles(files, isLiveCapture);
    e.target.value = "";
  };

  useEffect(() => {
    const pending = (window as any).pendingProjectPhotos;
    if (project && pending && pending.length > 0) {
      delete (window as any).pendingProjectPhotos;
      processFiles(pending, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handleManualSubmit = async () => {
    if (manualQueue.length === 0) return;
    
    const latNum = parseFloat(manualCoords.lat);
    const lngNum = parseFloat(manualCoords.lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError("Por favor, ingrese coordenadas numéricas válidas.");
      return;
    }

    try {
      await uploadAndAddPhoto(manualQueue[0], latNum, lngNum);
      const newQueue = manualQueue.slice(1);
      setManualQueue(newQueue);
      if (newQueue.length === 0) {
        setError(null);
        setManualCoords({ lat: "", lng: "" });
      } else {
        setError(`Faltan ${newQueue.length} foto(s) por ubicar.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la fotografía manualmente.");
    }
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

    <section className="card p-4 md:p-6 space-y-4 col-span-full w-full">
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

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg, image/png, image/heic, image/heif, image/*"
        multiple
        className="sr-only"
        onChange={(e) => handlePhotoUpload(e, false)}
      />
      
      {/* Input oculto para forzar la apertura de la cámara trasera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg, image/png, image/heic, image/heif, image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handlePhotoUpload(e, true)}
      />
      
      {/* MODAL / SECCIÓN DE INGRESO MANUAL */}
      {manualQueue.length > 0 && (
        <div className="mt-4 p-4 border border-sky-500 bg-slate-800 rounded-lg space-y-3">
          <p className="text-sm text-sky-300 font-semibold">
            Acción Requerida: Ubicación Manual ({manualQueue.length} pendiente(s))
          </p>
          <p className="text-xs text-slate-400">
            La imagen "{manualQueue[0].name}" no tiene GPS. Ingrese la latitud y longitud.
          </p>
          <div className="flex flex-col gap-3">
            <input type="number" placeholder="Latitud (ej. 21.8853)" value={manualCoords.lat} onChange={(e) => setManualCoords({ ...manualCoords, lat: e.target.value })} className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm" />
            <input type="number" placeholder="Longitud (ej. -102.2916)" value={manualCoords.lng} onChange={(e) => setManualCoords({ ...manualCoords, lng: e.target.value })} className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm" />
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <button onClick={handleManualSubmit} className="flex-1 bg-sky-600 text-white py-2 rounded text-sm font-semibold">Guardar y Subir</button>
            <button onClick={() => { setManualQueue([]); setError(null); setManualCoords({ lat: "", lng: "" }); }} className="flex-1 bg-slate-700 text-white py-2 rounded text-sm font-semibold">Cancelar</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <button
          type="button"
          disabled={!isProjectReady}
          onClick={() => isProjectReady && cameraInputRef.current?.click()}
          className="w-full rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 px-3 py-3 text-base font-semibold hover:bg-emerald-800/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors"
        >
          📷 Tomar Foto In-Situ (Cámara)
        </button>

        <button
          type="button"
          disabled={!isProjectReady}
          onClick={() => isProjectReady && galleryInputRef.current?.click()}
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
