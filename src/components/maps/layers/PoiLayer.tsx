import * as React from "react";
import { useState, useMemo } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface PoiLayerProps {
  visible: boolean;
  pois?: any[];
  selectedPoiId?: string;
  onPoiSelect?: (poi: any) => void;
}

/**
 * CAPA 2 - PoiLayer con Clustering Inteligente y Tooltips Interactivos
 * Agrupa marcadores densos para prevenir la saturación de etiquetas y facilitar la lectura en expedientes complejos.
 */
export const PoiLayer: React.FC<PoiLayerProps> = ({
  visible,
  pois = [],
  selectedPoiId,
  onPoiSelect,
}) => {
  const [activePoi, setActivePoi] = useState<any | null>(null);

  // Algoritmo determinista de clustering por cuadrícula simplificado para alto rendimiento
  const clusters = useMemo(() => {
    if (!visible || pois.length === 0) return [];

    const gridSize = 0.015; // Tamaño de la cuadrícula en grados geográficos
    const groups: Record<string, any[]> = {};

    pois.forEach((poi) => {
      const lat = poi.lat || poi.latitude || 0;
      const lng = poi.lng || poi.longitude || 0;
      const gridX = Math.round(lat / gridSize);
      const gridY = Math.round(lng / gridSize);
      const key = `${gridX},${gridY}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(poi);
    });

    return Object.entries(groups).map(([key, list]) => {
      const first = list[0];
      const flat = first.lat || first.latitude || 0;
      const flng = first.lng || first.longitude || 0;

      if (list.length === 1) {
        return {
          type: "single",
          poi: first,
          lat: flat,
          lng: flng,
        };
      } else {
        // Calcular centroide del cluster
        const avgLat = list.reduce((sum, p) => sum + (p.lat || p.latitude || 0), 0) / list.length;
        const avgLng = list.reduce((sum, p) => sum + (p.lng || p.longitude || 0), 0) / list.length;
        return {
          type: "cluster",
          count: list.length,
          pois: list,
          lat: avgLat,
          lng: avgLng,
        };
      }
    });
  }, [pois, visible]);

  if (!visible) return null;

  return (
    <>
      {clusters.map((c, idx) => {
        if (c.type === "single") {
          const isSelected = c.poi.id === selectedPoiId;
          const iconColor = isSelected ? "#ef4444" : "#3b82f6";

          return (
            <React.Fragment key={`poi-single-${c.poi.id || idx}`}>
              <Marker
                position={{ lat: c.lat, lng: c.lng }}
                onClick={() => {
                  if (onPoiSelect) onPoiSelect(c.poi);
                  setActivePoi(c.poi);
                }}
                icon={{
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                  fillColor: iconColor,
                  fillOpacity: 1,
                  strokeWeight: 1.5,
                  strokeColor: "#ffffff",
                  scale: 1.3,
                  anchor: new google.maps.Point(12, 22),
                }}
              />
              {activePoi && activePoi.id === c.poi.id && (
                <InfoWindow
                  position={{ lat: c.lat, lng: c.lng }}
                  onCloseClick={() => setActivePoi(null)}
                >
                  <div className="p-2 text-slate-900 font-sans max-w-xs">
                    <h4 className="text-xs font-black uppercase text-slate-800">{c.poi.name || "Punto de Interés"}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Categoría: {c.poi.category || "General"}</p>
                    {c.poi.comentario && <p className="text-[10px] text-slate-600 mt-1 italic">"{c.poi.comentario}"</p>}
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        } else {
          // Renderizar indicador de cluster numérico
          return (
            <Marker
              key={`poi-cluster-${idx}`}
              position={{ lat: c.lat, lng: c.lng }}
              label={{
                text: String(c.count),
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#ef4444",
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: 16,
              }}
            />
          );
        }
      })}
    </>
  );
};

export default PoiLayer;
