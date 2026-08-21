"use client";

import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { MockMap } from "../MockMap";
import { MapLayerManager, DEFAULT_LAYERS_STATE, MapLayersState } from "./MapLayerManager";

// Capas Cartográficas Modulares
import BaseMapLayer from "./layers/BaseMapLayer";
import RectorGeometryLayer from "./layers/RectorGeometryLayer";
import PoiLayer from "./layers/PoiLayer";
import PhotoEvidenceLayer from "./layers/PhotoEvidenceLayer";
import StreetViewManualLayer from "./layers/StreetViewManualLayer";
import StreetViewAutomaticLayer from "./layers/StreetViewAutomaticLayer";
import FindingsLayer from "./layers/FindingsLayer";
import StreetViewConeLayer from "./layers/StreetViewConeLayer";

// Contexto de Filtros
import { useAnalyticsFilter } from "../analytics/AnalyticsFilterContext";

interface ProfessionalGeoMapProps {
  geografiaRectora?: {
    polygonCoords?: { lat: number; lng: number }[];
    lineCoords?: { lat: number; lng: number }[];
    center?: { lat: number; lng: number };
    hasCoordinates?: boolean;
  };
  pois?: any[];
  photographs?: any[];
  streetViewManual?: any[];
  streetViewAutomatic?: any[];
  findings?: any[];
  onPoiSelect?: (poi: any) => void;
  onStreetViewSelect?: (sv: any) => void;
  onFindingSelect?: (finding: any) => void;
  selectedPoiId?: string;
  selectedSvId?: string;
  selectedFindingId?: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "550px",
  borderRadius: "1rem",
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#475569" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
];

const GOOGLE_MAPS_LIBRARIES: any = ["places", "visualization", "drawing"];

