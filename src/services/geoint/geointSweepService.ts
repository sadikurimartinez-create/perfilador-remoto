import type { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import { fetchStreetViewPanorama } from "./streetViewProviderService";
import { runTemporalComparison } from "./temporalComparisonService";
import { buildStreetViewFindingFromAnalysis } from "./findingMapperService";

export interface GeointSweepInputPhoto {
  id?: string;
  lat?: number;
  lng?: number;
  previewUrl?: string;
  url?: string;
  archivo_url?: string;
  tipo?: string;
  category?: string;
  comentario?: string;
  gpsTimestamp?: number | string;
  heading?: number;
}

export interface GeointSweepExecutionResult {
  expedienteId: string;
  totalPhotosReceived: number;
  findings: StreetViewFinding[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Servicio Orquestador del Motor GEOINT Operacional.
 * Ejecuta en serie o paralelo controlado la secuencia:
 * Fotografías georreferenciadas → Panorámicas Street View real → Comparación de visión IA → Mapeo de hallazgos.
 */
export async function executeAutomaticGeointSweep(
  photos: GeointSweepInputPhoto[],
  expedienteId: string = "EXP-2026"
): Promise<GeointSweepExecutionResult> {
  console.log(`[geointSweepService] Iniciando barrido automático GEOINT para expediente ${expedienteId}. Fotos recibidas: ${photos.length}`);

  const findings: StreetViewFinding[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    console.warn("[geointSweepService] No se proporcionaron fotografías georreferenciadas válidas.");
    return {
      expedienteId,
      totalPhotosReceived: 0,
      findings: [],
      successCount: 0,
      errorCount: 1,
      errors: ["NO_PHOTOS_PROVIDED: El arreglo de fotografías está vacío."],
    };
  }

  for (let idx = 0; idx < photos.length; idx++) {
    const photo = photos[idx];
    const lat = Number(photo.lat);
    const lng = Number(photo.lng);

    if (isNaN(lat) || isNaN(lng)) {
      const errMessage = `INVALID_COORDINATES: Foto índice ${idx} id=${photo.id || "sin_id"} sin coordenadas válidas.`;
      console.warn(`[geointSweepService] ${errMessage}`);
      errors.push(errMessage);
      errorCount++;
      continue;
    }

    try {
      // 1. Obtener panorama real de Street View
      const panoramaResult = await fetchStreetViewPanorama(lat, lng, {
        heading: photo.heading || (idx * 45) % 360,
        pitch: 5,
        fov: 90,
      });

      if (panoramaResult.error) {
        errors.push(`PHOTO_${idx}_STREET_VIEW_ERROR: ${panoramaResult.error}`);
      }

      // 2. Ejecutar análisis de comparación temporal e IA
      const photoImageUrl = photo.previewUrl || photo.url || photo.archivo_url || "";
      const panoramaImageUrl = panoramaResult.dataUrl || panoramaResult.url || "";

      const temporalComparison = await runTemporalComparison({
        primaryUrl: photoImageUrl,
        contextualUrl: panoramaImageUrl,
        primaryDate: photo.gpsTimestamp
          ? new Date(photo.gpsTimestamp).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        contextualDate: "2023-01-01",
        expedienteId,
      });

      if (temporalComparison.error) {
        errors.push(`PHOTO_${idx}_AI_VISION_ERROR: ${temporalComparison.error}`);
      }

      // 3. Mapear la salida combinada hacia StreetViewFinding
      const finding = buildStreetViewFindingFromAnalysis({
        photo,
        panoramaResult,
        temporalComparison,
        expedienteId,
        index: idx,
      });

      findings.push(finding);
      successCount++;
    } catch (err: any) {
      const catchErr = `PHOTO_${idx}_EXCEPTION: Error inesperado en procesamiento de foto id=${photo.id || idx}: ${err?.message || err}`;
      console.error(`[geointSweepService] ${catchErr}`);
      errors.push(catchErr);
      errorCount++;
    }
  }

  console.log(
    `[geointSweepService] Barrido GEOINT finalizado para expediente ${expedienteId}. ` +
    `Hallazgos procesados: ${findings.length}, Éxitos: ${successCount}, Errores: ${errorCount}`
  );

  return {
    expedienteId,
    totalPhotosReceived: photos.length,
    findings,
    successCount,
    errorCount,
    errors,
  };
}
