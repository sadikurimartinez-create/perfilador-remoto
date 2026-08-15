import * as React from "react";
import { useState } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface StreetViewAutomaticLayerProps {
  visible: boolean;
  streetViewAutomatic?: any[];
  onStreetViewSelect?: (sv: any) => void;
}

// Mapa de colores institucional aprobado por categoría para evitar correlación directa con peligro
const CATEGORY_COLORS: Record<string, string> = {
  RUTA_ACCESO: "#3b82f6",     // Azul
  RUTA_ESCAPE: "#f97316",     // Naranja
  PUNTO_ACECHO: "#64748b",    // Gris
  GRAFITI: "#a855f7",         // Morado
  vulnerabilidad_fisica: "#06b6d4",
};

/**
 * CAPA 5 - StreetViewAutomaticLayer
 * Representa las capturas de barrido asistido multicapa de la Fase 1.
 * Colorea de forma determinista según la categoría táctica observada.
 */
export const StreetViewAutomaticLayer: React.FC<StreetViewAutomaticLayerProps> = ({
  visible,
  streetViewAutomatic = [],
  onStreetViewSelect,
}) => {
  const [activeSv, setActiveSv] = useState<any | null>(null);

  if (!visible || streetViewAutomatic.length === 0) return null;

  // Filtrar para mostrar únicamente capturas en estado PENDIENTE_REVISION o sin estado definido
  const pendingCaptures = streetViewAutomatic.filter(
    (sv) => sv.estado_revision === "PENDIENTE_REVISION" || !sv.estado_revision
  );

  return (
    <>
      {pendingCaptures.map((sv, idx) => {
        const svLat = sv.lat || (sv.streetViewMetadata?.panoramaLat) || 0;
        const svLng = sv.lng || (sv.streetViewMetadata?.panoramaLng) || 0;
        const category = sv.streetViewCategory || "vulnerabilidad_fisica";
        const color = CATEGORY_COLORS[category] || "#06b6d4";

        return (
          <React.Fragment key={`sv-auto-${sv.id || idx}`}>
            <Marker
              position={{ lat: svLat, lng: svLng }}
              onClick={() => {
                if (onStreetViewSelect) onStreetViewSelect(sv);
                setActiveSv(sv);
              }}
              icon={{
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 1.5,
                strokeColor: "#ffffff",
                scale: 1.1,
                anchor: new google.maps.Point(12, 22),
              }}
            />
            {activeSv && activeSv.id === sv.id && (
              <InfoWindow
                position={{ lat: svLat, lng: svLng }}
                onCloseClick={() => setActiveSv(null)}
              >
                <div className="p-2 text-slate-900 font-sans max-w-xs flex flex-col items-center">
                  {sv.previewUrl && (
                    <img
                      src={sv.previewUrl}
                      alt="Street View Automático"
                      className="w-28 h-20 object-cover rounded-md mb-2 border border-slate-200"
                    />
                  )}
                  <h4 className="text-[11px] font-black uppercase" style={{ color }}>
                    Barrido: {category.replace("_", " ")}
                  </h4>
                  <p className="text-[9px] text-slate-500 font-mono">Orientación (HDG): {sv.streetViewMetadata?.heading || 0}°</p>
                  <p className="text-[9px] text-slate-500 font-mono">Estado: <span className="font-bold text-emerald-600">APROBADO</span></p>
                  {sv.comentario && <p className="text-[9px] text-slate-600 mt-1 text-center italic">"{sv.comentario}"</p>}
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default StreetViewAutomaticLayer;
