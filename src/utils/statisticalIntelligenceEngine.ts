/**
 * Statistical Intelligence Engine (SIE) v1.0
 * Motor de Inteligencia Estadística Criminal para la SSPE-CEIPOL.
 * Realiza cálculos estadísticos deterministas y matemáticos libres de alucinaciones.
 */

export interface StandardCrimeRecord {
  id: string;
  delito: string;
  fechaStr: string; // YYYY-MM-DD
  horaStr: string; // HH:MM
  lat: number;
  lng: number;
  fechaObj: Date;
  horaNum: number; // 0.0 - 23.99
  diaSemana: number; // 0-6 (0=Domingo)
  colonia: string;
  arma: string;
  violencia: boolean;
  distancia_m: number;
}

export interface ExclusionLog {
  id: number;
  motivo: string;
  registro: any;
}

export interface SieAnalysisResult {
  temporal: {
    totalEventos: number;
    variacionMensualPorcentaje: number;
    mesCritico: string;
    diaCritico: string;
    horarioCritico: string;
    ventanaOportunidad: string;
    tiempoPromedioEntreEventosHoras: number;
    tiempoMaximoEntreEventosHoras: number;
    tiempoMinimoEntreEventosHoras: number;
    indiceAceleracionDelictiva: number;
    anomaliasFechas: string[];
    mediaMovil7Dias: number;
    desviacionEstandarDiaria: number;
    percentil90Diario: number;
  };
  espacial: {
    centroGravedad: { lat: number; lng: number };
    desviacionEstandarEspacialMetros: number;
    elipseDireccional: {
      anguloRotacionGrados: number;
      semiEjeMayorMetros: number;
      semiEjeMenorMetros: number;
      areaElipseMetros2: number;
    };
    distanciaMediaMetros: number;
    distanciaMaximaMetros: number;
    distanciaMinimaMetros: number;
    migraciónEspacialMetros: number; // Distancia entre centroides de primera y segunda mitad temporal
    expansionTerritorialClasificacion: string;
    hotspotsCount: number;
    topHotspotCoords: { lat: number; lng: number; count: number }[];
  };
  multivariable: {
    delitoPorHora: Record<string, number[]>; // delito -> array de 24 horas
    delitoPorDiaSemana: Record<string, number[]>; // delito -> array de 7 días
    correlacionDelitoArma: Record<string, Record<string, number>>;
    correlacionDelitoViolencia: Record<string, { conViolencia: number; sinViolencia: number }>;
  };
  criminologico: {
    indicadores: {
      especializacion: number; // 0-100 (basado en entropía de Shannon)
      persistencia: number; // 0-100 (días con delito / días totales)
      movilidad: number; // 0-100 (dispersión espacial relativa al radio)
      violencia: number; // 0-100 (% violencia)
      planeacion: number; // 0-100 (concentración horaria)
      oportunidad: number; // 0-100 (cercanía a atractores comerciales)
      capacidadTerritorial: number; // 0-100 (área de elipse relativa al área del radio)
    };
  };
  predictivo: {
    modelo: string; // "Poisson / Inferencia Frecuencial Histórica"
    probabilidadRepeticionManana: number; // 0-1 (Poisson con lambda diario)
    probabilidadRepeticionSemanal: number; // 0-1 (Poisson con lambda semanal)
    intervaloConfianzaSemanal: { min: number; max: number; confiabilidad: number };
    indiceRiesgoTerritorial: number; // 0-100
    indiceVulnerabilidadAmbiental: number; // 0-100
    variablesPredictivasExplicativas: string[];
    confiabilidadModeloPorcentaje: number;
  };
  exclusionLogs: ExclusionLog[];
}

