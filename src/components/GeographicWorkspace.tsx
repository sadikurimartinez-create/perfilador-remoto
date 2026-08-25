"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { ProfessionalGeoMap } from "./maps/ProfessionalGeoMap";
import { StreetViewFindingsPanel, StreetViewFinding } from "./streetview/StreetViewFindingsPanel";
import { StreetViewEvidenceRibbon } from "./streetview/StreetViewEvidenceRibbon";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { AnalyticsFilterProvider } from "./analytics/AnalyticsFilterContext";
import { GeointControlledSweepEngine } from "@/modules/geoint/GeointControlledSweepEngine";
import { GeointTemporalComparativeEngine } from "@/modules/geoint/GeointTemporalComparativeEngine";
import { useProject } from "@/context/ProjectContext";
import { executeAutomaticGeointSweep } from "@/services/geoint/geointSweepService";

// ADR-019.15: Geografía Rectora reactiva basada exclusivamente en datos reales del expediente o fotos in situ.
const INITIAL_SV_AUTOMATIC: any[] = [];

export function GeographicWorkspace() {
  const { project, album } = useProject();
  const expedienteId = project?.id || "EXP-2026";

  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const [selectedSv, setSelectedSv] = useState<any | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);

  const [captures, setCaptures] = useState<any[]>(INITIAL_SV_AUTOMATIC);
  const [findings, setFindings] = useState<StreetViewFinding[]>([]);

  // Estados de control modal para motores GEOINT ADR-018 y ADR-019
  const [isSweepEngineOpen, setIsSweepEngineOpen] = useState(false);
  const [isTemporalEngineOpen, setIsTemporalEngineOpen] = useState(false);
  const [activeTemporalCandidate, setActiveTemporalCandidate] = useState<any | null>(null);

  // Extraer fotografías georreferenciadas reales del álbum del expediente
  const georeferencedPhotos = React.useMemo(() => {
    if (album && Array.isArray(album) && album.length > 0) {
      const filtered = album.filter((p: any) => {
        if (p.lat == null || p.lng == null) return false;
        const isDefaultFallback =
          Math.abs(Number(p.lat) - 21.8853) < 0.0001 &&
          Math.abs(Number(p.lng) - (-102.2916)) < 0.0001;
        return !isDefaultFallback;
      });
      if (filtered.length > 0) return filtered;
    }
    return [];
  }, [album]);

  // Centro y Geografía Rectora reactiva basada en el expediente, fotos de campo o hallazgos reales (Sección 8)
  const activeGeografiaRectora = React.useMemo(() => {
    if (project?.latitude != null && project?.longitude != null) {
      return {
        center: { lat: Number(project.latitude), lng: Number(project.longitude) },
        hasCoordinates: true,
      };
    }
    if (georeferencedPhotos.length > 0 && georeferencedPhotos[0].lat != null && georeferencedPhotos[0].lng != null) {
      return {
        center: { lat: Number(georeferencedPhotos[0].lat), lng: Number(georeferencedPhotos[0].lng) },
        hasCoordinates: true,
      };
    }
    if (findings.length > 0 && findings[0].coordenadas?.lat != null && findings[0].coordenadas?.lng != null) {
      return {
        center: { lat: Number(findings[0].coordenadas.lat), lng: Number(findings[0].coordenadas.lng) },
        hasCoordinates: true,
      };
    }
    return { center: undefined, hasCoordinates: false };
  }, [project, georeferencedPhotos, findings]);

  // Resolución reactiva de Evidencia Primaria In Situ real (Campo) sin fallbacks estáticos
  const primaryEvidenceCandidate = React.useMemo(() => {
    const rawPhoto = georeferencedPhotos?.[0] || (album && album.length > 0 ? album[0] : null);
    if (!rawPhoto) return undefined;
    const photo: any = rawPhoto;

    const rawLat = photo.lat ?? photo.latitude ?? photo.gpsLat ?? photo.exifLat ?? photo.coordenadas?.lat;
    const rawLng = photo.lng ?? photo.longitude ?? photo.gpsLng ?? photo.exifLng ?? photo.coordenadas?.lng;
    if (rawLat == null || rawLng == null || isNaN(Number(rawLat)) || isNaN(Number(rawLng))) {
      return undefined;
    }

    const url = photo.previewUrl || photo.url || photo.file_url || photo.archivo_url || "";

    return {
      id: photo.id ? `ev-${photo.id}` : `ev-primary-${Date.now()}`,
      code: photo.code || (photo.id ? `EV-${photo.id.toString().slice(-5)}` : "EV-CAMPO-001"),
      title: photo.title || photo.comentario || "Fotografía de Inspección In Situ",
      url: url,
      evidenceClass: "EVIDENCIA_PRIMARIA_CAMPO" as const,
      timestamp: photo.gpsTimestamp
        ? new Date(photo.gpsTimestamp).toISOString().split("T")[0]
        : photo.fechaCreacion
        ? new Date(photo.fechaCreacion).toISOString().split("T")[0]
        : "FECHA_NO_DISPONIBLE",
      lat: Number(rawLat),
      lng: Number(rawLng),
    };
  }, [georeferencedPhotos, album]);

  // Resolución reactiva de Evidencia Contextual Street View real (Panorama) sin fallbacks estáticos
  const contextualEvidenceCandidate = React.useMemo(() => {
    const rawTarget = activeTemporalCandidate || selectedFinding || selectedSv || (captures && captures.length > 0 ? captures[0] : null) || (findings && findings.length > 0 ? findings[0] : null);
    if (!rawTarget) return undefined;
    const target: any = rawTarget;

    const rawLat = target.latitude ?? target.lat ?? target.coordenadas?.lat ?? target.geometry?.lat;
    const rawLng = target.longitude ?? target.lng ?? target.coordenadas?.lng ?? target.geometry?.lng;
    if (rawLat == null || rawLng == null || isNaN(Number(rawLat)) || isNaN(Number(rawLng))) {
      return undefined;
    }

    const heading = target.geolocalizacion?.heading ?? target.heading ?? target.streetViewMetadata?.heading ?? target.geometry?.heading ?? 180;
    const url = target.file_url || target.archivo_url || target.imagen || target.previewUrl || target.imageReference || "";

    return {
      id: target.id ? `sv-${target.id}` : `sv-context-${Date.now()}`,
      code: target.code || (target.id ? `SV-${target.id.toString().slice(-5)}` : "SV-PANORAMA-001"),
      title: target.title || target.descripcion || "Captura Panorámica Street View (Archivo)",
      url: url,
      evidenceClass: "EVIDENCIA_CONTEXTUAL_TEMPORAL" as const,
      panoramaTimestamp: target.fechaCreacion
        ? new Date(target.fechaCreacion).toISOString().split("T")[0]
        : target.validationDate
        ? new Date(target.validationDate).toISOString().split("T")[0]
        : "FECHA_NO_DISPONIBLE",
      lat: Number(rawLat),
      lng: Number(rawLng),
      heading: Number(heading),
    };
  }, [activeTemporalCandidate, selectedFinding, selectedSv, captures, findings]);

  const handleTriggerTemporalComparison = (candidate?: any) => {
    setActiveTemporalCandidate(candidate || null);
    setIsTemporalEngineOpen(true);
  };

  // Sincronizar hallazgos del expediente desde el backend al cargar
  useEffect(() => {
    async function fetchFindings() {
      try {
        console.log(`[AUDIT ADR-019.5 v1.3] Cargando hallazgos para expediente ${expedienteId}...`);
        const res = await fetch(`/api/expedientes/${expedienteId}/streetview/findings`);
        if (res.ok) {
          const data = await res.json();
          const loadedFindings = Array.isArray(data) ? data : (data?.findings || []);
          console.log("[AUDIT ADR-019.5 v1.3] Hallazgos sincronizados desde backend:", loadedFindings.length);
          setFindings(loadedFindings);
        } else {
          console.warn("[AUDIT ADR-019.5 v1.3] Error HTTP al consultar hallazgos:", res.status);
        }
      } catch (err) {
        console.error("[AUDIT ADR-019.5 v1.3] Error cargando hallazgos:", err);
      }
    }
    fetchFindings();
  }, [expedienteId]);

  // ADR-019.9.3: Corrección del latch de ejecución GEOINT diferida
  const sweepScheduledRef = React.useRef(false);
  const sweepStartedRef = React.useRef(false);

  useEffect(() => {
    if (sweepStartedRef.current || sweepScheduledRef.current) return;
    if (!georeferencedPhotos || georeferencedPhotos.length === 0) return;

    sweepScheduledRef.current = true;
    console.log("[ADR-019.9.1] UI expediente lista");

    const timerId = setTimeout(() => {
      sweepStartedRef.current = true;
      console.log("[ADR-019.9.1] Iniciando sweep background");
      console.log("[AUTO SWEEP ADR-019.7] Fotos recibidas:", georeferencedPhotos.length);
      console.log(`[AUTO SWEEP ADR-019.7] Motor iniciado: Ejecutando barrido automático GEOINT/StreetView para expediente ${expedienteId}...`);

      async function runAutoSweep() {
        try {
          console.log("[ADR-019.8.2 DEBUG] Antes de consultar hallazgos existentes");
          const fetchStartTime = Date.now();
          console.log(`[ADR-019.8.3 CLIENT DEBUG] Iniciando fetch a /api/expedientes/${expedienteId}/streetview/findings a las ${new Date().toISOString()}`);

          let checkRes: Response;
          try {
            checkRes = await fetch(`/api/expedientes/${expedienteId}/streetview/findings`);
          } catch (fetchErr: any) {
            console.error(`[ADR-019.8.3 CLIENT DEBUG] Error de red en fetch de hallazgos tras ${Date.now() - fetchStartTime}ms:`, fetchErr);
            throw fetchErr;
          }

          const fetchDuration = Date.now() - fetchStartTime;
          console.log(`[ADR-019.8.3 CLIENT DEBUG] Fetch completado en ${fetchDuration}ms. Status: ${checkRes.status}`);
          console.log("[ADR-019.8.2 DEBUG] Respuesta findings:", checkRes.status);
          let hasRealGeointFindings = false;

          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const existingList = Array.isArray(checkData) ? checkData : (checkData?.findings || []);
            
            hasRealGeointFindings = existingList.some(
              (f: any) =>
                f.analysisSource === "TEMPORAL_COMPARISON_AI" &&
                (f.origenRevision === "BARRIDO_AUTOMATICO" || f.origenRevision === "AUTOMATICO")
            );
          }

          if (hasRealGeointFindings) {
            console.log(`[AUTO SWEEP ADR-019.7] Persistencia confirmada: Hallazgos reales procesados por ADR-019.7 ya existen en Firestore.`);
            console.log("[ADR-019.9.1] Sweep terminado (hallazgos existentes)");
            return;
          }

          console.log("[AUTO SWEEP ADR-019.7] Motor GEOINT real iniciado");
          console.log("[AUTO SWEEP ADR-019.7] Fotografías procesadas:", georeferencedPhotos.length);

          console.log("[ADR-019.8.2 DEBUG] Entrando a geointSweepService");
          const sweepResult = await executeAutomaticGeointSweep(
            georeferencedPhotos as any,
            expedienteId
          );
          console.log(
            "[ADR-019.8.2 DEBUG] Resultado GEOINT:",
            sweepResult.successCount,
            sweepResult.errorCount
          );

          const generatedFindings = sweepResult.findings;
          console.log("[AUTO SWEEP ADR-019.7] Hallazgos persistibles:", generatedFindings.length);

          for (const finding of generatedFindings) {
            const enrichedFinding = { ...finding, analysisSource: "TEMPORAL_COMPARISON_AI" };
            await handleFindingCreated(enrichedFinding);
            console.log("[AUTO SWEEP ADR-019.7] Persistencia confirmada:", finding.id);
          }

          console.log("[ADR-019.9.1] Sweep terminado");
        } catch (err) {
          console.error("[AUTO SWEEP ADR-019.7] Error en barrido automático:", err);
        }
      }

      runAutoSweep();
    }, 1000);

    return () => {
      clearTimeout(timerId);
      if (!sweepStartedRef.current) {
        sweepScheduledRef.current = false;
      }
    };
  }, [georeferencedPhotos, expedienteId]);

  const handlePoiSelect = (poi: any) => {
    setSelectedPoi(poi);
    setSelectedSv(null);
    setSelectedFinding(null);
  };

  const handleStreetViewSelect = (sv: any) => {
    setSelectedSv(sv);
    setSelectedPoi(null);
    setSelectedFinding(null);
  };

  const handleFindingSelect = (finding: any) => {
    setSelectedFinding(finding);
    setSelectedPoi(null);
    setSelectedSv(null);
  };

  const handleCaptureStatusChange = (captureId: string, status: "APROBADO" | "IGNORADO") => {
    setCaptures((prev) =>
      prev.map((c) => {
        const cId = c.id || c.hash_md5 || c.filename;
        if (cId === captureId) {
          return { ...c, estado_revision: status };
        }
        return c;
      })
    );
  };

  const handleFindingCreated = async (newFinding: StreetViewFinding) => {
    try {
      console.log("[AUDIT ADR-019.5 v1.3] Disparando handleFindingCreated con payload:", newFinding);
      const res = await fetch("/api/streetview/findings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newFinding)
      });

      if (!res.ok) {
        throw new Error(`Persistencia fallida: ${res.status}`);
      }

      const responseData = await res.json();
      const savedFinding = responseData.finding || responseData;
      console.log("[AUDIT ADR-019.5 v1.3] Hallazgo guardado con éxito en Firestore:", savedFinding);

      setFindings((prev) => [
        ...prev,
        savedFinding
      ]);
    } catch (err) {
      console.warn("[AUDIT ADR-019.5 v1.3] Error al guardar hallazgo en Firestore:", err);
    }
  };

  console.debug("[GEOINT DEBUG]", {
    albumPhotosCount: album?.length || 0,
    georeferencedPhotosCount: georeferencedPhotos?.length || 0,
    firstGeoreferencedPhoto: georeferencedPhotos?.[0] || null,
    findingsCount: findings?.length || 0,
    firstFindingCoordinates: findings?.[0]?.coordenadas || null,
  });

  return (
    <AnalyticsFilterProvider>
      <div className="flex flex-col min-h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-y-auto">
        {/* Encabezado Operativo GEOINT (Ancho Completo) */}
        <div className="w-full bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase block">Perfilador Remoto SSPE-CEIPOL</span>
              <h1 className="text-base font-black tracking-tight text-white uppercase flex items-center gap-2">
                <span>MAPA</span> Espacio Analítico v1.0 
                <span className="text-xs text-slate-400 font-mono">({expedienteId})</span>
              </h1>
            </div>
          </div>

          {/* Inspección Rápida del Elemento Seleccionado */}
          {(selectedPoi || selectedSv || selectedFinding) && (
            <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-1.5 text-xs shadow-inner">
              {selectedPoi && (
                <span className="text-cyan-400 font-bold">MAPA</span>
              )}
              {selectedSv && (
                <span className="text-amber-400 font-bold">MAPA</span>
              )}
              {selectedFinding && (
                <span className="text-emerald-400 font-bold">OK Hallazgo: {selectedFinding.categoria}</span>
              )}
              <button
                type="button"
                onClick={() => { setSelectedPoi(null); setSelectedSv(null); setSelectedFinding(null); }}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-300 ml-2 cursor-pointer"
              >
                X Limpiar
              </button>
            </div>
          )}

          {/* Barra de Acciones GEOINT Gobernadas */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsSweepEngineOpen(true)}
              className="py-2 px-3.5 bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-900 text-cyan-300 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-cyan-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>LANZAR</span> Barrido GEOINT
            </button>
            <button
              type="button"
              onClick={() => handleTriggerTemporalComparison()}
              className="py-2 px-3.5 bg-amber-950 border border-amber-800/80 hover:bg-amber-900 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-amber-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>RELOJ</span> Comparación IA
            </button>
          </div>
        </div>

        {/* ZONA 1 — MAPA PRINCIPAL (Primero en el DOM, Ancho Completo, min-h-[65vh]) */}
        <div className="w-full min-h-[65vh] h-[65vh] relative bg-slate-950 border-b border-slate-800 shrink-0">
          <ProfessionalGeoMap
            geografiaRectora={activeGeografiaRectora}
            pois={[]}
            photographs={georeferencedPhotos}
            streetViewManual={[]}
            streetViewAutomatic={captures}
            findings={findings}
            onPoiSelect={handlePoiSelect}
            onStreetViewSelect={handleStreetViewSelect}
            onFindingSelect={handleFindingSelect}
            selectedPoiId={selectedPoi?.id}
            selectedSvId={selectedSv?.id || selectedSv?.hash_md5}
            selectedFindingId={selectedFinding?.id}
          />
        </div>

        {/* ZONA 2 — EVIDENCIAS Y Convalidación HUMANA (Horizontal, Debajo del Mapa) */}
        <div className="w-full bg-slate-950 p-5 space-y-5">
          {/* 2.1 Cintilla Inteligente de Evidencias Compatibles (R ≤ 50m) */}
          <StreetViewEvidenceRibbon
            expedienteId={expedienteId}
            findings={findings}
            captures={captures}
            selectedFindingId={selectedFinding?.id}
            onFindingSelect={handleFindingSelect}
            onTriggerTemporalComparison={handleTriggerTemporalComparison}
          />

          {/* 2.2 Consola de Convalidación Humana de Hallazgos */}
          <div className="w-full">
            <StreetViewFindingsPanel
              expedienteId={expedienteId}
              captures={captures}
              onCaptureStatusChange={handleCaptureStatusChange}
              onFindingCreated={handleFindingCreated}
              onTriggerTemporalComparison={handleTriggerTemporalComparison}
            />
          </div>
        </div>

        {/* Modales Gobernados de Motores GEOINT (ADR-018 y ADR-019) */}
        {isSweepEngineOpen && (
          <GeointControlledSweepEngine
            isOpen={isSweepEngineOpen}
            lat={primaryEvidenceCandidate?.lat ?? activeGeografiaRectora.center?.lat ?? 0}
            lng={primaryEvidenceCandidate?.lng ?? activeGeografiaRectora.center?.lng ?? 0}
            onClose={() => setIsSweepEngineOpen(false)}
            onFindingsGenerated={(newCaptures) => {
              setCaptures((prev) => [...prev, ...newCaptures]);
            }}
          />
        )}

        {isTemporalEngineOpen && (
          <GeointTemporalComparativeEngine
            isOpen={isTemporalEngineOpen}
            projectId={expedienteId}
            primaryEvidenceCandidate={primaryEvidenceCandidate}
            contextualEvidenceCandidate={contextualEvidenceCandidate}
            onClose={() => {
              setIsTemporalEngineOpen(false);
              setActiveTemporalCandidate(null);
            }}
            onComparisonGenerated={(cmp) => {
              const newFinding: StreetViewFinding = {
                id: cmp.comparisonId,
                expedienteId: cmp.projectId,
                categoria: "COMPARACION_TEMPORAL",
                coordenadas: {
                  lat: cmp.contextualEvidence?.lat ?? cmp.primaryEvidence?.lat,
                  lng: cmp.contextualEvidence?.lng ?? cmp.primaryEvidence?.lng,
                },
                imagen: cmp.primaryEvidence.url,
                descripcion: cmp.aiAnalysis.calibratedObservation,
                observaciones_visual: cmp.aiAnalysis.calibratedObservation,
                estado: "PENDIENTE_REVISION",
                fechaCreacion: cmp.createdAt,
                origenRevision: "MANUAL",
              };
              handleFindingCreated(newFinding);
            }}
          />
        )}
      </div>
    </AnalyticsFilterProvider>
  );
}

export default GeographicWorkspace;
