import * as React from "react";
import { Polygon, Polyline, Circle, Marker } from "@react-google-maps/api";

export interface RectorGeometryData {
  geometryType?: "INDIVIDUAL" | "PUNTO" | "CORREDOR" | "LINEAL" | "POLIGONO" | "BUFFER" | string;
  polygonCoords?: { lat: number; lng: number }[];
  lineCoords?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  radiusKm?: number;
  hasCoordinates?: boolean;
}

interface RectorGeometryLayerProps {
  visible: boolean;
  geografiaRectora?: RectorGeometryData;
}

/**
 * CAPA 1 - RectorGeometryLayer
 * Representa el área de análisis y polígonos/líneas/puntos de la geografía rectora
 * con soporte especializado para los 3 tipos de geometría táctica:
 * 1. INDIVIDUAL (Punto Focal + Radio de Cobertura)
 * 2. CORREDOR (Eje de Trazado Vial + Buffer de Franja)
 * 3. POLÍGONO (Área Delimitada)
 */
export const RectorGeometryLayer: React.FC<RectorGeometryLayerProps> = ({
  visible,
  geografiaRectora,
}) => {
  if (!visible || !geografiaRectora) return null;

  const rawType = (geografiaRectora.geometryType || "").toUpperCase();
  const isIndividual = rawType.includes("INDIVIDUAL") || rawType.includes("PUNTO") || rawType.includes("POINT");
  const isCorridor = rawType.includes("CORREDOR") || rawType.includes("LINE") || rawType.includes("LINEAL");
  const isPolygon = rawType.includes("POLIGONO") || rawType.includes("POLYGON") || rawType.includes("BUFFER") || (!isIndividual && !isCorridor);

  const radiusMeters = (geografiaRectora.radiusKm || 1.0) * 1000;

  // 1. POLÍGONO
  const polygonPaths = React.useMemo(() => {
    if (!isPolygon) return null;
    if (geografiaRectora.polygonCoords && geografiaRectora.polygonCoords.length >= 3) {
      return geografiaRectora.polygonCoords;
    }
    if (geografiaRectora.center && geografiaRectora.center.lat && geografiaRectora.center.lng) {
      const c = geografiaRectora.center;
      const d = 0.008; // ~800m bounding box
      return [
        { lat: c.lat + d, lng: c.lng - d },
        { lat: c.lat + d, lng: c.lng + d },
        { lat: c.lat - d, lng: c.lng + d },
        { lat: c.lat - d, lng: c.lng - d },
      ];
    }
    return null;
  }, [isPolygon, geografiaRectora]);

  // 2. CORREDOR
  const corridorLinePaths = React.useMemo(() => {
    if (!isCorridor) return null;
    if (geografiaRectora.lineCoords && geografiaRectora.lineCoords.length >= 2) {
      return geografiaRectora.lineCoords;
    }
    if (geografiaRectora.center && geografiaRectora.center.lat && geografiaRectora.center.lng) {
      const c = geografiaRectora.center;
      const d = 0.006; // ~600m corridor line stretch
      return [
        { lat: c.lat, lng: c.lng - d },
        { lat: c.lat, lng: c.lng + d },
      ];
    }
    return null;
  }, [isCorridor, geografiaRectora]);

  // Icono para Punto Focal Táctico (Geometría Individual)
  const focalIcon = React.useMemo(() => {
    if (typeof window === "undefined" || !window.google) return undefined;
    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: "#06b6d4",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#ffffff",
      scale: 1.5,
      anchor: new google.maps.Point(12, 22),
    };
  }, []);

  return (
    <>
      {/* 1. POLÍGONO / ÁREA DELIMITADA */}
      {isPolygon && polygonPaths && (
        <Polygon
          paths={polygonPaths}
          options={{
            fillColor: "#06b6d4",
            fillOpacity: 0.18,
            strokeColor: "#06b6d4",
            strokeOpacity: 0.9,
            strokeWeight: 2.5,
            clickable: false,
          }}
        />
      )}

      {/* 2. CORREDOR VIAL / LÍNEA TÁCTICA */}
      {isCorridor && corridorLinePaths && (
        <>
          {/* Franja de amortiguamiento / Buffer de corredor */}
          <Polyline
            path={corridorLinePaths}
            options={{
              strokeColor: "#06b6d4",
              strokeOpacity: 0.25,
              strokeWeight: 24,
              clickable: false,
            }}
          />
          {/* Eje central de corredor */}
          <Polyline
            path={corridorLinePaths}
            options={{
              strokeColor: "#38bdf8",
              strokeOpacity: 0.95,
              strokeWeight: 4,
              clickable: false,
            }}
          />
        </>
      )}

      {/* 3. PUNTO INDIVIDUAL / CENTRO FOCAL */}
      {isIndividual && geografiaRectora.center && (
        <>
          <Circle
            center={geografiaRectora.center}
            radius={radiusMeters}
            options={{
              fillColor: "#06b6d4",
              fillOpacity: 0.12,
              strokeColor: "#06b6d4",
              strokeOpacity: 0.8,
              strokeWeight: 2,
              clickable: false,
            }}
          />
          <Marker
            position={geografiaRectora.center}
            icon={focalIcon}
            title="Punto Focal Rector"
          />
        </>
      )}

      {/* Círculo de cobertura adicional para Polígono */}
      {isPolygon && geografiaRectora.center && (
        <Circle
          center={geografiaRectora.center}
          radius={radiusMeters}
          options={{
            fillColor: "#38bdf8",
            fillOpacity: 0.05,
            strokeColor: "#38bdf8",
            strokeOpacity: 0.5,
            strokeWeight: 1.5,
            clickable: false,
          }}
        />
      )}
    </>
  );
};

export default RectorGeometryLayer;
