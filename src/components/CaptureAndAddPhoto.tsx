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
    // Aumentamos el tiempo a 40 segundos para dar más tiempo a dispositivos móviles e iOS en interiores
    const timeout = setTimeout(() => reject(new Error("Tiempo de espera agotado buscando satélites GPS. Revise los permisos de Safari/Chrome o salga a un área despejada.")), 40000);
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
        let errMsg = "Error de GPS.";
        if (err.code === 1) errMsg = "Permiso de ubicación DENEGADO. Active el GPS en Ajustes > Privacidad para su navegador.";
        if (err.code === 2) errMsg = "Posición no disponible. Intente salir a un área despejada.";
        if (err.code === 3) errMsg = "Tiempo de espera agotado por el sensor GPS del dispositivo.";
        reject(new Error(errMsg));
      },
      { enableHighAccuracy: true, timeout: 35000, maximumAge: 30000 }
    );
  });
}

function getDeviceLocation(): Promise<{ lat: number; lng: number; accuracy: number | null; timestamp: number | null }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator?.geolocation?.getCurrentPosition !== "function") {
      reject(new Error("El navegador de este celular no soporta geolocalización."));
      return;
    }
    const timeout = setTimeout(() => reject(new Error("Tiempo de espera agotado buscando satélites GPS. Revise los permisos de Safari/Chrome o salga a un área despejada.")), 40000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp ?? Date.now(),
        });
      },
      (err) => {
        clearTimeout(timeout);
        let errMsg = "Error de GPS.";
        if (err.code === 1) errMsg = "Permiso de ubicación DENEGADO. Active el GPS en Ajustes > Privacidad para su navegador.";
        if (err.code === 2) errMsg = "Posición no disponible. Intente salir a un área despejada.";
        if (err.code === 3) errMsg = "Tiempo de espera agotado por el sensor GPS del dispositivo.";
        reject(new Error(errMsg));
      },
      { enableHighAccuracy: true, timeout: 35000, maximumAge: 0 } // Desactivar caché de ubicación para forzar sensor físico
    );
  });
}

function getCoordinatesDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function coordinatesMatch(lat1: number, lng1: number, lat2: number, lng2: number, thresholdMeters: number = 100): boolean {
  const distance = getCoordinatesDistance(lat1, lng1, lat2, lng2);
  return distance <= thresholdMeters;
}

function generateSafeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function ElapsedTime({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);
  if (!running) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded inline-block ml-1">{m}:{s}</span>;
}

interface ManualQueueItem {
  file: File;
  diagnosticLogs: string;
  exifLat: number | null;
  exifLng: number | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  gpsTimestamp: number | null;
}

