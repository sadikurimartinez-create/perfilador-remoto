import { SIECoreResult } from "../statisticalIntelligenceEngineV2/models/statisticalTypes";
import { StatisticalEvidenceMatrix, VariableTrace } from "./models/statisticalEvidenceTypes";

export class StatisticalEvidenceBuilder {
  /**
   * Construye la Statistical Evidence Matrix (SEM) a partir de los resultados crudos del SIE 2.0.
   */
  public static build(
    projectId: string,
    rawIncidents: any[],
    sieResult: SIECoreResult,
    analysisDate: string = new Date().toISOString()
  ): StatisticalEvidenceMatrix {
    const totalEvents = sieResult.metadata.totalEvents;
    const centerLat = sieResult.metadata.centerLat;
    const centerLng = sieResult.metadata.centerLng;
    const radius = sieResult.metadata.radiusMeters;

    // 1. Obtener y agrupar delitos válidos dentro del radio para la evidencia criminal
    const validIncidents = rawIncidents.filter(inc => {
      const lat = parseFloat(inc.lat ?? inc.LATITUD);
      const lng = parseFloat(inc.lng ?? inc.LONGITUD);
      if (isNaN(lat) || !isFinite(lat) || isNaN(lng) || !isFinite(lng)) {
        return false;
      }
      const dist = this.calculateHaversineDistance(centerLat, centerLng, lat, lng);
      return dist <= radius;
    });

    const crimeCounts: Record<string, number> = {};
    validIncidents.forEach(inc => {
      const type = (inc.delito ?? inc.INCIDENTE ?? inc.INCIDENCIA ?? "OTROS").toUpperCase().trim();
      crimeCounts[type] = (crimeCounts[type] ?? 0) + 1;
    });

    const crimeTypes = Object.entries(crimeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const dominantCrime = crimeTypes.length > 0 ? crimeTypes[0].type : "NINGUNO";
    const dominantCount = crimeTypes.length > 0 ? crimeTypes[0].count : 0;
    const concentrationScore = totalEvents > 0 ? parseFloat((dominantCount / totalEvents).toFixed(4)) : 0;

    // 2. Determinar patrón espacial descriptivo
    let spatialPattern = "DISPERSO";
    if (sieResult.spatialAnalysis.clusters.length > 0) {
      if (sieResult.spatialAnalysis.spatialEntropy < 0.4) {
        spatialPattern = "CONCENTRACIÓN ESPACIAL CRÍTICA (HIPER-HOTSPOTS)";
      } else if (sieResult.spatialAnalysis.spatialEntropy < 0.7) {
        spatialPattern = "AGRUPACIÓN ESPACIAL MODERADA";
      } else {
        spatialPattern = "DISPERSIÓN SEMI-UNIFORME EN CLÚSTERES";
      }
    } else if (totalEvents > 0) {
      spatialPattern = "DISPERSIÓN TOTAL SIN CLÚSTERES DEFINIDOS";
    }

    // 3. Calcular limitaciones analíticas (Transversales a nivel raíz)
    const limitations: { type: "SPATIAL" | "TEMPORAL" | "PREDICTIVE" | "QUALITY"; description: string; severity: "HIGH" | "MEDIUM" | "LOW" }[] = [];
    
    if (totalEvents < 15) {
      limitations.push({
        type: "TEMPORAL",
        description: "Volumen delictivo muy bajo para un análisis de tendencias robusto. La representatividad puede verse mermada.",
        severity: "HIGH"
      });
    } else if (totalEvents < 50) {
      limitations.push({
        type: "TEMPORAL",
        description: "Cantidad moderada de eventos. Los intervalos de confianza pueden ser amplios en análisis temporal.",
        severity: "MEDIUM"
      });
    }

    if (sieResult.spatialAnalysis.clusters.length === 0 && totalEvents > 0) {
      limitations.push({
        type: "SPATIAL",
        description: "No se identificaron agrupaciones de densidad significativa (DBSCAN). El delito se presenta disperso en el territorio.",
        severity: "LOW"
      });
    }

    if (!sieResult.predictiveAnalysis.poissonModelValidity) {
      limitations.push({
        type: "PREDICTIVE",
        description: "El modelo predictivo de Poisson muestra un bajo ajuste estadístico (p-value < 0.05). La distribución de eventos diarios es irregular y no se explica completamente por Poisson.",
        severity: "HIGH"
      });
    }

    if (sieResult.qualityMetrics.completenessPercentage < 90) {
      limitations.push({
        type: "QUALITY",
        description: `Baja completitud de datos críticos (${sieResult.qualityMetrics.completenessPercentage}%). Posible sesgo o falta de precisión por vacíos informativos.`,
        severity: "MEDIUM"
      });
    }

    // 4. Calcular confianza operacional (Métrica de utilidad táctica - Ajuste 2)
    // Fórmula ponderada:
    // - Tamaño de muestra (hasta 40 pts): 40 * min(1, totalEvents / 100)
    // - Cohesión espacial de clústeres (hasta 30 pts): 30 * (puntos en clústeres / totalEvents)
    // - Completitud de calidad de datos (hasta 30 pts): 30 * (completeness / 100)
    const sampleWeight = 40 * Math.min(1, totalEvents / 100);
    const pointsInClusters = sieResult.spatialAnalysis.clusters.reduce((sum, c) => sum + c.pointsCount, 0);
    const clusterWeight = totalEvents > 0 ? 30 * (pointsInClusters / totalEvents) : 0;
    const qualityWeight = 30 * (sieResult.qualityMetrics.completenessPercentage / 100);
    const operationalReliability = Math.round(sampleWeight + clusterWeight + qualityWeight);

    // 5. Configurar trazabilidad de variables individuales (Ajuste 1)
    const variableTraceability = {
      totalEvents: this.createVariableTrace("SIE-METADATA", "2.0", analysisDate),
      hotspots: this.createVariableTrace("SIE-SSM-DBSCAN", "2.0", analysisDate),
      poissonRisk: this.createVariableTrace("SIE-CPM-POISSON", "2.0", analysisDate),
      trend: this.createVariableTrace("SIE-TIM-THEIL-SEN", "2.0", analysisDate)
    };

    // 6. Configurar banderas de disponibilidad para consumo HIE/CIE (Ajuste 6)
    const availableForHIE = totalEvents >= 5; // Requerir mínimo 5 eventos para validez de hipótesis
    const availableForCIE = sieResult.spatialAnalysis.hotspots.length > 0; // Disponible para mapas si hay hotspots

    // 7. Encontrar fechas extremas de cobertura temporal para consistencia
    const sortedDates = validIncidents
      .map(inc => inc.fecha ?? inc.FECHA)
      .filter(Boolean)
      .sort();
    
    const startDate = sortedDates.length > 0 ? sortedDates[0] : "SIN_FECHA";
    const endDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : "SIN_FECHA";

    return {
      metadata: {
        projectId,
        analysisDate,
        sieVersion: sieResult.metadata.engineVersion,
        semVersion: "1.0", // Versión propia del componente (Ajuste 4)
        totalCanonicalIncidents: totalEvents,
        analysisRadiusMeters: radius
      },
      
      criminalEvidence: {
        totalEvents,
        crimeTypes,
        dominantCrime,
        concentrationScore
      },
      
      temporalEvidence: {
        trendDirection: sieResult.temporalAnalysis.trendDirection,
        trendSlope: sieResult.temporalAnalysis.trendSlope,
        seasonalityIndex: sieResult.temporalAnalysis.seasonalityIndex,
        criticalPeriods: sieResult.temporalAnalysis.seasonalRiskPeriods,
        anomalies: sieResult.temporalAnalysis.anomalies.map(an => ({
          date: an.date,
          count: an.count,
          deviation: an.deviation,
          severity: an.severity
        })),
        temporalCoverage: {
          startDate,
          endDate
        }
      },
      
      spatialEvidence: {
        hotspots: sieResult.spatialAnalysis.hotspots,
        clusterCount: sieResult.spatialAnalysis.clusters.length,
        centerOfGravity: sieResult.spatialAnalysis.centerOfGravity,
        dispersionMeters: sieResult.spatialAnalysis.dispersionMeters,
        entropy: sieResult.spatialAnalysis.spatialEntropy,
        spatialPattern
      },
      
      predictiveEvidence: {
        poissonProbability: sieResult.predictiveAnalysis.poissonProbabilityWeekly,
        nearRepeatRisk: sieResult.predictiveAnalysis.nearRepeatScore,
        modelFit: sieResult.predictiveAnalysis.poissonModelValidity,
        confidenceMetrics: {
          statisticalConfidence: sieResult.temporalAnalysis.trendConfidence,
          operationalReliability
        }
      },
      
      qualityEvidence: {
        dataCompleteness: sieResult.qualityMetrics.completenessPercentage,
        statisticalValidity: sieResult.predictiveAnalysis.poissonModelValidity && sieResult.qualityMetrics.completenessPercentage >= 80,
        warnings: [],
        validationStatus: "VALIDATED"
      },
      
      limitations,
      variableTraceability,
      
      intelligenceReadiness: {
        availableForHIE,
        availableForCIE,
        availableForReport: totalEvents > 0
      },
      
      traceability: {
        source: "historicalIncidents",
        sieVersion: sieResult.metadata.engineVersion,
        semVersion: "1.0",
        methodsUsed: ["Theil-Sen", "DBSCAN", "Poisson", "Near Repeat", "Shannon Entropy", "Z-Score"],
        generatedAt: analysisDate
      }
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

  private static createVariableTrace(source: string, version: string, timestamp: string): VariableTrace {
    return {
      source,
      engine: "Statistical Intelligence Engine",
      version,
      timestamp
    };
  }
}
