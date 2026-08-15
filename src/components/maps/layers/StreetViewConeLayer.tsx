"use client";

import * as React from "react";
import { Polygon } from "@react-google-maps/api";

interface StreetViewConeLayerProps {
  center: { lat: number; lng: number } | null;
  heading: number;
  fov: number;
  visible?: boolean;
}

/**
 * Calcula el polígono para simular el abanico visual (Cono) de Street View
 * basado en coordenadas geográficas reales.
 */
function getConePoints(lat: number, lng: number, heading: number, fov: number, radiusMeters = 30): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  
  // Agregar vértice central de la cámara
  points.push({ lat, lng });

  // Conversión aproximada de metros a grados de latitud/longitud
  const rLat = radiusMeters / 111320;
  const rLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const startAngle = heading - fov / 2;
  const endAngle = heading + fov / 2;

  // Generar puntos del arco del abanico (cada 5 grados)
  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const angleRad = ((90 - angle) * Math.PI) / 180; // Convertir heading a ángulo trigonométrico estándar
    const pLat = lat + rLat * Math.sin(angleRad);
    const pLng = lng + rLng * Math.cos(angleRad);
    points.push({ lat: pLat, lng: pLng });
  }

  // Cerrar el polígono de vuelta en el vértice de origen
  points.push({ lat, lng });
  return points;
}

export function StreetViewConeLayer({
  center,
  heading,
  fov,
  visible = true
}: StreetViewConeLayerProps) {
  if (!visible || !center) return null;

  const paths = getConePoints(center.lat, center.lng, heading, fov);

  const options = {
    fillColor: "#06b6d4", // Cyan-500
    fillOpacity: 0.18,
    strokeColor: "#0891b2", // Cyan-600
    strokeOpacity: 0.7,
    strokeWeight: 1.5,
    clickable: false,
    draggable: false,
    editable: false,
    visible: true,
    zIndex: 999
  };

  return <Polygon paths={paths} options={options} />;
}

export default StreetViewConeLayer;
