import * as React from "react";
import { useState } from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";
import { geographicEvidenceCoordinates, geographicEvidenceTrace, geographicRoleLabels } from "@/utils/geographicEvidencePresentation";

interface PhotoEvidenceLayerProps { visible: boolean; photographs?: any[] }
export const PhotoEvidenceLayer: React.FC<PhotoEvidenceLayerProps> = ({ visible, photographs = [] }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (!visible) return null;
  return <>{photographs.filter(photo => !photo.deleted).map(photo => {
    const position = geographicEvidenceCoordinates(photo);
    if (!position || !photo.id) return null;
    const trace = geographicEvidenceTrace(photo);
    const image = photo.previewUrl || photo.url;
    return <React.Fragment key={photo.id}>
      <Marker position={position} title={`${trace.label} · ${trace.resourceId}`}
        label={{ text: trace.label, color: "#ffffff", fontSize: "12px", fontWeight: "700" }}
        icon={{ path: 0, scale: 16, fillColor: trace.role === "NONE" ? "#86198f" : "#0369a1", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 }}
        onClick={() => setActiveId(photo.id)} />
      {activeId === photo.id && <InfoWindow position={position} options={{ disableAutoPan: false, maxWidth: 340 }} onCloseClick={() => setActiveId(null)}>
        <article className="text-slate-900 w-72 max-w-[70vw] p-2 space-y-2" data-resource-id={trace.resourceId}>
          <h4 className="font-bold">{trace.label} · {geographicRoleLabels[trace.role][1]}</h4>
          {image ? <a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt={geographicRoleLabels[trace.role][1]} className="w-full h-44 object-contain" /></a> : <p>SIN VISTA PREVIA</p>}
          <p className="text-xs break-all">Recurso: {trace.resourceId} · Expediente: {trace.projectId || "No acreditado"}</p>
          <p className="text-xs">{position.lat}, {position.lng} · Secuencia: {trace.order ?? "No acreditada"}</p>
          <p className="text-xs">{photo.fuente || photo.sourceProvider || "Origen no acreditado"}</p>
          <p className="text-sm">{photo.comentario || photo.context || "Sin contextualización"}</p>
          <button type="button" onClick={() => setActiveId(null)}>Cerrar evidencia</button>
        </article>
      </InfoWindow>}
    </React.Fragment>;
  })}</>;
};
export default PhotoEvidenceLayer;
