import { 
  EvidenceNature, 
  EvidenceValidationState, 
  EvidenceReliability, 
  EvidenceType 
} from "./evidenceGovernanceEngine";

export class EvidenceReliabilityEngine {
  /**
   * Calcula el peso evidencial ponderado (0 a 100) de un objeto de evidencia.
   */
  public static calculateWeight(
    nature: EvidenceNature,
    validation: EvidenceValidationState,
    type: EvidenceType,
    ageDays: number = 0
  ): number {
    let baseWeight = 50;

    // 1. Ponderación por Naturaleza Epistemológica
    switch (nature) {
      case "OBSERVACIONAL":
        baseWeight = 90; // Observación directa (foto, medición física)
        break;
      case "ESTADISTICA":
        baseWeight = 85; // Datos estructurados agregados de fuentes oficiales
        break;
      case "DOCUMENTAL":
        baseWeight = 60; // Informes de prensa, expedientes, etc.
        break;
      case "DERIVADA":
        baseWeight = 30; // Resultados generados por modelos o deducción automática
        break;
    }

    // Ajustes por tipo específico si es necesario
    if (type === "STREET_VIEW" && nature === "OBSERVACIONAL") {
      baseWeight -= 5; // Pequeño ajuste por no ser tomada in-situ en tiempo real
    }

    // 2. Penalización o Bonificación por Estado de Validación
    switch (validation) {
      case "VALIDADA":
        baseWeight += 10;
        break;
      case "OBSERVADA":
        baseWeight -= 25;
        break;
      case "DESCARTADA":
        baseWeight = 0;
        break;
      case "REGISTRADA":
      default:
        // Se mantiene neutral
        break;
    }

    // 3. Penalización por antigüedad (atenuación temporal)
    if (ageDays > 365) {
      baseWeight -= 20;
    } else if (ageDays > 180) {
      baseWeight -= 10;
    } else if (ageDays > 90) {
      baseWeight -= 5;
    }

    // Acotar entre 0 y 100
    return Math.max(0, Math.min(100, baseWeight));
  }

  /**
   * Determina la confiabilidad categórica ("ALTA", "MEDIA", "BAJA") según el peso y estado.
   */
  public static determineReliability(
    weight: number,
    validation: EvidenceValidationState
  ): EvidenceReliability {
    if (validation === "DESCARTADA") return "BAJA";
    if (validation === "OBSERVADA") return "BAJA";

    if (weight >= 75) {
      return "ALTA";
    } else if (weight >= 45) {
      return "MEDIA";
    } else {
      return "BAJA";
    }
  }
}
