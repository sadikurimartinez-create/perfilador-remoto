import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";

export interface ResolvedRelationshipResult {
  coincidesWithHotspot: boolean;
  closestAttractorName: string;
  distanceToHotspotMeters: number;
  temporalConcurrence: string[];
  correlatedFactors: string[];
}

export class IntelligenceEvidenceResolver {
  /**
   * Resuelve relaciones puramente factuales entre la incidencia estadística de la SEM
   * y las características físicas del entorno registradas en el terreno.
   * Prohíbe rigurosamente emitir juicios causales directos o recomendaciones de patrullaje.
   */
  public static resolveEvidenceRelationship(context: IntelligenceIntegrationContext): ResolvedRelationshipResult {
    const sem = context.evidenceSources.SEM;
    const tie = context.evidenceSources.TIE;
    const vee = context.evidenceSources.VEE;

    let coincidesWithHotspot = false;
    let closestAttractorName = "Ninguno identificado";
    let distanceToHotspotMeters = 9999;
    const temporalConcurrence: string[] = [];
    const correlatedFactors: string[] = [];

    // 1. Resolver coincidencia con atractores económicos (DENUE)
    if (tie && tie.economicAttractors && tie.economicAttractors.length > 0) {
      // Buscar el atractor más cercano a cualquier hotspot de la SEM
      const hotspots = sem.spatialEvidence?.hotspots || [];
      for (const hs of hotspots) {
        for (const attr of tie.economicAttractors) {
          const dist = attr.distanceToHotspotMeters ?? 9999;
          if (dist < 100) {
            coincidesWithHotspot = true;
          }
          if (dist < distanceToHotspotMeters) {
            distanceToHotspotMeters = dist;
            closestAttractorName = attr.name;
          }
        }
      }
    }

    // 2. Resolver confluencia temporal
    if (sem.temporalEvidence?.criticalPeriods && sem.temporalEvidence.criticalPeriods.length > 0) {
      sem.temporalEvidence.criticalPeriods.forEach(p => temporalConcurrence.push(p));
    }

    // 3. Correlacionar factores físicos sin atribuir causalidad directa (CPTED / Vulnerabilidades)
    if (tie?.environmentalRiskFactors) {
      const risks = tie.environmentalRiskFactors;
      if (risks.lightingScore === "DEFICIENT" || risks.lightingScore === "CRITICAL") {
        correlatedFactors.push("Deficiencia en iluminación pública");
      }
      if (risks.abandonedLotsCount && risks.abandonedLotsCount > 0) {
        correlatedFactors.push(`Predios baldíos abandonados (${risks.abandonedLotsCount})`);
      }
      if (risks.visibilityObstructions && risks.visibilityObstructions.length > 0) {
        risks.visibilityObstructions.forEach(obs => correlatedFactors.push(`Obstrucción de visibilidad: ${obs}`));
      }
    }

    if (vee) {
      if (vee.graffitiEvidence && vee.graffitiEvidence.length >= 2) {
        correlatedFactors.push("Presencia acumulada de grafiti en muros circundantes");
      }
      if (vee.analystPhotos && vee.analystPhotos.length > 0) {
        vee.analystPhotos.forEach(f => {
          if (f.finding && !correlatedFactors.includes(f.finding)) {
            correlatedFactors.push(`Hallazgo visual: ${f.finding}`);
          }
        });
      }
    }

    return {
      coincidesWithHotspot,
      closestAttractorName,
      distanceToHotspotMeters,
      temporalConcurrence,
      correlatedFactors
    };
  }
}
