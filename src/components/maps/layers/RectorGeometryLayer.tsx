import * as React from "react";
import { Polygon, Polyline, Circle } from "@react-google-maps/api";

interface RectorGeometryLayerProps {
  visible: boolean;
  geografiaRectora?: {
    polygonCoords?: { lat: number; lng: number }[];
    lineCoords?: { lat: number; lng: number }[];
    center?: { lat: number; lng: number };
    radiusKm?: number;
    hasCoordinates?: boolean;
  };
}

/**
 * CAPA 1 - RectorGeometryLayer
 * Representa el área de análisis y polígonos/líneas de la geografía rectora con tonos cian semitransparentes.
 */
export const RectorGeometryLayer: React.FC<RectorGeometryLayerProps> = ({
  visible,
  geografiaRectora,
}) => {
  if (!visible || !geografiaRectora) return null;

  // Auto-generate polygon if center exists but polygonCoords is missing/empty
  const activePolygon = React.useMemo(() => {
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
  }, [geografiaRectora]);

  const radiusMeters = (geografiaRectora.radiusKm || 1.5) * 1000;

  return (
    <>
      {activePolygon && (
        <Polygon
          paths={activePolygon}
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
      {geografiaRectora.center && (
        <Circle
          center={geografiaRectora.center}
          radius={radiusMeters}
          options={{
            fillColor: "#38bdf8",
            fillOpacity: 0.08,
            strokeColor: "#38bdf8",
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
            clickable: false,
          }}
        />
      )}
      {geografiaRectora.lineCoords && geografiaRectora.lineCoords.length > 0 && (
        <Polyline
          path={geografiaRectora.lineCoords}
          options={{
            strokeColor: "#06b6d4",
            strokeOpacity: 0.85,
            strokeWeight: 3,
            clickable: false,
          }}
        />
      )}
    </>
  );
};

export default RectorGeometryLayer;