export function ProfessionalGeoMap({
  geografiaRectora,
  pois = [],
  photographs = [],
  streetViewManual = [],
  streetViewAutomatic = [],
  findings = [],
  onPoiSelect,
  onStreetViewSelect,
  onFindingSelect,
  selectedPoiId,
  selectedSvId,
  selectedFindingId
}: ProfessionalGeoMapProps) {
  // Inicialización del gestor reactivo de capas
  const layerManager = useMemo(() => new MapLayerManager(), []);
  const [layers, setLayers] = useState<MapLayersState>(layerManager.getState());
  const [forceFallback, setForceFallback] = useState(false);
  const [selectedMarkerForCone, setSelectedMarkerForCone] = useState<any | null>(null);

  // Intentar obtener el contexto de forma segura por si se renderiza de forma aislada
  let analyticsContext: any = null;
  try {
    analyticsContext = useAnalyticsFilter();
  } catch (err) {
    // Fallback silencioso si no hay provider
  }

  const filterState = analyticsContext ? analyticsContext.filterState : {};

  // Filtrado reactivo de Hallazgos y Capturas según la categoría activa seleccionada en el Dashboard
  const filteredFindings = useMemo(() => {
    if (!filterState?.categoriaSeleccionada) return findings;
    return findings.filter((f) => f.categoria === filterState.categoriaSeleccionada);
  }, [findings, filterState?.categoriaSeleccionada]);

  const filteredStreetViewAutomatic = useMemo(() => {
    if (!filterState?.categoriaSeleccionada) return streetViewAutomatic;
    return streetViewAutomatic.filter((sv) => sv.categoria_exploracion === filterState.categoriaSeleccionada);
  }, [streetViewAutomatic, filterState?.categoriaSeleccionada]);

  useEffect(() => {
    const unsubscribe = layerManager.subscribe((newState) => {
      setLayers(newState);
    });
    return unsubscribe;
  }, [layerManager]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapCenter = useMemo(() => {
    if (geografiaRectora?.center?.lat && geografiaRectora?.center?.lng) {
      return geografiaRectora.center;
    }
    return { lat: 21.885, lng: -102.291 }; // Aguascalientes, México
  }, [geografiaRectora]);

  const mapOptions = useMemo(() => ({
    styles: darkMapStyles,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: true,
    fullscreenControl: false,
  }), []);

  // Seleccionar automáticamente el centro del cono de visión activo
  const activeConeData = useMemo(() => {
    const active = selectedMarkerForCone;
    if (!active) return null;

    const lat = active.latitude || active.lat || active.coordenadas?.lat || 0;
    const lng = active.longitude || active.lng || active.coordenadas?.lng || 0;
    const heading = active.geolocalizacion?.heading || active.street_view_session?.heading_final || active.heading || 0;
    const fov = active.geolocalizacion?.fov || active.street_view_session?.fov_final || active.fov || 90;

    return { center: { lat, lng }, heading, fov };
  }, [selectedMarkerForCone]);

  if (forceFallback || loadError) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute top-4 left-4 right-4 bg-amber-950/80 border border-amber-800 text-amber-200 px-4 py-3 rounded-xl z-50 flex items-center justify-between shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <p className="text-xs font-bold uppercase tracking-tight">Modo Contingencia Táctico Activo (Canvas Fallback)</p>
          </div>
          <button
            onClick={() => setForceFallback(false)}
            className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg uppercase font-black tracking-wider hover:bg-slate-800"
          >
            Reintentar SIG
          </button>
        </div>
        <MockMap />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full min-h-[550px] bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-900 gap-3">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Cargando Motor SIG Profesional...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950">
      {/* Panel flotante de Capas */}
      <div className="absolute top-4 right-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 z-10 w-64 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">Capas de Inteligencia</span>
          <button
            onClick={() => setForceFallback(true)}
            className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-bold hover:text-slate-200"
          >
            Canvas
          </button>
        </div>
        <div className="space-y-2 text-xs text-slate-300 font-medium">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.rectorGeometry}
              onChange={() => layerManager.toggleLayer("rectorGeometry")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>Geografía Rectora</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.pois}
              onChange={() => layerManager.toggleLayer("pois")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>Puntos de Interés (POI)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.photos}
              onChange={() => layerManager.toggleLayer("photos")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>Fotografías de Campo</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.streetViewManual}
              onChange={() => layerManager.toggleLayer("streetViewManual")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>SV Manual (Cian)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.streetViewAutomatic}
              onChange={() => layerManager.toggleLayer("streetViewAutomatic")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>SV Automático (Categoría)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.findings}
              onChange={() => layerManager.toggleLayer("findings")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span>Hallazgos Aprobados</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer pt-1.5 border-t border-slate-800/80">
            <input
              type="checkbox"
              checked={layers.streetViewCone}
              onChange={() => layerManager.toggleLayer("streetViewCone")}
              className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4"
            />
            <span className="text-cyan-400 font-bold">Conos Visuales Street View</span>
          </label>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={15}
        options={mapOptions}
      >
        <BaseMapLayer />
        
        <RectorGeometryLayer visible={layers.rectorGeometry} geografiaRectora={geografiaRectora} />
        
        <PoiLayer visible={layers.pois} pois={pois} selectedPoiId={selectedPoiId} onPoiSelect={onPoiSelect} />
        
        <PhotoEvidenceLayer visible={layers.photos} photographs={photographs} />
        
        <StreetViewManualLayer
          visible={layers.streetViewManual}
          streetViewManual={streetViewManual}
          onStreetViewSelect={(sv) => {
            setSelectedMarkerForCone(sv);
            if (onStreetViewSelect) onStreetViewSelect(sv);
          }}
        />
        
        <StreetViewAutomaticLayer
          visible={layers.streetViewAutomatic}
          streetViewAutomatic={filteredStreetViewAutomatic}
          onStreetViewSelect={(sv) => {
            setSelectedMarkerForCone(sv);
            if (onStreetViewSelect) onStreetViewSelect(sv);
          }}
        />
        
        <FindingsLayer
          visible={layers.findings}
          findings={filteredFindings}
          selectedFindingId={selectedFindingId}
          onFindingSelect={(finding) => {
            setSelectedMarkerForCone(finding);
            if (onFindingSelect) onFindingSelect(finding);
          }}
        />

        <StreetViewConeLayer
          visible={layers.streetViewCone || selectedMarkerForCone !== null}
          center={activeConeData?.center || null}
          heading={activeConeData?.heading || 0}
          fov={activeConeData?.fov || 90}
        />
      </GoogleMap>
    </div>
  );
}

export default ProfessionalGeoMap;
