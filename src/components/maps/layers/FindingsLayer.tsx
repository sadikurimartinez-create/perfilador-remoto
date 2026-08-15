import * as React from "react";
import { useState } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface FindingsLayerProps {
  visible: boolean;
  findings?: any[];
  onFindingSelect?: (finding: any) => void;
  selectedFindingId?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  RUTA_ACCESO: "#3b82f6",     // Azul
  RUTA_ESCAPE: "#f97316",     // Naranja
  PUNTO_ACECHO: "#64748b",    // Gris
  GRAFITI: "#a855f7",         // Morado
};

/**
 * CAPA 6 - FindingsLayer
 * Muestra los hallazgos de Street View validados y aprobados por el analista.
 * Incluye InfoWindows interactivos y soporte para conos de visión.
 */
export const FindingsLayer: React.FC<FindingsLayerProps> = ({
  visible,
  findings = [],
  onFindingSelect,
  selectedFindingId,
}) => {
  const [activeFinding, setActiveFinding] = useState<any | null>(null);

  if (!visible || findings.length === 0) return null;

  return (
    <>
      {findings.map((f, idx) => {
        const lat = f.coordenadas?.lat || f.coordsInfo?.lat || f.lat || 0;
        const lng = f.coordenadas?.lng || f.coordsInfo?.lng || f.lng || 0;
        const category = f.categoria || "RUTA_ACCESO";
        const color = CATEGORY_COLORS[category] || "#e11d48"; // Rojo por defecto si no tiene categoría

        const isSelected = selectedFindingId === f.id || (activeFinding && activeFinding.id === f.id);

        return (
          <React.Fragment key={`finding-${f.id || idx}`}>
            <Marker
              position={{ lat, lng }}
              onClick={() => {
                if (onFindingSelect) onFindingSelect(f);
                setActiveFinding(f);
              }}
              icon={{
                path: "M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z",
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: isSelected ? 2.5 : 1.5,
                strokeColor: isSelected ? "#38bdf8" : "#ffffff", // Borde cian si está seleccionado
                scale: isSelected ? 1.3 : 1.1,
                anchor: new google.maps.Point(12, 22),
              }}
            />
            {activeFinding && activeFinding.id === f.id && (
              <InfoWindow
                position={{ lat, lng }}
                onCloseClick={() => {
                  setActiveFinding(null);
                  if (onFindingSelect) onFindingSelect(null);
                }}
              >
                <div className="p-2.5 text-slate-950 font-sans max-w-[240px] flex flex-col items-center">
                  {f.imagen && (
                    <img
                      src={f.imagen}
                      alt="Hallazgo Street View"
                      className="w-full h-24 object-cover rounded-lg mb-2 border border-slate-200"
                    />
                  )}
                  <h4 className="text-[11px] font-black uppercase text-center w-full pb-1 border-b border-slate-100" style={{ color }}>
                    📍 HALLAZGO: {category.replace("_", " ")}
                  </h4>
                  <div className="w-full text-[9px] text-slate-500 font-mono mt-1.5 space-y-0.5">
                    <p>ID: <span className="font-bold text-slate-700">{f.id}</span></p>
                    <p>Orientación: <span className="font-bold text-slate-700">{f.heading || 0}°</span></p>
                    <p>Amplitud (FOV): <span className="font-bold text-slate-700">{f.fov || 90}°</span></p>
                    <p>Coordenadas: <span className="font-bold text-slate-700">{lat.toFixed(5)}, {lng.toFixed(5)}</span></p>
                  </div>
                  {f.descripcion && (
                    <p className="text-[9px] text-slate-700 mt-2 bg-slate-50 p-1.5 rounded border border-slate-100 italic w-full text-center leading-relaxed">
                      "{f.descripcion}"
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default FindingsLayer;
