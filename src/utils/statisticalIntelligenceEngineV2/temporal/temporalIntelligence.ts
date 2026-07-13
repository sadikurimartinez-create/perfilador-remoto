import { StandardCrimeRecord } from "../models/statisticalTypes";

export class TemporalIntelligence {
  /**
   * Ejecuta el análisis temporal avanzado (TIM) sobre los incidentes históricos.
   */
  public static analyze(records: StandardCrimeRecord[]) {
    if (records.length === 0) {
      return this.buildEmptyAnalysis();
    }

    // Ordenar cronológicamente
    const sortedRecords = [...records].sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());
    
    // 1. Obtener serie de tiempo diaria completa (incluyendo días con 0 incidentes)
    const minDate = sortedRecords[0].fechaObj;
    const maxDate = sortedRecords[sortedRecords.length - 1].fechaObj;
    
    const totalDaysSpan = Math.max(
      Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      1
    );

    const countsByDateStr: Record<string, number> = {};
    sortedRecords.forEach(r => {
      countsByDateStr[r.fechaStr] = (countsByDateStr[r.fechaStr] ?? 0) + 1;
    });

    const dailyTimeline: { dateStr: string; dateObj: Date; count: number }[] = [];
    const tempDate = new Date(minDate);
    for (let i = 0; i < totalDaysSpan; i++) {
      const year = tempDate.getFullYear();
      const month = String(tempDate.getMonth() + 1).padStart(2, "0");
      const day = String(tempDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      
      dailyTimeline.push({
        dateStr,
        dateObj: new Date(tempDate),
        count: countsByDateStr[dateStr] ?? 0
      });
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // 2. Estimador de Theil-Sen
    const trend = this.calculateTheilSen(dailyTimeline);

    // 3. Distribuciones y Estacionalidad
    const monthlyDistribution = new Array(12).fill(0);
    const weeklyDistribution = new Array(7).fill(0);
    const hourlyDistribution = new Array(24).fill(0);

    sortedRecords.forEach(r => {
      const m = r.fechaObj.getMonth();
      if (m >= 0 && m < 12) monthlyDistribution[m]++;

      const d = r.diaSemana;
      if (d >= 0 && d < 7) weeklyDistribution[d]++;

      const h = Math.floor(r.horaNum);
      if (h >= 0 && h < 24) hourlyDistribution[h]++;
    });

    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const maxMonthIndex = monthlyDistribution.indexOf(Math.max(...monthlyDistribution));
    const annualPattern = monthlyDistribution.reduce((a, b) => a + b, 0) > 0 ? months[maxMonthIndex] : "Sin datos";

    // Variabilidad mensual (Coeficiente de variación)
    const monthlyMean = monthlyDistribution.reduce((a, b) => a + b, 0) / 12;
    const monthlyVariance = monthlyDistribution.reduce((sum, count) => sum + Math.pow(count - monthlyMean, 2), 0) / 12;
    const monthlyStdDev = Math.sqrt(monthlyVariance);
    const monthlyVariation = monthlyMean > 0 ? parseFloat((monthlyStdDev / monthlyMean).toFixed(3)) : 0;

    // Estacionalidad semanal (Coeficiente de variación)
    const weeklyMean = weeklyDistribution.reduce((a, b) => a + b, 0) / 7;
    const weeklyVariance = weeklyDistribution.reduce((sum, count) => sum + Math.pow(count - weeklyMean, 2), 0) / 7;
    const weeklyStdDev = Math.sqrt(weeklyVariance);
    const seasonalityIndex = weeklyMean > 0 ? parseFloat((weeklyStdDev / weeklyMean).toFixed(3)) : 0;

    // Períodos críticos de riesgo semanal/horario
    const daysName = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const sortedDays = daysName
      .map((name, idx) => ({ name, count: weeklyDistribution[idx] }))
      .sort((a, b) => b.count - a.count);
    
    const sortedHours = Array.from({ length: 24 })
      .map((_, idx) => ({ hour: idx, count: hourlyDistribution[idx] }))
      .sort((a, b) => b.count - a.count);

    const seasonalRiskPeriods: string[] = [];
    if (sortedDays[0].count > 0) {
      seasonalRiskPeriods.push(`Día Crítico: ${sortedDays[0].name}`);
    }
    if (sortedHours[0].count > 0) {
      const p1 = sortedHours[0].hour;
      seasonalRiskPeriods.push(`Horario Crítico: ${String(p1).padStart(2, "0")}:00 - ${String((p1 + 1) % 24).padStart(2, "0")}:00`);
    }

    // 4. Detección de Anomalías (TIM)
    const anomalies = this.detectTemporalAnomalies(dailyTimeline);

    return {
      trendSlope: trend.trendSlope,
      trendDirection: trend.trendDirection,
      trendConfidence: trend.confidence,
      seasonalityIndex,
      annualPattern,
      monthlyVariation,
      seasonalRiskPeriods,
      anomalies,
      monthlyDistribution,
      weeklyDistribution,
      hourlyDistribution
    };
  }

  /**
   * Calcula la regresión robusta de Theil-Sen.
   */
  private static calculateTheilSen(timeline: { dateStr: string; dateObj: Date; count: number }[]) {
    const n = timeline.length;
    if (n < 2) {
      return { trendSlope: 0, trendDirection: "stable" as const, confidence: 0 };
    }

    const slopes: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = j - i;
        const dy = timeline[j].count - timeline[i].count;
        slopes.push(dy / dx);
      }
    }

