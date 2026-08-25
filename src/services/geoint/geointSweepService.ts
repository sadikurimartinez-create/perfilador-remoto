import type { StreetViewFinding } from "@/components/streetview/StreetViewFindingsPanel";
import { fetchStreetViewPanorama } from "./streetViewProviderService";
import { runTemporalComparison } from "./temporalComparisonService";
import { buildStreetViewFindingFromAnalysis } from "./findingMapperService";
import { calculateHaversineDistanceMeters } from "../../utils/geoResolver";

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
 * ADR-019.15: Ejecuta la secuencia gobernada:
 * Fotografías georreferenciadas → Metadata real Google Street View (source=outdoor) → Haversine <= 50m → Deduplicación por pano_id → Comparación temporal con fecha real.
 */
export async function executeAutomaticGeointSweep(
  photos: GeointSweepInputPhoto[],
  expedienteId: string = "EXP-2026"
): Promise<GeointSweepExecutionResult> {
  console.log(`[geointSweepService] Iniciando barrido automático GEOINT para expediente ${expedienteId}. Fotos recibidas: ${photos.length}`);

  const findings: StreetViewFinding[] = [];
  const errors: string[] = [];
  const processedPanoramaIds = new Set<string>();
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

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      const errMessage = `INVALID_COORDINATES: Foto índice ${idx} id=${photo.id || "sin_id"} sin coordenadas válidas.`;
      console.warn(`[geointSweepService] ${errMessage}`);
      errors.push(errMessage);
      errorCount++;
      continue;
    }

    try {
      // 1. Obtener panorama real de Street View con metadata real (source=outdoor)
      const panoramaResult = await fetchStreetViewPanorama(lat, lng, {
        heading: photo.heading || (idx * 45) % 360,
        pitch: 5,
        fov: 90,
      });

      if (!panoramaResult.isAvailable || !panoramaResult.panoramaId || panoramaResult.error?.includes("NO_VALID_OUTDOOR_PANORAMA")) {
        const outdoorErr = `NO_VALID_OUTDOOR_PANORAMA: Foto id=${photo.id || idx} no posee panorámica exterior válida de Google Street View. Omitiendo.`;
        console.warn(`[geointSweepService] ${outdoorErr}`);
        errors.push(outdoorErr);
        errorCount++;
        continue;
      }

      const panoLat = panoramaResult.panoramaLat ?? lat;
      const panoLng = panoramaResult.panoramaLng ?? lng;

      // 2. Validación de Integridad Geoespacial ADR-019.15: Haversine <= 50m
      const distanceMeters = calculateHaversineDistanceMeters(lat, lng, panoLat, panoLng);

      if (distanceMeters > 50) {
        const distErr = `EXCEEDS_DISTANCE_TOLERANCE_50M: Panorama para foto id=${photo.id || idx} se encuentra a ${distanceMeters.toFixed(1)}m (Tolerancia max <= 50m). Omitiendo persistencia por desalineación territorial.`;
        console.warn(`[geointSweepService] ${distErr}`);
        errors.push(distErr);
        errorCount++;
        continue;
      }

      // 3. Deduplicación Nivel 1 por panoramaId real de Google (pano_id)
      const realPanoId = panoramaResult.panoramaId;
      if (processedPanoramaIds.has(realPanoId)) {
        const dupMsg = `DUPLICATE_PANORAMA: Panorama ${realPanoId} ya fue procesado en este expediente. Omitiendo duplicado.`;
        console.info(`[geointSweepService] ${dupMsg}`);
        continue;
      }
      processedPanoramaIds.add(realPanoId);

      // 4. Determinar fecha real de captura (prohibido inventar fechas)
      const realContextualDate = panoramaResult.captureDate || "FECHA_NO_DISPONIBLE";

      const photoImageUrl = photo.previewUrl || photo.url || photo.archivo_url || "";
      const panoramaImageUrl = panoramaResult.dataUrl || panoramaResult.url || "";

      const primaryDateStr = photo.gpsTimestamp
        ? new Date(photo.gpsTimestamp).toISOString().split("T")[0]
        : "FECHA_NO_DISPONIBLE";

      const temporalComparison = await runTemporalComparison({
        primaryUrl: photoImageUrl,
        contextualUrl: panoramaImageUrl,
        primaryDate: primaryDateStr,
        contextualDate: realContextualDate,
        expedienteId,
      });

      if (temporalComparison.error) {
        errors.push(`PHOTO_${idx}_AI_VISION_ERROR: ${temporalComparison.error}`);
      }

      // 5. Mapear la salida combinada hacia StreetViewFinding
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

