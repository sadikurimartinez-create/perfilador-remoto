import * as React from "react";
import { Polygon, Polyline } from "@react-google-maps/api";

interface RectorGeometryLayerProps {
  visible: boolean;
  geografiaRectora?: {
    polygonCoords?: { lat: number; lng: number }[];
    lineCoords?: { lat: number; lng: number }[];
    center?: { lat: number; lng: number };
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

  return (
    <>
      {geografiaRectora.polygonCoords && geografiaRectora.polygonCoords.length > 0 && (
        <Polygon
          paths={geografiaRectora.polygonCoords}
          options={{
            fillColor: "#06b6d4",
            fillOpacity: 0.12,
            strokeColor: "#06b6d4",
            strokeOpacity: 0.85,
            strokeWeight: 2,
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
