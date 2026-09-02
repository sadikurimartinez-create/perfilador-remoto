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
import { useAuth } from "@/context/AuthContext";
import { UniversalEvidenceComparison } from "@/types/geointTemporalComparison";
import { GeointGovernanceStatus, GeointGovernanceStatusValue } from "@/types/geointGovernance";
import { buildStreetViewFindingFromTemporalComparison } from "@/services/geoint/temporalComparisonBridge";
import {
  buildSweepGeographyContext,
  getCanonicalGeographyCoordinates,
  getCanonicalMapViewport,
  type CanonicalProjectGeography,
} from "@/utils/canonicalProjectGeography";

// ADR-019.15: Geografía Rectora reactiva basada exclusivamente en datos reales del expediente o fotos in situ.
const INITIAL_SV_AUTOMATIC: any[] = [];

export function calculateSweepPreparation(input: {
  expedienteId: string;
  georeferencedPhotosCount: number;
  existingFindingsCount: number;
  canonicalGeography?: CanonicalProjectGeography | null;
}) {
  const hasCanonicalGeography = input.canonicalGeography?.validationStatus === "VALID";
  return {
    mode: "PREPARATION" as const,
    sweepAvailable: hasCanonicalGeography,
    recommendedReason:
      hasCanonicalGeography
        ? "CANONICAL_GEOGRAPHY_AVAILABLE"
        : "NO_VALID_CANONICAL_GEOGRAPHY",
    expedienteId: input.expedienteId,
    georeferencedPhotosCount: input.georeferencedPhotosCount,
    existingFindingsCount: input.existingFindingsCount,
    geographyId: input.canonicalGeography?.geographyId ?? null,
    geographyType: input.canonicalGeography?.type ?? null,
  };
}

export function GeographicWorkspace() {
  const { project, album, registerSweep } = useProject();
  const { user } = useAuth();
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

  // Centro y Geografía Rectora reactiva basada exclusivamente en el contrato canónico del expediente.
  const activeGeografiaRectora = React.useMemo(() => {
    const canonicalGeography = project?.canonicalGeography;
    if (!canonicalGeography || canonicalGeography.validationStatus !== "VALID") {
      return { center: undefined, hasCoordinates: false };
    }
    const coordinates = getCanonicalGeographyCoordinates(canonicalGeography);
    const viewport = getCanonicalMapViewport(canonicalGeography);
    return {
      center: viewport.center,
      polygonCoords: canonicalGeography.type === "POLYGON" ? coordinates : undefined,
      lineCoords: canonicalGeography.type === "CORRIDOR" ? coordinates : undefined,
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      hasCoordinates: coordinates.length > 0,
    };
  }, [project?.canonicalGeography]);

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

  const sweepPreparation = React.useMemo(
    () =>
      calculateSweepPreparation({
        expedienteId,
        georeferencedPhotosCount: georeferencedPhotos.length,
        existingFindingsCount: findings.length,
        canonicalGeography: project?.canonicalGeography ?? null,
      }),
    [expedienteId, georeferencedPhotos.length, findings.length, project?.canonicalGeography]
  );

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

  const handleCaptureStatusChange = (captureId: string, status: GeointGovernanceStatusValue) => {
    setCaptures((prev) =>
      prev.map((c) => {
        const cId = c.id || c.hash_md5 || c.filename;
        if (cId === captureId) {
          return { ...c, estado_revision: status, status };
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
    sweepPreparation,
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
            lat={activeGeografiaRectora.center?.lat ?? 0}
            lng={activeGeografiaRectora.center?.lng ?? 0}
            canonicalGeography={project?.canonicalGeography ?? null}
            onClose={() => setIsSweepEngineOpen(false)}
            onFindingsGenerated={(newCaptures) => {
              const sweepGeographyContext = project?.canonicalGeography
                ? buildSweepGeographyContext(project.canonicalGeography)
                : null;
              setCaptures((prev) => [
                ...prev,
                ...newCaptures.map((capture) => ({
                  ...capture,
                  estado_revision: GeointGovernanceStatus.PENDING_REVIEW,
                  status: GeointGovernanceStatus.PENDING_REVIEW,
                  sourceType: "STREETVIEW_AUTOMATICO",
                })),
              ]);
              void registerSweep({
                engine: "GEOINT_CONTROLLED_SWEEP",
                source: "GeointControlledSweepEngine",
                type: "Directa",
                relevance: "Alto",
                initialContext: "Ejecución manual desde GeographicWorkspace.",
                outputEvidenceIds: newCaptures.map((capture) => capture.sourceEvidenceId).filter(Boolean),
                outputFindingIds: newCaptures.map((capture) => capture.originalFindingId).filter(Boolean),
                geographyId: project?.canonicalGeography?.geographyId ?? null,
                geographyType: project?.canonicalGeography?.type ?? null,
                data: `Barrido GEOINT controlado generado por acción operacional explícita. Hallazgos: ${newCaptures.length}. Geografía: ${sweepGeographyContext?.geographyId ?? "UNAVAILABLE"}.`,
              }).catch((err) => {
                console.warn("[GeographicWorkspace] No se pudo registrar lifecycle del barrido GEOINT controlado:", err);
              });
            }}
          />
        )}

        {isTemporalEngineOpen && (
          <GeointTemporalComparativeEngine
            isOpen={isTemporalEngineOpen}
            projectId={expedienteId}
            analystName={user?.username}
            primaryEvidenceCandidate={primaryEvidenceCandidate}
            contextualEvidenceCandidate={contextualEvidenceCandidate}
            onClose={() => {
              setIsTemporalEngineOpen(false);
              setActiveTemporalCandidate(null);
            }}
            onComparisonGenerated={(cmp: UniversalEvidenceComparison) => {
              handleFindingCreated(buildStreetViewFindingFromTemporalComparison(cmp));
            }}
          />
        )}
      </div>
    </AnalyticsFilterProvider>
  );
}

export default GeographicWorkspace;
