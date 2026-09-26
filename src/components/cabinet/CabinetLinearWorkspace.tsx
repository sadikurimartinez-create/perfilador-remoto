"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import {
  assessCorridorIntegrity,
  confirmDraftProjectGeography,
  corridorVertexRole,
  createDraftProjectGeography,
  updateDraftProjectGeography,
  type CorridorVertexRole,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { CEIPOLConfirmModal } from "@/components/ui/CEIPOLConfirmModal";
import { findNearestCorridorSegment } from "./cabinetLinearGeometry";
import {
  createCabinetContextPoi,
  createCabinetContextPoiId,
  moveCabinetContextPoi,
  updateCabinetContextPoi,
  type CabinetContextPoi,
  type CabinetMapActionMode,
} from "./cabinetContextPoi";
import type { CabinetCompletionResult } from "./cabinetCompletionContract";

type LinearWorkflowStep = "START" | "NEXT_NODE" | "INTERMEDIATE" | "END" | "REVIEW";
type EditAction = "MOVE" | "ADD_PI" | "DELETE_PI" | null;

type LinearVertex = {
  id: string;
  point: LatLngPoint;
};

type PendingOperation =
  | { kind: "APPEND"; vertexId: string; completesCorridor: boolean }
  | { kind: "MOVE"; vertexId: string }
  | { kind: "INSERT"; vertexId: string; insertIndex: number };

interface CabinetLinearWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
  onComplete?: (result: CabinetCompletionResult) => void;
}

const GOOGLE_MAPS_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

const INITIAL_CENTER: LatLngPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const MAX_INSERT_DISTANCE_METERS = 75;

function displayRole(role: CorridorVertexRole, index: number) {
  if (role === "START") return "NI";
  if (role === "END") return "NF";
  return `PI ${index}`;
}

