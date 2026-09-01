"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GeoEvidence, GeoEvidenceSource } from "../../types/geointEvidence";
import {
  UniversalEvidenceComparison,
  PrimaryEvidenceRef,
  ContextualEvidenceRef,
  ComparisonType,
  AnalystValidationStatus,
} from "../../types/geointTemporalComparison";
import {
  isSameLocation,
  adaptStreetViewFindingToGeoEvidence,
  isValidCoordinate,
} from "../../utils/geoResolver";
import {
  compareTemporalEvidence,
  updateComparisonValidationStatus,
} from "../../services/geoint/temporalComparisonService";
import {
  GeointGovernanceStatus,
  buildGeointTraceabilityId,
} from "../../types/geointGovernance";

export interface GeointTemporalComparativeEngineProps {
  isOpen: boolean;
  projectId?: string;
  analystName?: string;
  evidenceA?: GeoEvidence | null;
  evidenceB?: GeoEvidence | null;
  // Soporte legacy retrocompatible
  primaryEvidenceCandidate?: Partial<PrimaryEvidenceRef>;
  contextualEvidenceCandidate?: Partial<ContextualEvidenceRef>;
  toleranceMeters?: number;
  onClose: () => void;
  onComparisonGenerated?: (comparison: UniversalEvidenceComparison | any) => void;
}

/**
 * ADR-019.13-F3/F4 — Motor de Comparación Temporal Universal GeoEvidence A vs GeoEvidence B
 * Desacoplado de roles fijos (Campo vs Street View) con Convalidación Humana de Gabinete (ADR-016).
 */
