import * as React from "react";
import { InfoWindow, Marker } from "@react-google-maps/api";
import type { CanonicalCrimeIncident } from "@/types/crimeIncidenceWorkspace";

export interface CrimeIncidenceLayerPoint {
  technicalId: string;
  coordinates: CanonicalCrimeIncident["coordinates"];
  occurredDate: string | null;
  incidentType: string | null;
  source: CanonicalCrimeIncident["source"];
  coverageStatus: CanonicalCrimeIncident["coverage"]["geographic"];
}

interface CrimeIncidenceLayerProps {
  visible: boolean;
  matchedRecords: CanonicalCrimeIncident[];
  batchSize?: number;
  onRenderProgress?: (rendered: number, total: number) => void;
}

export const CRIME_INCIDENCE_RENDER_BATCH_SIZE = 250;

export function getNextCrimeIncidenceRenderCount(current: number, total: number, batchSize: number): number {
  return Math.min(current + batchSize, total);
}

export function toCrimeIncidenceLayerPoints(
  matchedRecords: readonly CanonicalCrimeIncident[]
): CrimeIncidenceLayerPoint[] {
  return matchedRecords.map((incident) => ({
    technicalId: incident.id,
    coordinates: incident.coordinates,
    occurredDate: incident.occurredDate,
    incidentType: incident.incidentType,
    source: incident.source,
    coverageStatus: incident.coverage.geographic,
  }));
}

function label(value: string | null | undefined): string {
  return value && value.trim() ? value : "No disponible";
}

export function CrimeIncidenceLayer({
  visible,
  matchedRecords,
  batchSize = CRIME_INCIDENCE_RENDER_BATCH_SIZE,
  onRenderProgress,
}: CrimeIncidenceLayerProps) {
  const [activePoint, setActivePoint] = React.useState<CrimeIncidenceLayerPoint | null>(null);
  const points = React.useMemo(() => toCrimeIncidenceLayerPoints(matchedRecords), [matchedRecords]);
  const [renderedCount, setRenderedCount] = React.useState(() => Math.min(batchSize, points.length));

  React.useEffect(() => {
    setActivePoint(null);
    setRenderedCount(Math.min(batchSize, points.length));
  }, [batchSize, points]);

  React.useEffect(() => {
    if (!visible || renderedCount >= points.length) return;
    const frame = window.requestAnimationFrame(() => {
      setRenderedCount((current) => getNextCrimeIncidenceRenderCount(current, points.length, batchSize));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [batchSize, points.length, renderedCount, visible]);

  React.useEffect(() => {
    onRenderProgress?.(visible ? renderedCount : 0, visible ? points.length : 0);
  }, [onRenderProgress, points.length, renderedCount, visible]);

  if (!visible) return null;
  const visiblePoints = points.slice(0, renderedCount);

  return React.createElement(
    React.Fragment,
    null,
    ...visiblePoints.map((point) => {
      const lat = point.coordinates.lat;
      const lng = point.coordinates.lng;
      if (lat === null || lng === null) return null;
      const source = point.source.sourceReference ?? point.source.sourceFile ?? point.source.querySource;
      return React.createElement(
        React.Fragment,
        { key: point.technicalId },
        React.createElement(Marker, {
          position: { lat, lng },
          title: `${label(point.incidentType)} | ${label(point.occurredDate)}`,
          onClick: () => setActivePoint(point),
        }),
        activePoint?.technicalId === point.technicalId
          ? React.createElement(
              InfoWindow,
              { position: { lat, lng }, onCloseClick: () => setActivePoint(null) },
              React.createElement(
                "div",
                { className: "max-w-[240px] space-y-1 p-2 text-xs text-slate-900" },
                React.createElement("p", { className: "font-bold" }, label(point.incidentType)),
                React.createElement("p", null, `Fecha: ${label(point.occurredDate)}`),
                React.createElement("p", null, `Fuente: ${label(source)}`),
                React.createElement("p", null, `Cobertura: ${label(point.coverageStatus)}`),
                React.createElement("p", { className: "font-mono text-[10px]" }, `ID: ${point.technicalId}`),
                React.createElement(
                  "p",
                  { className: "font-mono text-[10px]" },
                  `Original: ${label(point.coordinates.originalLat?.toString())}, ${label(point.coordinates.originalLng?.toString())}`
                )
              )
            )
          : null
      );
    })
  );
}

export default React.memo(CrimeIncidenceLayer);