export function CabinetLinearWorkspace({
  onBack,
  onCancel,
  onComplete,
}: CabinetLinearWorkspaceProps) {
  const [vertices, setVertices] = useState<LinearVertex[]>([]);
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null);
  const [captureByVertexId, setCaptureByVertexId] = useState<Record<string, StreetViewCapturePayload>>({});
  const [workflowStep, setWorkflowStep] = useState<LinearWorkflowStep>("START");
  const [geometryConfirmed, setGeometryConfirmed] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<LatLngPoint | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editAction, setEditAction] = useState<EditAction>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deleteConfirmationStage, setDeleteConfirmationStage] = useState<0 | 1 | 2>(0);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [contextPois, setContextPois] = useState<CabinetContextPoi[]>([]);
  const [mapActionMode, setMapActionMode] = useState<CabinetMapActionMode>("GEOMETRY");
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [pendingPoiPoint, setPendingPoiPoint] = useState<LatLngPoint | null>(null);
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null);
  const [poiLabelInput, setPoiLabelInput] = useState("");
  const [poiDescriptionInput, setPoiDescriptionInput] = useState("");
  const [poiDeleteCandidateId, setPoiDeleteCandidateId] = useState<string | null>(null);
  const nextVertexId = useRef(1);
  const nextPoiId = useRef(1);
  const lastFittedVertexCount = useRef(0);

  const apiKey = typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
    : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const vertexPath = useMemo(() => vertices.map((vertex) => vertex.point), [vertices]);
  const corridorIntegrity = useMemo(() => assessCorridorIntegrity(vertexPath), [vertexPath]);
  const allVerticesCaptured = vertices.length > 0 && vertices.every((vertex) => Boolean(captureByVertexId[vertex.id]));
  const hasPendingCandidate = Boolean(pendingPoint || activeVertexId || pendingOperation);
  const canValidateGeometry = workflowStep === "REVIEW"
    && !isEditing
    && !hasPendingCandidate
    && corridorIntegrity.isValid
    && allVerticesCaptured;
  const canSelectInitialPoint = workflowStep === "START" || workflowStep === "INTERMEDIATE" || workflowStep === "END";
  const poiInteractionActive = mapActionMode !== "GEOMETRY" || Boolean(pendingPoiPoint || editingPoiId);

  useEffect(() => {
    if (!mapInstance || vertexPath.length < 2 || lastFittedVertexCount.current === vertexPath.length) return;
    const bounds = new google.maps.LatLngBounds();
    vertexPath.forEach((point) => bounds.extend(point));
    mapInstance.fitBounds(bounds, 48);
    lastFittedVertexCount.current = vertexPath.length;
  }, [mapInstance, vertexPath]);

  const removeCapture = (vertexId: string) => {
    setCaptureByVertexId((current) => {
      const next = { ...current };
      delete next[vertexId];
      return next;
    });
  };

  const beginPendingCapture = (point: LatLngPoint, operation: PendingOperation) => {
    setPendingPoint(point);
    setActiveVertexId(operation.vertexId);
    setPendingOperation(operation);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(true);
  };

  const resetPoiInteraction = () => {
    setMapActionMode("GEOMETRY");
    setSelectedPoiId(null);
    setPendingPoiPoint(null);
    setEditingPoiId(null);
    setPoiLabelInput("");
    setPoiDescriptionInput("");
  };

  const beginAddPoi = () => {
    if (hasPendingCandidate || isStreetViewOpen || isEditing) return;
    resetPoiInteraction();
    setMapActionMode("ADD_POI");
  };

  const beginEditPoi = (poi: CabinetContextPoi) => {
    if (hasPendingCandidate || isStreetViewOpen || isEditing) return;
    resetPoiInteraction();
    setEditingPoiId(poi.id);
    setPoiLabelInput(poi.label);
    setPoiDescriptionInput(poi.description ?? "");
  };

  const beginMovePoi = (poiId: string) => {
    if (hasPendingCandidate || isStreetViewOpen || isEditing) return;
    resetPoiInteraction();
    setSelectedPoiId(poiId);
    setMapActionMode("MOVE_POI");
  };

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng || hasPendingCandidate) return;
    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };

    if (mapActionMode === "ADD_POI") {
      setPendingPoiPoint(point);
      return;
    }

    if (mapActionMode === "MOVE_POI" && selectedPoiId) {
      setContextPois((current) => current.map((poi) => (
        poi.id === selectedPoiId ? moveCabinetContextPoi(poi, point) : poi
      )));
      resetPoiInteraction();
      return;
    }

    if (editingPoiId) return;

    if (isEditing && editAction === "MOVE" && selectedVertexId) {
      setVertices((current) => current.map((vertex) => (
        vertex.id === selectedVertexId ? { ...vertex, point } : vertex
      )));
      removeCapture(selectedVertexId);
      beginPendingCapture(point, { kind: "MOVE", vertexId: selectedVertexId });
      setEditMessage("Nodo movido. Realice una nueva captura Street View para completar la edición.");
      return;
    }

    if (isEditing && editAction === "ADD_PI") {
      const nearestSegment = findNearestCorridorSegment(point, vertexPath);
      if (!nearestSegment || nearestSegment.distanceMeters > MAX_INSERT_DISTANCE_METERS) {
        setEditMessage("Seleccione un punto sobre la línea o a menos de 75 metros de un segmento.");
        return;
      }
      const vertexId = `cabinet-linear-vertex-${nextVertexId.current++}`;
      beginPendingCapture(point, {
        kind: "INSERT",
        vertexId,
        insertIndex: nearestSegment.segmentIndex + 1,
      });
      setEditMessage(`Nuevo PI candidato para el segmento ${nearestSegment.segmentIndex + 1}.`);
      return;
    }

    if (isEditing || !canSelectInitialPoint) return;
    const vertexId = `cabinet-linear-vertex-${nextVertexId.current++}`;
    beginPendingCapture(point, {
      kind: "APPEND",
      vertexId,
      completesCorridor: workflowStep === "END",
    });
  };

  const savePoi = () => {
    if (!poiLabelInput.trim()) return;

    if (editingPoiId) {
      setContextPois((current) => current.map((poi) => (
        poi.id === editingPoiId
          ? updateCabinetContextPoi(poi, { label: poiLabelInput, description: poiDescriptionInput })
          : poi
      )));
      resetPoiInteraction();
      return;
    }

    if (!pendingPoiPoint) return;
    const id = createCabinetContextPoiId(nextPoiId.current++);
    setContextPois((current) => [
      ...current,
      createCabinetContextPoi(id, pendingPoiPoint, poiLabelInput, poiDescriptionInput),
    ]);
    resetPoiInteraction();
  };

  const confirmPoiDeletion = () => {
    if (!poiDeleteCandidateId) return;
    setContextPois((current) => current.filter((poi) => poi.id !== poiDeleteCandidateId));
    if (selectedPoiId === poiDeleteCandidateId || editingPoiId === poiDeleteCandidateId) resetPoiInteraction();
    setPoiDeleteCandidateId(null);
  };

  const handleCapture = (payload: StreetViewCapturePayload) => {
    if (!pendingPoint || !activeVertexId || !pendingOperation) return;

    if (pendingOperation.kind === "APPEND") {
      setVertices((current) => [...current, { id: pendingOperation.vertexId, point: pendingPoint }]);
      setWorkflowStep(pendingOperation.completesCorridor ? "REVIEW" : "NEXT_NODE");
    } else if (pendingOperation.kind === "INSERT") {
      setVertices((current) => {
        const next = [...current];
        next.splice(pendingOperation.insertIndex, 0, {
          id: pendingOperation.vertexId,
          point: pendingPoint,
        });
        return next;
      });
      setEditMessage("PI agregado en el segmento seleccionado.");
    } else {
      setEditMessage("Nodo movido y captura Street View actualizada.");
    }

    setCaptureByVertexId((current) => ({ ...current, [activeVertexId]: payload }));
    setPendingPoint(null);
    setActiveVertexId(null);
    setPendingOperation(null);
    setSelectedVertexId(null);
    setGeometryConfirmed(false);
    setIsStreetViewOpen(false);
  };

  const chooseNextStep = (step: "INTERMEDIATE" | "END") => {
    setPendingPoint(null);
    setActiveVertexId(null);
    setPendingOperation(null);
    setIsStreetViewOpen(false);
    setWorkflowStep(step);
  };

  const startEditing = () => {
    setGeometryConfirmed(false);
    setIsEditing(true);
    setEditAction(null);
    setSelectedVertexId(null);
    setEditMessage("Seleccione una acción de edición estructural.");
  };

  const selectEditAction = (action: Exclude<EditAction, null>) => {
    if (hasPendingCandidate) return;
    setEditAction(action);
    setSelectedVertexId(null);
    setEditMessage(
      action === "MOVE"
        ? "Seleccione un nodo y después su nueva coordenada territorial en el mapa."
        : action === "ADD_PI"
          ? "Seleccione sobre o cerca del segmento donde desea insertar el PI."
          : "Seleccione el PI que desea eliminar.",
    );
  };

  const finishEditing = () => {
    if (hasPendingCandidate) return;
    setIsEditing(false);
    setEditAction(null);
    setSelectedVertexId(null);
    setEditMessage(null);
  };

  const selectVertexForMove = (vertexId: string) => {
    if (!isEditing || editAction !== "MOVE" || hasPendingCandidate) return;
    setSelectedVertexId(vertexId);
    setEditMessage("Nodo seleccionado. Marque ahora su nueva coordenada territorial en el mapa.");
  };

  const requestVertexDeletion = (vertexId: string, index: number) => {
    if (!isEditing || editAction !== "DELETE_PI" || hasPendingCandidate) return;
    if (corridorVertexRole(index, vertices.length) !== "INTERMEDIATE") return;
    setDeleteCandidateId(vertexId);
    setDeleteConfirmationStage(1);
  };

  const cancelVertexDeletion = () => {
    setDeleteCandidateId(null);
    setDeleteConfirmationStage(0);
  };

  const confirmVertexDeletion = () => {
    if (!deleteCandidateId) return;
    const candidateIndex = vertices.findIndex((vertex) => vertex.id === deleteCandidateId);
    if (candidateIndex < 0 || corridorVertexRole(candidateIndex, vertices.length) !== "INTERMEDIATE") {
      cancelVertexDeletion();
      return;
    }

    setVertices((current) => current.filter((vertex) => vertex.id !== deleteCandidateId));
    removeCapture(deleteCandidateId);
    setGeometryConfirmed(false);
    setSelectedVertexId(null);
    setEditMessage("PI eliminado. La geometría y los roles fueron recalculados.");
    cancelVertexDeletion();
  };

  const vertexRole = (index: number) => (
    workflowStep === "REVIEW"
      ? corridorVertexRole(index, vertices.length)
      : index === 0 ? "START" : "INTERMEDIATE"
  );
  const pendingRole = pendingOperation?.kind === "MOVE"
    ? "Nodo movido"
    : pendingOperation?.kind === "INSERT"
      ? `PI ${pendingOperation.insertIndex}`
      : workflowStep === "START" ? "NI" : workflowStep === "END" ? "NF" : `PI ${Math.max(1, vertices.length)}`;
  const mapCenter = pendingPoint ?? vertices[vertices.length - 1]?.point ?? INITIAL_CENTER;
  const handleComplete = () => {
    if (
      !geometryConfirmed ||
      !onComplete ||
      workflowStep !== "REVIEW" ||
      isEditing ||
      hasPendingCandidate ||
      poiInteractionActive ||
      !corridorIntegrity.isValid ||
      !allVerticesCaptured
    ) {
      return;
    }

    const draft = createDraftProjectGeography("lineal");
    const populatedDraft = updateDraftProjectGeography(draft, vertexPath);
    const confirmedDraft = confirmDraftProjectGeography(populatedDraft);

    onComplete({
      geometryType: "lineal",
      draftGeography: confirmedDraft,
      streetViewEvidence: vertices.map((vertex, index) => ({
        territorialRef: {
          geometryType: "lineal",
          nodeId: vertex.id,
          order: index + 1,
          role: corridorVertexRole(index, vertices.length),
        },
        capture: captureByVertexId[vertex.id],
      })),
      contextPois: [...contextPois],
    });
  };

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
          <div className="h-[420px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950 sm:h-[460px] lg:h-[480px]">
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
                options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy" }}
              >
                {vertexPath.length >= 2 && (
                  <Polyline path={vertexPath} options={{ strokeColor: "#38bdf8", strokeOpacity: 0.95, strokeWeight: 4, clickable: false }} />
                )}
                {vertices.map((vertex, index) => {
                  const role = vertexRole(index);
                  return (
                    <Marker
                      key={vertex.id}
                      position={vertex.point}
                      title={`${displayRole(role, index)} - nodo territorial`}
                      label={{ text: displayRole(role, index), color: "#ffffff", fontWeight: "700" }}
                      onClick={() => {
                        if (editAction === "MOVE") selectVertexForMove(vertex.id);
                        if (editAction === "DELETE_PI") requestVertexDeletion(vertex.id, index);
                      }}
                    />
                  );
                })}
                {contextPois.map((poi) => (
                  <Marker
                    key={poi.id}
                    position={poi.point}
                    title={`POI — ${poi.label}`}
                    label={{ text: "POI", color: "#111827", fontSize: "10px", fontWeight: "700" }}
                    icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: "#f59e0b", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 13 }}
                    onClick={() => { if (mapActionMode === "GEOMETRY") beginEditPoi(poi); }}
                  />
                ))}
                {pendingPoint && pendingOperation?.kind !== "MOVE" && (
                  <Marker position={pendingPoint} title={`${pendingRole} pendiente de captura`} />
                )}
              </GoogleMap>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton type="button" variant={editAction === "MOVE" ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectEditAction("MOVE")}>Mover nodo</CEIPOLButton>
                  <CEIPOLButton type="button" variant={editAction === "ADD_PI" ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectEditAction("ADD_PI")}>Agregar PI</CEIPOLButton>
                  <CEIPOLButton type="button" variant={editAction === "DELETE_PI" ? "danger" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectEditAction("DELETE_PI")}>Borrar PI</CEIPOLButton>
                  <CEIPOLButton type="button" variant="confirm" disabled={hasPendingCandidate} onClick={finishEditing}>Finalizar edición</CEIPOLButton>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-slate-400">
                    {pendingPoint
                      ? `${pendingRole}: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}. Captura pendiente.`
                      : editMessage ?? "Seleccione una acción de edición estructural."}
                  </p>
                  {pendingPoint && (
                    <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>Abrir Street View</CEIPOLButton>
                  )}
                </div>
              </div>
            ) : canSelectInitialPoint ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{pendingPoint ? `${pendingRole} territorial: ${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}` : `Seleccione en el mapa la coordenada territorial para ${pendingRole}.`}</p>
                {pendingPoint && (
                  <CEIPOLButton type="button" variant="primary" onClick={() => setIsStreetViewOpen(true)}>Abrir Street View</CEIPOLButton>
                )}
              </div>
            ) : workflowStep === "NEXT_NODE" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-400">Seleccione el siguiente tipo de nodo territorial.</p>
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton type="button" variant="secondary" disabled={poiInteractionActive} onClick={() => chooseNextStep("INTERMEDIATE")}>Agregar PI</CEIPOLButton>
                  <CEIPOLButton type="button" variant="primary" disabled={poiInteractionActive} onClick={() => chooseNextStep("END")}>Definir NF</CEIPOLButton>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Corredor completo en revisión humana.</p>
            )}
          </div>

          <div className="space-y-3 border border-amber-900/60 bg-amber-950/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-amber-300">POIs contextuales</p>
                <p className="mt-1 text-xs text-slate-400">Referencias locales que no forman parte de NI, PI, NF ni de la Polyline.</p>
              </div>
              <CEIPOLButton type="button" variant="secondary" disabled={hasPendingCandidate || isStreetViewOpen || isEditing} onClick={beginAddPoi}>Agregar POI</CEIPOLButton>
            </div>

            {mapActionMode === "ADD_POI" && !pendingPoiPoint && <p className="text-xs text-amber-200">Seleccione libremente la ubicación del POI en el mapa.</p>}
            {mapActionMode === "MOVE_POI" && <p className="text-xs text-amber-200">Seleccione la nueva ubicación del POI en el mapa.</p>}

            {(pendingPoiPoint || editingPoiId) && (
              <div className="grid gap-3 border-t border-amber-900/40 pt-3">
                <label className="grid gap-1 text-xs text-slate-300">Nombre / etiqueta
                  <input value={poiLabelInput} onChange={(event) => setPoiLabelInput(event.target.value)} className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="grid gap-1 text-xs text-slate-300">Descripción opcional
                  <textarea value={poiDescriptionInput} onChange={(event) => setPoiDescriptionInput(event.target.value)} rows={2} className="w-full resize-y border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton type="button" variant="confirm" disabled={!poiLabelInput.trim()} onClick={savePoi}>Guardar POI</CEIPOLButton>
                  <CEIPOLButton type="button" variant="ghost" onClick={resetPoiInteraction}>Cancelar</CEIPOLButton>
                </div>
              </div>
            )}

            {contextPois.length === 0 ? (
              <p className="text-xs text-slate-500">Sin POIs contextuales.</p>
            ) : (
              <div className="space-y-2">
                {contextPois.map((poi) => (
                  <div key={poi.id} className="flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-xs text-slate-300">
                      <p className="font-bold text-amber-300">{poi.label}</p>
                      {poi.description && <p className="mt-1 text-slate-400">{poi.description}</p>}
                      <p className="mt-1 font-mono text-slate-500">{poi.point.lat.toFixed(6)}, {poi.point.lng.toFixed(6)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CEIPOLButton type="button" size="sm" variant="secondary" disabled={isEditing} onClick={() => beginEditPoi(poi)}>Editar</CEIPOLButton>
                      <CEIPOLButton type="button" size="sm" variant="secondary" disabled={hasPendingCandidate || isEditing} onClick={() => beginMovePoi(poi.id)}>Mover</CEIPOLButton>
                      <CEIPOLButton type="button" size="sm" variant="danger" onClick={() => setPoiDeleteCandidateId(poi.id)}>Eliminar</CEIPOLButton>
                    </div>
                  </div>
                ))}
              </div>
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
                const role = vertexRole(index);
                const roleLabel = displayRole(role, index);
                return (
                  <article key={vertex.id} className="border border-slate-800 bg-slate-900/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-100">{roleLabel}</h4>
                      <span className="font-mono text-xs text-cyan-300">{vertex.point.lat.toFixed(6)}, {vertex.point.lng.toFixed(6)}</span>
                    </div>
                    {isEditing && editAction === "MOVE" && (
                      <CEIPOLButton type="button" size="sm" variant={selectedVertexId === vertex.id ? "primary" : "secondary"} disabled={hasPendingCandidate} onClick={() => selectVertexForMove(vertex.id)}>Mover {roleLabel}</CEIPOLButton>
                    )}
                    {isEditing && editAction === "DELETE_PI" && (
                      <CEIPOLButton type="button" size="sm" variant="danger" disabled={role !== "INTERMEDIATE" || hasPendingCandidate} onClick={() => requestVertexDeletion(vertex.id, index)}>
                        {role === "INTERMEDIATE" ? `Borrar ${roleLabel}` : `${roleLabel} no se puede borrar`}
                      </CEIPOLButton>
                    )}
                    {!capture && (
                      <p className="mt-3 border border-amber-900/60 bg-amber-950/30 p-3 text-xs font-bold text-amber-300">Este nodo requiere una nueva captura Street View antes de validar la geometría.</p>
                    )}
                    {capture && (
                      <div className="mt-3 space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capture.dataUrl} alt={`Captura Street View ${roleLabel}`} className="h-[240px] w-full bg-black object-contain sm:h-[380px] lg:h-[500px]" />
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
                <p className="border border-emerald-800 bg-emerald-950/40 p-3 text-center text-sm font-bold text-emerald-300">Geometría lineal validada</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CEIPOLButton type="button" variant="confirm" disabled={!canValidateGeometry || geometryConfirmed} onClick={() => setGeometryConfirmed(true)}>Validar geometría</CEIPOLButton>
                <CEIPOLButton type="button" variant="secondary" disabled={!geometryConfirmed || isEditing || poiInteractionActive} onClick={startEditing}>Editar</CEIPOLButton>
              </div>
              {geometryConfirmed && (
                <CEIPOLButton
                  type="button"
                  variant="primary"
                  disabled={!onComplete || isEditing || hasPendingCandidate || poiInteractionActive}
                  onClick={handleComplete}
                >
                  Continuar con creación del expediente
                </CEIPOLButton>
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
        isOpen={Boolean(poiDeleteCandidateId)}
        onClose={() => setPoiDeleteCandidateId(null)}
        onConfirm={confirmPoiDeletion}
        title="Eliminar POI contextual"
        message="¿Desea eliminar únicamente este POI contextual?"
        confirmText="Eliminar POI"
        variant="danger"
      />
      <CEIPOLConfirmModal
        isOpen={deleteConfirmationStage === 1}
        onClose={cancelVertexDeletion}
        onConfirm={() => setDeleteConfirmationStage(2)}
        title="Eliminar punto intermedio"
        message="¿Desea eliminar este punto intermedio?"
        confirmText="Continuar"
        variant="warning"
      />
      <CEIPOLConfirmModal
        isOpen={deleteConfirmationStage === 2}
        onClose={cancelVertexDeletion}
        onConfirm={confirmVertexDeletion}
        title="Confirmar eliminación definitiva"
        message="Esta acción modificará la geometría del corredor. ¿Confirma la eliminación definitiva?"
        confirmText="Eliminar PI"
        variant="danger"
      />
    </div>
  );
}