export function GeointTemporalComparativeEngine({
  isOpen,
  projectId = "EXP-2026",
  analystName = "UNAVAILABLE",
  evidenceA: initialEvidenceA,
  evidenceB: initialEvidenceB,
  primaryEvidenceCandidate,
  contextualEvidenceCandidate,
  toleranceMeters = 50,
  onClose,
  onComparisonGenerated,
}: GeointTemporalComparativeEngineProps) {
  // Estado local para Evidencia A
  const [evA, setEvA] = useState<GeoEvidence>(() => {
    if (initialEvidenceA) return initialEvidenceA;
    if (primaryEvidenceCandidate) {
      const adapted = adaptStreetViewFindingToGeoEvidence(primaryEvidenceCandidate);
      if (adapted) return adapted;
    }
    return {
      id: `ev-A-${Date.now()}`,
      expedienteId: projectId,
      traceabilityId: buildGeointTraceabilityId("trace-eva", [projectId, primaryEvidenceCandidate?.id]),
      sourceEvidenceId: primaryEvidenceCandidate?.id || "SOURCE_EVIDENCE_A_UNKNOWN",
      source: "FIELD_PHOTO",
      coordinates: (primaryEvidenceCandidate as any)?.coordinates || {
        lat: primaryEvidenceCandidate?.lat as number,
        lng: primaryEvidenceCandidate?.lng as number,
      },
      captureDate: primaryEvidenceCandidate?.timestamp || "FECHA_NO_DISPONIBLE",
      imageReference: primaryEvidenceCandidate?.url || "",
      metadata: { category: "EVIDENCIA_A", sourceProvider: "CEIPOL_FIELD" },
      status: GeointGovernanceStatus.APPROVED_EVIDENCE,
    };
  });

  // Estado local para Evidencia B
  const [evB, setEvB] = useState<GeoEvidence>(() => {
    if (initialEvidenceB) return initialEvidenceB;
    if (contextualEvidenceCandidate) {
      const adapted = adaptStreetViewFindingToGeoEvidence(contextualEvidenceCandidate);
      if (adapted) return adapted;
    }
    return {
      id: `ev-B-${Date.now()}`,
      expedienteId: projectId,
      traceabilityId: buildGeointTraceabilityId("trace-evb", [projectId, contextualEvidenceCandidate?.id]),
      sourceEvidenceId: contextualEvidenceCandidate?.id || "SOURCE_EVIDENCE_B_UNKNOWN",
      source: "STREET_VIEW_HISTORICAL",
      coordinates: (contextualEvidenceCandidate as any)?.coordinates || {
        lat: contextualEvidenceCandidate?.lat as number,
        lng: contextualEvidenceCandidate?.lng as number,
      },
      captureDate: contextualEvidenceCandidate?.panoramaTimestamp || "FECHA_NO_DISPONIBLE",
      imageReference: contextualEvidenceCandidate?.url || "",
      metadata: { heading: 180, sourceProvider: "GOOGLE_STREET_VIEW" },
      status: GeointGovernanceStatus.PENDING_REVIEW,
    };
  });

  const [comparisonType, setComparisonType] = useState<ComparisonType>("TEMPORAL_VISUAL_DELTA");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStatusMsg, setAnalysisStatusMsg] = useState<string>("");
  const [activeComparison, setActiveComparison] = useState<UniversalEvidenceComparison | null>(null);
  const [validationComment, setValidationComment] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sincronización reactiva con props
  useEffect(() => {
    if (initialEvidenceA) {
      setEvA(initialEvidenceA);
    } else if (primaryEvidenceCandidate) {
      const adapted = adaptStreetViewFindingToGeoEvidence(primaryEvidenceCandidate);
      if (adapted) setEvA(adapted);
    }
  }, [initialEvidenceA, primaryEvidenceCandidate]);

  useEffect(() => {
    if (initialEvidenceB) {
      setEvB(initialEvidenceB);
    } else if (contextualEvidenceCandidate) {
      const adapted = adaptStreetViewFindingToGeoEvidence(contextualEvidenceCandidate);
      if (adapted) setEvB(adapted);
    }
  }, [initialEvidenceB, contextualEvidenceCandidate]);

  // Validar compatibilidad espacio-geográfica in-memory
  const spatialCheck = useMemo(() => {
    return isSameLocation(evA, evB, toleranceMeters);
  }, [evA, evB, toleranceMeters]);

  // Función de disparo del análisis comparativo universal
  const handleExecuteTemporalComparison = useCallback(async () => {
    if (!spatialCheck.isCompatible) {
      alert(`⛔ COMPARACIÓN BLOQUEADA: La distancia entre Evidencia A y Evidencia B (${spatialCheck.distanceMeters}m) supera el límite máximo permitido (${toleranceMeters}m). Prohibido comparar puntos diferentes.`);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatusMsg("Ejecutando validación espacial y análisis comparativo IA...");
    setValidationError(null);

    try {
      const result = await compareTemporalEvidence(
        evA,
        evB,
        toleranceMeters,
        comparisonType,
        analystName
      );

      if (!result.isSuccess || result.isSpatialBlocked || !result.comparison) {
        alert("⚠️ Error en comparación: " + (result.error || "Validación fallida"));
        return;
      }

      setActiveComparison(result.comparison);
      setValidationComment(result.comparison.aiAnalysis.calibratedObservation);

      if (onComparisonGenerated) {
        onComparisonGenerated(result.comparison);
      }
    } catch (err: any) {
      alert("Error inesperado en comparación temporal: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatusMsg("");
    }
  }, [evA, evB, spatialCheck, toleranceMeters, comparisonType, analystName, onComparisonGenerated]);

  // Función de Convalidación Humana (ADR-016 / ADR-019.13-F4)
  const handleHumanValidation = async (status: AnalystValidationStatus) => {
    if (!activeComparison) return;

    const reviewerId = analystName.trim();
    if (!reviewerId || reviewerId.toUpperCase() === "UNAVAILABLE") {
      setValidationError("No hay una identidad humana acreditada disponible para registrar la convalidación.");
      return;
    }

    if (status === "APPROVED_EVIDENCE" && (!validationComment || validationComment.trim().length === 0)) {
      setValidationError("⚠️ Justificación/Comentario de convalidación obligatoria para promover a evidencia probatoria.");
      return;
    }

    setIsAnalyzing(true);
    setValidationError(null);

    try {
      const updatedRecord = await updateComparisonValidationStatus(
        activeComparison.comparisonId,
        activeComparison.expedienteId,
        status,
        validationComment.trim(),
        reviewerId
      );

      const updatedComparison: UniversalEvidenceComparison = {
        ...activeComparison,
        analystValidationStatus: status,
        validationComment: validationComment.trim(),
        validatedBy: reviewerId,
        validatedAt: new Date().toISOString(),
      };

      if (onComparisonGenerated) {
        onComparisonGenerated(updatedComparison);
      }

      alert(
        status === "APPROVED_EVIDENCE"
          ? `✅ Evidencia Aprobada e Integrada al Expediente [${activeComparison.comparisonId}]. Status: APPROVED_EVIDENCE.`
          : `🚫 Comparación Rechazada y Descartada de Informes [${activeComparison.comparisonId}]. Status: REJECTED_FINDING.`
      );
      onClose();
    } catch (err: any) {
      setValidationError("Error actualizando estado de convalidación: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auxiliar para etiquetas de fuente
  const getBadgeStyle = (source: GeoEvidenceSource) => {
    switch (source) {
      case "FIELD_PHOTO":
        return { label: "CAMPO IN SITU", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
      case "STREET_VIEW_AUTOMATIC":
        return { label: "STREET VIEW AUTO", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
      case "STREET_VIEW_MANUAL":
        return { label: "STREET VIEW MANUAL", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
      case "STREET_VIEW_HISTORICAL":
        return { label: "STREET VIEW HISTÓRICO", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
      default:
        return { label: "EVIDENCIA GEOINT", color: "bg-slate-800 text-slate-300 border-slate-700" };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="flex max-h-[95vh] w-full max-w-[95vw] flex-col rounded-xl border border-amber-500/30 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        {/* Encabezado Gobernado Universal */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center space-x-3">
            <span className="rounded bg-amber-500/20 p-2 text-xl font-bold text-amber-400">⏳</span>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Motor de Comparación Temporal Universal GEOINT
              </h2>
              <p className="text-xs text-amber-400/80">
                ADR-019.13-F4 — Gobernanza Humana, Persistencia ADR-019.8 e Integración Forense
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Panel Principal Comparativo Forense Dual */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Banner de Validación Espacial */}
          {!spatialCheck.isCompatible ? (
            <div className="rounded-lg border border-red-500 bg-red-950/80 p-4 text-red-200 shadow-lg flex items-center gap-3">
              <span className="text-2xl">⛔</span>
              <div>
                <h4 className="font-bold uppercase text-xs text-red-400 tracking-wider">
                  COMPARACIÓN BLOQUEADA POR INCOMPATIBILIDAD GEOGRÁFICA
                </h4>
                <p className="text-xs mt-0.5">
                  La distancia comprobada entre Evidencia A y Evidencia B (
                  <strong className="text-white font-mono">
                    {spatialCheck.distanceMeters === Infinity ? "Sin Coordenadas GPS" : `${spatialCheck.distanceMeters}m`}
                  </strong>
                  ) supera la tolerancia máxima (<strong>{toleranceMeters}m</strong>). Prohibido realizar análisis temporal sobre puntos geográficos distintos.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-emerald-300 text-xs flex items-center justify-between font-mono">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <strong>VALIDATED GEO MATCH:</strong> Distancia comprobada: {spatialCheck.distanceMeters.toFixed(2)}m (≤ {toleranceMeters}m).
              </span>
              <span className="text-slate-400 text-[10px]">
                {evA.coordinates.lat != null && evA.coordinates.lng != null
                  ? `LAT: ${evA.coordinates.lat.toFixed(5)} / LNG: ${evA.coordinates.lng.toFixed(5)}`
                  : "SIN GEORREFERENCIA"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* PANEL IZQUIERDO: EVIDENCIA A */}
            <div className="flex flex-col rounded-lg border border-slate-700 bg-slate-950/80 p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getBadgeStyle(evA.source).color}`}>
                  EVIDENCIA A: {getBadgeStyle(evA.source).label}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {evA.id}</span>
              </div>

              {/* Visor Imagen A */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900 mb-4">
                {evA.imageReference ? (
                  <img
                    src={evA.imageReference}
                    alt="Evidencia A"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                    Sin Vista Previa
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs mt-auto bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 font-bold block">Fecha Captura:</span>
                    <span className="font-mono text-cyan-400">{evA.captureDate || "FECHA_NO_DISPONIBLE"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Fuente:</span>
                    <span className="font-mono text-slate-200">{evA.source}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  GPS: {isValidCoordinate(evA.coordinates?.lat, evA.coordinates?.lng)
                    ? `${Number(evA.coordinates.lat).toFixed(6)}, ${Number(evA.coordinates.lng).toFixed(6)}`
                    : "SIN COORDENADAS GPS VÁLIDAS"}
                </div>
              </div>
            </div>

            {/* PANEL DERECHO: EVIDENCIA B */}
            <div className="flex flex-col rounded-lg border border-slate-700 bg-slate-950/80 p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getBadgeStyle(evB.source).color}`}>
                  EVIDENCIA B: {getBadgeStyle(evB.source).label}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {evB.id}</span>
              </div>

              {/* Visor Imagen B */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900 mb-4">
                {evB.imageReference ? (
                  <img
                    src={evB.imageReference}
                    alt="Evidencia B"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                    Sin Vista Previa
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs mt-auto bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 font-bold block">Fecha Captura:</span>
                    <span className="font-mono text-cyan-400">{evB.captureDate || "FECHA_NO_DISPONIBLE"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Fuente:</span>
                    <span className="font-mono text-slate-200">{evB.source}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  GPS: {isValidCoordinate(evB.coordinates?.lat, evB.coordinates?.lng)
                    ? `${Number(evB.coordinates.lat).toFixed(6)}, ${Number(evB.coordinates.lng).toFixed(6)}`
                    : "SIN COORDENADAS GPS VÁLIDAS"}
                </div>
              </div>
            </div>
          </div>

          {/* Resultado de Análisis IA y Convalidación Humana */}
          {activeComparison && (
            <div className="rounded-lg border border-cyan-500/40 bg-slate-950 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <span>🤖</span> Resultado de Análisis Comparativo IA & Delta Temporal
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {activeComparison.analystValidationStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 font-bold block mb-1">Delta Temporal:</span>
                  <span className="text-amber-400 font-mono text-sm">{activeComparison.temporalValidation.dateDifferenceFormatted}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 font-bold block mb-1">Distancia Comprobada:</span>
                  <span className="text-emerald-400 font-mono text-sm">{activeComparison.spatialValidation.distanceMeters.toFixed(2)}m</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 font-bold block mb-1">Confiabilidad IA:</span>
                  <span className="text-cyan-400 font-mono text-sm">{(activeComparison.aiAnalysis.confidenceScore * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 uppercase block mb-1">
                  Observación Calibrada / Fundamentación del Analista <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={validationComment}
                  onChange={(e) => {
                    setValidationComment(e.target.value);
                    if (e.target.value.trim().length > 0) setValidationError(null);
                  }}
                  placeholder="Escriba la fundamentación del análisis comparativo para promover la evidencia..."
                  className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium resize-none"
                />
              </div>

              {validationError && (
                <div className="p-2 rounded bg-red-950/60 border border-red-800 text-[10px] text-red-300 font-bold">
                  {validationError}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => handleHumanValidation("REJECTED_FINDING")}
                  className="flex-1 py-2 rounded bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-800 text-xs font-bold uppercase tracking-wider transition"
                >
                  🚫 Rechazar Comparación (REJECTED_FINDING)
                </button>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => handleHumanValidation("APPROVED_EVIDENCE")}
                  className="flex-1 py-2 rounded bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg transition"
                >
                  ✅ Aprobar Evidencia Probatoria (APPROVED_EVIDENCE)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 p-4">
          <div className="text-xs text-slate-400">
            {isAnalyzing && <span className="animate-pulse text-amber-400">{analysisStatusMsg}</span>}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isAnalyzing}
              className="rounded px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cerrar
            </button>
            {!activeComparison && (
              <button
                onClick={handleExecuteTemporalComparison}
                disabled={isAnalyzing || !spatialCheck.isCompatible}
                className="rounded bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? "Ejecutando IA..." : "🚀 Ejecutar Análisis Comparativo IA"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
