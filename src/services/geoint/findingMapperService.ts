import type { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import type { TemporalComparisonResult } from "./temporalComparisonService";
import type { StreetViewPanoramaResult } from "./streetViewProviderService";

export interface CreateFindingInput {
  photo: {
    id?: string;
    lat?: number;
    lng?: number;
    gpsLat?: number;
    gpsLng?: number;
    exifLat?: number;
    exifLng?: number;
    coordenadas?: { lat?: number; lng?: number };
    previewUrl?: string;
    url?: string;
    archivo_url?: string;
    tipo?: string;
    category?: string;
    comentario?: string;
    gpsTimestamp?: number | string;
    heading?: number;
    [key: string]: any;
  };
  panoramaResult: StreetViewPanoramaResult;
  temporalComparison: TemporalComparisonResult;
  expedienteId: string;
  index?: number;
}

/**
 * Servicio mapeador de hallazgos GEOINT.
 * Construye la estructura estandarizada StreetViewFinding a partir de las fuentes analíticas.
 */
export function buildStreetViewFindingFromAnalysis(
  input: CreateFindingInput
): StreetViewFinding {
  const { photo, panoramaResult, temporalComparison, expedienteId, index = 0 } = input;

  // Resolución robusta de coordenadas sin fallbacks estáticos falsos
  const rawLat =
    photo.lat ??
    photo.gpsLat ??
    photo.exifLat ??
    photo.coordenadas?.lat ??
    panoramaResult.panoramaLat;

  const rawLng =
    photo.lng ??
    photo.gpsLng ??
    photo.exifLng ??
    photo.coordenadas?.lng ??
    panoramaResult.panoramaLng;

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (rawLat == null || rawLng == null || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    throw new Error(
      `PHOTO_WITHOUT_GPS_COORDINATES: La fotografía id=${photo.id || index} no posee coordenadas GPS válidas.`
    );
  }
  const timestampStr = photo.gpsTimestamp
    ? new Date(photo.gpsTimestamp).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const photoImage = photo.previewUrl || photo.url || photo.archivo_url || "/placeholder-streetview.jpg";
  const panoramaImage = panoramaResult.dataUrl || panoramaResult.url || photoImage;

  const rawCategory = photo.tipo || photo.category || "COMPARACION_TEMPORAL";
  const categoriaValidada: StreetViewFinding["categoria"] =
    rawCategory === "ACECHO_ESCONDITE" ||
    rawCategory === "GRAFFITI_PANDILLA" ||
    rawCategory === "DENUE_POI" ||
    rawCategory === "OSINT_GENERAL" ||
    rawCategory === "RUTA_ACCESO" ||
    rawCategory === "PUNTO_ACECHO" ||
    rawCategory === "COMPARACION_TEMPORAL"
      ? rawCategory
      : "COMPARACION_TEMPORAL";

  const isSuccess = panoramaResult.isAvailable && temporalComparison.isAiSuccess;
  const statusPrefix = isSuccess
    ? "[BARRIDO OPERACIONAL GEOINT ADR-019.7]"
    : "[PROCESAMIENTO CALIBRADO LOCAL]";

  const descripcion =
    `${statusPrefix} Hallazgo espacial detectado in situ en lat ${lat.toFixed(4)}, lng ${lng.toFixed(4)}. ` +
    `${photo.comentario || "Modificación estructural identificada respecto al entorno periférico."} ` +
    `Delta temporal: ${temporalComparison.temporalDeltaFormatted}.`;

  const observacionesVisual =
    `${temporalComparison.calibratedObservation} ` +
    `Muestra in situ registrada el ${timestampStr}. Requiere validación de gabinete SSPE-CEIPOL.`;

  return {
    id: `sv-geoint-${photo.id || index}-${Date.now()}`,
    expedienteId,
    categoria: categoriaValidada,
    coordenadas: { lat, lng },
    imagen: panoramaImage,
    heading: photo.heading || (index * 45) % 360,
    pitch: 5,
    fov: 90,
    estado: "PENDIENTE_REVISION",
    descripcion,
    observaciones_visual: observacionesVisual,
    fechaCreacion: new Date().toISOString(),
    usuarioRevision: "MOTOR_GEOINT_ADR019",
    origenRevision: "BARRIDO_AUTOMATICO",
  };
}
