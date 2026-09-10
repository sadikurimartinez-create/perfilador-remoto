"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { ProfessionalGeoMap } from "./maps/ProfessionalGeoMap";
import HistoricalGeographyReconciliationPanel from "./HistoricalGeographyReconciliationPanel";
import TerritorialVertexReconciliationPanel, { type TerritorialVertex } from "./TerritorialVertexReconciliationPanel";
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
  deleteGeographicEntity,
  getGeographicEntities,
  saveGeographicEntity,
  updateGeographicEntityMetadata,
} from "@/services/geographicEntityService";
import {
  buildSweepGeographyContext,
  getCanonicalGeographyCoordinates,
  getCanonicalMapViewport,
  type CanonicalProjectGeography,
} from "@/utils/canonicalProjectGeography";
import { isExplicitInSituPhoto } from "@/services/geoint/inSituPhotoCanonicalAdapter";
import type { HistoricalGeographyCandidate } from "@/utils/historicalGeographyReconciliation";

// ADR-019.15: Geografía Rectora reactiva basada exclusivamente en datos reales del expediente o fotos in situ.
const INITIAL_SV_AUTOMATIC: any[] = [];
const EMPTY_HISTORICAL_CANDIDATES: HistoricalGeographyCandidate[] = [];

function presentToken(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || undefined;
}

