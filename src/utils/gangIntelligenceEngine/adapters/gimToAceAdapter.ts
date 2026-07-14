import { GangEvidenceMatrix } from "../models/gangIntelligenceTypes";

/**
 * ACEGimPayload - Contrato de datos seguro para auditoría institucional.
 * Alimenta al Analytical Consistency Engine (ACE) sin proveer lógicas forenses o narrativas crudas.
 */
export interface ACEGimPayload {
  confidenceScore: number;
  limitationsCount: number;
  hasTraceability: boolean;
  contradictoryEvidenceCount: number;
  evidenceCount: {
    graffiti: number;
    osintEvents: number;
  };
  evidenceDescriptions: string[];
  analyticalObservations: string[];
}

export class GimToAceAdapter {
  /**
   * Adapta una GangEvidenceMatrix (GEM) a un ACEGimPayload seguro enfocado en gobernanza,
   * excluyendo conclusiones forenses o de culpabilidad directa de acuerdo con la Regla ACE-GIM-002.
   */
  public static bridge(gem: GangEvidenceMatrix | null | undefined): ACEGimPayload | null {
    if (!gem) return null;

    // Convertir la confianza cualitativa de GIM en un score numérico para ACE
    let confidenceScore = 0;
    const confidenceLevel = gem.presenceEvidence?.confidence || "NONE";
    switch (confidenceLevel) {
      case "HIGH":
        confidenceScore = 90;
        break;
      case "MEDIUM":
        confidenceScore = 70;
        break;
      case "LOW":
        confidenceScore = 40;
        break;
      default:
        confidenceScore = 0;
        break;
    }

    // Evaluar la cantidad de limitaciones de forma segura
    let limitationsCount = 0;
    if (gem.presenceEvidence?.remarks && gem.presenceEvidence.remarks.trim().length > 0) {
      limitationsCount = 1;
    }

    // Extraer descripciones factuales de evidencia de grafitis y OSINT
    const evidenceDescriptions: string[] = [];
    if (gem.graffitiEvidence) {
      gem.graffitiEvidence.forEach(g => {
        evidenceDescriptions.push(`Grafiti con simbología asociada: ${g.symbologyMatch}`);
      });
    }
    if (gem.osintEvidence?.events) {
      gem.osintEvidence.events.forEach(e => {
        evidenceDescriptions.push(`Reporte OSINT de tipo ${e.eventType} registrado en coordenadas del polígono`);
      });
    }

    // Extraer observaciones analíticas estructuradas sin emitir juicios penales directos
    const analyticalObservations: string[] = [];
    if (gem.territorialInfluence) {
      gem.territorialInfluence.forEach(t => {
        analyticalObservations.push(`Influencia de tipo ${t.influenceType || "PASSIVE"} con nivel de actividad ${t.activityLevel || "UNKNOWN"}`);
      });
    }

    const hasTraceability = Array.isArray(gem.traceabilityLog) && gem.traceabilityLog.length > 0;

    return {
      confidenceScore,
      limitationsCount,
      hasTraceability,
      contradictoryEvidenceCount: 0, // Reservado para correlaciones cruzadas avanzadas
      evidenceCount: {
        graffiti: gem.graffitiEvidence?.length || 0,
        osintEvents: gem.osintEvidence?.eventsFound || gem.osintEvidence?.events?.length || 0
      },
      evidenceDescriptions,
      analyticalObservations
    };
  }
}
