import { SIECoreResult } from "../statisticalIntelligenceEngineV2/models/statisticalTypes";
import { StatisticalEvidenceMatrix } from "./models/statisticalEvidenceTypes";

export class StatisticalEvidenceValidator {
  /**
   * Valida la consistencia analítica, temporal y espacial de la SEM contra el origen y el motor.
   */
  public static validate(
    sem: StatisticalEvidenceMatrix,
    rawIncidents: any[],
    sieResult: SIECoreResult
  ): {
    validationStatus: "VALIDATED" | "WARNING" | "FAILED";
    warnings: string[];
  } {
    const warnings: string[] = [];
    let status: "VALIDATED" | "WARNING" | "FAILED" = "VALIDATED";

    // --- Validación 1: Fidelidad de Conteo de Eventos Totales ---
    if (sem.criminalEvidence.totalEvents !== sieResult.metadata.totalEvents) {
      status = "FAILED";
      warnings.push(
        `[CRITICAL] Discrepancia de conteo de eventos: SEM registra ${sem.criminalEvidence.totalEvents} pero SIE reporta ${sieResult.metadata.totalEvents}`
      );
    }

    // --- Validación 2: Coincidencia de Hotspots ---
    if (sem.spatialEvidence.hotspots.length !== sieResult.spatialAnalysis.hotspots.length) {
      status = "FAILED";
      warnings.push(
        `[CRITICAL] Discrepancia en hotspots: SEM registra ${sem.spatialEvidence.hotspots.length} hotspots, pero SIE reporta ${sieResult.spatialAnalysis.hotspots.length}`
      );
    }

    // --- Validación 3: Bondad de Ajuste Poisson (Modelo Predictivo) ---
    if (!sem.predictiveEvidence.modelFit || !sieResult.predictiveAnalysis.poissonModelValidity) {
      if (status !== "FAILED") status = "WARNING";
      warnings.push(
        `[WARNING] El modelo Poisson muestra un bajo ajuste estadístico (p-value < 0.05). Existe sobredispersión temporal en la frecuencia diaria.`
      );
    }

    // --- Validación 4: Cobertura Temporal de Datos (Ajuste 5) ---
    const centerLat = sieResult.metadata.centerLat;
    const centerLng = sieResult.metadata.centerLng;
    const radius = sieResult.metadata.radiusMeters;

    const validIncidents = rawIncidents.filter(inc => {
      const lat = parseFloat(inc.lat ?? inc.LATITUD);
      const lng = parseFloat(inc.lng ?? inc.LONGITUD);
      if (isNaN(lat) || !isFinite(lat) || isNaN(lng) || !isFinite(lng)) {
        return false;
      }
      const dist = this.calculateHaversineDistance(centerLat, centerLng, lat, lng);
      return dist <= radius;
    });

    const sortedDates = validIncidents
      .map(inc => inc.fecha ?? inc.FECHA)
      .filter(Boolean)
      .sort();

    const expectedStart = sortedDates.length > 0 ? sortedDates[0] : "SIN_FECHA";
    const expectedEnd = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : "SIN_FECHA";

    if (
      sem.temporalEvidence.temporalCoverage.startDate !== expectedStart ||
      sem.temporalEvidence.temporalCoverage.endDate !== expectedEnd
    ) {
      if (status !== "FAILED") status = "WARNING";
      warnings.push(
        `[WARNING] Inconsistencia en la cobertura temporal: SEM reporta [${sem.temporalEvidence.temporalCoverage.startDate} a ${sem.temporalEvidence.temporalCoverage.endDate}] pero los registros limpios muestran [${expectedStart} a ${expectedEnd}]`
      );
    }

    return {
      validationStatus: status,
      warnings
    };
  }

  private static calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
