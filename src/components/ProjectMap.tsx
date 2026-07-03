"use client";

import React, { useMemo, useState } from "react";
import { GoogleMap, Marker, Polyline, Polygon, Circle, useJsApiLoader, InfoWindow } from "@react-google-maps/api";

interface ProjectMapProps {
  geometryType: "individual" | "lineal" | "poligono" | string;
  coordinates: { lat: number; lng: number }[];
  onUpdateCoordinates?: (newCoords: { lat: number; lng: number }[]) => void;
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

  // Group coordinates of evidences for corridor polyline or polygon drawing
  const geoShapePath = useMemo(() => {
    return georeferencedPhotos.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }, [georeferencedPhotos]);

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
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
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
        {georeferencedPhotos.map((photo) => (
          <Marker
            key={photo.id}
            position={{ lat: Number(photo.lat), lng: Number(photo.lng) }}
            onMouseOver={() => setHoveredPhoto(photo)}
            onMouseOut={() => setHoveredPhoto(null)}
            icon={{
              path: 0, // circle
              fillColor: "#38bdf8",
              fillOpacity: 0.9,
              strokeWeight: 2,
              strokeColor: "#ffffff",
              scale: 7,
            }}
          />
        ))}

        {/* Hover info window containing the preview of the georeferenced evidence */}
        {hoveredPhoto && hoveredPhoto.lat != null && hoveredPhoto.lng != null && (
          <InfoWindow
            position={{ lat: Number(hoveredPhoto.lat), lng: Number(hoveredPhoto.lng) }}
            options={{
              pixelOffset: new window.google.maps.Size(0, -35),
            }}
          >
            <div className="bg-slate-950/95 text-slate-200 p-3.5 rounded-xl border border-slate-700/80 shadow-2xl flex flex-col items-center gap-2.5 w-64 pointer-events-none font-sans">
              <img
                src={hoveredPhoto.previewUrl || "/no-image.png"}
                alt={hoveredPhoto.tipo || "Evidencia"}
                className="w-56 h-40 object-cover rounded-lg border border-slate-700 bg-slate-900"
              />
              <div className="w-full text-center">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-wide">
                  {hoveredPhoto.tipo || "Evidencia de Campo"}
                </span>
                {hoveredPhoto.comentario && (
                  <p className="text-[10px] text-slate-300 mt-1.5 leading-normal line-clamp-4">
                    {hoveredPhoto.comentario}
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