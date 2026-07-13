import { StandardCrimeRecord } from "../models/statisticalTypes";
import { SpatialStatistics } from "../spatial/spatialStatistics";

export class PredictiveCrimeModel {
  /**
   * Ejecuta el análisis predictivo y probabilístico (CPM).
   */
  public static analyze(
    records: StandardCrimeRecord[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ) {
    if (records.length === 0) {
      return this.buildEmptyAnalysis();
    }

    // Ordenar cronológicamente
    const sorted = [...records].sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());
    const minDate = sorted[0].fechaObj.getTime();
    const maxDate = sorted[sorted.length - 1].fechaObj.getTime();
    const totalDaysSpan = Math.max(Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1, 1);

    // 1. Modelo de Poisson
    const lambdaDiaria = sorted.length / totalDaysSpan;
    const lambdaSemanal = lambdaDiaria * 7;

    const poissonProbabilityTomorrow = parseFloat((1 - Math.exp(-lambdaDiaria)).toFixed(3));
    const poissonProbabilityWeekly = parseFloat((1 - Math.exp(-lambdaSemanal)).toFixed(3));
    const poissonExpectedEventsWeekly = parseFloat(lambdaSemanal.toFixed(2));

    // 2. Near-Repeat Analysis (Ventana: 14 días, Radio: 500m)
    const nearRepeatResult = this.calculateNearRepeatRisk(sorted, 500, 14);

    // 3. Bondad de Ajuste Chi-Cuadrada de la distribución de Poisson
    const fitResult = this.calculateChiSquareFit(sorted, totalDaysSpan, lambdaDiaria);

    // Calcular confiabilidad del modelo predictivo ajustada
    // Se penaliza por la variabilidad diaria y el ajuste estadístico (p-value bajo)
    let confidenceLevel = 90;
    if (!fitResult.modelValidity) {
      confidenceLevel -= 25; // Penalizar si no se ajusta a Poisson
    }
    confidenceLevel -= Math.min(Math.round(nearRepeatResult.nearRepeatScore * 0.15), 15);
    confidenceLevel = Math.max(confidenceLevel, 30);

    // 4. Identificar zonas de riesgo predictivas basadas en hotspots espaciales
    const spatialResult = SpatialStatistics.analyze(sorted, centerLat, centerLng, radiusMeters);
    const riskZones = spatialResult.hotspots.map(h => {
      let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" = "MEDIUM";
      if (h.events >= 10 || h.densityScore > 15) {
        riskLevel = "CRITICAL";
      } else if (h.events >= 4 || h.densityScore > 5) {
        riskLevel = "HIGH";
      }

      return {
        lat: h.center.lat,
        lng: h.center.lng,
        radiusMeters: 250,
        riskLevel
      };
    });

    return {
      poissonProbabilityTomorrow,
      poissonProbabilityWeekly,
      poissonExpectedEventsWeekly,
      poissonModelFitScore: fitResult.pValue,
      poissonModelValidity: fitResult.modelValidity,
      nearRepeatScore: nearRepeatResult.nearRepeatScore,
      riskZones
    };
  }

  /**
   * Calcula el contagio espacio-temporal de Near-Repeat en el cuadrante.
   */
  private static calculateNearRepeatRisk(
    records: StandardCrimeRecord[],
    radiusMeters: number,
    timeWindowDays: number
  ) {
    const N = records.length;
    if (N < 2) {
      return { nearRepeatScore: 0, riskZones: [] };
    }

    let nearRepeatPairs = 0;
    const maxTimeDiffMs = timeWindowDays * 24 * 60 * 60 * 1000;

    for (let i = 0; i < N; i++) {
      const p1 = records[i];
      for (let j = i + 1; j < N; j++) {
        const p2 = records[j];
        
        // Diferencia de tiempo
        const timeDiff = p2.fechaObj.getTime() - p1.fechaObj.getTime();
        if (timeDiff <= maxTimeDiffMs) {
          // Diferencia espacial (Haversine)
          const spaceDiff = SpatialStatistics.calculateHaversineDistance(
            p1.lat, p1.lng, p2.lat, p2.lng
          );
          
          if (spaceDiff <= radiusMeters) {
            nearRepeatPairs++;
          }
        }
      }
    }

    // Normalizar score 0 - 100
    // Un score del 100% significa que cada delito está acoplado con al menos un evento en la ventana
    const rawRatio = nearRepeatPairs / N;
    const nearRepeatScore = Math.min(Math.round(rawRatio * 20), 100);

    return {
      nearRepeatScore,
      nearRepeatPairs
    };
  }

