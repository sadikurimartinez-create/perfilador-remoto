"use client";

import React, { useState, useCallback } from "react";
import { buildStreetViewUrl } from "@/lib/googleStreetView";
import {
  GeoIntSweepCategory,
  GeoIntSweepFindingPayload,
  GEOINT_SWEEP_CATEGORIES,
  GeointGovernanceStatus,
} from "@/types/geointSweep";
import { calculateHaversineDistanceMeters } from "@/utils/geoResolver";
import { logGeointEvent } from "@/services/geoint/logGeointEvent";
import { buildGeointTraceabilityId } from "@/types/geointGovernance";

interface GeointControlledSweepEngineProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  projectId?: string;
  analystName?: string;
  onClose: () => void;
  onFindingsGenerated?: (findings: GeoIntSweepFindingPayload[]) => void;
}

export type SweepType = "MULTICAPA" | "RADIAL" | "CORREDOR";

/**
 * ADR-018 v1.0 — GEOINT Controlled Sweep Engine
 * Motor orquestador único y gobernado para la ejecución de barridos GEOINT / Street View.
 * Regla Inmutable: Ningún barrido se ejecuta de forma automática.
 */
export function GeointControlledSweepEngine({
  isOpen,
  lat,
  lng,
  projectId = "EXP-2026",
  analystName = "Analista CEIPOL",
  onClose,
  onFindingsGenerated,
}: GeointControlledSweepEngineProps) {
  const [sweepType, setSweepType] = useState<SweepType>("MULTICAPA");
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [selectedCategories, setSelectedCategories] = useState<GeoIntSweepCategory[]>([
    "ACECHO_ESCONDITE",
    "GRAFFITI_PANDILLA",
    "DENUE_POI",
    "OSINT_GENERAL",
  ]);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgressMsg, setSweepMsg] = useState<string>("");

  const handleToggleCategory = (cat: GeoIntSweepCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  /**
   * Acción Explícita del Analista: Disparador único para ejecutar el barrido gobernado.
   */
  const handleExecuteControlledSweep = useCallback(async () => {
    if (selectedCategories.length === 0) {
      alert("⚠️ Seleccione al menos una categoría gobernada para ejecutar el barrido GEOINT.");
      return;
    }

    setIsSweeping(true);
    setSweepMsg("Inicializando motor GEOINT Controlled Sweep...");
    const generatedFindings: GeoIntSweepFindingPayload[] = [];


    // Event Log Forense: Registrar inicio de barrido (ADR-019.18)
    logGeointEvent(
      "GEOINT_SWEEP_STARTED",
      projectId,
      `trace-sweep-start-${Date.now()}`,
      analystName,
      "GeointControlledSweepEngine",
      "INITIATED",
      "SWEEP_SESSION",
      `sweep-${Date.now()}`,
      { lat, lng, radiusMeters, sweepType, selectedCategories }
    );

    try {
      let globalCount = 0;
      const radiusDegreeApprox = (radiusMeters / 1000) * 0.009;

      for (const cat of selectedCategories) {
        const catMeta = GEOINT_SWEEP_CATEGORIES[cat];
        setSweepMsg(`Ejecutando barrido ${sweepType} — Categoría: ${catMeta.label}...`);

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

          // Validación de Integridad Geoespacial ADR-019.15: Haversine distance <= radiusMeters (Max 50m para evidencia directa)
          const distMeters = calculateHaversineDistanceMeters(lat, lng, sweepLat, sweepLng);

          if (distMeters > Math.max(radiusMeters, 50)) {
            console.warn(`[GeointControlledSweepEngine] Punto de muestreo desalineado a ${distMeters.toFixed(1)}m. Omitiendo.`);
            continue;
          }

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
            console.warn("[GeointControlledSweepEngine] Fallback a URL pública:", e);
          }

          const panoramaKey = `${sweepLat.toFixed(5)},${sweepLng.toFixed(5)},${sweepHeading}`;
          if (generatedFindings.some((f) => (f.metadata as any)?.panoramaKey === panoramaKey)) {
            console.info(`[GeointControlledSweepEngine] Punto ${panoramaKey} duplicado. Omitiendo.`);
            continue;
          }

          const findingId = `geoint-finding-${Date.now()}-${globalCount + 1}`;
          const traceabilityId = buildGeointTraceabilityId("trace-adr018", [
            projectId,
            findingId,
            panoramaKey,
          ]);

          // Estructura de Datos Obligatoria ADR-018 v1.0 / ADR-019.15
          const payload: GeoIntSweepFindingPayload = {
            source: "GEOINT_CONTROLLED_SWEEP",
            category: cat,
            status: GeointGovernanceStatus.PENDING_REVIEW,
            traceabilityId,
            sourceEvidenceId: findingId,
            createdBy: analystName,
            originalFindingId: findingId,
            geometry: {
              lat: sweepLat,
              lng: sweepLng,
              heading: sweepHeading,
              pitch: sweepPitch,
              fov: sweepFov,
            },
            file_url: dataUrl,
            comentario: `[BARRIDO GEOINT CONTROLADO - ${catMeta.label}] Muestreo espacial periférico R=${radiusMeters}m (${distMeters.toFixed(1)}m del centro).`,
            timestamp: new Date().toISOString(),
            metadata: {
              sweepType,
              radiusMeters,
              panoramaLat: sweepLat,
              panoramaLng: sweepLng,
              panoramaKey,
              distanceMeters: distMeters,
            },
          };

          generatedFindings.push(payload);
          globalCount++;
        }
      }

      if (generatedFindings.length > 0) {
        if (onFindingsGenerated) {
          onFindingsGenerated(generatedFindings);
        }
        onClose();
      } else {
        alert("⚠️ No se pudieron generar capturas de barrido GEOINT para el perímetro seleccionado.");
      }
    } catch (err: any) {
      alert("Error durante la ejecución del motor GEOINT Sweep: " + err.message);
    } finally {
      setIsSweeping(false);
      setSweepMsg("");
    }
  }, [lat, lng, selectedCategories, sweepType, radiusMeters, analystName, onFindingsGenerated, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 space-y-5">
        
        {/* Encabezado del Motor */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-xl">
              🛰️
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                GEOINT Controlled Sweep Engine
                <span className="px-2 py-0.5 text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded-full font-mono">
                  ADR-018 v1.0
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Motor Orquestador de Barridos Geoespaciales Gobernados CEIPOL
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
          
          {/* Modalidad de Barrido */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">Modalidad de Barrido Táctico:</label>
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
              <span>Radio Periférico Gobernado:</span>
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

          {/* Selección de Categorías Gobernadas (ADR-018) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">Categorías Gobernadas de Inteligencia (ADR-018):</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              {(Object.keys(GEOINT_SWEEP_CATEGORIES) as GeoIntSweepCategory[]).map((cat) => {
                const meta = GEOINT_SWEEP_CATEGORIES[cat];
                const isSelected = selectedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] cursor-pointer select-none transition ${
                      isSelected
                        ? "bg-slate-900 border-cyan-500/80 text-slate-100"
                        : "bg-slate-950/50 border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCategory(cat)}
                      className="mt-0.5 rounded accent-cyan-500 h-3.5 w-3.5 bg-slate-950 border-slate-800"
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1" style={{ color: meta.color }}>
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Telemetría de POI */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-400 flex justify-between">
            <span>Coordenadas POI: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
            <span>Analista Solicitante: <strong className="text-slate-200">{analystName}</strong></span>
          </div>
        </div>

        {/* Overlay de Progreso */}
        {isSweeping && (
          <div className="p-4 bg-slate-950/90 border border-cyan-900 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent" />
            <span className="text-xs font-mono font-bold text-cyan-300">{sweepProgressMsg}</span>
          </div>
        )}

        {/* Acciones del Analista */}
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
            disabled={isSweeping || selectedCategories.length === 0}
            onClick={handleExecuteControlledSweep}
            className={`w-2/3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition border shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              isSweeping || selectedCategories.length === 0
                ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-500 text-slate-950 border-cyan-400/40 shadow-cyan-950/50"
            }`}
          >
            🚀 Ejecutar Barrido GEOINT
          </button>
        </div>

      </div>
    </div>
  );
}

export default GeointControlledSweepEngine;
