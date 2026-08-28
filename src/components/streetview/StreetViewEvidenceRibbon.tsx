"use client";

import React, { useMemo } from "react";
import { GeoEvidence, GeoEvidenceSource } from "../../types/geointEvidence";
import {
  filterCompatibleEvidence,
  getEvidenceDistanceDetail,
} from "../../services/geoint/evidenceCompatibilityService";
import {
  adaptStreetViewFindingToGeoEvidence,
  adaptSweepPayloadToGeoEvidence,
} from "../../utils/geoResolver";

export interface StreetViewEvidenceRibbonProps {
  expedienteId?: string;
  referenceEvidence?: GeoEvidence | null;
  candidates?: GeoEvidence[];
  findings?: any[]; // Soporte legacy para arreglo StreetViewFinding
  captures?: any[]; // Soporte legacy para arreglo de capturas automáticas
  toleranceMeters?: number;
  selectedEvidenceId?: string;
  selectedFindingId?: string; // Retrocompatibilidad para GeographicWorkspace
  onEvidenceSelected?: (evidence: GeoEvidence) => void;
  onFindingSelect?: (finding: any) => void; // Bridge legacy
  onTriggerTemporalComparison?: (evidence: GeoEvidence) => void;
}

/**
 * ADR-019.13-F2 — Cintilla Inteligente de Evidencias GEOINT
 * Selector horizontal gobernado que filtra y presenta únicamente evidencias
 * compatibles con la ubicación geográfica de referencia (R <= toleranceMeters).
 */