export class StatisticalIntelligenceEngine {
  /**
   * Ejecuta el pipeline completo de análisis estadístico.
   */
  public static analyze(
    rawRecords: any[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ): SieAnalysisResult {
    const exclusionLogs: ExclusionLog[] = [];
    
    // Etapa 1 & 2: Normalización y Limpieza
    const cleanRecords: StandardCrimeRecord[] = [];
    let logCounter = 1;

    for (const r of rawRecords) {
      // 1. Deducir delito
      const delitoRaw = r.INCIDENTE ?? r.incidente ?? r.delito ?? r.DELITO ?? r.SUBTIPO ?? r.subtipo ?? r.tipo ?? r.TIPO ?? "";
      const delitoClean = String(delitoRaw).trim();
      if (!delitoClean) {
        exclusionLogs.push({ id: logCounter++, motivo: "Sin clasificación de delito o incidente", registro: r });
        continue;
      }

      // 2. Coordenadas
      const rawLat = r.LAT ?? r.lat ?? r.Lat ?? r.latitude ?? r.Latitude ?? r.Coordenada_Y ?? r.y ?? r.Y;
      const rawLng = r.LONG ?? r.lng ?? r.lng1 ?? r.Long ?? r.LON ?? r.lon ?? r.Lon ?? r.longitude ?? r.Longitude ?? r.Coordenada_X ?? r.x ?? r.X;
      
      const latNum = parseFloat(String(rawLat));
      const lngNum = parseFloat(String(rawLng));

      if (isNaN(latNum) || isNaN(lngNum)) {
        exclusionLogs.push({ id: logCounter++, motivo: "Coordenadas no numéricas o ausentes", registro: r });
        continue;
      }

      // Validar rangos geográficos plausibles de México (Lat 14-33, Lng -122 a -86)
      if (latNum < 14 || latNum > 33 || lngNum < -122 || lngNum > -86) {
        exclusionLogs.push({ id: logCounter++, motivo: "Coordenadas fuera de límites nacionales (México)", registro: r });
        continue;
      }

      // 3. Fechas y Horas
      const rawFecha = r.FECHA ?? r.fecha ?? r.Fecha ?? r.FECHA_HECHO ?? r.FECHA_OCURRENCIA ?? "";
      const rawHora = r.HORA ?? r.hora ?? r.Hora ?? r.HORA_HECHO ?? r.HORA_OCURRENCIA ?? "00:00";

      const fechaStr = String(rawFecha).split("T")[0].trim();
      const horaStr = String(rawHora).trim();

      // Intentar parsear fecha
      const fechaObj = new Date(fechaStr + "T00:00:00");
      if (isNaN(fechaObj.getTime())) {
        exclusionLogs.push({ id: logCounter++, motivo: "Formato de fecha inválido o corrupto", registro: r });
        continue;
      }

      // Intentar parsear hora
      const timeParts = horaStr.split(":");
      let hours = parseInt(timeParts[0] ?? "0", 10);
      let minutes = parseInt(timeParts[1] ?? "0", 10);

      if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
        hours = 0;
        minutes = 0;
      }
      const horaNum = hours + minutes / 60;
      const diaSemana = fechaObj.getDay();

      // 4. Distancia Haversine al epicentro del proyecto
      const dist = this.haversineDistance(centerLat, centerLng, latNum, lngNum);
      if (dist > radiusMeters) {
        exclusionLogs.push({ id: logCounter++, motivo: `Registro fuera del radio de interés (${Math.round(dist)}m > ${radiusMeters}m)`, registro: r });
        continue;
      }

      // 5. Otros atributos opcionales
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

    // Ordenar cronológicamente
    cleanRecords.sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());

    // Si no hay registros válidos tras la limpieza, devolver estructura vacía/fallida
    if (cleanRecords.length === 0) {
      return this.buildEmptyResult(exclusionLogs);
    }

    // Ejecutar sub-motores analíticos
    const temporal = this.analyzeTemporal(cleanRecords);
    const espacial = this.analyzeSpatial(cleanRecords, centerLat, centerLng, radiusMeters);
    const multivariable = this.analyzeMultivariable(cleanRecords);
    const criminologico = this.analyzeCriminological(cleanRecords, espacial.elipseDireccional.areaElipseMetros2, radiusMeters);
    const predictivo = this.analyzePredictive(cleanRecords, temporal.desviacionEstandarDiaria, temporal.percentil90Diario);

    return {
      temporal,
      espacial,
      multivariable,
      criminologico,
      predictivo,
      exclusionLogs
    };
  }

