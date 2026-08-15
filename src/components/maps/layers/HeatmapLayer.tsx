import * as React from "react";

interface HeatmapLayerProps {
  visible: boolean;
  points?: any[];
}

/**
 * CAPA 7 - HeatmapLayer
 * Infraestructura de mapa de calor preparada para análisis espacial futuro y densidad criminal territorial.
 */
export const HeatmapLayer: React.FC<HeatmapLayerProps> = () => {
  return null; // Reservado para implementaciones WebGL de densidad espacial futuras
};

export default HeatmapLayer;
