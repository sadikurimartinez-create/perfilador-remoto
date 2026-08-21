"use client";

import React, { useState, useCallback } from "react";
import { buildStreetViewUrl } from "@/lib/googleStreetView";
import { StreetViewCapturePayload } from "./streetViewMapper";

interface StreetViewSweepManagerProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  onClose: () => void;
  onCaptureMultiple: (payloads: StreetViewCapturePayload[]) => void;
  analystName?: string;
}

export type SweepType = "RADIAL" | "CORREDOR" | "MULTICAPA";

export function StreetViewSweepManager({
  isOpen,
  lat,
  lng,
  onClose,
  onCaptureMultiple,
  analystName = "Analista CEIPOL",
}: StreetViewSweepManagerProps) {
  const [sweepType, setSweepType] = useState<SweepType>("MULTICAPA");
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [selectedSweepCategories, setSelectedSweepCategories] = useState<string[]>([
    "RUTA_ACCESO",
    "RUTA_ESCAPE",
    "PUNTO_ACECHO",
    "GRAFITI",
  ]);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepMsg, setSweepMsg] = useState<string>("");

  const handleToggleCategory = (cat: string) => {
    setSelectedSweepCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleRunSweep = useCallback(async () => {
    if (selectedSweepCategories.length === 0) {
      alert("⚠️ Seleccione al menos una categoría táctica para ejecutar el barrido.");
      return;
    }

    setIsSweeping(true);
    setSweepMsg("Iniciando motor de barrido analítico...");
    const payloads: StreetViewCapturePayload[] = [];

    try {
      let globalCount = 0;
      const radiusDegreeApprox = (radiusMeters / 1000) * 0.009;

      for (const cat of selectedSweepCategories) {
        setSweepMsg(`Ejecutando barrido ${sweepType} — Categoría: ${cat}...`);

        const imagesPerCategory = sweepType === "RADIAL" ? 4 : sweepType === "CORREDOR" ? 2 : 3;

        for (let i = 0; i < imagesPerCategory; i++) {
          if (globalCount >= 16) break;

          let offsetLat = 0;
          let offsetLng = 0;
          let sweepHeading = 0;

          if (sweepType === "CORREDOR") {
            const distanceRatio = (i + 1) / imagesPerCategory;
            offsetLat = radiusDegreeApprox * distanceRatio * (i % 2 === 0 ? 1 : -1);
            offsetLng = radiusDegreeApprox * 0.2 * (i % 2 === 0 ? 1 : -1);
            sweepHeading = i % 2 === 0 ? 0 : 180;
          } else {
            const angle = (i * 2 * Math.PI) / imagesPerCategory + (cat.charCodeAt(0) % 5);
            const r = radiusDegreeApprox * (0.3 + 0.3 * i);
            offsetLat = r * Math.sin(angle);
            offsetLng = r * Math.cos(angle);
            sweepHeading = (i * 120 + 45) % 360;
          }

          const sweepLat = lat + offsetLat;
          const sweepLng = lng + offsetLng;
          const sweepPitch = 5.0;
          const sweepFov = 90.0;

          const staticUrl = buildStreetViewUrl(sweepLat, sweepLng, {
            size: "800x600",
            heading: sweepHeading,
            pitch: sweepPitch,
            fov: sweepFov,
          });

          if (!staticUrl) continue;

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
            console.warn("[StreetViewSweepManager] Fallback a URL pública:", e);
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
            comentario: `[BARRIDO ANALÍTICO ${sweepType} - ${cat}] Muestreo geoespacial periférico R=${radiusMeters}m (Punto ${i + 1}).`,
            analystName,
            tipo_origen: "STREETVIEW_AUTOMATICO",
            estado_revision: "PENDIENTE_REVISION",
          };

          payloads.push(payload);
          globalCount++;
        }
      }

      if (payloads.length > 0) {
        onCaptureMultiple(payloads);
        onClose();
      } else {
        alert("⚠️ No se pudieron generar capturas de barrido para el área seleccionada.");
      }
    } catch (err: any) {
      alert("Error durante la ejecución del barrido analítico: " + err.message);
    } finally {
      setIsSweeping(false);
      setSweepMsg("");
    }
  }, [lat, lng, selectedSweepCategories, sweepType, radiusMeters, analystName, onCaptureMultiple, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 space-y-5">
        
        {/* Encabezado del Módulo */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-xl">
              📡
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                StreetView Sweep Manager
                <span className="px-2 py-0.5 text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded-full font-mono">
                  v2.5.0
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Ordenamiento y Ejecución de Barridos Analíticos Periféricos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition text-base cursor-pointer"
          >
            ✖
          </button>
        </div>

        {/* Formulario de Configuración de Barrido */}
        <div className="space-y-4 text-xs">
          
          {/* Tipo de Barrido */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">Tipo de Barrido Analítico:</label>
            <div className="grid grid-cols-3 gap-2">
              {(["MULTICAPA", "RADIAL", "CORREDOR"] as SweepType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSweepType(type)}
                  className={`py-2 px-3 rounded-xl border text-[11px] font-bold tracking-wider transition ${
                    sweepType === type
                      ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Radio de Exploración */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Radio Periférico de Exploración:</span>
              <span className="text-cyan-400 font-mono">{radiusMeters} metros</span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="25"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-950 cursor-pointer"
            />
          </div>

          {/* Selección de Capas Tácticas */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">Capas de Exploración Táctica:</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {["RUTA_ACCESO", "RUTA_ESCAPE", "PUNTO_ACECHO", "GRAFITI", "PREDIOS_BALDIOS", "VULNERABILIDAD_VIAL"].map((cat) => (
                <label key={cat} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedSweepCategories.includes(cat)}
                    onChange={() => handleToggleCategory(cat)}
                    className="rounded accent-cyan-500 h-3.5 w-3.5 bg-slate-950 border-slate-800"
                  />
                  <span>{cat.replace("_", " ")}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Telemetría de POI */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-400 flex justify-between">
            <span>POI Central: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
            <span>Analista: <strong className="text-slate-200">{analystName}</strong></span>
          </div>
        </div>

        {/* Overlay de Progreso de Barrido */}
        {isSweeping && (
          <div className="p-4 bg-slate-950/90 border border-cyan-900 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent" />
            <span className="text-xs font-mono font-bold text-cyan-300">{sweepMsg}</span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSweeping || selectedSweepCategories.length === 0}
            onClick={handleRunSweep}
            className={`w-2/3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition border shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              isSweeping || selectedSweepCategories.length === 0
                ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-500 text-slate-950 border-cyan-400/40 shadow-cyan-950/50"
            }`}
          >
            🚀 Ordenar y Ejecutar Barrido
          </button>
        </div>

      </div>
    </div>
  );
}

export default StreetViewSweepManager;
