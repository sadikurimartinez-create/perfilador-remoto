"use client";

import { useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import {
  buildDraftGeographyPreview,
  canonicalCoordinateKey,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";

type PolygonVertex = {
  id: string;
  point: LatLngPoint;
};

type PolygonWorkflowStep = "BUILDING" | "REVIEW";

interface CabinetPolygonWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
}

const INITIAL_CENTER: LatLngPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

export function CabinetPolygonWorkspace({ onBack, onCancel }: CabinetPolygonWorkspaceProps) {
  const [vertices, setVertices] = useState<PolygonVertex[]>([]);
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null);
  const [captureByVertexId, setCaptureByVertexId] = useState<Record<string, StreetViewCapturePayload>>({});
  const [pendingPoint, setPendingPoint] = useState<LatLngPoint | null>(null);
  const [workflowStep, setWorkflowStep] = useState<PolygonWorkflowStep>("BUILDING");
  const [geometryConfirmed, setGeometryConfirmed] = useState(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [isSelectingVertex, setIsSelectingVertex] = useState(true);
  const nextVertexId = useRef(1);

  const apiKey = typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
    : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const vertexPath = useMemo(() => vertices.map((vertex) => vertex.point), [vertices]);
  const canonicalPreview = useMemo(() => buildDraftGeographyPreview({
    type: "POLYGON",
    points: vertexPath,
    confirmed: false,
  }), [vertexPath]);
  const uniquePositionCount = useMemo(
    () => new Set(vertexPath.map(canonicalCoordinateKey)).size,
    [vertexPath],
  );
  const allVerticesCaptured = vertices.length > 0
    && vertices.every((vertex) => Boolean(captureByVertexId[vertex.id]));
  const hasPendingCandidate = Boolean(pendingPoint || activeVertexId);
  const hasMinimumVertices = vertices.length >= 3 && uniquePositionCount >= 3;
  const polygonIntegrityValid = hasMinimumVertices
    && allVerticesCaptured
    && !hasPendingCandidate
    && canonicalPreview.canConfirm;
  const canClosePolygon = workflowStep === "BUILDING" && polygonIntegrityValid;
  const canValidateGeometry = workflowStep === "REVIEW" && polygonIntegrityValid;
  const nextVertexLabel = `V${vertices.length + 1}`;
  const mapCenter = pendingPoint ?? vertices[vertices.length - 1]?.point ?? INITIAL_CENTER;

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (workflowStep !== "BUILDING" || !isSelectingVertex || hasPendingCandidate || !event.latLng) return;

    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    const vertexId = `cabinet-polygon-vertex-${nextVertexId.current++}`;
    setPendingPoint(point);
    setActiveVertexId(vertexId);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(true);
  };

  const handleCapture = (payload: StreetViewCapturePayload) => {
    if (!pendingPoint || !activeVertexId) return;

    const acceptedVertex = { id: activeVertexId, point: pendingPoint };
    setVertices((current) => [...current, acceptedVertex]);
    setCaptureByVertexId((current) => ({ ...current, [activeVertexId]: payload }));
    setPendingPoint(null);
    setActiveVertexId(null);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(false);
    setIsSelectingVertex(vertices.length + 1 < 3);
  };

  const prepareNextVertex = () => {
    if (workflowStep !== "BUILDING" || hasPendingCandidate) return;
    setGeometryConfirmed(false);
    setIsSelectingVertex(true);
  };

  const closePolygon = () => {
    if (!canClosePolygon) return;
    setWorkflowStep("REVIEW");
    setIsSelectingVertex(false);
    setGeometryConfirmed(false);
  };

  const returnToBuilding = () => {
    setWorkflowStep("BUILDING");
    setGeometryConfirmed(false);
    setIsSelectingVertex(false);
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-400">Modalidad Gabinete</p>
          <h3 className="mt-1 text-lg font-bold text-slate-100">Polígono Territorial</h3>
          <p className="mt-1 text-sm text-slate-400">Defina cada vértice territorial y documente su vista antes de cerrar el área.</p>
        </div>
        <div className="flex gap-2">
          <CEIPOLButton type="button" variant="ghost" onClick={onBack}>Volver</CEIPOLButton>
          <CEIPOLButton type="button" variant="ghost" onClick={onCancel}>Cancelar</CEIPOLButton>
        </div>
      </div>

      <div className="space-y-5">
        <section className="w-full space-y-3">
          <div className="h-[420px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
            {!apiKey || loadError ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-amber-300">
                Google Maps no está disponible. Verifique la clave pública configurada.
              </div>
            ) : !isLoaded ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Cargando mapa...</div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={15}
                onClick={handleMapClick}
                options={{
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                  gestureHandling: "greedy",
                }}
              >
                {vertices.map((vertex, index) => (
                  <Marker
                    key={vertex.id}
                    position={vertex.point}
                    title={`V${index + 1} - vértice territorial`}
                    label={{ text: `V${index + 1}`, color: "#ffffff", fontWeight: "700" }}
                  />
                ))}
                {pendingPoint && <Marker position={pendingPoint} title={`${nextVertexLabel} pendiente de captura`} />}
                {vertexPath.length >= 2 && (
                  <Polygon
                    paths={vertexPath}
                    options={{
                      fillColor: "#06b6d4",
                      fillOpacity: vertexPath.length >= 3 ? 0.16 : 0,
                      strokeColor: "#38bdf8",
                      strokeOpacity: 0.95,
                      strokeWeight: 3,
                      clickable: false,
                    }}
                  />
                )}
              </GoogleMap>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
            {workflowStep === "BUILDING" ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {pendingPoint
                      ? `${nextVertexLabel} territorial: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}`
                      : isSelectingVertex
                        ? `Seleccione en el mapa la coordenada territorial para ${nextVertexLabel}.`
                        : "Elija agregar otro vértice o cerrar el polígono."}
                  </p>
                  {pendingPoint && (
                    <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>Abrir Street View</CEIPOLButton>
                  )}
                </div>
                {vertices.length >= 3 && !pendingPoint && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <CEIPOLButton type="button" variant="secondary" onClick={prepareNextVertex}>Agregar vértice</CEIPOLButton>
                    <CEIPOLButton type="button" variant="primary" disabled={!canClosePolygon} onClick={closePolygon}>Cerrar polígono</CEIPOLButton>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-400">Polígono cerrado visualmente y listo para revisión humana.</p>
            )}
          </div>
        </section>

        <section className="w-full space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-400">Street View por vértice</p>
              <p className="mt-1 text-xs text-slate-400">Las capturas documentan cada vértice; no construyen el Polygon.</p>
            </div>
            <span className="text-xs font-bold text-slate-300">{vertices.length} vértice(s) aceptado(s)</span>
          </div>

          {vertices.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-slate-500">
              La inspección Street View de V1 aparecerá aquí después de aceptar la captura.
            </div>
          ) : (
            <div className="space-y-4">
              {vertices.map((vertex, index) => {
                const capture = captureByVertexId[vertex.id];
                return (
                  <article key={vertex.id} className="border border-slate-800 bg-slate-900/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-100">V{index + 1}</h4>
                      <span className="font-mono text-xs text-cyan-300">{vertex.point.lat.toFixed(6)}, {vertex.point.lng.toFixed(6)}</span>
                    </div>
                    {capture && (
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capture.dataUrl} alt={`Captura Street View V${index + 1}`} className="max-h-[460px] w-full object-contain" />
                        <dl className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          <div><dt className="text-slate-500">Coordenada territorial</dt><dd className="font-mono">{vertex.point.lat.toFixed(6)}, {vertex.point.lng.toFixed(6)}</dd></div>
                          <div><dt className="text-slate-500">Cámara Google</dt><dd className="font-mono">{capture.panoramaLat.toFixed(6)}, {capture.panoramaLng.toFixed(6)}</dd></div>
                          <div><dt className="text-slate-500">Heading</dt><dd>{capture.heading}°</dd></div>
                          <div><dt className="text-slate-500">Pitch / FOV</dt><dd>{capture.pitch}° / {capture.fov}°</dd></div>
                          {capture.panoId && <div><dt className="text-slate-500">Pano ID</dt><dd className="break-all font-mono">{capture.panoId}</dd></div>}
                          {capture.captureDate && <div><dt className="text-slate-500">Fecha de cobertura</dt><dd>{capture.captureDate}</dd></div>}
                        </dl>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {workflowStep === "REVIEW" && (
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <p>Vértices: <strong>{vertices.length}</strong></p>
                <p>Posiciones únicas: <strong>{uniquePositionCount}</strong></p>
                <p>Capturas: <strong>{allVerticesCaptured ? "Completas" : "Incompletas"}</strong></p>
              </div>
              <p className={`text-sm font-bold ${canonicalPreview.canConfirm ? "text-emerald-300" : "text-amber-300"}`}>
                {canonicalPreview.canConfirm ? "Integridad canónica válida para revisión." : "La integridad canónica del polígono es insuficiente."}
              </p>
              {geometryConfirmed && (
                <p className="border border-emerald-800 bg-emerald-950/40 p-3 text-center text-sm font-bold text-emerald-300">Geometría poligonal validada</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CEIPOLButton type="button" variant="confirm" disabled={!canValidateGeometry || geometryConfirmed} onClick={() => setGeometryConfirmed(true)}>Validar geometría</CEIPOLButton>
                <CEIPOLButton type="button" variant="secondary" onClick={returnToBuilding}>Volver a construcción</CEIPOLButton>
              </div>
            </div>
          )}
        </section>
      </div>

      {pendingPoint && activeVertexId && (
        <StreetViewPanoramaPicker
          isOpen={isStreetViewOpen}
          lat={pendingPoint.lat}
          lng={pendingPoint.lng}
          onClose={() => setIsStreetViewOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </div>
  );
}
