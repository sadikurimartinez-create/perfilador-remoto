import * as React from "react";
import { useState } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface StreetViewManualLayerProps {
  visible: boolean;
  streetViewManual?: any[];
  onStreetViewSelect?: (sv: any) => void;
}

/**
 * CAPA 4 - StreetViewManualLayer
 * Representa las capturas de Street View manuales tomadas por el analista.
 * Se representan mediante marcadores de cámara color cian.
 */
export const StreetViewManualLayer: React.FC<StreetViewManualLayerProps> = ({
  visible,
  streetViewManual = [],
  onStreetViewSelect,
}) => {
  const [activeSv, setActiveSv] = useState<any | null>(null);

  if (!visible || streetViewManual.length === 0) return null;

  return (
    <>
      {streetViewManual.map((sv, idx) => {
        const svLat = sv.lat || (sv.streetViewMetadata?.panoramaLat) || 0;
        const svLng = sv.lng || (sv.streetViewMetadata?.panoramaLng) || 0;

        return (
          <React.Fragment key={`sv-manual-${sv.id || idx}`}>
            <Marker
              position={{ lat: svLat, lng: svLng }}
              onClick={() => {
                if (onStreetViewSelect) onStreetViewSelect(sv);
                setActiveSv(sv);
              }}
              icon={{
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "#06b6d4",
                fillOpacity: 1,
                strokeWeight: 1,
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
                      alt="Street View Manual"
                      className="w-28 h-20 object-cover rounded-md mb-2 border border-slate-200"
                    />
                  )}
                  <h4 className="text-[11px] font-black uppercase text-cyan-600">Street View Manual</h4>
                  <p className="text-[9px] text-slate-500 font-mono">Orientación (HDG): {sv.streetViewMetadata?.heading}°</p>
                  <p className="text-[9px] text-slate-500 font-mono">Analista: {sv.contextualizedBy || "Gabinete"}</p>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default StreetViewManualLayer;