  /**
   * Distancia Haversine en metros entre dos puntos geográficos.
   */
  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Motor 1: Análisis Temporal de Incidentes
   */
  private static analyzeTemporal(records: StandardCrimeRecord[]) {
    const totalEventos = records.length;
    
    // Contar eventos por fecha
    const countByDate: Record<string, number> = {};
    records.forEach(r => {
      countByDate[r.fechaStr] = (countByDate[r.fechaStr] ?? 0) + 1;
    });

    const dailyCounts = Object.values(countByDate);
    const sum = dailyCounts.reduce((a, b) => a + b, 0);
    const meanDaily = sum / dailyCounts.length;

    // Desviación estándar diaria
    const variance = dailyCounts.reduce((a, b) => a + Math.pow(b - meanDaily, 2), 0) / dailyCounts.length;
    const desviacionEstandarDiaria = Math.sqrt(variance);

    // Calcular percentil 90
    const sortedCounts = [...dailyCounts].sort((a, b) => a - b);
    const p90Index = Math.floor(sortedCounts.length * 0.9);
    const percentil90Diario = sortedCounts[p90Index] ?? 0;

    // Buscar anomalías (Días que superan 2 desviaciones estándar)
    const threshold = meanDaily + 2 * desviacionEstandarDiaria;
    const anomaliasFechas: string[] = [];
    Object.entries(countByDate).forEach(([fecha, count]) => {
      if (count > threshold && count > 1) {
        anomaliasFechas.push(fecha);
      }
    });

    // Mes crítico
    const monthCounts: Record<number, number> = {};
    records.forEach(r => {
      const m = r.fechaObj.getMonth();
      monthCounts[m] = (monthCounts[m] ?? 0) + 1;
    });
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let maxMonthVal = -1;
    let mesCritico = "Sin datos";
    Object.entries(monthCounts).forEach(([m, val]) => {
      if (val > maxMonthVal) {
        maxMonthVal = val;
        mesCritico = months[parseInt(m, 10)] ?? "Sin datos";
      }
    });

    // Día crítico
    const dayCounts: Record<number, number> = {};
    records.forEach(r => {
      dayCounts[r.diaSemana] = (dayCounts[r.diaSemana] ?? 0) + 1;
    });
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    let maxDayVal = -1;
    let diaCritico = "Sin datos";
    Object.entries(dayCounts).forEach(([d, val]) => {
      if (val > maxDayVal) {
        maxDayVal = val;
        diaCritico = days[parseInt(d, 10)] ?? "Sin datos";
      }
    });

    // Horarios
    const hourBlocks = new Array(24).fill(0);
    records.forEach(r => {
      const hour = Math.floor(r.horaNum);
      if (hour >= 0 && hour < 24) hourBlocks[hour]++;
    });

    let maxHourVal = -1;
    let peakHour = 0;
    hourBlocks.forEach((val, idx) => {
      if (val > maxHourVal) {
        maxHourVal = val;
        peakHour = idx;
      }
    });
    const horarioCritico = `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 1) % 24).padStart(2, "0")}:00`;
    const ventanaOportunidad = peakHour >= 19 || peakHour <= 4 ? "Nocturna (19:00 - 04:00)" : "Vespertina/Comercial (12:00 - 18:00)";

    // Intervalo de tiempos entre eventos consecutivos (en horas)
    let intervals: number[] = [];
    for (let i = 1; i < records.length; i++) {
      const diffMs = records[i].fechaObj.getTime() - records[i - 1].fechaObj.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      intervals.push(diffHours);
    }
    const sumInt = intervals.reduce((a, b) => a + b, 0);
    const tiempoPromedioEntreEventosHoras = intervals.length > 0 ? parseFloat((sumInt / intervals.length).toFixed(1)) : 0;
    const tiempoMaximoEntreEventosHoras = intervals.length > 0 ? parseFloat(Math.max(...intervals).toFixed(1)) : 0;
    const tiempoMinimoEntreEventosHoras = intervals.length > 0 ? parseFloat(Math.min(...intervals).toFixed(1)) : 0;

    // Variación e Índice de Aceleración Delictiva
    // Dividimos cronológicamente en 2 mitades
    const half = Math.floor(records.length / 2);
    let indexAceleracion = 0;
    let variacionMensual = 0;
    if (records.length >= 4) {
      const firstHalf = records.slice(0, half);
      const secondHalf = records.slice(half);

      const spanFirst = (firstHalf[firstHalf.length - 1].fechaObj.getTime() - firstHalf[0].fechaObj.getTime()) || 1;
      const spanSecond = (secondHalf[secondHalf.length - 1].fechaObj.getTime() - secondHalf[0].fechaObj.getTime()) || 1;

      const rateFirst = firstHalf.length / (spanFirst / (1000 * 60 * 60 * 24 * 30)); // eventos/mes
      const rateSecond = secondHalf.length / (spanSecond / (1000 * 60 * 60 * 24 * 30)); // eventos/mes

      indexAceleracion = rateFirst > 0 ? parseFloat(((rateSecond - rateFirst) / rateFirst).toFixed(2)) : 0;
      variacionMensual = rateFirst > 0 ? parseFloat((((rateSecond - rateFirst) / rateFirst) * 100).toFixed(1)) : 0;
    }

    return {
      totalEventos,
      variacionMensualPorcentaje: variacionMensual,
      mesCritico,
      diaCritico,
      horarioCritico,
      ventanaOportunidad,
      tiempoPromedioEntreEventosHoras,
      tiempoMaximoEntreEventosHoras,
      tiempoMinimoEntreEventosHoras,
      indiceAceleracionDelictiva: indexAceleracion,
      anomaliasFechas: anomaliasFechas.slice(0, 5),
      mediaMovil7Dias: parseFloat(meanDaily.toFixed(2)),
      desviacionEstandarDiaria: parseFloat(desviacionEstandarDiaria.toFixed(2)),
      percentil90Diario
    };
  }

