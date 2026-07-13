import { StandardCrimeRecord, ExclusionLog, SIECoreResult } from "./models/statisticalTypes";
import { TemporalIntelligence } from "./temporal/temporalIntelligence";
import { SpatialStatistics } from "./spatial/spatialStatistics";
import { PredictiveCrimeModel } from "./predictive/predictiveCrimeModel";

export * from "./models/statisticalTypes";
export * from "./temporal/temporalIntelligence";
export * from "./spatial/spatialStatistics";
export * from "./predictive/predictiveCrimeModel";

export class StatisticalIntelligenceEngineV2 {
  /**
   * Ejecuta el pipeline completo del motor estadístico versión 2.0.
   */
  public static analyze(
    rawRecords: any[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ): SIECoreResult {
    const exclusionLogs: ExclusionLog[] = [];
    const cleanRecords: StandardCrimeRecord[] = [];
    let logCounter = 1;

    for (const r of rawRecords) {
      // 1. Deducir tipo de delito
      const delitoRaw = r.INCIDENTE ?? r.incidente ?? r.delito ?? r.DELITO ?? r.SUBTIPO ?? r.subtipo ?? r.tipo ?? r.TIPO ?? "";
      const delitoClean = String(delitoRaw).trim();
      if (!delitoClean) {
        exclusionLogs.push({ id: logCounter++, motivo: "Sin clasificación de delito o incidente", registro: r });
        continue;
      }

      // 2. Extraer coordenadas geográficas
      const rawLat = r.LAT ?? r.lat ?? r.Lat ?? r.latitude ?? r.Latitude ?? r.Coordenada_Y ?? r.y ?? r.Y;
      const rawLng = r.LONG ?? r.lng ?? r.lng1 ?? r.Long ?? r.LON ?? r.lon ?? r.Lon ?? r.longitude ?? r.Longitude ?? r.Coordenada_X ?? r.x ?? r.X;
      
      const latNum = parseFloat(String(rawLat));
      const lngNum = parseFloat(String(rawLng));

      if (isNaN(latNum) || isNaN(lngNum)) {
        exclusionLogs.push({ id: logCounter++, motivo: "Coordenadas no numéricas o ausentes", registro: r });
        continue;
      }

      // Validar límites de México (Lat: 14-33, Lng: -122 a -86)
      if (latNum < 14 || latNum > 33 || lngNum < -122 || lngNum > -86) {
        exclusionLogs.push({ id: logCounter++, motivo: "Coordenadas fuera de límites nacionales (México)", registro: r });
        continue;
      }

      // 3. Validar y parsear fecha/hora
      const rawFecha = r.FECHA ?? r.fecha ?? r.Fecha ?? r.FECHA_HECHO ?? r.FECHA_OCURRENCIA ?? "";
      const rawHora = r.HORA ?? r.hora ?? r.Hora ?? r.HORA_HECHO ?? r.HORA_OCURRENCIA ?? "00:00";

      const fechaStr = String(rawFecha).split("T")[0].trim();
      const horaStr = String(rawHora).trim();

      const fechaObj = new Date(fechaStr + "T00:00:00");
      if (isNaN(fechaObj.getTime())) {
        exclusionLogs.push({ id: logCounter++, motivo: "Formato de fecha inválido o corrupto", registro: r });
        continue;
      }

      const timeParts = horaStr.split(":");
      let hours = parseInt(timeParts[0] ?? "0", 10);
      let minutes = parseInt(timeParts[1] ?? "0", 10);

      if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
        hours = 0;
        minutes = 0;
      }
      const horaNum = hours + minutes / 60;
      const diaSemana = fechaObj.getDay();

      // 4. Medir distancia al epicentro
      const dist = SpatialStatistics.calculateHaversineDistance(centerLat, centerLng, latNum, lngNum);
      if (dist > radiusMeters) {
        exclusionLogs.push({
          id: logCounter++,
          motivo: `Registro fuera del radio de interés (${Math.round(dist)}m > ${radiusMeters}m)`,
          registro: r
        });
        continue;
      }

      // 5. Normalizar variables criminológicas
      const coloniaRaw = r.COLONIA ?? r.colonia ?? r.Colonia ?? r.NEIGHBORHOOD ?? "SECTOR NO ESPECIFICADO";
      const armaRaw = r.ARMA ?? r.arma ?? r.Arma ?? r.TIPO_ARMA ?? r.ARMAS ?? "NINGUNA";
      const violenciaRaw = r.VIOLENCIA ?? r.violencia ?? r.Violencia ?? r.MODALIDAD ?? "";
      const violencia = /violencia|con_violencia|lesiones|arma/i.test(String(violenciaRaw)) || /fuego|blanca/i.test(String(armaRaw));

      cleanRecords.push({
        id: r.id ?? `crime-${logCounter++}`,
        delito: delitoClean,
        fechaStr,
        horaStr: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        lat: latNum,
        lng: lngNum,
        fechaObj,
        horaNum,
        diaSemana,
        colonia: String(coloniaRaw).trim(),
        arma: String(armaRaw).trim().toUpperCase(),
        violencia,
        distancia_m: dist
      });
    }

    // Ordenar cronológicamente el dataset limpio
    cleanRecords.sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());

