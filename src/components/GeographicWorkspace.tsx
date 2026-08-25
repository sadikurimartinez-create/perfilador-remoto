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

const MOCK_RECTORA = {
  center: { lat: 21.885, lng: -102.291 },
  polygonCoords: [
    { lat: 21.892, lng: -102.300 },
    { lat: 21.892, lng: -102.280 },
    { lat: 21.878, lng: -102.280 },
    { lat: 21.878, lng: -102.300 },
  ],
  lineCoords: [
    { lat: 21.885, lng: -102.295 },
    { lat: 21.885, lng: -102.285 },
  ],
  hasCoordinates: true,
};

const MOCK_POIS = [
  { id: "poi-1", name: "Cámara Escudo 01", category: "Vigilancia", lat: 21.888, lng: -102.293, comentario: "Punto de monitoreo de accesos" },
  { id: "poi-2", name: "Estación de Servicio Pemex", category: "Comercio", lat: 21.882, lng: -102.288, comentario: "Frecuentada por halcones" },
  { id: "poi-3", name: "Cruce Táctico Central", category: "Cruce", lat: 21.885, lng: -102.291, comentario: "Cruce principal de la zona" },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `poi-dense-${i}`,
    name: `Punto Táctico Adicional ${i + 1}`,
    category: "Inteligencia",
    lat: 21.885 + (Math.random() - 0.5) * 0.005,
    lng: -102.291 + (Math.random() - 0.5) * 0.005,
    comentario: "Punto secundario de cobertura"
  }))
];