function hasRealCoordinates(photo: any): boolean {
  const lat = Number(photo?.lat);
  const lng = Number(photo?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function isDefaultCoordinateFallback(photo: any): boolean {
  return (
    Math.abs(Number(photo?.lat) - 21.8853) < 0.0001 &&
    Math.abs(Number(photo?.lng) - (-102.2916)) < 0.0001
  );
}

function hasInSituIncompatibleSignal(photo: any): boolean {
  const tipo = presentToken(photo?.tipo);
  const gpsSource = presentToken(photo?.gpsSource);
  const evidenceType = presentToken(photo?.evidenceType ?? photo?.metadata?.evidenceType);
  const analysisType = presentToken(photo?.analysisType ?? photo?.metadata?.analysisType);
  const sourceType = presentToken(photo?.sourceType ?? photo?.metadata?.sourceType);
  const sourceProvider = presentToken(photo?.sourceProvider ?? photo?.metadata?.sourceProvider);
  const fuente = presentToken(photo?.fuente ?? photo?.metadata?.fuente);
  const streetViewSource = presentToken(photo?.streetViewSource ?? photo?.metadata?.streetViewSource);

  return Boolean(
    tipo?.includes("STREET_VIEW") ||
    gpsSource === "STREET_VIEW" ||
    evidenceType === "GEOGRAPHIC_VECTOR" ||
    evidenceType === "VIRTUAL_STREET_VIEW" ||
    evidenceType === "MAP_CAPTURE" ||
    analysisType === "STREET_VIEW" ||
    analysisType === "MAP_CAPTURE" ||
    sourceType === "STREET_VIEW" ||
    sourceType === "STREETVIEW_AUTOMATICO" ||
    sourceType === "REMOTE_VISUAL" ||
    sourceProvider === "GOOGLE_STREET_VIEW" ||
    fuente?.includes("STREET VIEW") ||
    streetViewSource ||
    photo?.streetViewMetadata ||
    photo?.isStreetView === true
  );
}

function hasModernInSituClassificationMetadata(photo: any): boolean {
  return Boolean(
    presentToken(photo?.gpsSource) ||
    presentToken(photo?.evidenceType ?? photo?.metadata?.evidenceType) ||
    presentToken(photo?.analysisType ?? photo?.metadata?.analysisType) ||
    presentToken(photo?.sourceType ?? photo?.metadata?.sourceType) ||
    presentToken(photo?.streetViewSource ?? photo?.metadata?.streetViewSource)
  );
}

function isWorkspaceInSituPhoto(photo: any): boolean {
  if (!hasRealCoordinates(photo)) return false;
  if (isDefaultCoordinateFallback(photo)) return false;
  if (hasInSituIncompatibleSignal(photo)) return false;

  if (isExplicitInSituPhoto({
    gpsSource: photo.gpsSource,
    tipo: photo.tipo,
    evidenceType: photo.evidenceType ?? photo.metadata?.evidenceType,
    analysisType: photo.analysisType ?? photo.metadata?.analysisType,
    streetViewSource: photo.streetViewSource ?? photo.metadata?.streetViewSource,
  })) {
    return true;
  }

  // compatibilidad legacy: lectura de fotos historicas con lat/lng reales y sin metadata moderna.
  return !hasModernInSituClassificationMetadata(photo);
}

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

export type GeographicWorkspaceProps = {
  historicalGeographyCandidatesInput?: HistoricalGeographyCandidate[];
};

export function GeographicWorkspace({
  historicalGeographyCandidatesInput = [],
}: GeographicWorkspaceProps = {}) {
  const { project, album, registerSweep, updateProjectDetails, persistHistoricalGeographyReconciliationForProject } = useProject();
  const { user } = useAuth();
  const expedienteId = project?.id || "EXP-2026";

  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const [selectedSv, setSelectedSv] = useState<any | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);

  const [captures, setCaptures] = useState<any[]>(INITIAL_SV_AUTOMATIC);
  const [findings, setFindings] = useState<StreetViewFinding[]>([]);
  const [historicalPreviewCandidates, setHistoricalPreviewCandidates] = useState<HistoricalGeographyCandidate[]>([]);
  const [historicalMapCandidates, setHistoricalMapCandidates] = useState<HistoricalGeographyCandidate[]>([]);
  const [selectedHistoricalCandidateIds, setSelectedHistoricalCandidateIds] = useState<string[]>([]);
  const [discardedHistoricalCandidateIds, setDiscardedHistoricalCandidateIds] = useState<string[]>([]);
  const [territorialVertices, setTerritorialVertices] = useState<TerritorialVertex[]>([]);
  const [territorialPreviewPath, setTerritorialPreviewPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isTerritorialVertexCaptureEnabled, setIsTerritorialVertexCaptureEnabled] = useState(false);

  // Estados de control modal para motores GEOINT ADR-018 y ADR-019
  const [isSweepEngineOpen, setIsSweepEngineOpen] = useState(false);
  const [isTemporalEngineOpen, setIsTemporalEngineOpen] = useState(false);
  const [activeTemporalCandidate, setActiveTemporalCandidate] = useState<any | null>(null);

  // Extraer fotografías de campo in situ según el contrato canónico existente.
  const inSituGeoreferencedPhotos = React.useMemo(() => {
    if (album && Array.isArray(album) && album.length > 0) {
      const filtered = album.filter(isWorkspaceInSituPhoto);
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
      geometryType: canonicalGeography.type,
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      hasCoordinates: coordinates.length > 0,
    };
  }, [project?.canonicalGeography]);

  // Resolución reactiva de Evidencia Primaria In Situ real (Campo) sin fallbacks estáticos
  const primaryEvidenceCandidate = React.useMemo(() => {
    const rawPhoto = inSituGeoreferencedPhotos?.[0] || null;
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
  }, [inSituGeoreferencedPhotos]);

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
        georeferencedPhotosCount: inSituGeoreferencedPhotos.length,
        existingFindingsCount: findings.length,
        canonicalGeography: project?.canonicalGeography ?? null,
      }),
    [expedienteId, inSituGeoreferencedPhotos.length, findings.length, project?.canonicalGeography]
  );

  const persistedHistoricalCandidates = project?.historicalGeographyReconciliation?.candidates ?? EMPTY_HISTORICAL_CANDIDATES;

  const historicalGeographyCandidates = React.useMemo(() => {
    if (project && historicalGeographyCandidatesInput.length > 0) {
      return historicalGeographyCandidatesInput.filter((candidate) => candidate.projectId === project.id);
    }

    return persistedHistoricalCandidates;
  }, [
    historicalGeographyCandidatesInput,
    persistedHistoricalCandidates,
    project?.id,
  ]);

  React.useEffect(() => {
    setHistoricalMapCandidates(historicalGeographyCandidates);
    setSelectedHistoricalCandidateIds([]);
    setDiscardedHistoricalCandidateIds(
      historicalGeographyCandidates
        .filter((candidate) => candidate.status === "DISCARDED")
        .map((candidate) => candidate.candidateId)
    );
    setHistoricalPreviewCandidates([]);
  }, [historicalGeographyCandidates]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadTerritorialVertices() {
      if (!project?.id) {
        setTerritorialVertices([]);
        return;
      }
      const entities = await getGeographicEntities(project.id);
      if (cancelled) return;
      setTerritorialVertices(entities
        .filter((entity) => entity.type === "VERTEX" || entity.metadata?.isVertex === true)
        .map((entity, index) => ({
          ...entity,
          id: entity.id || `territorial-vertex-${index + 1}`,
          type: "VERTEX" as const,
          metadata: {
            ...(entity.metadata || {}),
            isVertex: true as const,
            isIndependentPoi: false as const,
            order: Number(entity.metadata?.order || index + 1),
            source: "HUMAN_MAP_VERTEX" as const,
          },
        }))
        .sort((a, b) => Number(a.metadata.order) - Number(b.metadata.order)));
    }

    void loadTerritorialVertices();

    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  const historicalPreviewPath = React.useMemo(
    () => historicalPreviewCandidates.map((candidate) => ({ lat: candidate.lat, lng: candidate.lng })),
    [historicalPreviewCandidates]
  );

  const handleHistoricalCandidateStateChange = React.useCallback((
    nextCandidates: HistoricalGeographyCandidate[],
    nextSelectedIds: string[],
    nextDiscardedIds: string[]
  ) => {
    setHistoricalMapCandidates(nextCandidates);
    setSelectedHistoricalCandidateIds(nextSelectedIds);
    setDiscardedHistoricalCandidateIds(nextDiscardedIds);
  }, []);

  const handleTerritorialVertexAdd = React.useCallback(async (lat: number, lng: number) => {
    if (!project || project.geometryType !== "lineal" || project.canonicalGeography?.validationStatus === "VALID") return;
    const order = territorialVertices.length + 1;
    const createdAt = Date.now();
    const entityId = await saveGeographicEntity({
      projectId: project.id,
      lat,
      lng,
      type: "VERTEX",
      geometryType: project.geometryType,
      source: "HUMAN_MAP_VERTEX",
      createdBy: user?.username || "Usuario Local",
      createdAt,
      metadata: {
        name: `Vertice territorial ${order}`,
        comentario: "Vertice territorial definido manualmente en mapa.",
        isIndependentPoi: false,
        isVertex: true,
        tipo: "Corredor",
        order,
        source: "HUMAN_MAP_VERTEX",
      },
    });
    setTerritorialVertices((prev) => [
      ...prev,
      {
        id: entityId,
        projectId: project.id,
        lat,
        lng,
        type: "VERTEX",
        geometryType: project.geometryType,
        source: "HUMAN_MAP_VERTEX",
        createdBy: user?.username || "Usuario Local",
        createdAt,
        metadata: {
          name: `Vertice territorial ${order}`,
          comentario: "Vertice territorial definido manualmente en mapa.",
          isIndependentPoi: false,
          isVertex: true,
          tipo: "Corredor",
          order,
          source: "HUMAN_MAP_VERTEX",
        },
      },
    ]);
  }, [project, territorialVertices.length, user?.username]);

  const handleTerritorialVertexReorder = React.useCallback(async (nextVertices: TerritorialVertex[]) => {
    if (!project) return;
    await Promise.all(nextVertices.map((vertex, index) =>
      updateGeographicEntityMetadata(project.id, vertex.id, {
        ...vertex.metadata,
        order: index + 1,
        isVertex: true,
        isIndependentPoi: false,
        source: "HUMAN_MAP_VERTEX",
      })
    ));
    setTerritorialVertices(nextVertices.map((vertex, index) => ({
      ...vertex,
      metadata: { ...vertex.metadata, order: index + 1 },
    })));
  }, [project]);

  const handleTerritorialVertexRemove = React.useCallback(async (vertexId: string) => {
    if (!project) return;
    await deleteGeographicEntity(project.id, vertexId);
    const remaining = territorialVertices
      .filter((vertex) => vertex.id !== vertexId)
      .map((vertex, index) => ({
        ...vertex,
        metadata: { ...vertex.metadata, order: index + 1 },
      }));
    setTerritorialVertices(remaining);
    await Promise.all(remaining.map((vertex) => updateGeographicEntityMetadata(project.id, vertex.id, vertex.metadata)));
  }, [project, territorialVertices]);

  const handleTerritorialGeographyConfirm = React.useCallback(async (canonicalGeography: CanonicalProjectGeography) => {
    await updateProjectDetails({
      canonicalGeography,
      geographyId: canonicalGeography.geographyId,
      geographyValidationStatus: canonicalGeography.validationStatus,
    });
    setIsTerritorialVertexCaptureEnabled(false);
  }, [updateProjectDetails]);

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
        const cId = c.id || c.findingId || c.originalFindingId || c.hash_md5 || c.filename;
        if (cId === captureId) {
          return { ...c, estado_revision: status, status };
        }
        return c;
      })
    );
  };

  const reconcileFindingIntoProject = React.useCallback(async (savedFinding: StreetViewFinding) => {
    const findingId =
      savedFinding?.id ||
      (savedFinding as any)?.findingId ||
      (savedFinding as any)?.traceabilityId;

    if (!findingId) {
      console.warn(
        "[GEOINT FINDING RECONCILIATION BLOCKED] Hallazgo sin identidad canónica.",
        savedFinding
      );
      return;
    }

    setFindings((prev) => {
      const withoutDuplicate = prev.filter((item) => {
        const currentId =
          item?.id ||
          (item as any)?.findingId ||
          (item as any)?.traceabilityId;

        return currentId !== findingId;
      });

      return [...withoutDuplicate, savedFinding];
    });

    const isApprovedFinding =
      savedFinding?.estado === GeointGovernanceStatus.APPROVED_EVIDENCE ||
      String((savedFinding as any)?.humanValidationStatus || "").toUpperCase() === "APPROVED";

    if (!isApprovedFinding) {
      console.info("[GEOINT FINDING PENDING HUMAN REVIEW]", {
        projectId: project?.id || expedienteId,
        findingId,
        estado: savedFinding?.estado || null,
        humanValidationStatus: (savedFinding as any)?.humanValidationStatus || null,
      });
      return;
    }

    const existingApprovedFindings = Array.isArray(project?.approvedFindings)
      ? project.approvedFindings
      : [];

    const reconciledApprovedFindings = [
      ...existingApprovedFindings.filter((item: any) => {
        const currentId =
          item?.id ||
          item?.findingId ||
          item?.traceabilityId;

        return currentId !== findingId;
      }),
      savedFinding,
    ];

    await updateProjectDetails({
      approvedFindings: reconciledApprovedFindings,
    });

    console.info("[GEOINT FINDING RECONCILED]", {
      projectId: project?.id || expedienteId,
      findingId,
      approvedFindingsCount: reconciledApprovedFindings.length,
    });
  }, [project?.id, project?.approvedFindings, expedienteId, updateProjectDetails]);

  const persistFindingAndReconcile = React.useCallback(async (newFinding: StreetViewFinding) => {
    try {
      console.log(
        "[AUDIT ADR-019.5 v1.3] Persistiendo hallazgo nuevo:",
        newFinding
      );

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

      console.log(
        "[AUDIT ADR-019.5 v1.3] Hallazgo guardado con éxito en Firestore:",
        savedFinding
      );

      await reconcileFindingIntoProject(savedFinding);
    } catch (err) {
      console.warn(
        "[AUDIT ADR-019.5 v1.3] Error al guardar hallazgo en Firestore:",
        err
      );
    }
  }, [reconcileFindingIntoProject]);

  console.debug("[GEOINT DEBUG]", {
    albumPhotosCount: album?.length || 0,
    georeferencedPhotosCount: inSituGeoreferencedPhotos?.length || 0,
    firstGeoreferencedPhoto: inSituGeoreferencedPhotos?.[0] || null,
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
              <span>RELOJ</span> Comparación Temporal
            </button>
          </div>
        </div>

        {/* ZONA 1 — MAPA PRINCIPAL (Primero en el DOM, Ancho Completo, min-h-[65vh]) */}
        <div className="w-full min-h-[65vh] h-[65vh] relative bg-slate-950 border-b border-slate-800 shrink-0">
          <ProfessionalGeoMap
            geografiaRectora={activeGeografiaRectora}
            pois={[]}
            photographs={inSituGeoreferencedPhotos}
            streetViewManual={[]}
            streetViewAutomatic={captures}
            findings={findings}
            historicalCandidates={historicalMapCandidates}
            historicalPreviewPath={historicalPreviewPath}
            territorialVertices={territorialVertices.map((vertex) => ({
              id: vertex.id,
              lat: vertex.lat,
              lng: vertex.lng,
              order: vertex.metadata.order,
            }))}
            territorialPreviewPath={territorialPreviewPath}
            isTerritorialVertexCaptureEnabled={isTerritorialVertexCaptureEnabled}
            selectedHistoricalCandidateIds={selectedHistoricalCandidateIds}
            discardedHistoricalCandidateIds={discardedHistoricalCandidateIds}
            onTerritorialVertexAdd={handleTerritorialVertexAdd}
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
          {project && project.geometryType === "lineal" && (
            <TerritorialVertexReconciliationPanel
              projectId={project.id}
              vertices={territorialVertices}
              canonicalGeographyExists={project.canonicalGeography?.validationStatus === "VALID"}
              isCaptureEnabled={isTerritorialVertexCaptureEnabled}
              onCaptureEnabledChange={setIsTerritorialVertexCaptureEnabled}
              onReorder={handleTerritorialVertexReorder}
              onRemove={handleTerritorialVertexRemove}
              onPreviewChange={setTerritorialPreviewPath}
              onConfirm={handleTerritorialGeographyConfirm}
            />
          )}

          {project && historicalGeographyCandidates.length > 0 && (
            <HistoricalGeographyReconciliationPanel
              projectId={project.id}
              candidates={historicalGeographyCandidates}
              canonicalGeographyExists={project.canonicalGeography?.validationStatus === "VALID"}
              onPreviewChange={setHistoricalPreviewCandidates}
              onCandidateStateChange={handleHistoricalCandidateStateChange}
              onPersist={(reconciliation) =>
                persistHistoricalGeographyReconciliationForProject(project.id, reconciliation)
              }
              confirmedBy={{
                id: user?.id ?? null,
                username: user?.username ?? null,
                name: user?.name ?? null,
              }}
            />
          )}

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
              onFindingCreated={reconcileFindingIntoProject}
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
              newCaptures.forEach((capture) => {
                const findingId = capture.originalFindingId;

                const lat = capture.geometry.lat;

                const lng = capture.geometry.lng;

                if (
                  !findingId ||
                  !capture.sourceEvidenceId ||
                  !capture.geographyId
                ) {
                  console.warn("[GEOINT SWEEP FINDING PERSIST BLOCKED]", {
                    findingId: findingId || null,
                    sourceEvidenceId: capture.sourceEvidenceId || null,
                    geographyId: capture.geographyId || null,
                  });
                  return;
                }

                void fetch("/api/streetview/findings", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    id: findingId,
                    expedienteId,
                    traceabilityId: capture.traceabilityId,
                    sourceEvidenceId: capture.sourceEvidenceId,
                    supportingEvidenceIds: [capture.sourceEvidenceId],
                    geographyId: capture.geographyId,

                    categoria: capture.category,
                    coordenadas: {
                      lat,
                      lng,
                    },
                    imagen: capture.file_url,
                    heading: capture.geometry.heading ?? 0,
                    pitch: capture.geometry.pitch ?? 0,
                    fov: capture.geometry.fov ?? 90,
                    estado: GeointGovernanceStatus.PENDING_REVIEW,
                    descripcion:
                      capture.explanation ||
                      capture.comentario ||
                      "",
                    origenRevision: "BARRIDO_AUTOMATICO",
                  }),
                })
                  .then(async (res) => {
                    const payload = await res.json().catch(() => null);

                    if (!res.ok) {
                      throw new Error(
                        payload?.details ||
                        payload?.error ||
                        `HTTP ${res.status}`
                      );
                    }

                    console.info("[GEOINT SWEEP FINDING PERSISTED]", {
                      findingId,
                      projectId: expedienteId,
                    });
                  })
                  .catch((err) => {
                    console.warn(
                      "[GEOINT SWEEP FINDING PERSIST ERROR]",
                      findingId,
                      err
                    );
                  });
              });
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
              void persistFindingAndReconcile(buildStreetViewFindingFromTemporalComparison(cmp));
            }}
          />
        )}
      </div>
    </AnalyticsFilterProvider>
  );
}

export default GeographicWorkspace;