    slopes.sort((a, b) => a - b);
    const medianSlope = this.getMedian(slopes);

    // Calcular Kendall's Tau para evaluar confianza
    let concordant = 0;
    let discordant = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dy = timeline[j].count - timeline[i].count;
        if (dy > 0) concordant++;
        else if (dy < 0) discordant++;
      }
    }
    const totalPairs = (n * (n - 1)) / 2;
    const tau = totalPairs > 0 ? (concordant - discordant) / totalPairs : 0;
    const confidence = parseFloat((Math.abs(tau) * 100).toFixed(1));

    let trendDirection: "increase" | "decrease" | "stable" = "stable";
    if (medianSlope > 0.001) {
      trendDirection = "increase";
    } else if (medianSlope < -0.001) {
      trendDirection = "decrease";
    }

    return {
      trendSlope: parseFloat(medianSlope.toFixed(4)),
      trendDirection,
      confidence
    };
  }

  /**
   * Detección de Anomalías basado en Z-Score de la distribución de frecuencias diarias.
   */
  private static detectTemporalAnomalies(timeline: { dateStr: string; dateObj: Date; count: number }[]) {
    const counts = timeline.map(t => t.count);
    const sum = counts.reduce((a, b) => a + b, 0);
    const mean = sum / (counts.length || 1);
    
    const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (counts.length || 1);
    const stdDev = Math.sqrt(variance);

    const anomalies: { date: string; count: number; deviation: number; severity: "HIGH" | "MEDIUM" | "LOW" }[] = [];
    
    // Si la desviación es 0, no tiene sentido calcular anomalías
    if (stdDev === 0) return [];

    timeline.forEach(day => {
      const zScore = (day.count - mean) / stdDev;
      if (zScore > 2.0 && day.count > 1) {
        let severity: "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (zScore > 3.5) {
          severity = "HIGH";
        } else if (zScore > 2.0) {
          severity = "MEDIUM";
        }

        anomalies.push({
          date: day.dateStr,
          count: day.count,
          deviation: parseFloat(zScore.toFixed(2)),
          severity
        });
      }
    });

    // Ordenar por severidad de mayor a menor y limitar a las 8 principales
    return anomalies
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 8);
  }

  private static getMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 !== 0) {
      return arr[mid];
    }
    return (arr[mid - 1] + arr[mid]) / 2;
  }

  private static buildEmptyAnalysis() {
    return {
      trendSlope: 0,
      trendDirection: "stable" as const,
      trendConfidence: 0,
      seasonalityIndex: 0,
      annualPattern: "Evidencia Insuficiente",
      monthlyVariation: 0,
      seasonalRiskPeriods: [],
      anomalies: [],
      monthlyDistribution: new Array(12).fill(0),
      weeklyDistribution: new Array(7).fill(0),
      hourlyDistribution: new Array(24).fill(0)
    };
  }
}
