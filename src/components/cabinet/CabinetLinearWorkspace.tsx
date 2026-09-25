"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import {
  assessCorridorIntegrity,
  corridorVertexRole,
  type CorridorVertexRole,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";

type LinearWorkflowStep = "START" | "NEXT_NODE" | "INTERMEDIATE" | "END" | "REVIEW";

type LinearVertex = {
  id: string;
  point: LatLngPoint;
};

interface CabinetLinearWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
}

const INITIAL_CENTER: LatLngPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

function displayRole(role: CorridorVertexRole, index: number) {
  if (role === "START") return "NI";
  if (role === "END") return "NF";
  return `PI ${index}`;
}

export function CabinetLinearWorkspace({ onBack, onCancel }: CabinetLinearWorkspaceProps) {
  const [vertices, setVertices] = useState<LinearVertex[]>([]);
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null);
  const [captureByVertexId, setCaptureByVertexId] = useState<Record<string, StreetViewCapturePayload>>({});
  const [workflowStep, setWorkflowStep] = useState<LinearWorkflowStep>("START");
  const [geometryConfirmed, setGeometryConfirmed] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<LatLngPoint | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const nextVertexId = useRef(1);
  const lastFittedVertexCount = useRef(0);

  const apiKey = typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
    : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const vertexPath = useMemo(() => vertices.map((vertex) => vertex.point), [vertices]);
  const corridorIntegrity = useMemo(() => assessCorridorIntegrity(vertexPath), [vertexPath]);
  const allVerticesCaptured = vertices.length > 0 && vertices.every((vertex) => Boolean(captureByVertexId[vertex.id]));
  const canValidateGeometry = workflowStep === "REVIEW" && corridorIntegrity.isValid && allVerticesCaptured;
  const canSelectPoint = workflowStep === "START" || workflowStep === "INTERMEDIATE" || workflowStep === "END";

  useEffect(() => {
    if (!mapInstance || vertexPath.length < 2 || lastFittedVertexCount.current === vertexPath.length) return;
    const bounds = new google.maps.LatLngBounds();
    vertexPath.forEach((point) => bounds.extend(point));
    mapInstance.fitBounds(bounds, 48);
    lastFittedVertexCount.current = vertexPath.length;
  }, [mapInstance, vertexPath]);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!canSelectPoint || !event.latLng) return;

    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    const vertexId = `cabinet-linear-vertex-${nextVertexId.current++}`;
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
    setWorkflowStep(workflowStep === "END" ? "REVIEW" : "NEXT_NODE");
    setPendingPoint(null);
    setActiveVertexId(null);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(false);
  };

  const chooseNextStep = (step: "INTERMEDIATE" | "END") => {
    setPendingPoint(null);
    setActiveVertexId(null);
    setIsStreetViewOpen(false);
    setWorkflowStep(step);
  };

  const reviewRole = (index: number) => corridorVertexRole(index, vertices.length);
  const pendingRole = workflowStep === "START" ? "NI" : workflowStep === "END" ? "NF" : `PI ${Math.max(1, vertices.length)}`;
  const mapCenter = pendingPoint ?? vertices[vertices.length - 1]?.point ?? INITIAL_CENTER;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-400">Modalidad Gabinete</p>
          <h3 className="mt-1 text-lg font-bold text-slate-100">Corredor Lineal</h3>
          <p className="mt-1 text-sm text-slate-400">Defina NI, los PI necesarios y NF mediante selección territorial explícita.</p>
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
                onLoad={setMapInstance}
                onUnmount={() => setMapInstance(null)}
                options={{
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                  gestureHandling: "greedy",
                }}
              >
                {vertexPath.length >= 2 && (
                  <Polyline
                    path={vertexPath}
                    options={{ strokeColor: "#38bdf8", strokeOpacity: 0.95, strokeWeight: 4, clickable: false }}
                  />
                )}
                {vertices.map((vertex, index) => {
                  const role = workflowStep === "REVIEW" ? reviewRole(index) : index === 0 ? "START" : "INTERMEDIATE";
                  return (
                    <Marker
                      key={vertex.id}
                      position={vertex.point}
                      title={`${displayRole(role, index)} - nodo territorial`}
                      label={{ text: displayRole(role, index), color: "#ffffff", fontWeight: "700" }}
                    />
                  );
                })}
                {pendingPoint && <Marker position={pendingPoint} title={`${pendingRole} pendiente de captura`} />}
              </GoogleMap>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
            {canSelectPoint ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {pendingPoint
                    ? `${pendingRole} territorial: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}`
                    : `Seleccione en el mapa la coordenada territorial para ${pendingRole}.`}
                </p>
                {pendingPoint && (
                  <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>
                    Abrir Street View
                  </CEIPOLButton>
                )}
              </div>
            ) : workflowStep === "NEXT_NODE" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-400">Seleccione el siguiente tipo de nodo territorial.</p>
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton type="button" variant="secondary" onClick={() => chooseNextStep("INTERMEDIATE")}>Agregar PI</CEIPOLButton>
                  <CEIPOLButton type="button" variant="primary" onClick={() => chooseNextStep("END")}>Definir NF</CEIPOLButton>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Corredor completo en revisión humana.</p>
            )}
          </div>
        </section>

        <section className="w-full space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-400">Street View por nodo</p>
              <p className="mt-1 text-xs text-slate-400">Las capturas documentan cada nodo; no construyen la Polyline.</p>
            </div>
            <span className="text-xs font-bold text-slate-300">{vertices.length} nodo(s) aceptado(s)</span>
          </div>

          {vertices.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-slate-500">
              La inspección Street View de NI aparecerá aquí después de aceptar la captura.
            </div>
          ) : (
            <div className="space-y-4">
              {vertices.map((vertex, index) => {
                const capture = captureByVertexId[vertex.id];
                const role = workflowStep === "REVIEW" ? reviewRole(index) : index === 0 ? "START" : "INTERMEDIATE";
                return (
                  <article key={vertex.id} className="border border-slate-800 bg-slate-900/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-100">{displayRole(role, index)}</h4>
                      <span className="font-mono text-xs text-cyan-300">{vertex.point.lat.toFixed(6)}, {vertex.point.lng.toFixed(6)}</span>
                    </div>
                    {capture && (
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capture.dataUrl} alt={`Captura Street View ${displayRole(role, index)}`} className="max-h-[460px] w-full object-contain" />
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
              <p className={`text-sm font-bold ${corridorIntegrity.isValid ? "text-emerald-300" : "text-amber-300"}`}>
                {corridorIntegrity.isValid
                  ? `Corredor válido: ${corridorIntegrity.nodeCount} nodos y ${corridorIntegrity.uniquePositionCount} posiciones distintas.`
                  : "El corredor no cumple la integridad territorial requerida."}
              </p>
              {geometryConfirmed && (
                <p className="border border-emerald-800 bg-emerald-950/40 p-3 text-center text-sm font-bold text-emerald-300">
                  Geometría lineal validada
                </p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CEIPOLButton type="button" variant="confirm" disabled={!canValidateGeometry || geometryConfirmed} onClick={() => setGeometryConfirmed(true)}>
                  Validar geometría
                </CEIPOLButton>
                <CEIPOLButton type="button" variant="secondary" disabled={!geometryConfirmed} onClick={() => setGeometryConfirmed(false)}>
                  Editar
                </CEIPOLButton>
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