  /**
   * Valida la bondad de ajuste de la distribución de Poisson con Chi-Cuadrada.
   */
  private static calculateChiSquareFit(
    records: StandardCrimeRecord[],
    totalDaysSpan: number,
    lambdaDiaria: number
  ) {
    // Si hay muy pocos días o delitos, no podemos validar
    if (totalDaysSpan < 5 || records.length < 3) {
      return { chiSquare: 0, pValue: 1.0, modelValidity: true };
    }

    // Contar crímenes por día
    const countsByDayStr: Record<string, number> = {};
    records.forEach(r => {
      countsByDayStr[r.fechaStr] = (countsByDayStr[r.fechaStr] ?? 0) + 1;
    });

    const dailyCounts = Object.values(countsByDayStr);
    const zeroDaysCount = totalDaysSpan - dailyCounts.length;
    const allCounts = [...dailyCounts, ...new Array(zeroDaysCount).fill(0)];

    // Agrupar frecuencias observadas (0 crímenes, 1 crimen, 2 crímenes, 3+ crímenes)
    const observedFrequencies = [0, 0, 0, 0]; // index 0, 1, 2, 3+
    allCounts.forEach(c => {
      if (c >= 3) {
        observedFrequencies[3]++;
      } else {
        observedFrequencies[c]++;
      }
    });

    // Calcular frecuencias esperadas bajo Poisson
    const expectedFrequencies = [0, 0, 0, 0];
    const totalDays = allCounts.length;

    // P(k) = (lambda^k * e^-lambda) / k!
    const p0 = Math.exp(-lambdaDiaria);
    const p1 = lambdaDiaria * p0;
    const p2 = (Math.pow(lambdaDiaria, 2) * p0) / 2;
    const p3plus = 1 - (p0 + p1 + p2);

    expectedFrequencies[0] = p0 * totalDays;
    expectedFrequencies[1] = p1 * totalDays;
    expectedFrequencies[2] = p2 * totalDays;
    expectedFrequencies[3] = p3plus * totalDays;

    // Calcular estadístico Chi-Cuadrada
    let chiSquare = 0;
    for (let i = 0; i < 4; i++) {
      const obs = observedFrequencies[i];
      const exp = Math.max(expectedFrequencies[i], 0.1); // Evitar división por 0
      chiSquare += Math.pow(obs - exp, 2) / exp;
    }

    // Grados de libertad: K - 1 - 1 (1 por estimar lambda) = 2
    const df = 2;
    const pValue = this.approximateChiSquarePValue(chiSquare, df);

    // Si p-value < 0.05, rechazamos la hipótesis de que se ajusta a una distribución de Poisson
    const modelValidity = pValue >= 0.05;

    return {
      chiSquare: parseFloat(chiSquare.toFixed(3)),
      pValue,
      modelValidity
    };
  }

  /**
   * Aproximación numérica del p-value de la distribución Chi-Cuadrada usando Wilson-Hilferty.
   */
  private static approximateChiSquarePValue(x: number, df: number): number {
    if (x <= 0) return 1.0;
    
    // Transformación de Wilson-Hilferty a distribución normal estándar
    const term1 = x / df;
    const term2 = 2 / (9 * df);
    const z = (Math.pow(term1, 1 / 3) - (1 - term2)) / Math.sqrt(term2);
    
    // Aproximación del CDF normal estándar (1 - CDF para cola superior)
    return parseFloat((1 - this.normalCDF(z)).toFixed(4));
  }

  private static normalCDF(z: number): number {
    // Constantes de aproximación de Abramowitz y Stegun
    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;

    const t = 1.0 / (1.0 + p * Math.abs(z));
    const exponential = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const cdf = 1.0 - exponential * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));
    
    return z >= 0 ? cdf : 1.0 - cdf;
  }

  private static buildEmptyAnalysis() {
    return {
      poissonProbabilityTomorrow: 0,
      poissonProbabilityWeekly: 0,
      poissonExpectedEventsWeekly: 0,
      poissonModelFitScore: 1.0,
      poissonModelValidity: true,
      nearRepeatScore: 0,
      riskZones: []
    };
  }
}
