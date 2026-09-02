import * as React from "react";
import { Polygon, Polyline, Marker } from "@react-google-maps/api";

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
 * 1. INDIVIDUAL (Un unico Punto Rector)
 * 2. CORREDOR (Una sola linea por nodos rectores reales)
 * 3. POLÍGONO (Perimetro por vertices rectores reales)
 */
export const RectorGeometryLayer: React.FC<RectorGeometryLayerProps> = ({
  visible,
  geografiaRectora,
}) => {
  const rawType = (geografiaRectora?.geometryType || "").toUpperCase();
  const isIndividual = rawType.includes("INDIVIDUAL") || rawType.includes("PUNTO") || rawType.includes("POINT");
  const isCorridor = rawType.includes("CORREDOR") || rawType.includes("LINE") || rawType.includes("LINEAL");
  const isPolygon = rawType.includes("POLIGONO") || rawType.includes("POLYGON") || rawType.includes("BUFFER") || (!isIndividual && !isCorridor);


  // 1. POLÍGONO
  const polygonPaths = React.useMemo(() => {
    if (!isPolygon) return null;
    if (geografiaRectora?.polygonCoords && geografiaRectora.polygonCoords.length >= 3) {
      return geografiaRectora.polygonCoords;
    }
    return null;
  }, [isPolygon, geografiaRectora]);

  // 2. CORREDOR
  const corridorLinePaths = React.useMemo(() => {
    if (!isCorridor) return null;
    if (geografiaRectora?.lineCoords && geografiaRectora.lineCoords.length >= 2) {
      return geografiaRectora.lineCoords;
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

  if (!visible || !geografiaRectora) return null;
  return (
    <>
      {/* POLIGONO: solamente vertices rectores reales */}
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

      {/* CORREDOR: una sola linea por nodos rectores reales */}
      {isCorridor && corridorLinePaths && (
        <Polyline
          path={corridorLinePaths}
          options={{
            strokeColor: "#38bdf8",
            strokeOpacity: 0.95,
            strokeWeight: 4,
            clickable: false,
          }}
        />
      )}

      {/* INDIVIDUAL: un unico punto rector real */}
      {isIndividual && geografiaRectora.center && (
        <Marker
          position={geografiaRectora.center}
          icon={focalIcon}
          title="Punto Rector"
          clickable={false}
        />
      )}
    </>
  );
};

export default RectorGeometryLayer;