export function StreetViewEvidenceRibbon({
  expedienteId = "EXP-2026",
  referenceEvidence,
  candidates = [],
  findings = [],
  captures = [],
  toleranceMeters = 50,
  selectedEvidenceId,
  selectedFindingId,
  onEvidenceSelected,
  onFindingSelect,
  onTriggerTemporalComparison,
}: StreetViewEvidenceRibbonProps) {
  const activeSelectedId = selectedEvidenceId || selectedFindingId;

  // 1. Unificar y adaptar candidato pool desde props directos o legacy (findings / captures)
  const candidatePool: GeoEvidence[] = useMemo(() => {
    const list: GeoEvidence[] = [];

    const isDuplicate = (candidate: GeoEvidence) =>
      list.some(
        (existing) =>
          existing.id === candidate.id ||
          ((existing.metadata as any)?.panoramaId &&
            (candidate.metadata as any)?.panoramaId &&
            (existing.metadata as any).panoramaId === (candidate.metadata as any).panoramaId) ||
          (existing.imageReference && candidate.imageReference && existing.imageReference === candidate.imageReference) ||
          (existing.coordinates?.lat === candidate.coordinates?.lat &&
            existing.coordinates?.lng === candidate.coordinates?.lng &&
            existing.metadata.heading === candidate.metadata.heading)
      );

    for (const c of candidates) {
      if (!isDuplicate(c)) {
        list.push(c);
      }
    }

    if (findings && Array.isArray(findings)) {
      for (const f of findings) {
        const adapted = adaptStreetViewFindingToGeoEvidence(f);
        if (adapted && !isDuplicate(adapted)) {
          list.push(adapted);
        }
      }
    }

    if (captures && Array.isArray(captures)) {
      for (const c of captures) {
        const adapted = adaptSweepPayloadToGeoEvidence(c, expedienteId);
        if (adapted && !isDuplicate(adapted)) {
          list.push(adapted);
        }
      }
    }

    return list;
  }, [candidates, findings, captures, expedienteId]);

  // 2. Resolver la evidencia de referencia activa
  const activeReference: GeoEvidence | null = useMemo(() => {
    if (referenceEvidence && referenceEvidence.coordinates) {
      return referenceEvidence;
    }
    // Si no se proporcionó referencia explícita, tomar el primer candidato con coordenadas válidas
    return candidatePool.length > 0 ? candidatePool[0] : null;
  }, [referenceEvidence, candidatePool]);

  // 3. Filtrar candidatos usando el servicio de compatibilidad geoespacial
  const compatibleEvidenceList: GeoEvidence[] = useMemo(() => {
    if (!activeReference) return [];
    return filterCompatibleEvidence(activeReference, candidatePool, toleranceMeters);
  }, [activeReference, candidatePool, toleranceMeters]);

  // Manejador de selección con objeto GeoEvidence completo
  const handleSelect = (evidence: GeoEvidence) => {
    if (onEvidenceSelected) {
      onEvidenceSelected(evidence);
    }
    if (onTriggerTemporalComparison) {
      onTriggerTemporalComparison(evidence);
    }
    // Mantenimiento de compatibilidad para handlers legacy que esperan el contrato previo
    if (onFindingSelect) {
      onFindingSelect({
        id: evidence.id,
        expedienteId: evidence.expedienteId,
        categoria: evidence.metadata.category || "COMPARACION_TEMPORAL",
        coordenadas: evidence.coordinates,
        imagen: evidence.imageReference,
        heading: evidence.metadata.heading,
        pitch: evidence.metadata.pitch,
        fov: evidence.metadata.fov,
        estado: evidence.status,
        fechaCreacion: evidence.captureDate,
        origenRevision: evidence.source === "STREET_VIEW_MANUAL" ? "MANUAL" : "BARRIDO_AUTOMATICO",
      });
    }
  };

  // Badge y etiquetas por fuente GEOINT
  const getSourceBadge = (source: GeoEvidenceSource) => {
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

  if (!activeReference || (compatibleEvidenceList.length === 0 && !activeReference)) {
    return (
      <div className="w-full border-t border-slate-800 bg-slate-950 p-3 text-center font-mono text-xs text-slate-500">
        [CINTILLA INTELIGENTE GEOINT] Sin evidencias compatibles en el radio de {toleranceMeters}m para el expediente {expedienteId}.
      </div>
    );
  }

  return (
    <div className="w-full border-t border-slate-800 bg-slate-950/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
      {/* Encabezado Inteligente de Proximidad */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Cintilla Inteligente de Evidencias Compatibles (R ≤ {toleranceMeters}m)
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            {compatibleEvidenceList.length + 1} coincidencia(s)
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
          <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-300">
            Ref: {activeReference.coordinates.lat != null && activeReference.coordinates.lng != null
              ? `${activeReference.coordinates.lat.toFixed(5)}, ${activeReference.coordinates.lng.toFixed(5)}`
              : "Sin georreferencia"}
          </span>
          <span className="text-emerald-400 font-bold">ADR-019.13-F2</span>
        </div>
      </div>

      {/* Ribbon con Scroll Horizontal de Evidencias Compatibles */}
      <div className="flex space-x-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        
        {/* Renderizar Primero la Evidencia de Referencia */}
        {activeReference && (
          <div
            onClick={() => handleSelect(activeReference)}
            className={`group relative flex min-w-[240px] max-w-[260px] cursor-pointer flex-col rounded-lg border p-2 transition-all hover:scale-[1.02] border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500 shadow-lg`}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded border border-emerald-800/80 bg-slate-950">
              {activeReference.imageReference ? (
                <img
                  src={activeReference.imageReference}
                  alt={activeReference.id}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-900 text-[10px] text-slate-500">
                  Sin Previsualización
                </div>
              )}
              <span className="absolute top-1 left-1 rounded bg-emerald-500/90 text-black px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider shadow">
                EVIDENCIA REFERENCIA
              </span>
            </div>

            <div className="mt-2 space-y-1 text-left text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-300 truncate max-w-[130px]">
                  {activeReference.id}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeReference.captureDate || "Fecha In Situ"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${getSourceBadge(activeReference.source).color}`}>
                  {getSourceBadge(activeReference.source).label}
                </span>
                <span className="text-emerald-400 font-mono font-bold text-[9px]">0 m (ORIGEN)</span>
              </div>
            </div>
          </div>
        )}

        {/* Renderizar Evidencias Candidatas Compatibles */}
        {compatibleEvidenceList.map((item) => {
          const isSelected = activeSelectedId === item.id;
          const badgeMeta = getSourceBadge(item.source);
          const distanceMeta = getEvidenceDistanceDetail(activeReference, item);

          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`group relative flex min-w-[240px] max-w-[260px] cursor-pointer flex-col rounded-lg border p-2 transition-all hover:scale-[1.02] hover:shadow-lg ${
                isSelected
                  ? "border-amber-500 bg-amber-950/40 ring-1 ring-amber-500"
                  : "border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              {/* Contenedor Vista Previa */}
              <div className="relative aspect-video w-full overflow-hidden rounded border border-slate-800 bg-slate-950">
                {item.imageReference ? (
                  <img
                    src={item.imageReference}
                    alt={item.id}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-[10px] text-slate-500">
                    Sin Vista Previa
                  </div>
                )}
                
                {/* Badge de Validación Geoespacial */}
                <span className="absolute top-1 left-1 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider shadow">
                  VALIDATED GEO MATCH
                </span>

                <span
                  className={`absolute top-1 right-1 rounded px-1.5 py-0.5 text-[8px] font-bold shadow ${
                    item.status === "APPROVED_EVIDENCE"
                      ? "bg-emerald-500/90 text-white"
                      : item.status === "REJECTED_FINDING"
                      ? "bg-rose-500/90 text-white"
                      : "bg-amber-500/90 text-black"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {/* Metadatos Forenses */}
              <div className="mt-2 space-y-1 text-left text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-200 truncate max-w-[130px]">
                    {item.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.captureDate || "Sin Fecha"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${badgeMeta.color}`}>
                    {badgeMeta.label}
                  </span>
                  <span className="text-cyan-400 font-mono font-bold text-[9px]">
                    📍 {distanceMeta.formattedDistance}
                  </span>
                </div>

                <div className="text-[9px] text-slate-500 font-mono truncate">
                  {item.coordinates.lat != null && item.coordinates.lng != null
                    ? `LAT: ${item.coordinates.lat.toFixed(5)} / LNG: ${item.coordinates.lng.toFixed(5)}`
                    : "SIN GEORREFERENCIA"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
