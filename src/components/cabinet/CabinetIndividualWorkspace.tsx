"use client";

import { useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";

type TerritorialPoint = {
  lat: number;
  lng: number;
};

interface CabinetIndividualWorkspaceProps {
  onBack: () => void;
  onCancel: () => void;
}

const INITIAL_CENTER: TerritorialPoint = { lat: 21.8853, lng: -102.2916 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

export function CabinetIndividualWorkspace({
  onBack,
  onCancel,
}: CabinetIndividualWorkspaceProps) {
  const [candidate, setCandidate] = useState<TerritorialPoint | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [capture, setCapture] = useState<StreetViewCapturePayload | null>(null);
  const [validated, setValidated] = useState(false);

  const apiKey = typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
    : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;

    setCandidate({
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    });
    setCapture(null);
    setValidated(false);
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="space-y-3">
          <div className="h-[420px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
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
        </section>

        <section className="min-h-[420px] rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          {!capture || !candidate ? (
            <div className="flex h-full min-h-[388px] items-center justify-center text-center text-sm text-slate-500">
              La captura aceptada de Street View aparecerá aquí.
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capture.dataUrl}
                alt="Vista capturada desde Google Street View"
                className="aspect-[4/3] w-full rounded-lg border border-slate-700 object-cover"
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
    </div>
  );
}
