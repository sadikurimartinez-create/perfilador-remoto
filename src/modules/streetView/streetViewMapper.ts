import {
  AlbumPhoto,
  EvidenceOrigin,
  CollectionMethod,
  EvidenceCategoryClass,
  SourceProvider,
  StreetViewMetadata,
} from "@/context/ProjectContext";
import { evaluateStreetViewGovernance } from "./streetViewGovernance";
import { buildStreetViewFindingLineage, validateLineage } from "@/utils/evidenceLineage";
import { createAiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";

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
  geographyId?: string | null;
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
  const evidenceId = `EVI-REM-${timestamp.toString().slice(-6)}`;

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

  const lineage = buildStreetViewFindingLineage({
    findingId: photoId,
    evidenceId,
    sourceReference: payload.panoId || payload.captureDate || "Google Street View Panorama",
    geographyId: payload.geographyId ?? null,
  });
  const lineageValidation = validateLineage(lineage);
  const aiAnalyticalOutput = createAiAnalyticalOutput({
    outputType: "INFERENCE",
    provider: "GOOGLE_STREET_VIEW",
    model: "UNAVAILABLE",
    confidence: governance.confidencePercentage,
    confidenceSource: "DETERMINISTIC_RULE",
    sourceReferences: [payload.panoId, payload.captureDate, "Google Street View Panorama"],
    evidenceIds: [evidenceId],
    findingIds: [photoId],
    geographyId: payload.geographyId ?? null,
    lineage,
    limitations: ["Visual interpretation remains AI/deterministic inference until human review."],
  });

  return {
    id: photoId,
    previewUrl: payload.dataUrl,
    lat: payload.poiLat,
    lng: payload.poiLng,
    tipo: "REMOTE_STREET_VIEW",
    comentario: commentText,
    evidenceId,
    contextualizedAt: timestamp,
    contextualizedBy: payload.analystName || "Analista CEIPOL",
    isContextualized: true,
    gpsAccuracy: 5,
    gpsTimestamp: timestamp,
    gpsSource: "GOOGLE_STREET_VIEW_PANORAMA",
    validado: true,
    humanValidationStatus: "PENDING_REVIEW",
    validationSource: "CANONICAL_FIELD",
    isIndependentPoi: true,
    geographyId: payload.geographyId ?? null,

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
    sourceEvidenceId: evidenceId,
    lineage,
    lineageStatus: lineageValidation.status,
    aiAnalyticalOutput,
  };
}

export default mapStreetViewToAlbumPhoto;