    const totalEvents = cleanRecords.length;
    
    // Si no hay registros válidos, devolver estructura por defecto vacía
    if (totalEvents === 0) {
      return this.buildEmptyResult(exclusionLogs, centerLat, centerLng, radiusMeters, rawRecords.length);
    }

    // Ejecutar submódulos analíticos de SIE 2.0 Core
    const temporalAnalysis = TemporalIntelligence.analyze(cleanRecords);
    const spatialAnalysis = SpatialStatistics.analyze(cleanRecords, centerLat, centerLng, radiusMeters);
    const predictiveAnalysis = PredictiveCrimeModel.analyze(cleanRecords, centerLat, centerLng, radiusMeters);

    // Calcular completitud de calidad de datos
    const completenessPercentage = rawRecords.length > 0 
      ? Math.round(((rawRecords.length - exclusionLogs.length) / rawRecords.length) * 100) 
      : 100;

    return {
      metadata: {
        totalEvents,
        centerLat,
        centerLng,
        radiusMeters,
        generatedAt: new Date().toISOString(),
        engineVersion: "2.0-core"
      },
      temporalAnalysis,
      spatialAnalysis,
      predictiveAnalysis,
      qualityMetrics: {
        completenessPercentage,
        excludedRecordsCount: exclusionLogs.length,
        recordsTrawledCount: rawRecords.length
      },
      exclusionLogs
    };
  }

  private static buildEmptyResult(
    exclusionLogs: ExclusionLog[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
    totalRecords: number
  ): SIECoreResult {
    return {
      metadata: {
        totalEvents: 0,
        centerLat,
        centerLng,
        radiusMeters,
        generatedAt: new Date().toISOString(),
        engineVersion: "2.0-core"
      },
      temporalAnalysis: {
        trendSlope: 0,
        trendDirection: "stable",
        trendConfidence: 0,
        seasonalityIndex: 0,
        annualPattern: "Evidencia Insuficiente",
        monthlyVariation: 0,
        seasonalRiskPeriods: [],
        anomalies: [],
        monthlyDistribution: new Array(12).fill(0),
        weeklyDistribution: new Array(7).fill(0),
        hourlyDistribution: new Array(24).fill(0)
      },
      spatialAnalysis: {
        centerOfGravity: { lat: centerLat, lng: centerLng },
        dispersionMeters: 0,
        spatialEntropy: 0,
        spatialEntropyInterpretation: "concentrated",
        clusters: [],
        hotspots: []
      },
      predictiveAnalysis: {
        poissonProbabilityTomorrow: 0,
        poissonProbabilityWeekly: 0,
        poissonExpectedEventsWeekly: 0,
        poissonModelFitScore: 1.0,
        poissonModelValidity: true,
        nearRepeatScore: 0,
        riskZones: []
      },
      qualityMetrics: {
        completenessPercentage: totalRecords > 0 ? 0 : 100,
        excludedRecordsCount: exclusionLogs.length,
        recordsTrawledCount: totalRecords
      },
      exclusionLogs
    };
  }
}
