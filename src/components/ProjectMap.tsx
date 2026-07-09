"use client";

import React, { useMemo, useState } from "react";
import { GoogleMap, Marker, Polyline, Polygon, Circle, useJsApiLoader, InfoWindow } from "@react-google-maps/api";

interface ProjectMapProps {
  geometryType: "individual" | "lineal" | "poligono" | string;
  coordinates: { lat: number; lng: number }[];
  onUpdateCoordinates?: (newCoords: { lat: number; lng: number }[]) => void;
  onAddPoint?: (lat: number, lng: number, details: { name: string; isIndependentPoi: boolean; isVertex: boolean }) => Promise<void>;
  album: any[];
  project: {
    id: string;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number | null;
    locationName?: string;
  };
}

const mapContainerStyle = {
  width: "100%",
  height: "550px",
  borderRadius: "0.75rem",
};

// Dark mode maps styling for matching CEIPOL styling aesthetics
const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];

const GOOGLE_MAPS_LIBRARIES: any = ["places", "visualization", "drawing"];

export function ProjectMap({
  geometryType,
  coordinates,
  onUpdateCoordinates,
  onAddPoint,
  album,
  project,
}: ProjectMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [hoveredPhoto, setHoveredPhoto] = useState<any | null>(null);
  const [subMode, setSubMode] = useState<"vertex" | "poi">("poi");

  const center = useMemo(() => {
    if (project?.latitude && project?.longitude) {
      return { lat: project.latitude, lng: project.longitude };
    }
    if (coordinates.length > 0) {
      return coordinates[0];
    }
    return { lat: 21.8853, lng: -102.2916 }; // Default Aguascalientes
  }, [project, coordinates]);

  const mapOptions = useMemo(() => ({
    styles: darkMapStyles,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: true,
    fullscreenControl: true,
  }), []);

  // Filter georeferenced evidence items
  const georeferencedPhotos = useMemo(() => {
    return album.filter((p) => p.lat != null && p.lng != null);
  }, [album]);

  // Group coordinates of evidences for corridor polyline or polygon drawing (excl. independent POIs)
  const geoShapePath = useMemo(() => {
    return georeferencedPhotos
      .filter((p) => !p.isIndependentPoi && p.tipo !== "POI" && p.tipo !== "Punto Independiente" && !p.tipo?.startsWith("Barrido"))
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }, [georeferencedPhotos]);

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !onAddPoint) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (geometryType === "individual") {
      const name = window.prompt("Ingrese el nombre o comentario para esta evidencia / POI:", "Evidencia de Campo");
      if (name === null) return;
      await onAddPoint(lat, lng, { name, isIndependentPoi: true, isVertex: false });
    } else {
      if (subMode === "vertex") {
        // Modalidad 1: Ampliar / Modificar Trazado
        await onAddPoint(lat, lng, { name: "Vértice de trazado", isIndependentPoi: false, isVertex: true });
      } else {
        // Modalidad 2: Evidencia / POI Independiente
        const name = window.prompt("Ingrese el comentario para esta evidencia independiente:", "POI Independiente");
        if (name === null) return;
        await onAddPoint(lat, lng, { name, isIndependentPoi: true, isVertex: false });
      }
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-[550px] bg-slate-950 flex items-center justify-center text-xs text-slate-400 border border-slate-800 rounded-xl">
        <div className="flex flex-col items-center gap-2">
          <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
          <span>Cargando Mapa Táctico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Floating Toolbar to toggle sub-modalities for corridors and polygons */}
      {(geometryType === "lineal" || geometryType === "poligono" || geometryType === "corredor") && (
        <div className="absolute top-3 left-3 z-[10] bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-2xl flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => setSubMode("vertex")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${subMode === "vertex" ? "bg-rose-650 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            📏 Modalidad 1: Ampliar {geometryType === "lineal" || geometryType === "corredor" ? "Corredor" : "Polígono"}
          </button>
          <button
            type="button"
            onClick={() => setSubMode("poi")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${subMode === "poi" ? "bg-cyan-650 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            📍 Modalidad 2: POI / Evidencia Independiente
          </button>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
        onClick={handleMapClick}
      >
        {/* Draw circle for individual type projects */}
        {geometryType === "individual" && project?.latitude && project?.longitude && (
          <Circle
            center={{ lat: project.latitude, lng: project.longitude }}
            radius={Number(project.radius || 500)}
            options={{
              strokeColor: "#38bdf8",
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: "#0284c7",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Draw polyline for lineal (corridor) type projects */}
        {(geometryType === "lineal" || geometryType === "corredor") && geoShapePath.length > 1 && (
          <Polyline
            path={geoShapePath}
            options={{
              strokeColor: "#f43f5e",
              strokeOpacity: 0.9,
              strokeWeight: 4,
            }}
          />
        )}

        {/* Draw polygon for shape area type projects */}
        {geometryType === "poligono" && geoShapePath.length > 2 && (
          <Polygon
            paths={geoShapePath}
            options={{
              strokeColor: "#10b981",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              fillColor: "#10b981",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Georeferenced Evidence markers */}
        {georeferencedPhotos.map((photo) => {
          const isPoi = photo.isIndependentPoi || photo.tipo === "POI" || photo.tipo === "Punto Independiente" || photo.tipo?.startsWith("Barrido");
          return (
            <Marker
              key={photo.id}
              position={{ lat: Number(photo.lat), lng: Number(photo.lng) }}
              onMouseOver={() => setHoveredPhoto(photo)}
              onMouseOut={() => setHoveredPhoto(null)}
              icon={{
                path: 0, // circle
                fillColor: isPoi ? "#c084fc" : "#22d3ee",
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: isPoi ? 8 : 6,
              }}
            />
          );
        })}

        {/* Hover info window containing the preview and full metadata of the georeferenced evidence */}
        {hoveredPhoto && hoveredPhoto.lat != null && hoveredPhoto.lng != null && (
          <InfoWindow
            position={{ lat: Number(hoveredPhoto.lat), lng: Number(hoveredPhoto.lng) }}
            options={{
              pixelOffset: new window.google.maps.Size(0, -35),
            }}
          >
            <div className="bg-slate-950/95 text-slate-200 p-4 rounded-xl border border-slate-800 shadow-2xl flex flex-col gap-2.5 w-72 pointer-events-none font-sans text-xs">
              <img
                src={hoveredPhoto.previewUrl || "/no-image.png"}
                alt={hoveredPhoto.tipo || "Evidencia"}
                className="w-full h-36 object-cover rounded-lg border border-slate-800 bg-slate-900"
              />
              <div className="w-full space-y-1.5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                  <span className="font-black text-cyan-400 uppercase tracking-wide">
                    {hoveredPhoto.evidenceId || `EVI-${hoveredPhoto.id.slice(0, 6).toUpperCase()}`}
                  </span>
                  <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full ${hoveredPhoto.validado ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
                    {hoveredPhoto.validado ? "VALIDADA" : "PENDIENTE"}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400">
                  <div><span className="text-slate-500 font-bold">Tipo:</span> {hoveredPhoto.tipo || "Fotografía"}</div>
                  <div><span className="text-slate-500 font-bold">Fuente:</span> {hoveredPhoto.gpsSource || "Analista"}</div>
                  <div><span className="text-slate-500 font-bold">Fecha:</span> {hoveredPhoto.contextualizedAt ? new Date(hoveredPhoto.contextualizedAt).toLocaleDateString("es-MX") : "N/D"}</div>
                  <div><span className="text-slate-500 font-bold">Usuario:</span> {hoveredPhoto.contextualizedBy || "Analista CEIPOL"}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Coordenadas:</span> {Number(hoveredPhoto.lat).toFixed(5)}, {Number(hoveredPhoto.lng).toFixed(5)}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Confianza:</span> {hoveredPhoto.gpsAccuracy ? `${hoveredPhoto.gpsAccuracy}m` : "Alto"}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Relación Hipótesis:</span> Factor ambiental y delictivo</div>
                </div>

                {hoveredPhoto.comentario && (
                  <p className="text-[10px] text-slate-300 leading-normal border-t border-slate-900 pt-1.5 italic">
                    "{hoveredPhoto.comentario}"
                  </p>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}