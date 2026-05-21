"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, Polyline, Polygon, useJsApiLoader } from "@react-google-maps/api";

type ProjectMapProps = {
  geometryType: "individual" | "lineal" | "poligono";
  coordinates: { lat: number; lng: number }[];
};

const containerStyle = {
  width: "100%",
  height: "320px",
};

export function ProjectMap({ geometryType, coordinates }: ProjectMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const center = useMemo(() => {
    if (coordinates.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length;
    const lng = coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length;
    return { lat, lng };
  }, [coordinates]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google || coordinates.length === 0) return;
    const g = (window as any).google as typeof google;
    const bounds = new g.maps.LatLngBounds();
    coordinates.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    if (coordinates.length > 1) {
      mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
    } else {
      mapRef.current.setCenter(coordinates[0]);
      mapRef.current.setZoom(15);
    }
  }, [mapReady, coordinates]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "project-map",
    googleMapsApiKey: apiKey,
  });

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400 mt-4">
        <p className="font-semibold">Mapa no disponible</p>
        <p className="mt-1">Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400 mt-4">
        <p className="font-semibold">Error al cargar el mapa</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex items-center justify-center mt-4">
        Cargando mapa de Google…
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-slate-700 overflow-hidden bg-slate-900/50 mt-4">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        onLoad={onMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          mapTypeId: "hybrid",
        }}
      >
        {coordinates.map((c, idx) => (
          <Marker
            key={`coord-${idx}`}
            position={c}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#dc2626",
              fillOpacity: 1,
              strokeColor: "#fef2f2",
              strokeWeight: 2,
            }}
          />
        ))}

        {geometryType === "lineal" && coordinates.length > 1 && (
          <Polyline
            path={coordinates}
            options={{
              strokeColor: "#3b82f6",
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        )}

        {geometryType === "poligono" && coordinates.length > 2 && (
          <Polygon
            paths={coordinates}
            options={{
              strokeColor: "#8b5cf6",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              fillColor: "#8b5cf6",
              fillOpacity: 0.35,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}