export function CaptureAndAddPhoto() {
  const { uploadAndAddPhoto, project, album, uploadDocument } = useProject();
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
  const pendingProcessed = useRef(false);
  
  const [isUploadingEvidencia, setIsUploadingEvidencia] = useState(false);
  
  // Estados para el Fallback Manual
  const [manualQueue, setManualQueue] = useState<ManualQueueItem[]>([]);
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

    // Intentamos obtener la ubicación actual del dispositivo una sola vez por lote.
    // Usamos maximumAge: 0 para forzar una consulta fresca a los sensores físicos en móviles/iOS.
    let deviceLoc: { lat: number; lng: number; accuracy: number | null; timestamp: number | null } | null = null;
    try {
      deviceLoc = await getDeviceLocation();
    } catch (err) {
      console.warn("No se pudo obtener la ubicación del dispositivo en processFiles:", err);
    }

    const needsManual: ManualQueueItem[] = [];

    for (const selected of files) {
      // 1. Extraer coordenadas EXIF de la imagen original antes de comprimir
      let exifLat: number | null = null;
      let exifLng: number | null = null;

      try {
        const exifGps = await exifr.gps(selected).catch(() => null);
        if (
          exifGps &&
          typeof exifGps.latitude === "number" &&
          typeof exifGps.longitude === "number"
        ) {
          exifLat = exifGps.latitude;
          exifLng = exifGps.longitude;
        } else {
          const fullExif = (await exifr
            .parse(selected, { gps: true })
            .catch(() => null)) as Record<string, unknown> | null;
          if (fullExif?.latitude != null && fullExif?.longitude != null) {
            exifLat = fullExif.latitude as number;
            exifLng = fullExif.longitude as number;
          }
        }
      } catch (exifErr) {
        console.warn("Error leyendo metadatos EXIF en processFiles:", exifErr);
      }

      // 2. Sistema de Validación Redundante y Priorización
      let finalLat: number | null = null;
      let finalLng: number | null = null;
      let gpsSource = "SIN_GEOLOCALIZACION";
      let validado = false;
      const logsArray: string[] = [];

      const logTimestamp = new Date().toISOString();
      logsArray.push(`--- DIAGNÓSTICO DE GEOLOCALIZACIÓN (${logTimestamp}) ---`);
      logsArray.push(`Archivo: ${selected.name}`);
      logsArray.push(`Modo de captura: ${isLiveCapture ? "Cámara In-Situ" : "Galería / Carrete"}`);

      if (deviceLoc) {
        logsArray.push(`GPS Dispositivo: Lat ${deviceLoc.lat}, Lng ${deviceLoc.lng} (Precisión: ${deviceLoc.accuracy}m, Timestamp: ${new Date(deviceLoc.timestamp || Date.now()).toISOString()})`);
      } else {
        logsArray.push("GPS Dispositivo: No disponible o Permiso denegado");
      }

      if (exifLat !== null && exifLng !== null) {
        logsArray.push(`GPS EXIF: Lat ${exifLat}, Lng ${exifLng}`);
      } else {
        logsArray.push("GPS EXIF: No disponible en metadatos de la imagen");
      }

      if (deviceLoc && exifLat !== null && exifLng !== null) {
        // Validación cruzada (ambas fuentes disponibles)
        const distanceMeters = getCoordinatesDistance(deviceLoc.lat, deviceLoc.lng, exifLat, exifLng);
        const match = coordinatesMatch(deviceLoc.lat, deviceLoc.lng, exifLat, exifLng, 100);

        logsArray.push(`Validación cruzada: Distancia de ${distanceMeters.toFixed(1)} metros entre GPS Dispositivo y GPS EXIF.`);

        if (match) {
          validado = true;
          logsArray.push("Resultado: Coincidencia exitosa (dentro del umbral de 100 metros). Coordenadas validadas.");
          
          if (isLiveCapture) {
            finalLat = deviceLoc.lat;
            finalLng = deviceLoc.lng;
            gpsSource = "VALIDACION_CRUZADA_DEVICE_PRIORITY";
            logsArray.push("Criterio: Captura en vivo. Se priorizan coordenadas del GPS del dispositivo.");
          } else {
            finalLat = exifLat;
            finalLng = exifLng;
            gpsSource = "VALIDACION_CRUZADA_EXIF_PRIORITY";
            logsArray.push("Criterio: Carga desde galería. Se priorizan coordenadas EXIF de la fotografía.");
          }
        } else {
          validado = false;
          logsArray.push(`Resultado: Discrepancia detectada (>100 metros). Coordenadas NO validadas.`);

          if (isLiveCapture) {
            finalLat = deviceLoc.lat;
            finalLng = deviceLoc.lng;
            gpsSource = "DISCREPANCIA_DEVICE_PRIORITY";
            logsArray.push("Criterio: Captura en vivo. Se priorizan coordenadas del GPS del dispositivo por encima de EXIF.");
          } else {
            finalLat = exifLat;
            finalLng = exifLng;
            gpsSource = "DISCREPANCIA_EXIF_PRIORITY";
            logsArray.push("Criterio: Carga desde galería. Se priorizan coordenadas EXIF de la fotografía por encima del GPS actual.");
          }
        }
      } else if (deviceLoc) {
        // Solo GPS del navegador/dispositivo
        finalLat = deviceLoc.lat;
        finalLng = deviceLoc.lng;
        gpsSource = "SOLO_DEVICE_GPS";
        // Si es captura en vivo in-situ, se considera validado de fábrica
        validado = isLiveCapture; 
        logsArray.push(`Resultado: Únicamente disponible GPS del dispositivo.`);
        logsArray.push(isLiveCapture
          ? "Criterio: Captura en vivo sin metadatos EXIF (común en iOS). Coordenadas asignadas automáticamente y marcadas como validadas."
          : "Criterio: Carga de galería sin metadatos EXIF. Coordenadas asignadas desde la ubicación actual del dispositivo."
        );
      } else if (exifLat !== null && exifLng !== null) {
        // Solo GPS EXIF
        finalLat = exifLat;
        finalLng = exifLng;
        gpsSource = "SOLO_EXIF_GPS";
        validado = true;
        logsArray.push("Resultado: Únicamente disponible GPS EXIF.");
        logsArray.push("Criterio: Coordenadas extraídas directamente de los metadatos EXIF de la imagen. Marcado como validado.");
      } else {
        // Ninguno
        finalLat = null;
        finalLng = null;
        gpsSource = "SIN_GEOLOCALIZACION";
        validado = false;
        logsArray.push("Resultado: No se pudo determinar ninguna coordenada automática.");
        logsArray.push("Criterio: Requiere intervención manual del usuario.");
      }

      const diagnosticLogsStr = logsArray.join("\n");

      if (finalLat !== null && finalLng !== null) {
        try {
          await uploadAndAddPhoto(selected, finalLat, finalLng, {
            gpsAccuracy: deviceLoc?.accuracy ?? null,
            gpsTimestamp: deviceLoc?.timestamp ?? null,
            gpsSource,
            exifLat,
            exifLng,
            gpsLat: deviceLoc?.lat ?? null,
            gpsLng: deviceLoc?.lng ?? null,
            diagnosticLogs: diagnosticLogsStr,
            validado,
          });
        } catch (err) {
          console.error("[CaptureAndAddPhoto] Error subiendo foto:", err);
          setError(err instanceof Error ? err.message : "Error al subir la fotografía.");
          break;
        }
      } else {
        needsManual.push({
          file: selected,
          diagnosticLogs: diagnosticLogsStr,
          exifLat,
          exifLng,
          gpsLat: deviceLoc?.lat ?? null,
          gpsLng: deviceLoc?.lng ?? null,
          gpsAccuracy: deviceLoc?.accuracy ?? null,
          gpsTimestamp: deviceLoc?.timestamp ?? null,
        });
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
    if (project && pending && pending.length > 0 && !pendingProcessed.current) {
      pendingProcessed.current = true;
      const filesToProcess = [...pending];
      delete (window as any).pendingProjectPhotos;
      
      setTimeout(() => {
        processFiles(filesToProcess, false);
      }, 500);
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

    const currentItem = manualQueue[0];
    const userDiagnosticLogs = `${currentItem.diagnosticLogs}\n\n[${new Date().toISOString()}] REGISTRO MANUAL DE COORDENADAS:\n- Coordenadas manuales ingresadas: Lat ${latNum}, Lng ${lngNum}.\n- Motivo de la carga manual: El sistema requirió la intervención manual del operador.`;

    try {
      await uploadAndAddPhoto(currentItem.file, latNum, lngNum, {
        gpsAccuracy: currentItem.gpsAccuracy,
        gpsTimestamp: currentItem.gpsTimestamp,
        gpsSource: "MANUAL",
        exifLat: currentItem.exifLat,
        exifLng: currentItem.exifLng,
        gpsLat: currentItem.gpsLat,
        gpsLng: currentItem.gpsLng,
        diagnosticLogs: userDiagnosticLogs,
        validado: true,
      });
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

  const handleEvidenciaComplementaria = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingEvidencia(true);
    setError(null);
    try {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await uploadDocument(file, "PENDIENTE DE CONTEXTUALIZAR EN GABINETE");
      }
      alert("Evidencia in-situ capturada.\nRecuerde contextualizarla en la pestaña de Evidencias Adicionales (Gabinete).");
    } catch (err: any) {
      setError(err.message || "Error al subir evidencia complementaria.");
    } finally {
      setIsUploadingEvidencia(false);
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
          <p className="text-lg text-slate-200 font-semibold tracking-tight flex items-center justify-center gap-2">
            Procesando imagen... <ElapsedTime running={isFetchingGPS} />
          </p>
            <p className="text-sm text-slate-400 mt-1">Comprimiendo y extrayendo GPS</p>
          </div>
        </div>
      )}
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-100">
          Evidencia Fotográfica
        </h3>
        <p className="text-sm text-slate-400">
          Tome las fotos con la cámara de su teléfono y súbalas aquí. El sistema extraerá el GPS de las fotografías o de su ubicación actual. (En iOS/iPhone, recuerde dar permisos de Ubicación a Safari).
        </p>
      </header>

      {/* MODAL / SECCIÓN DE INGRESO MANUAL */}
      {manualQueue.length > 0 && (
        <div className="mt-4 p-4 border border-sky-500 bg-slate-800 rounded-lg space-y-3">
          <p className="text-sm text-sky-300 font-semibold">
            Acción Requerida: Ubicación Manual ({manualQueue.length} pendiente(s))
          </p>
          <p className="text-xs text-slate-400">
            La imagen &quot;{manualQueue[0].file.name}&quot; no tiene GPS. Ingrese la latitud y longitud.
          </p>
          <div className="flex flex-col gap-3">
            <input type="number" placeholder="Latitud (ej. 21.8853)" value={manualCoords.lat} onChange={(e) => setManualCoords({ ...manualCoords, lat: e.target.value })} className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm" />
            <input type="number" placeholder="Longitud (ej. -102.2916)" value={manualCoords.lng} onChange={(e) => setManualCoords({ ...manualCoords, lng: e.target.value })} className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm" />
          </div>
          <div className="flex flex-col gap-3 mt-2">
          <button 
            onClick={async () => {
              setError("Buscando señal GPS...");
              try {
                const loc = await getFallbackLocation();
                setManualCoords({ lat: loc.lat.toString(), lng: loc.lng.toString() });
                setError(null);
              } catch (err: any) {
                setError(err.message);
              }
            }}
            className="w-full bg-emerald-600 text-white py-2 rounded text-sm font-semibold transition"
          >
            📍 Obtener Mi Ubicación Actual
          </button>
          <div className="flex gap-3">
            <button onClick={handleManualSubmit} className="flex-1 bg-sky-600 text-white py-2 rounded text-sm font-semibold">Guardar y Subir</button>
            <button onClick={() => { setManualQueue([]); setError(null); setManualCoords({ lat: "", lng: "" }); }} className="flex-1 bg-slate-700 text-white py-2 rounded text-sm font-semibold">Cancelar</button>
          </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <label
          className={`w-full text-center rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 px-3 py-3 text-base font-semibold hover:bg-emerald-800/50 shadow-md transition-colors cursor-pointer ${!isProjectReady ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          📷 Tomar Foto In-Situ (Cámara)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handlePhotoUpload(e, true)}
          />
        </label>

        <label
          className={`w-full text-center rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 px-3 py-3 text-base font-semibold hover:bg-sky-800/50 shadow-md transition-colors cursor-pointer ${!isProjectReady ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          📸 Seleccionar fotos del Carrete / Galería
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handlePhotoUpload(e, false)}
          />
        </label>
      </div>

      {/* FASE: EVIDENCIA COMPLEMENTARIA IN-SITU */}
      <div className="mt-8 border-t border-slate-700 pt-6 space-y-4">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-100">
            Evidencia Complementaria (In-situ)
          </h3>
          <p className="text-sm text-slate-400">
            Tome fotografías adicionales en calidad de evidencias (fuera de la geometría del perfil). Podrá contextualizarlas y auditarlas con IA posteriormente en el trabajo de Gabinete.
          </p>
        </header>
        <div className="flex flex-col gap-4">
          <label
            className={`w-full text-center rounded-lg border border-purple-600 bg-purple-900/30 text-purple-100 px-3 py-3 text-base font-semibold hover:bg-purple-800/50 shadow-md transition-colors cursor-pointer ${!isProjectReady || isUploadingEvidencia ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            {isUploadingEvidencia ? "Guardando Evidencia..." : "📸 Capturar Evidencia (Cámara)"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleEvidenciaComplementaria}
            />
          </label>
          <label
            className={`w-full text-center rounded-lg border border-indigo-600 bg-indigo-900/30 text-indigo-100 px-3 py-3 text-base font-semibold hover:bg-indigo-800/50 shadow-md transition-colors cursor-pointer ${!isProjectReady || isUploadingEvidencia ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            🖼️ Subir Evidencia (Galería)
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleEvidenciaComplementaria}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  </>
  );
}
