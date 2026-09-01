"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ProfessionalGeoMap } from "@/components/maps/ProfessionalGeoMap";
import type { CrimeIncidenceWorkspaceViewModel } from "@/utils/crimeIncidenceWorkspaceAdapter";

interface CrimeIncidenceMapProps {
  viewModel: CrimeIncidenceWorkspaceViewModel;
}

export interface CrimeIncidenceRendererGeography {
  polygonCoords?: Array<{ lat: number; lng: number }>;
  lineCoords?: Array<{ lat: number; lng: number }>;
  center: { lat: number; lng: number };
  hasCoordinates: true;
}

export function getCrimeIncidenceRendererGeography(
  viewModel: CrimeIncidenceWorkspaceViewModel
): CrimeIncidenceRendererGeography | null {
  const resolved = viewModel.geographyContext.geographicResolution.geometry;
  const canonical = viewModel.geographyContext.canonicalGeography;

  if (resolved.mode === "POINT_RADIUS") {
    const [lng, lat] = resolved.geometry.coordinates;
    return { center: { lat, lng }, hasCoordinates: true };
  }

  if (resolved.mode === "CORRIDOR_COVERAGE") {
    const first = resolved.geometry.coordinates[0];
    if (!first) return null;
    return {
      center: { lat: first[1], lng: first[0] },
      lineCoords: resolved.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      hasCoordinates: true,
    };
  }

  const ring = resolved.geometry.coordinates[0] ?? [];
  const first = ring[0];
  if (!first) return null;
  return {
    center: { lat: first[1], lng: first[0] },
    polygonCoords: ring.map(([lng, lat]) => ({ lat, lng })),
    hasCoordinates: true,
  };
}

export function CrimeIncidenceMap({ viewModel }: CrimeIncidenceMapProps) {
  const geography = useMemo(() => getCrimeIncidenceRendererGeography(viewModel), [viewModel]);
  const [renderProgress, setRenderProgress] = useState({ rendered: 0, total: viewModel.incidents.matched.length });
  const handleRenderProgress = useCallback((rendered: number, total: number) => {
    setRenderProgress((current) => current.rendered === rendered && current.total === total ? current : { rendered, total });
  }, []);
  if (!geography) {
    return (
      <div className="flex h-full min-h-[420px] w-full items-center justify-center bg-slate-950 text-center">
        <p className="text-xs font-semibold uppercase text-amber-300">Cobertura geográfica no disponible</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[360px] w-full sm:min-h-[420px]" data-testid="crime-incidence-map">
      <ProfessionalGeoMap
        geografiaRectora={geography}
        crimeIncidents={viewModel.incidents.matched}
        crimeIncidenceMinimumHeight="100%"
        onCrimeIncidenceRenderProgress={handleRenderProgress}
        showLayerControls={false}
      />
      <div className="pointer-events-none absolute bottom-3 right-4 z-10 select-none text-2xl font-black tracking-widest text-white/15">
        {viewModel.institutionalMetadata.watermark}
      </div>
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] gap-1 overflow-x-auto rounded-md border border-slate-700 bg-slate-950/90 p-1.5 shadow-lg">
        {[
          ["Capas", "Controles de capas reservados"],
          ["Incidencias", `${viewModel.incidents.matched.length} autorizadas`],
          ["Geografía expediente", viewModel.geographyContext.geographicResolution.geometryType],
        ].map(([name, title]) => (
          <button key={name} type="button" disabled title={title} className="whitespace-nowrap rounded px-2.5 py-1 text-[10px] font-semibold text-slate-300 disabled:opacity-100">
            {name}
          </button>
        ))}
      </div>
      {renderProgress.rendered < renderProgress.total ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 border border-slate-700 bg-slate-950/90 px-3 py-2 text-[10px] font-semibold text-slate-300">
          Cargando incidencias {renderProgress.rendered} de {renderProgress.total}
        </div>
      ) : null}
    </div>
  );
}

export default CrimeIncidenceMap;
