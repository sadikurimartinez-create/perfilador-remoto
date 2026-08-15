import {
  AlbumPhoto,
  EvidenceOrigin,
  CollectionMethod,
  EvidenceCategoryClass,
  SourceProvider,
  StreetViewMetadata,
} from "@/context/ProjectContext";
import { evaluateStreetViewGovernance } from "./streetViewGovernance";

export interface StreetViewCapturePayload {
  dataUrl: string; // Preview/base64 de la captura congelada
  poiLat: number; // Coordenada observada del POI
  poiLng: number;
  panoramaLat: number; // Coordenada donde Google capturó la foto
  panoramaLng: number;
  heading: number;
  pitch: number;
  fov: number;
  panoId?: string;
  captureDate?: string;
  category?: string; // e.g., "hideout", "graffiti", "denue_interest", "vulnerabilidad_fisica", "other", "RUTA_ACCESO", "RUTA_ESCAPE", "PUNTO_ACECHO"
  comentario?: string;
  analystName?: string;
  tipo_origen?: "STREETVIEW_MANUAL" | "STREETVIEW_AUTOMATICO";
  estado_revision?: "PENDIENTE_REVISION" | "APROBADO" | "IGNORADO";
}

/**
 * SSPE-CEIPOL - STREET VIEW MAPPER v2.1 (CONTRATO MODERNO DE BARRIDO)
 * Mapea una captura congelada de visor panorámico a la estructura fuertemente tipada de AlbumPhoto.
 */
export function mapStreetViewToAlbumPhoto(
  payload: StreetViewCapturePayload
): AlbumPhoto {
  const timestamp = Date.now();
  const photoId = `remote-sv-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

  // Evaluar gobernanza y confiabilidad v2.1
  const governance = evaluateStreetViewGovernance(payload.captureDate, 5);

  const metadata: StreetViewMetadata = {
    panoramaLat: payload.panoramaLat,
    panoramaLng: payload.panoramaLng,
    heading: Math.round(payload.heading),
    pitch: Math.round(payload.pitch),
    fov: Math.round(payload.fov),
    panoId: payload.panoId,
    captureDate: payload.captureDate || "N/D",
    provider: "Google Maps Street View Panorama v3",
    captureTimestamp: timestamp,
    tipo_origen: payload.tipo_origen || "STREETVIEW_MANUAL",
    estado_revision: payload.estado_revision || "PENDIENTE_REVISION"
  } as any;

  const categoryLabel = payload.category
    ? payload.category.toUpperCase().replace(/_/g, " ")
    : "VULNERABILIDAD FISICA";

  const commentText = payload.comentario
    ? payload.comentario
    : `Análisis remoto de entorno vial [Categoría: ${categoryLabel}].`;

  return {
    id: photoId,
    previewUrl: payload.dataUrl,
    lat: payload.poiLat,
    lng: payload.poiLng,
    tipo: "REMOTE_STREET_VIEW",
    comentario: commentText,
    evidenceId: `EVI-REM-${timestamp.toString().slice(-6)}`,
    contextualizedAt: timestamp,
    contextualizedBy: payload.analystName || "Analista CEIPOL",
    isContextualized: true,
    gpsAccuracy: 5,
    gpsTimestamp: timestamp,
    gpsSource: "GOOGLE_STREET_VIEW_PANORAMA",
    validado: true,
    isIndependentPoi: true,

    // Estructura de Gobernanza v2.1 y Contrato Determinístico de Evidencia
    evidenceOrigin: "REMOTE" as EvidenceOrigin,
    collectionMethod: "DESKTOP_ANALYSIS" as CollectionMethod,
    evidenceCategoryClass: "REMOTE_VISUAL" as EvidenceCategoryClass,
    sourceProvider: "GOOGLE_STREET_VIEW" as SourceProvider,
    confidenceLevel: governance.confidenceLevel,
    confidencePercentage: governance.confidencePercentage,
    confidenceFactors: governance.confidenceFactors,
    streetViewCategory: payload.category || "vulnerabilidad_fisica",
    streetViewSource: "Google Maps Street View Panorama v3",
    streetViewMetadata: metadata,

    // Campos deterministas del contrato Evidence Governance Engine
    category: "STREET_VIEW",
    classification: "REMOTE_VISUAL",
    isStreetView: true,
  };
}

export default mapStreetViewToAlbumPhoto;
