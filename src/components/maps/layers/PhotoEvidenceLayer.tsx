import * as React from "react";
import { useState } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";

interface PhotoEvidenceLayerProps {
  visible: boolean;
  photographs?: any[];
}

/**
 * CAPA 3 - PhotoEvidenceLayer
 * Representa las evidencias fotográficas de campo con iconos de cámara verdes y miniaturas de previsualización.
 */
export const PhotoEvidenceLayer: React.FC<PhotoEvidenceLayerProps> = ({
  visible,
  photographs = [],
}) => {
  const [activePhoto, setActivePhoto] = useState<any | null>(null);

  console.debug("[PHOTO LAYER DEBUG]", {
    renderedPhotographsCount: photographs.length,
    firstCoordinateUsed: photographs.length > 0 ? {
      lat: photographs[0].lat || photographs[0].latitude || 0,
      lng: photographs[0].lng || photographs[0].longitude || 0,
    } : null,
  });

  if (!visible || photographs.length === 0) return null;

  return (
    <>
      {photographs.map((p, idx) => {
        const rawLat =
          p.lat ??
          p.latitude ??
          p.gpsLat ??
          p.exifLat ??
          p.coordenadas?.lat;

        const rawLng =
          p.lng ??
          p.longitude ??
          p.gpsLng ??
          p.exifLng ??
          p.coordenadas?.lng;

        const pLat = Number(rawLat);
        const pLng = Number(rawLng);

        if (
          !Number.isFinite(pLat) ||
          !Number.isFinite(pLng) ||
          (pLat === 0 && pLng === 0)
        ) {
          console.warn(
            "[PHOTO EVIDENCE] Fotografía descartada por coordenadas inválidas:",
            p
          );
          return null;
        }

        console.debug("[PHOTO EVIDENCE ADR-019.11.8]", {
          id: p.id,
          lat: pLat,
          lng: pLng,
          source:
            p.lat || p.latitude
              ? "direct"
              : p.gpsLat || p.exifLat
              ? "metadata"
              : "coordinates_object"
        });

        return (
          <React.Fragment key={`photo-${p.id || idx}`}>
            <Marker
              position={{ lat: pLat, lng: pLng }}
              onClick={() => setActivePhoto(p)}
              icon={{
                path: "M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
                fillColor: "#10b981",
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: "#ffffff",
                scale: 1.0,
                anchor: new google.maps.Point(12, 12),
              }}
            />
            {activePhoto && activePhoto.id === p.id && (
              <InfoWindow
                position={{ lat: pLat, lng: pLng }}
                onCloseClick={() => setActivePhoto(null)}
              >
                <div className="p-2 text-slate-900 font-sans max-w-xs flex flex-col items-center">
                  {p.previewUrl && (
                    <img
                      src={p.previewUrl}
                      alt="Miniatura de Campo"
                      className="w-28 h-20 object-cover rounded-md mb-2 border border-slate-200"
                    />
                  )}
                  <h4 className="text-[11px] font-black uppercase text-slate-800">Fotografía de Campo</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{p.gpsTimestamp ? new Date(p.gpsTimestamp).toLocaleDateString() : "N/D"}</p>
                  {p.comentario && <p className="text-[9px] text-slate-600 mt-1 text-center italic">"{p.comentario}"</p>}
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