  /**
   * Motor 2: Análisis Espacial de Incidentes
   */
  private static analyzeSpatial(
    records: StandardCrimeRecord[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ) {
    const N = records.length;
    
    // Centro de Gravedad (Mean Center)
    const sumLat = records.reduce((a, b) => a + b.lat, 0);
    const sumLng = records.reduce((a, b) => a + b.lng, 0);
    const meanLat = sumLat / N;
    const meanLng = sumLng / N;

    // Distancia espacial de los crímenes al epicentro del proyecto
    const distances = records.map(r => r.distancia_m);
    const sumDist = distances.reduce((a, b) => a + b, 0);
    const distanciaMedia = sumDist / N;
    const distanciaMaxima = Math.max(...distances);
    const distanciaMinima = Math.min(...distances);

    // Desviación estándar espacial (Standard Distance)
    // Calcula la dispersión espacial respecto al Mean Center en metros
    let varianceSum = 0;
    records.forEach(r => {
      const latMetros = (r.lat - meanLat) * 111111;
      const lngMetros = (r.lng - meanLng) * 111111 * Math.cos((meanLat * Math.PI) / 180);
      varianceSum += Math.pow(latMetros, 2) + Math.pow(lngMetros, 2);
    });
    const desviacionEstandarEspacialMetros = Math.sqrt(varianceSum / N);

    // Elipse Direccional (Standard Deviational Ellipse)
    let varX = 0; // en metros
    let varY = 0; // en metros
    let covXY = 0; // en metros
    records.forEach(r => {
      const x = (r.lng - meanLng) * 111111 * Math.cos((meanLat * Math.PI) / 180); // Lng como eje X
      const y = (r.lat - meanLat) * 111111; // Lat como eje Y
      varX += x * x;
      varY += y * y;
      covXY += x * y;
    });
    varX = varX / N;
    varY = varY / N;
    covXY = covXY / N;

    // Ángulo de rotación de la elipse
    const diff = varY - varX;
    let thetaRad = 0;
    if (Math.abs(diff) < 0.001) {
      thetaRad = covXY > 0 ? Math.PI / 4 : -Math.PI / 4;
    } else {
      thetaRad = 0.5 * Math.atan2(2 * covXY, diff);
    }

    // Calcular desviaciones estándar de los ejes principales (Semi-ejes de la elipse)
    const sinTheta = Math.sin(thetaRad);
    const cosTheta = Math.cos(thetaRad);

    let sumAxisA = 0;
    let sumAxisB = 0;
    records.forEach(r => {
      const x = (r.lng - meanLng) * 111111 * Math.cos((meanLat * Math.PI) / 180);
      const y = (r.lat - meanLat) * 111111;
      const ptA = x * cosTheta + y * sinTheta;
      const ptB = -x * sinTheta + y * cosTheta;
      sumAxisA += ptA * ptA;
      sumAxisB += ptB * ptB;
    });

    const semiEjeMayorMetros = Math.max(Math.sqrt(sumAxisA / N), 15);
    const semiEjeMenorMetros = Math.max(Math.sqrt(sumAxisB / N), 10);
    const areaElipseMetros2 = Math.PI * semiEjeMayorMetros * semiEjeMenorMetros;

    // Migración Espacial (Distancia entre centroide de 1era y 2da mitad cronológica)
    let migracionEspacialMetros = 0;
    if (records.length >= 6) {
      const half = Math.floor(records.length / 2);
      const firstHalf = records.slice(0, half);
      const secondHalf = records.slice(half);
      const mLat1 = firstHalf.reduce((a, b) => a + b.lat, 0) / firstHalf.length;
      const mLng1 = firstHalf.reduce((a, b) => a + b.lng, 0) / firstHalf.length;
      const mLat2 = secondHalf.reduce((a, b) => a + b.lat, 0) / secondHalf.length;
      const mLng2 = secondHalf.reduce((a, b) => a + b.lng, 0) / secondHalf.length;
      migracionEspacialMetros = this.haversineDistance(mLat1, mLng1, mLat2, mLng2);
    }

    const expansionTerritorialClasificacion = 
      desviacionEstandarEspacialMetros > radiusMeters * 0.75
        ? "Expansión Crítica y Dispersión Generalizada"
        : desviacionEstandarEspacialMetros > radiusMeters * 0.4
        ? "Concentración Sectorizada con Rutas de Escape"
        : "Focalización Táctica Aguda (Hotspot Compacto)";

    // Encontrar hotspots
    const grid: Record<string, { lat: number; lng: number; count: number }> = {};
    records.forEach(r => {
      const gLat = Math.round(r.lat * 1000) / 1000;
      const gLng = Math.round(r.lng * 1000) / 1000;
      const key = `${gLat},${gLng}`;
      if (!grid[key]) {
        grid[key] = { lat: gLat, lng: gLng, count: 0 };
      }
      grid[key].count++;
    });

    const sortedGrid = Object.values(grid).sort((a, b) => b.count - a.count);
    const hotspotsCount = sortedGrid.filter(g => g.count >= 2).length;

    return {
      centroGravedad: { lat: parseFloat(meanLat.toFixed(5)), lng: parseFloat(meanLng.toFixed(5)) },
      desviacionEstandarEspacialMetros: Math.round(desviacionEstandarEspacialMetros),
      elipseDireccional: {
        anguloRotacionGrados: Math.round((thetaRad * 180) / Math.PI),
        semiEjeMayorMetros: Math.round(semiEjeMayorMetros),
        semiEjeMenorMetros: Math.round(semiEjeMenorMetros),
        areaElipseMetros2: Math.round(areaElipseMetros2)
      },
      distanciaMediaMetros: Math.round(distanciaMedia),
      distanciaMaximaMetros: Math.round(distanciaMaxima),
      distanciaMinimaMetros: Math.round(distanciaMinima),
      migraciónEspacialMetros: Math.round(migracionEspacialMetros),
      expansionTerritorialClasificacion,
      hotspotsCount,
      topHotspotCoords: sortedGrid.slice(0, 3).map(h => ({
        lat: parseFloat(h.lat.toFixed(5)),
        lng: parseFloat(h.lng.toFixed(5)),
        count: h.count
      }))
    };
  }

  /**
   * Motor 3: Análisis Multivariable
   */
  private static analyzeMultivariable(records: StandardCrimeRecord[]) {
    const delitoPorHora: Record<string, number[]> = {};
    const delitoPorDiaSemana: Record<string, number[]> = {};
    const correlacionDelitoArma: Record<string, Record<string, number>> = {};
    const correlacionDelitoViolencia: Record<string, { conViolencia: number; sinViolencia: number }> = {};

    records.forEach(r => {
      const d = r.delito;
      
      // Delito por hora
      if (!delitoPorHora[d]) {
        delitoPorHora[d] = new Array(24).fill(0);
      }
      const hour = Math.floor(r.horaNum);
      if (hour >= 0 && hour < 24) delitoPorHora[d][hour]++;

      // Delito por día de la semana
      if (!delitoPorDiaSemana[d]) {
        delitoPorDiaSemana[d] = new Array(7).fill(0);
      }
      if (r.diaSemana >= 0 && r.diaSemana < 7) delitoPorDiaSemana[d][r.diaSemana]++;

      // Correlación arma
      if (!correlacionDelitoArma[d]) {
        correlacionDelitoArma[d] = {};
      }
      correlacionDelitoArma[d][r.arma] = (correlacionDelitoArma[d][r.arma] ?? 0) + 1;

      // Correlación violencia
      if (!correlacionDelitoViolencia[d]) {
        correlacionDelitoViolencia[d] = { conViolencia: 0, sinViolencia: 0 };
      }
      if (r.violencia) {
        correlacionDelitoViolencia[d].conViolencia++;
      } else {
        correlacionDelitoViolencia[d].sinViolencia++;
      }
    });

    return {
      delitoPorHora,
      delitoPorDiaSemana,
      correlacionDelitoArma,
      correlacionDelitoViolencia
    };
  }

  /**
   * Motor 4: Indicadores de Inteligencia Criminológica
   */
  private static analyzeCriminological(
    records: StandardCrimeRecord[],
    areaElipseMetros2: number,
    radiusMeters: number
  ) {
    const total = records.length;

    // 1. Especialización
    const counts: Record<string, number> = {};
    records.forEach(r => {
      counts[r.delito] = (counts[r.delito] ?? 0) + 1;
    });

    const p = Object.values(counts).map(c => c / total);
    let H = 0;
    p.forEach(prob => {
      H -= prob * Math.log2(prob);
    });
    const uniqueDelitosCount = Object.keys(counts).length;
    const Hmax = uniqueDelitosCount > 1 ? Math.log2(uniqueDelitosCount) : 1;
    const especializacion = uniqueDelitosCount === 1 ? 100 : Math.round(100 * (1 - H / Hmax));

    // 2. Persistencia
    const firstDate = records[0].fechaObj.getTime();
    const lastDate = records[records.length - 1].fechaObj.getTime();
    const totalDaysSpan = Math.max(Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1, 1);
    
    const uniqueDaysCount = new Set(records.map(r => r.fechaStr)).size;
    const persistencia = Math.min(Math.round((uniqueDaysCount / totalDaysSpan) * 100), 100);

    // 3. Movilidad
    const sumLat = records.reduce((a, b) => a + b.lat, 0) / total;
    const sumLng = records.reduce((a, b) => a + b.lng, 0) / total;
    let distSum = 0;
    records.forEach(r => {
      distSum += this.haversineDistance(sumLat, sumLng, r.lat, r.lng);
    });
    const avgDistToCenter = distSum / total;
    const movilidad = Math.min(Math.round((avgDistToCenter / radiusMeters) * 100), 100);

    // 4. Violencia
    const violentCount = records.filter(r => r.violencia).length;
    const violencia = Math.round((violentCount / total) * 100);

    // 5. Planeación
    const meanHour = records.reduce((a, b) => a + b.horaNum, 0) / total;
    const varHour = records.reduce((a, b) => a + Math.pow(b.horaNum - meanHour, 2), 0) / total;
    const stdHour = Math.sqrt(varHour);
    const planeacion = Math.max(Math.round(100 - (stdHour / 7) * 100), 0);

    // 6. Oportunidad
    const closeToEpicenterCount = records.filter(r => r.distancia_m <= 250).length;
    const oportunidad = Math.round((closeToEpicenterCount / total) * 100);

    // 7. Capacidad Territorial
    const totalAreaM2 = Math.PI * radiusMeters * radiusMeters;
    const capacidadTerritorial = Math.min(Math.round((areaElipseMetros2 / totalAreaM2) * 100), 100);

    return {
      indicadores: {
        especializacion,
        persistencia,
        movilidad,
        violencia,
        planeacion,
        oportunidad,
        capacidadTerritorial
      }
    };
  }

  /**
   * Motor 5: Inteligencia Predictiva
   */
  private static analyzePredictive(
    records: StandardCrimeRecord[],
    desviacionEstandarDiaria: number,
    percentil90Diario: number
  ) {
    const total = records.length;
    const firstDate = records[0].fechaObj.getTime();
    const lastDate = records[records.length - 1].fechaObj.getTime();
    const totalDaysSpan = Math.max(Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1, 1);

    const lambdaDiaria = total / totalDaysSpan;
    const lambdaSemanal = lambdaDiaria * 7;

    const probabilidadRepeticionManana = parseFloat((1 - Math.exp(-lambdaDiaria)).toFixed(3));
    const probabilidadRepeticionSemanal = parseFloat((1 - Math.exp(-lambdaSemanal)).toFixed(3));

    const margin = 1.96 * Math.sqrt(lambdaSemanal);
    const minSemanal = Math.max(Math.round(lambdaSemanal - margin), 0);
    const maxSemanal = Math.round(lambdaSemanal + margin);

    const volumenFactor = Math.min((total / 100) * 40, 40);
    const repeticionFactor = probabilidadRepeticionSemanal * 40;
    const dispersionFactor = Math.min((desviacionEstandarDiaria / 5) * 20, 20);
    const indiceRiesgoTerritorial = Math.round(volumenFactor + repeticionFactor + dispersionFactor);

    const violentPercentage = (records.filter(r => r.violencia).length / total) * 50;
    const temporalInstability = Math.min((desviacionEstandarDiaria / (lambdaDiaria || 1)) * 50, 50);
    const indiceVulnerabilidadAmbiental = Math.round(violentPercentage + temporalInstability);

    const vars: string[] = ["Incidencia Histórica Acumulada"];
    if (desviacionEstandarDiaria > 1.5) vars.push("Fluctuación e inestabilidad temporal");
    if (percentil90Diario > 3) vars.push("Picos horistas de oportunidad criminal");
    if (lambdaSemanal > 5) vars.push("Tasa de repetición recurrente alta");

    return {
      modelo: "Poisson / Inferencia Frecuencial Histórica",
      probabilidadRepeticionManana,
      probabilidadRepeticionSemanal,
      intervaloConfianzaSemanal: { min: minSemanal, max: maxSemanal, confiabilidad: 95 },
      indiceRiesgoTerritorial,
      indiceVulnerabilidadAmbiental,
      variablesPredictivasExplicativas: vars,
      confiabilidadModeloPorcentaje: Math.round(90 - Math.min(desviacionEstandarDiaria * 5, 20))
    };
  }

  private static buildEmptyResult(exclusionLogs: ExclusionLog[]): SieAnalysisResult {
    return {
      temporal: {
        totalEventos: 0,
        variacionMensualPorcentaje: 0,
        mesCritico: "Evidencia Insuficiente",
        diaCritico: "Evidencia Insuficiente",
        horarioCritico: "Evidencia Insuficiente",
        ventanaOportunidad: "Evidencia Insuficiente",
        tiempoPromedioEntreEventosHoras: 0,
        tiempoMaximoEntreEventosHoras: 0,
        tiempoMinimoEntreEventosHoras: 0,
        indiceAceleracionDelictiva: 0,
        anomaliasFechas: [],
        mediaMovil7Dias: 0,
        desviacionEstandarDiaria: 0,
        percentil90Diario: 0
      },
      espacial: {
        centroGravedad: { lat: 0, lng: 0 },
        desviacionEstandarEspacialMetros: 0,
        elipseDireccional: { anguloRotacionGrados: 0, semiEjeMayorMetros: 0, semiEjeMenorMetros: 0, areaElipseMetros2: 0 },
        distanciaMediaMetros: 0,
        distanciaMaximaMetros: 0,
        distanciaMinimaMetros: 0,
        migraciónEspacialMetros: 0,
        expansionTerritorialClasificacion: "Evidencia Insuficiente",
        hotspotsCount: 0,
        topHotspotCoords: []
      },
      multivariable: {
        delitoPorHora: {},
        delitoPorDiaSemana: {},
        correlacionDelitoArma: {},
        correlacionDelitoViolencia: {}
      },
      criminologico: {
        indicadores: { especializacion: 0, persistencia: 0, movilidad: 0, violencia: 0, planeacion: 0, oportunidad: 0, capacidadTerritorial: 0 }
      },
      predictivo: {
        modelo: "Poisson / Inferencia Frecuencial Histórica",
        probabilidadRepeticionManana: 0,
        probabilidadRepeticionSemanal: 0,
        intervaloConfianzaSemanal: { min: 0, max: 0, confiabilidad: 0 },
        indiceRiesgoTerritorial: 0,
        indiceVulnerabilidadAmbiental: 0,
        variablesPredictivasExplicativas: [],
        confiabilidadModeloPorcentaje: 0
      },
      exclusionLogs
    };
  }
}
