"use client";

import { GoogleMap, Marker, Polyline, Polygon, useLoadScript } from "@react-google-maps/api";
import { useState } from "react";

interface ProjectMapProps {
  geometryType: "individual" | "lineal" | "poligono";
  coordinates: { lat: number; lng: number }[];
  onUpdateCoordinates?: (coords: { lat: number; lng: number }[]) => void;
}

export function ProjectMap({ geometryType, coordinates, onUpdateCoordinates }: ProjectMapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc"
  });

  const [coords, setCoords] = useState(coordinates);

  if (!isLoaded) return <div>Cargando mapa...</div>;

  const center = coords[0] || { lat: 21.885, lng: -102.291 }; // Centro Aguascalientes

  const handleMarkerDrag = (index: number, lat: number, lng: number) => {
    const newCoords = [...coords];
    newCoords[index] = { lat, lng };
    setCoords(newCoords);
    if (onUpdateCoordinates) onUpdateCoordinates(newCoords);
  };

  return (
    <GoogleMap
      zoom={15}
      center={center}
      mapContainerStyle={{ width: "100%", height: "400px", borderRadius: "8px" }}
    >
      {geometryType === "individual" &&
        coords.map((coord, index) => (
          <Marker
            key={index}
            position={coord}
            draggable
            onDragEnd={(e) => handleMarkerDrag(index, e.latLng!.lat(), e.latLng!.lng())}
          />
        ))}

      {geometryType === "lineal" && <Polyline path={coords} options={{ strokeColor: "#FF0000", strokeWeight: 2 }} />}

      {geometryType === "poligono" && <Polygon path={coords} options={{ fillColor: "#FF0000", fillOpacity: 0.2, strokeColor: "#FF0000", strokeWeight: 2 }} />}
    </GoogleMap>
  );
}