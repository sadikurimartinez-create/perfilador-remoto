"use client";

import { useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { CEIPOLConfirmModal } from "@/components/ui/CEIPOLConfirmModal";
import type { LatLngPoint } from "@/utils/canonicalProjectGeography";
import {
  createCabinetContextPoi,
  createCabinetContextPoiId,
  moveCabinetContextPoi,
  updateCabinetContextPoi,
  type CabinetContextPoi,
  type CabinetMapActionMode,
} from "./cabinetContextPoi";

interface CabinetIndividualWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
}

const INITIAL_CENTER: LatLngPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

export function CabinetIndividualWorkspace({
  onBack,
  onCancel,
}: CabinetIndividualWorkspaceProps) {
  const [candidate, setCandidate] = useState<LatLngPoint | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [capture, setCapture] = useState<StreetViewCapturePayload | null>(null);
  const [validated, setValidated] = useState(false);
  const [contextPois, setContextPois] = useState<CabinetContextPoi[]>([]);
  const [mapActionMode, setMapActionMode] = useState<CabinetMapActionMode>("GEOMETRY");
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [pendingPoiPoint, setPendingPoiPoint] = useState<LatLngPoint | null>(null);
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null);
  const [poiLabelInput, setPoiLabelInput] = useState("");
  const [poiDescriptionInput, setPoiDescriptionInput] = useState("");
  const [poiDeleteCandidateId, setPoiDeleteCandidateId] = useState<string | null>(null);
  const nextPoiId = useRef(1);

  const apiKey = typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
    : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const territorialFlowPending = Boolean(candidate && !capture) || isStreetViewOpen;

  const resetPoiInteraction = () => {
    setMapActionMode("GEOMETRY");
    setSelectedPoiId(null);
    setPendingPoiPoint(null);
    setEditingPoiId(null);
    setPoiLabelInput("");
    setPoiDescriptionInput("");
  };

  const beginAddPoi = () => {
    if (territorialFlowPending) return;
    resetPoiInteraction();
    setMapActionMode("ADD_POI");
  };

  const beginEditPoi = (poi: CabinetContextPoi) => {
    resetPoiInteraction();
    setEditingPoiId(poi.id);
    setPoiLabelInput(poi.label);
    setPoiDescriptionInput(poi.description ?? "");
  };

  const beginMovePoi = (poiId: string) => {
    if (territorialFlowPending) return;
    resetPoiInteraction();
    setSelectedPoiId(poiId);
    setMapActionMode("MOVE_POI");
  };

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
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

    setCandidate(point);
    setCapture(null);
    setValidated(false);
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
    setCapture(payload);
    setValidated(false);
    setIsStreetViewOpen(false);
  };

  const handleChangePoint = () => {
    setCapture(null);
    setCandidate(null);
    setValidated(false);
    setIsStreetViewOpen(false);
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-400">Modalidad Gabinete</p>
          <h3 className="mt-1 text-lg font-bold text-slate-100">Punto Individual</h3>
          <p className="mt-1 text-sm text-slate-400">
            Seleccione en el mapa el punto territorial que será inspeccionado.
          </p>
        </div>
        <div className="flex gap-2">
          <CEIPOLButton type="button" variant="ghost" onClick={onBack}>
            Volver
          </CEIPOLButton>
          <CEIPOLButton type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </CEIPOLButton>
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
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Cargando mapa...
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={candidate ?? INITIAL_CENTER}
                zoom={15}
                onClick={handleMapClick}
                options={{
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                  gestureHandling: "greedy",
                }}
              >
                {candidate && <Marker position={candidate} />}
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
              </GoogleMap>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-300">
              {candidate ? (
                <>
                  <span className="font-bold text-slate-100">Punto territorial:</span>{" "}
                  <span className="font-mono">{candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}</span>
                </>
              ) : (
                "Haga clic en el mapa para definir el punto territorial."
              )}
            </div>
            <CEIPOLButton
              type="button"
              variant="primary"
              disabled={!candidate}
              onClick={() => setIsStreetViewOpen(true)}
            >
              Abrir Street View
            </CEIPOLButton>
          </div>

          <div className="space-y-3 border border-amber-900/60 bg-amber-950/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-amber-300">POIs contextuales</p>
                <p className="mt-1 text-xs text-slate-400">Referencias locales independientes del punto territorial.</p>
              </div>
              <CEIPOLButton type="button" variant="secondary" disabled={territorialFlowPending} onClick={beginAddPoi}>Agregar POI</CEIPOLButton>
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
                      <CEIPOLButton type="button" size="sm" variant="secondary" onClick={() => beginEditPoi(poi)}>Editar</CEIPOLButton>
                      <CEIPOLButton type="button" size="sm" variant="secondary" disabled={territorialFlowPending} onClick={() => beginMovePoi(poi.id)}>Mover</CEIPOLButton>
                      <CEIPOLButton type="button" size="sm" variant="danger" onClick={() => setPoiDeleteCandidateId(poi.id)}>Eliminar</CEIPOLButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          {!capture || !candidate ? (
            <div className="flex h-[240px] items-center justify-center text-center text-sm text-slate-500 sm:h-[380px] lg:h-[500px]">
              La captura aceptada de Street View aparecerá aquí.
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capture.dataUrl}
                alt="Vista capturada desde Google Street View"
                className="h-[240px] w-full rounded-lg border border-slate-700 bg-black object-contain sm:h-[380px] lg:h-[500px]"
              />

              <dl className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Punto territorial</dt>
                  <dd className="font-mono text-right">{candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Cámara Google</dt>
                  <dd className="font-mono text-right">{capture.panoramaLat.toFixed(6)}, {capture.panoramaLng.toFixed(6)}</dd>
                </div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Heading</dt><dd>{capture.heading}°</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Pitch</dt><dd>{capture.pitch}°</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">FOV</dt><dd>{capture.fov}°</dd></div>
                {capture.panoId && (
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Pano ID</dt><dd className="break-all text-right font-mono">{capture.panoId}</dd></div>
                )}
                {capture.captureDate && (
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Fecha de cobertura</dt><dd>{capture.captureDate}</dd></div>
                )}
              </dl>

              {validated && (
                <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-center text-sm font-bold text-emerald-300">
                  Punto Individual validado
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CEIPOLButton type="button" variant="confirm" onClick={() => setValidated(true)}>
                  Validar punto
                </CEIPOLButton>
                <CEIPOLButton type="button" variant="secondary" onClick={handleChangePoint}>
                  Cambiar punto
                </CEIPOLButton>
              </div>
            </div>
          )}
        </section>
      </div>

      {candidate && (
        <StreetViewPanoramaPicker
          isOpen={isStreetViewOpen}
          lat={candidate.lat}
          lng={candidate.lng}
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
    </div>
  );
}
