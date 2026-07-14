import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";

export interface EvidenceRelationship {
  coincidesWithHotspot: boolean;
  correlatedFactors: string[];
  confidenceScore: number;
  description: string;
}

export class IntelligenceEvidenceResolver {
  /**
   * Resuelve relaciones analíticas factuales entre los distintos motores del contrato (Ajuste 3).
   * No emite directivas tácticas de patrullaje, solo describe concurrencia de factores y correlaciones.
   */
  public static resolveEvidenceRelationship(
    context: IntelligenceIntegrationContext,
    hotspotId?: string
  ): EvidenceRelationship {
    const sem = context.statisticalEvidence.data;
    const vee = context.visualEvidence.data;
    const tie = context.territorialEvidence.data;

    const correlatedFactors: string[] = [];
    let coincidesWithHotspot = false;
    let confidenceScore = Math.min(
      sem.predictiveEvidence?.confidenceMetrics?.operationalReliability || 100,
      tie.confidence?.operationalConfidence || 100
    );

    // 1. Correlacionar Atractores y Hotspots
    const hasHotspots = sem.spatialEvidence?.hotspots?.length > 0;
    const hasAttractors = tie.economicAttractors?.length > 0;

    if (hasHotspots && hasAttractors) {
      // Verificar si hay algún atractor con proximidad baja al hotspot
      const closeAttractors = tie.economicAttractors.filter(
        a => a.distanceToHotspotMeters !== undefined && a.distanceToHotspotMeters <= 100
      );

      if (closeAttractors.length > 0) {
        coincidesWithHotspot = true;
        closeAttractors.forEach(a => {
          correlatedFactors.push(`Atractor Cercano: ${a.name} (${a.category}) a ${a.distanceToHotspotMeters}m de hotspot`);
        });
      }
    }

    // 2. Correlacionar Factores Ambientales y Alumbrado
    if (tie.environmentalRiskFactors?.lightingScore === "DEFICIENT" || 
        tie.environmentalRiskFactors?.lightingScore === "CRITICAL") {
      correlatedFactors.push(`Vulnerabilidad Física: Alumbrado Público Deficiente o Crítico`);
    }

    if (tie.environmentalRiskFactors?.abandonedLotsCount > 0) {
      correlatedFactors.push(`Vulnerabilidad Física: Presencia de ${tie.environmentalRiskFactors.abandonedLotsCount} lote(s) baldío(s)`);
    }

    // 3. Correlacionar Hallazgos de Grafitis
    if (vee.graffitiEvidence && vee.graffitiEvidence.length > 0) {
      correlatedFactors.push(`Apropiación Espacial: Detección activa de marcas y grafitis territoriales`);
    }

    // Construir descripción objetiva libre de causalidad criminalizante
    let description = "El análisis factual de coincidencia espacial no registra factores concurrentes significativos en la periferia de interés.";

    if (correlatedFactors.length > 0) {
      description = `El análisis espacial correlativo identifica la concurrencia de ${correlatedFactors.length} factores de exposición y facilitadores físicos dentro del entorno analizado, los cuales modifican las condiciones de exposición situacional.`;
    }

    return {
      coincidesWithHotspot,
      correlatedFactors,
      confidenceScore,
      description
    };
  }
}
