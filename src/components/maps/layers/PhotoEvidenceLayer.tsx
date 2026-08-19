import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface PhotoEvidenceLayerProps {
  visible: boolean;
  photographs?: any[];
  onSelectPhoto?: (photo: any) => void;
}

/**
 * CAPA 3 - PhotoEvidenceLayer
 * Representa las evidencias fotográficas de campo con iconos de cámara verdes y miniaturas de previsualización.
 */
export const PhotoEvidenceLayer: React.FC<PhotoEvidenceLayerProps> = ({
  visible,
  photographs = [],
  onSelectPhoto,
}) => {
  const [activePhoto, setActivePhoto] = useState<any | null>(null);

  const markerIcon = useMemo(() => {
    if (typeof window === "undefined" || !window.google) return undefined;
    return {
      path: "M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
      fillColor: "#10b981",
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: "#ffffff",
      scale: 1.0,
      anchor: new google.maps.Point(12, 12),
    };
  }, []);

  const handleMarkerClick = useCallback((p: any) => {
    setActivePhoto(p);
    if (onSelectPhoto) {
      onSelectPhoto(p);
    }
  }, [onSelectPhoto]);

  if (!visible || photographs.length === 0) return null;

  return (
    <>
      {photographs.map((p, idx) => {
        const pLat = p.lat || p.latitude || 0;
        const pLng = p.lng || p.longitude || 0;

        return (
          <React.Fragment key={`photo-${p.id || idx}`}>
            <Marker
              position={{ lat: pLat, lng: pLng }}
              onClick={() => handleMarkerClick(p)}
              icon={markerIcon}
            />
            {activePhoto && activePhoto.id === p.id && (
              <InfoWindow
                position={{ lat: pLat, lng: pLng }}
                onCloseClick={() => setActivePhoto(null)}
              >
                <div className="p-2 text-slate-900 font-sans max-w-xs flex flex-col items-center">
                  {(p.previewUrl || p.file_url) && (
                    <img
                      src={p.previewUrl || p.file_url}
                      alt="Miniatura de Campo"
                      className="w-28 h-20 object-cover rounded-md mb-2 border border-slate-200"
                    />
                  )}
                  <h4 className="text-[11px] font-black uppercase text-slate-800">{p.tipo || "Fotografía de Campo"}</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{p.gpsTimestamp ? new Date(p.gpsTimestamp).toLocaleDateString() : "N/D"}</p>
                  {p.comentario && <p className="text-[9px] text-slate-600 mt-1 text-center italic">"{p.comentario}"</p>}
                  <button
                    onClick={() => {
                      if (onSelectPhoto) onSelectPhoto(p);
                    }}
                    className="mt-2 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded transition flex items-center gap-1 shadow"
                  >
                    <span>🗑️</span> Borrar del Expediente
                  </button>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default PhotoEvidenceLayer;
