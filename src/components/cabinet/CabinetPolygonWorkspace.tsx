"use client";

import { useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { CEIPOLConfirmModal } from "@/components/ui/CEIPOLConfirmModal";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import {
  buildDraftGeographyPreview,
  canonicalCoordinateKey,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";
import {
  assessPolygonIntegrity,
  findNearestPolygonSegment,
} from "./cabinetPolygonGeometry";

type PolygonVertex = {
  id: string;
  point: LatLngPoint;
};

type PolygonWorkflowStep = "BUILDING" | "REVIEW";
type PolygonEditAction = "MOVE" | "ADD_VERTEX" | "DELETE_VERTEX" | null;
type PolygonPendingOperation =
  | { kind: "MOVE"; vertexId: string }
  | { kind: "INSERT"; vertexId: string; insertIndex: number };

interface CabinetPolygonWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
}

const INITIAL_CENTER: LatLngPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const MAX_INSERT_DISTANCE_METERS = 75;

export function CabinetPolygonWorkspace({ onBack, onCancel }: CabinetPolygonWorkspaceProps) {
  const [vertices, setVertices] = useState<PolygonVertex[]>([]);
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null);
  const [captureByVertexId, setCaptureByVertexId] = useState<Record<string, StreetViewCapturePayload>>({});
  const [pendingPoint, setPendingPoint] = useState<LatLngPoint | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PolygonPendingOperation | null>(null);
  const [workflowStep, setWorkflowStep] = useState<PolygonWorkflowStep>("BUILDING");
  const [geometryConfirmed, setGeometryConfirmed] = useState(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [isSelectingVertex, setIsSelectingVertex] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editAction, setEditAction] = useState<PolygonEditAction>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deleteConfirmationStage, setDeleteConfirmationStage] = useState<0 | 1 | 2>(0);
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
  const localIntegrity = useMemo(() => assessPolygonIntegrity(vertexPath), [vertexPath]);
  const uniquePositionCount = useMemo(
    () => new Set(vertexPath.map(canonicalCoordinateKey)).size,
    [vertexPath],
  );
  const allVerticesCaptured = vertices.length > 0
    && vertices.every((vertex) => Boolean(captureByVertexId[vertex.id]));
  const hasPendingCandidate = Boolean(pendingPoint || activeVertexId || pendingOperation);
  const hasMinimumVertices = vertices.length >= 3 && uniquePositionCount >= 3;
  const polygonIntegrityValid = hasMinimumVertices
    && canonicalPreview.canConfirm
    && localIntegrity.isValid;
  const canClosePolygon = workflowStep === "BUILDING"
    && polygonIntegrityValid
    && allVerticesCaptured
    && !hasPendingCandidate;
  const canFinishEditing = isEditing
    && polygonIntegrityValid
    && allVerticesCaptured
    && !hasPendingCandidate;
  const canValidateGeometry = workflowStep === "REVIEW" && polygonIntegrityValid
    && !isEditing
    && allVerticesCaptured
    && !hasPendingCandidate;
  const nextVertexLabel = `V${vertices.length + 1}`;
  const mapCenter = pendingPoint ?? vertices[vertices.length - 1]?.point ?? INITIAL_CENTER;

  const removeCapture = (vertexId: string) => {
    setCaptureByVertexId((current) => {
      const next = { ...current };
      delete next[vertexId];
      return next;
    });
  };

  const beginPendingCapture = (point: LatLngPoint, vertexId: string, operation: PolygonPendingOperation) => {
    setPendingPoint(point);
    setActiveVertexId(vertexId);
    setPendingOperation(operation);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(true);
  };

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng || hasPendingCandidate) return;
    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };

    if (isEditing && editAction === "MOVE" && selectedVertexId) {
      setVertices((current) => current.map((vertex) => (
        vertex.id === selectedVertexId ? { ...vertex, point } : vertex
      )));
      removeCapture(selectedVertexId);
      beginPendingCapture(point, selectedVertexId, { kind: "MOVE", vertexId: selectedVertexId });
      setEditMessage("Vértice movido. Realice una nueva captura Street View.");
      return;
    }

    if (isEditing && editAction === "ADD_VERTEX") {
      const nearestSegment = findNearestPolygonSegment(point, vertexPath);
      if (!nearestSegment || nearestSegment.distanceMeters > MAX_INSERT_DISTANCE_METERS) {
        setEditMessage("Seleccione un punto sobre una arista o a menos de 75 metros.");
        return;
      }
      const vertexId = `cabinet-polygon-vertex-${nextVertexId.current++}`;
      beginPendingCapture(point, vertexId, {
        kind: "INSERT",
        vertexId,
        insertIndex: nearestSegment.segmentIndex + 1,
      });
      setEditMessage(`Nuevo vértice candidato para la arista ${nearestSegment.segmentIndex + 1}.`);
      return;
    }

    if (workflowStep !== "BUILDING" || !isSelectingVertex || isEditing) return;
    const vertexId = `cabinet-polygon-vertex-${nextVertexId.current++}`;
    setPendingPoint(point);
    setActiveVertexId(vertexId);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(true);
  };

  const handleCapture = (payload: StreetViewCapturePayload) => {
    if (!pendingPoint || !activeVertexId) return;

    if (pendingOperation?.kind === "INSERT") {
      setVertices((current) => {
        const next = [...current];
        next.splice(pendingOperation.insertIndex, 0, {
          id: pendingOperation.vertexId,
          point: pendingPoint,
        });
        return next;
      });
      setEditMessage("Vértice insertado en la arista seleccionada.");
    } else if (pendingOperation?.kind === "MOVE") {
      setEditMessage("Vértice movido y captura Street View actualizada.");
    } else {
      const acceptedVertex = { id: activeVertexId, point: pendingPoint };
      setVertices((current) => [...current, acceptedVertex]);
      setIsSelectingVertex(vertices.length + 1 < 3);
    }

    setCaptureByVertexId((current) => ({ ...current, [activeVertexId]: payload }));
    setPendingPoint(null);
    setActiveVertexId(null);
    setPendingOperation(null);
    setSelectedVertexId(null);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(false);
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

  const startEditing = () => {
    setGeometryConfirmed(false);
    setIsEditing(true);
    setEditAction(null);
    setSelectedVertexId(null);
    setEditMessage("Seleccione una acción de edición estructural.");
  };

  const selectEditAction = (action: Exclude<PolygonEditAction, null>) => {
    if (hasPendingCandidate) return;
    setEditAction(action);
    setSelectedVertexId(null);
    setEditMessage(
      action === "MOVE"
        ? "Seleccione un vértice y después su nueva coordenada territorial."
        : action === "ADD_VERTEX"
          ? "Seleccione sobre o cerca de la arista donde desea insertar el vértice."
          : vertices.length > 3
            ? "Seleccione el vértice que desea borrar."
            : "No puede borrar: el polígono debe conservar al menos 3 vértices.",
    );
  };

  const finishEditing = () => {
    if (!canFinishEditing) return;
    setIsEditing(false);
    setEditAction(null);
    setSelectedVertexId(null);
    setEditMessage(null);
  };

  const selectVertexForMove = (vertexId: string) => {
    if (!isEditing || editAction !== "MOVE" || hasPendingCandidate) return;
    setSelectedVertexId(vertexId);
    setEditMessage("Vértice seleccionado. Marque su nueva coordenada territorial en el mapa.");
  };

  const requestVertexDeletion = (vertexId: string) => {
    if (!isEditing || editAction !== "DELETE_VERTEX" || hasPendingCandidate || vertices.length <= 3) return;
    setDeleteCandidateId(vertexId);
    setDeleteConfirmationStage(1);
  };

  const cancelVertexDeletion = () => {
    setDeleteCandidateId(null);
    setDeleteConfirmationStage(0);
  };

  const confirmVertexDeletion = () => {
    if (!deleteCandidateId || vertices.length <= 3) {
      cancelVertexDeletion();
      return;
    }
    setVertices((current) => current.filter((vertex) => vertex.id !== deleteCandidateId));
    removeCapture(deleteCandidateId);
    setGeometryConfirmed(false);
    setSelectedVertexId(null);
    setEditMessage("Vértice eliminado. La geometría fue recalculada.");
    cancelVertexDeletion();
  };

  const integrityMessages = [
    localIntegrity.hasSelfIntersection ? "AUTO-INTERSECCIÓN DETECTADA" : null,
    localIntegrity.isDegenerate ? "ÁREA DEGENERADA" : null,
    localIntegrity.hasConsecutiveDuplicates ? "VÉRTICES DUPLICADOS" : null,
    !allVerticesCaptured || hasPendingCandidate ? "CAPTURAS PENDIENTES" : null,
    polygonIntegrityValid && allVerticesCaptured && !hasPendingCandidate ? "GEOMETRÍA VÁLIDA" : null,
  ].filter((message): message is string => Boolean(message));

  const pendingLabel = pendingOperation?.kind === "MOVE"
    ? "Vértice movido"
    : pendingOperation?.kind === "INSERT"
      ? `V${pendingOperation.insertIndex + 1}`
      : nextVertexLabel;

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
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-amber-300">Google Maps no está disponible. Verifique la clave pública configurada.</div>
            ) : !isLoaded ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Cargando mapa...</div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={15}
                onClick={handleMapClick}
                options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy" }}
              >
                {vertices.map((vertex, index) => (
                  <Marker
                    key={vertex.id}
                    position={vertex.point}
                    title={`V${index + 1} - vértice territorial`}
                    label={{ text: `V${index + 1}`, color: "#ffffff", fontWeight: "700" }}
                    onClick={() => {
                      if (editAction === "MOVE") selectVertexForMove(vertex.id);
                      if (editAction === "DELETE_VERTEX") requestVertexDeletion(vertex.id);
                    }}
                  />
                ))}
                {pendingPoint && pendingOperation?.kind !== "MOVE" && <Marker position={pendingPoint} title={`${pendingLabel} pendiente de captura`} />}
                {vertexPath.length >= 2 && (
                  <Polygon
                    paths={vertexPath}
                    options={{
                      fillColor: localIntegrity.isValid ? "#06b6d4" : "#ef4444",
                      fillOpacity: vertexPath.length >= 3 ? 0.16 : 0,
                      strokeColor: localIntegrity.isValid ? "#38bdf8" : "#fb7185",
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
            {isEditing ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton type="button" variant={editAction === "MOVE" ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectEditAction("MOVE")}>Mover vértice</CEIPOLButton>
                  <CEIPOLButton type="button" variant={editAction === "ADD_VERTEX" ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectEditAction("ADD_VERTEX")}>Agregar vértice sobre arista</CEIPOLButton>
                  <CEIPOLButton type="button" variant={editAction === "DELETE_VERTEX" ? "danger" : "secondary"} disabled={hasPendingCandidate || vertices.length <= 3} onClick={() => selectEditAction("DELETE_VERTEX")}>Borrar vértice</CEIPOLButton>
                  <CEIPOLButton type="button" variant="confirm" disabled={!canFinishEditing} onClick={finishEditing}>Finalizar edición</CEIPOLButton>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-slate-400">
                    {pendingPoint
                      ? `${pendingLabel}: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}. Captura pendiente.`
                      : editMessage}
                  </p>
                  {pendingPoint && <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>Abrir Street View</CEIPOLButton>}
                </div>
              </>
            ) : workflowStep === "BUILDING" ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {pendingPoint
                      ? `${nextVertexLabel} territorial: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}`
                      : isSelectingVertex
                        ? `Seleccione en el mapa la coordenada territorial para ${nextVertexLabel}.`
                        : "Elija agregar otro vértice o cerrar el polígono."}
                  </p>
                  {pendingPoint && <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>Abrir Street View</CEIPOLButton>}
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
            <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-slate-500">La inspección Street View de V1 aparecerá aquí después de aceptar la captura.</div>
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
                    {isEditing && editAction === "MOVE" && (
                      <CEIPOLButton type="button" size="sm" variant={selectedVertexId === vertex.id ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectVertexForMove(vertex.id)}>Mover V{index + 1}</CEIPOLButton>
                    )}
                    {isEditing && editAction === "DELETE_VERTEX" && (
                      <CEIPOLButton type="button" size="sm" variant="danger" disabled={vertices.length <= 3 || hasPendingCandidate} onClick={() => requestVertexDeletion(vertex.id)}>Borrar V{index + 1}</CEIPOLButton>
                    )}
                    {!capture && <p className="mt-3 border border-amber-900/60 bg-amber-950/30 p-3 text-xs font-bold text-amber-300">Este vértice requiere una nueva captura Street View.</p>}
                    {capture && (
                      <div className="mt-3 space-y-3">
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
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <p>Vértices: <strong>{vertices.length}</strong></p>
                <p>Posiciones únicas: <strong>{uniquePositionCount}</strong></p>
                <p>Capturas: <strong>{allVerticesCaptured ? "Completas" : "Incompletas"}</strong></p>
                <p>Área: <strong>{localIntegrity.areaSquareMeters.toFixed(2)} m²</strong></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {integrityMessages.map((message) => (
                  <span key={message} className={`border px-2 py-1 text-xs font-bold ${message === "GEOMETRÍA VÁLIDA" ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"}`}>{message}</span>
                ))}
              </div>
              {geometryConfirmed && <p className="border border-emerald-800 bg-emerald-950/40 p-3 text-center text-sm font-bold text-emerald-300">Geometría poligonal validada</p>}
              {!isEditing && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <CEIPOLButton type="button" variant="confirm" disabled={!canValidateGeometry || geometryConfirmed} onClick={() => setGeometryConfirmed(true)}>Validar geometría</CEIPOLButton>
                  <CEIPOLButton type="button" variant="secondary" disabled={hasPendingCandidate} onClick={startEditing}>Editar</CEIPOLButton>
                  <CEIPOLButton type="button" variant="secondary" onClick={returnToBuilding}>Volver a construcción</CEIPOLButton>
                </div>
              )}
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

      <CEIPOLConfirmModal
        isOpen={deleteConfirmationStage === 1}
        onClose={cancelVertexDeletion}
        onConfirm={() => setDeleteConfirmationStage(2)}
        title="Eliminar vértice"
        message="¿Desea eliminar este vértice del polígono?"
        confirmText="Continuar"
        variant="warning"
      />
      <CEIPOLConfirmModal
        isOpen={deleteConfirmationStage === 2}
        onClose={cancelVertexDeletion}
        onConfirm={confirmVertexDeletion}
        title="Confirmar eliminación definitiva"
        message="Esta acción modificará la geometría del polígono. ¿Confirma la eliminación definitiva?"
        confirmText="Eliminar vértice"
        variant="danger"
      />
    </div>
  );
}