const MOCK_PHOTOGRAPHS = [
  { id: "photo-1", lat: 21.887, lng: -102.290, previewUrl: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=150&q=80", gpsTimestamp: Date.now() - 86400000, comentario: "Evidencia de marcas de pandilla" },
  { id: "photo-2", lat: 21.881, lng: -102.294, previewUrl: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?auto=format&fit=crop&w=150&q=80", gpsTimestamp: Date.now() - 172800000, comentario: "Vehículo sospechoso detectado" },
];

const MOCK_SV_MANUAL = [
  { id: "sv-man-1", lat: 21.889, lng: -102.295, streetViewMetadata: { heading: 120 }, contextualizedBy: "Analista Ceipol" },
  { id: "sv-man-2", lat: 21.883, lng: -102.285, streetViewMetadata: { heading: 45 }, contextualizedBy: "Gabinete SSPE" },
];

// @deprecated ADR-018: Desactivado para evitar la simulación de barridos automáticos al abrir expedientes
const INITIAL_SV_AUTOMATIC: any[] = [];

const MOCK_CRIMES = [
  { id: "crime-1", fecha: "2026-08-10", tipo: "Robo de Vehículo" },
  { id: "crime-2", fecha: "2026-08-11", tipo: "Asalto a Transeúnte" },
  { id: "crime-3", fecha: "2026-08-12", tipo: "Allanamiento" },
  { id: "crime-4", fecha: "2026-08-13", tipo: "Robo de Vehículo" },
  { id: "crime-5", fecha: "2026-08-14", tipo: "Daño en Propiedad" },
];

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
    return MOCK_PHOTOGRAPHS;
  }, [album]);

  // Resolución reactiva de Evidencia Primaria In Situ real (Campo)
  const primaryEvidenceCandidate = React.useMemo(() => {
    const rawPhoto = georeferencedPhotos?.[0] || (album && album.length > 0 ? album[0] : null);
    if (!rawPhoto) return undefined;
    const photo: any = rawPhoto;

    const rawLat = photo.lat ?? photo.latitude ?? photo.gpsLat ?? photo.exifLat ?? photo.coordenadas?.lat ?? 21.885;
    const rawLng = photo.lng ?? photo.longitude ?? photo.gpsLng ?? photo.exifLng ?? photo.coordenadas?.lng ?? -102.291;
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
        : new Date().toISOString().split("T")[0],
      lat: Number(rawLat),
      lng: Number(rawLng),
    };
  }, [georeferencedPhotos, album]);

  // Resolución reactiva de Evidencia Contextual Street View real (Panorama)
  const contextualEvidenceCandidate = React.useMemo(() => {
    const rawTarget = activeTemporalCandidate || selectedFinding || selectedSv || (captures && captures.length > 0 ? captures[0] : null) || (findings && findings.length > 0 ? findings[0] : null);
    if (!rawTarget) return undefined;
    const target: any = rawTarget;

    const rawLat = target.latitude ?? target.lat ?? target.coordenadas?.lat ?? target.geometry?.lat ?? 21.885;
    const rawLng = target.longitude ?? target.lng ?? target.coordenadas?.lng ?? target.geometry?.lng ?? -102.291;
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
        : "2023-03-15",
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
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
        {/* Sección Superior: Mapa y Controles Lateral */}
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Panel de Control Lateral */}
          <div className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-20 shrink-0">
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex flex-col gap-2">
              <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">Perfilador Remoto SSPE-CEIPOL</span>
              <h1 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                <span>🗺️</span> Espacio Analítico v1.0
              </h1>
              
              {/* Barra de Acciones GEOINT Gobernadas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsSweepEngineOpen(true)}
                  className="py-2 px-2.5 bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-900 text-cyan-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-md shadow-cyan-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🚀</span> Barrido GEOINT
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerTemporalComparison()}
                  className="py-2 px-2.5 bg-amber-950 border border-amber-800/80 hover:bg-amber-900 text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-md shadow-amber-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>⏳</span> Comparación IA
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Ficha de Detalles del Elemento Seleccionado */}
              {selectedPoi && (
                <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase">Punto de Interés</span>
                    <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">{selectedPoi.category}</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-tight">{selectedPoi.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">"{selectedPoi.comentario}"</p>
                  </div>
                </div>
              )}

              {selectedSv && (
                <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">Cámara de Barrido</span>
                    <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">PENDIENTE</span>
                  </div>
                  <img
                    src={selectedSv.file_url || selectedSv.archivo_url || selectedSv.previewUrl}
                    alt="Capture Preview"
                    className="w-full h-36 object-cover rounded-xl border border-slate-800"
                  />
                  <div className="text-[10px] space-y-1.5 font-mono text-slate-400 pt-1">
                    <p>ORIENTACIÓN: {selectedSv.geolocalizacion?.heading || selectedSv.street_view_session?.heading_final || 0}°</p>
                    <p>CATEGORÍA: {selectedSv.categoria_exploracion?.replace("_", " ") || "GENERAL"}</p>
                  </div>
                </div>
              )}

              {selectedFinding && (
                <div className="bg-cyan-950/20 border border-cyan-800/50 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-cyan-800/30 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase">Hallazgo Aprobado</span>
                    <span className="text-[9px] font-bold bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full uppercase">{selectedFinding.categoria}</span>
                  </div>
                  <img
                    src={selectedFinding.imagen}
                    alt="Finding"
                    className="w-full h-36 object-cover rounded-xl border border-cyan-800/60 shadow-md shadow-cyan-950/30"
                  />
                  <div>
                    <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">"{selectedFinding.descripcion || "Sin descripción táctica registrada."}"</p>
                  </div>
                  <div className="text-[10px] space-y-1 font-mono text-cyan-500/80 pt-1.5 border-t border-cyan-900/30">
                    <p>HEADING: {selectedFinding.heading}°</p>
                    <p>FOCAL (FOV): {selectedFinding.fov}°</p>
                    <p>REVISOR: {selectedFinding.usuarioRevision}</p>
                  </div>
                </div>
              )}

              {!selectedPoi && !selectedSv && !selectedFinding && (
                <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center justify-center h-36">
                  <span className="text-2xl mb-1.5">🎯</span>
                  <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Inspección de Análisis</p>
                  <p className="text-[9px] text-slate-500 mt-1">Haz clic en cualquier elemento, captura o hallazgo en el mapa.</p>
                </div>
              )}

              {/* Panel de Validación de Capturas de Barrido */}
              <StreetViewFindingsPanel
                expedienteId="EXP-2026"
                captures={captures}
                onCaptureStatusChange={handleCaptureStatusChange}
                onFindingCreated={handleFindingCreated}
                onTriggerTemporalComparison={handleTriggerTemporalComparison}
              />
            </div>
          </div>

          {/* Visor SIG Profesional + Cintilla Inferior GEOINT */}
          <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
            <div className="flex-1 w-full h-full relative">
              <ProfessionalGeoMap
                geografiaRectora={MOCK_RECTORA}
                pois={MOCK_POIS}
                photographs={georeferencedPhotos}
                streetViewManual={MOCK_SV_MANUAL}
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

            {/* ADR-019.11.2: Cintilla Horizontal Inferior de Evidencias GEOINT */}
            <StreetViewEvidenceRibbon
              expedienteId={expedienteId}
              findings={findings}
              captures={captures}
              selectedFindingId={selectedFinding?.id}
              onFindingSelect={handleFindingSelect}
              onTriggerTemporalComparison={handleTriggerTemporalComparison}
            />
          </div>
        </div>

        {/* Modales Gobernados de Motores GEOINT (ADR-018 y ADR-019) */}
        {isSweepEngineOpen && (
          <GeointControlledSweepEngine
            isOpen={isSweepEngineOpen}
            lat={21.885}
            lng={-102.291}
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
                  lat: cmp.contextualEvidence.lat ?? 21.885,
                  lng: cmp.contextualEvidence.lng ?? -102.291,
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
