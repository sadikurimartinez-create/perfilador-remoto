"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { buildStreetViewUrl } from "@/lib/googleStreetView";
import { StreetViewCapturePayload } from "./streetViewMapper";

interface StreetViewPanoramaPickerProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  onClose: () => void;
  onCapture: (payload: StreetViewCapturePayload) => void;
  onCaptureMultiple?: (payloads: StreetViewCapturePayload[]) => void;
  analystName?: string;
}

export function StreetViewPanoramaPicker({
  isOpen,
  lat,
  lng,
  onClose,
  onCapture,
  onCaptureMultiple,
  analystName = "Analista CEIPOL",
}: StreetViewPanoramaPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);

  const [heading, setHeading] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [fov, setFov] = useState<number>(90);
  const [panoId, setPanoId] = useState<string>("");
  const [captureDate, setCaptureDate] = useState<string>("");
  const [panoLat, setPanoLat] = useState<number>(lat);
  const [panoLng, setPanoLng] = useState<number>(lng);
  
  const [category, setCategory] = useState<string>("vulnerabilidad_fisica");
  const [comentario, setComentario] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [noImagery, setNoImagery] = useState<boolean>(false);

  // NUEVO: Estados para Barrido Asistido Multicapa (Fase 1)
  const [selectedSweepCategories, setSelectedSweepCategories] = useState<string[]>([
    "RUTA_ACCESO", "RUTA_ESCAPE", "PUNTO_ACECHO", "GRAFITI"
  ]);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepMsg] = useState<string>("");

  // Inicialización del visor StreetViewPanorama interactivo
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    if (typeof window === "undefined" || !window.google || !window.google.maps) {
      console.warn("[StreetViewPanoramaPicker] Google Maps JS API no disponible.");
      return;
    }

    setNoImagery(false);

    try {
      const panorama = new window.google.maps.StreetViewPanorama(containerRef.current, {
        position: { lat, lng },
        pov: { heading: 0, pitch: 0 },
        zoom: 1,
        enableCloseButton: false,
        addressControl: true,
        showRoadLabels: true,
        motionTracking: false,
        motionTrackingControl: false,
      });

      panoramaRef.current = panorama;

      // Event Listeners
      const povListener = panorama.addListener("pov_changed", () => {
        const povData = panorama.getPov();
        setHeading(Math.round(povData.heading));
        setPitch(Math.round(povData.pitch));
      });

      const zoomListener = panorama.addListener("zoom_changed", () => {
        const currentZoom = panorama.getZoom();
        setZoom(currentZoom);
        // Aproximación de FOV según nivel de Zoom de Google Street View (Zoom 0~1 = 90°, Zoom 2 = 45°, Zoom 3+ = 22.5°)
        const calculatedFov = Math.round(180 / Math.pow(2, currentZoom));
        setFov(Math.max(10, Math.min(100, calculatedFov)));
      });

      const posListener = panorama.addListener("position_changed", () => {
        const pos = panorama.getPosition();
        if (pos) {
          setPanoLat(pos.lat());
          setPanoLng(pos.lng());
        }
      });

      const panoListener = panorama.addListener("pano_changed", () => {
        const pId = panorama.getPano();
        setPanoId(pId || "");
      });

      const statusListener = panorama.addListener("status_changed", () => {
        const status = panorama.getStatus();
        if (status !== window.google.maps.StreetViewStatus.OK) {
          setNoImagery(true);
        } else {
          setNoImagery(false);
        }
      });

      // Intentar obtener fecha de cobertura de Google
      try {
        const svService = new window.google.maps.StreetViewService();
        svService.getPanorama({ location: { lat, lng }, radius: 50 }, (data, status) => {
          if (status === window.google.maps.StreetViewStatus.OK && data && data.imageDate) {
            setCaptureDate(data.imageDate);
          } else {
            setCaptureDate("N/D");
          }
        });
      } catch (err) {
        setCaptureDate("N/D");
      }

      return () => {
        if (povListener) window.google.maps.event.removeListener(povListener);
        if (zoomListener) window.google.maps.event.removeListener(zoomListener);
        if (posListener) window.google.maps.event.removeListener(posListener);
        if (panoListener) window.google.maps.event.removeListener(panoListener);
        if (statusListener) window.google.maps.event.removeListener(statusListener);
      };
    } catch (err) {
      console.error("[StreetViewPanoramaPicker] Error al crear StreetViewPanorama:", err);
      setNoImagery(true);
    }
  }, [isOpen, lat, lng]);

  const handleFreezeCapture = useCallback(async () => {
    setIsCapturing(true);
    try {
      // Generar URL congelada estática de alta resolución con los metadatos exactos de POV seleccionados por el analista
      const staticUrl = buildStreetViewUrl(panoLat || lat, panoLng || lng, {
        size: "800x600",
        heading,
        pitch,
        fov,
      });

      if (!staticUrl) {
        throw new Error("No se pudo generar la clave de API para la captura estática de Street View.");
      }

      // Descargar congelado estático para almacenamiento permanente
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(staticUrl)}`;
      let dataUrl = staticUrl;

      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("[StreetViewPanoramaPicker] Fallback a URL estática por directo:", e);
      }

      const payload: StreetViewCapturePayload = {
        dataUrl,
        poiLat: lat,
        poiLng: lng,
        panoramaLat: panoLat || lat,
        panoramaLng: panoLng || lng,
        heading,
        pitch,
        fov,
        panoId,
        captureDate: captureDate !== "N/D" ? captureDate : undefined,
        category,
        comentario: comentario.trim() || undefined,
        analystName,
        tipo_origen: "STREETVIEW_MANUAL",
        estado_revision: "APROBADO" // Capturas manuales se consideran aprobadas de inmediato
      };

      onCapture(payload);
    } catch (err: any) {
      alert("Error al congelar la evidencia de Street View: " + err.message);
    } finally {
      setIsCapturing(false);
    }
  }, [panoLat, panoLng, lat, lng, heading, pitch, fov, panoId, captureDate, category, comentario, analystName, onCapture]);

  // NUEVO: Implementación de la Lógica de Barrido Asistido Multicapa (Fase 1)
  const handleRunBarridoAsistido = useCallback(async () => {
    if (selectedSweepCategories.length === 0) {
      alert("⚠️ Seleccione al menos una categoría de exploración visual para el barrido asistido.");
      return;
    }

    setIsSweeping(true);
    setSweepMsg("Iniciando barrido asistido...");
    const payloads: StreetViewCapturePayload[] = [];

    try {
      let globalCount = 0;
      for (const cat of selectedSweepCategories) {
        setSweepMsg(`Explorando entorno para categoría: ${cat}...`);
        
        // Generar hasta 3 imágenes por categoría
        for (let i = 0; i < 3; i++) {
          if (globalCount >= 12) break; // Límite máximo global

          // Determinación determinista de coordenadas alrededor del centro (fórmula geoespacial simple)
          const angle = (i * 2 * Math.PI) / 3 + (cat.charCodeAt(0) % 10);
          const r = 0.0003 * (i + 1); // Radio creciente (aprox 30m, 60m, 90m)
          const offsetLat = r * Math.sin(angle);
          const offsetLng = r * Math.cos(angle);
          const sweepLat = lat + offsetLat;
          const sweepLng = lng + offsetLng;

          const sweepHeading = (i * 120 + 45) % 360;
          const sweepPitch = 10.0;
          const sweepFov = 90.0;

          const staticUrl = buildStreetViewUrl(sweepLat, sweepLng, {
            size: "800x600",
            heading: sweepHeading,
            pitch: sweepPitch,
            fov: sweepFov,
          });

          if (!staticUrl) continue;

          // Convertir a Data URL usando proxy
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(staticUrl)}`;
          let dataUrl = staticUrl;

          try {
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn("[StreetViewPanoramaPicker] Proxy fallback para barrido:", e);
          }

          const payload: StreetViewCapturePayload = {
            dataUrl,
            poiLat: lat,
            poiLng: lng,
            panoramaLat: sweepLat,
            panoramaLng: sweepLng,
            heading: sweepHeading,
            pitch: sweepPitch,
            fov: sweepFov,
            category: cat,
            comentario: `[BARRIDO ASISTIDO - ${cat}] Punto de interés periférico ${i + 1}. Evaluación de entorno y factores situacionales.`,
            analystName,
            tipo_origen: "STREETVIEW_AUTOMATICO",
            estado_revision: "PENDIENTE_REVISION"
          };

          payloads.push(payload);
          globalCount++;
        }
      }

      if (onCaptureMultiple) {
        onCaptureMultiple(payloads);
      } else {
        // Fallback si no está implementado el receptor múltiple
        for (const p of payloads) {
          onCapture(p);
        }
      }
    } catch (err: any) {
      alert("Error durante la ejecución del barrido asistido: " + err.message);
    } finally {
      setIsSweeping(false);
      setSweepMsg("");
    }
  }, [lat, lng, selectedSweepCategories, analystName, onCapture, onCaptureMultiple]);

  const handleToggleCategory = (cat: string) => {
    setSelectedSweepCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 md:p-6 font-sans animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden relative text-slate-100">
        
        {/* Header Táctico */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-lg">
              🎥
            </span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                Visor Interactivo 360° — Evidencia Digital de Gabinete
                <span className="px-2 py-0.5 text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded-full font-mono">
                  v2.2
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                POI GPS: {lat.toFixed(5)}, {lng.toFixed(5)} | Proveedor: Google Street View
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition text-base cursor-pointer"
            title="Cerrar visor"
          >
            ✖
          </button>
        </div>

        {/* Body Principal - Grid de Visor + Panel de Controles */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-950">
          
          {/* Contenedor del Panorama 360° */}
          <div className="lg:col-span-8 h-full relative bg-slate-950 border-r border-slate-800/80 flex flex-col">
            {noImagery ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950/90 text-amber-400 space-y-3">
                <span className="text-4xl">⚠️</span>
                <h4 className="text-sm font-black uppercase">Panorámica No Disponible</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Google Street View no cuenta con cobertura de vehículo o peatonal en el radio cercano a este punto exacto.
                </p>
              </div>
            ) : (
              <div ref={containerRef} className="w-full h-full min-h-[350px]" />
            )}

            {/* Floating Live Telemetry Badge sobre el Visor */}
            <div className="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl shadow-xl flex gap-3 text-[10px] font-mono text-slate-300">
              <div><span className="text-slate-500 font-bold">HDG:</span> <span className="text-cyan-400 font-bold">{heading}°</span></div>
              <div><span className="text-slate-500 font-bold">PITCH:</span> <span className="text-cyan-400 font-bold">{pitch}°</span></div>
              <div><span className="text-slate-500 font-bold">FOV:</span> <span className="text-cyan-400 font-bold">{zoom > 1 ? zoom : "N/D"}</span></div>
              <div><span className="text-slate-500 font-bold">COBER:</span> <span className="text-emerald-400 font-bold">{captureDate || "N/D"}</span></div>
            </div>

            {/* Floating Sweep Progress overlay */}
            {isSweeping && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-25 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
                <p className="text-sm font-black text-cyan-400 uppercase tracking-widest animate-pulse font-mono">
                  {sweepProgress}
                </p>
              </div>
            )}
          </div>

          {/* Panel Lateral de Calificación & Controles */}
          <div className="lg:col-span-4 p-5 bg-slate-900 flex flex-col justify-between overflow-y-auto space-y-4 font-sans border-t lg:border-t-0 border-slate-800">
            <div className="space-y-4">
              <div className="text-[10px] font-black tracking-wider text-slate-400 uppercase border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                <span>🎯</span> METADATOS Y CALIFICACIÓN TÁCTICA
              </div>

              {/* Categoría Táctica */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Categoría de Vulnerabilidad / Entorno:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                >
                  <option value="vulnerabilidad_fisica">Vulnerabilidad Física / Entorno Vial</option>
                  <option value="alumbrado_publico">Alumbrado Público Deficiente</option>
                  <option value="cerramientos_deficientes">Cerramientos / Bardas Deficientes</option>
                  <option value="predios_abandonados">Predios Abandonados / Lotes Baldíos</option>
                  <option value="hideout">Punto de Ocultamiento / Escondite</option>
                  <option value="graffiti">Grafiti Territorial / Marcas</option>
                  <option value="denue_interest">Punto de Interés Comercial DENUE</option>
                  <option value="other">Otro Factor de Entorno</option>
                </select>
              </div>

              {/* Observación o Comentario Analítico */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Observación Analítica de Gabinete:
                </label>
                <textarea
                  rows={2}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Describa el hallazgo visual observado en la orientación seleccionada..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* NUEVO: Panel de Barrido Asistido Multicapa */}
              <div className="border border-slate-800 bg-slate-950/50 p-3.5 rounded-xl space-y-2.5">
                <div className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                  <span>⚡ BARRIDO ASISTIDO MULTICAPA</span>
                  <span className="text-[8px] bg-cyan-950 border border-cyan-800 text-cyan-300 px-1.5 py-0.5 rounded">
                    Max 12 imgs
                  </span>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-normal">
                  Genera automáticamente un barrido periférico radial de Street View para las capas seleccionadas:
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {["RUTA_ACCESO", "RUTA_ESCAPE", "PUNTO_ACECHO", "GRAFITI"].map(catName => (
                    <label key={catName} className="flex items-center gap-2 text-[10px] font-bold text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedSweepCategories.includes(catName)}
                        onChange={() => handleToggleCategory(catName)}
                        className="rounded accent-cyan-500 h-3.5 w-3.5 bg-slate-950 border-slate-800"
                      />
                      <span>{catName.replace("_", " ")}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRunBarridoAsistido}
                  disabled={isSweeping || selectedSweepCategories.length === 0}
                  className={`w-full mt-2.5 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition border flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSweeping || selectedSweepCategories.length === 0
                      ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                      : "bg-cyan-650 hover:bg-cyan-600 text-slate-100 border-cyan-500/30"
                  }`}
                >
                  📡 Ejecutar Barrido Asistido
                </button>
              </div>

              {/* Telemetría Físico-Criminológica */}
              <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl space-y-1.5 text-[10px] font-mono text-slate-400">
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>Coordenada POI:</span>
                  <span className="text-slate-200">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>Coordenada Cám. Google:</span>
                  <span className="text-slate-200">{panoLat.toFixed(5)}, {panoLng.toFixed(5)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>Orientación (Heading):</span>
                  <span className="text-cyan-400 font-bold">{heading}°</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1">
                  <span>Inclinación (Pitch):</span>
                  <span className="text-cyan-400 font-bold">{pitch}°</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha Cobertura Google:</span>
                  <span className="text-emerald-400 font-bold">{captureDate || "N/D"}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                disabled={isCapturing || noImagery}
                onClick={handleFreezeCapture}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-xl border flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                  noImagery
                    ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-400/40 shadow-emerald-950/50"
                }`}
              >
                {isCapturing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Congelando Evidencia...</span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span>Capturar Esta Vista (POV)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition rounded-lg hover:bg-slate-800/40 cursor-pointer"
              >
                Cancelar y Salir
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default StreetViewPanoramaPicker;
