export { StatisticalEvidenceBuilder } from "./statisticalEvidenceBuilder";
export { StatisticalEvidenceValidator } from "./statisticalEvidenceValidator";
export * from "./models/statisticalEvidenceTypes";

import { SIECoreResult } from "../statisticalIntelligenceEngineV2/models/statisticalTypes";
import { StatisticalEvidenceMatrix } from "./models/statisticalEvidenceTypes";
import { StatisticalEvidenceBuilder } from "./statisticalEvidenceBuilder";
import { StatisticalEvidenceValidator } from "./statisticalEvidenceValidator";

export class StatisticalEvidenceMatrixManager {
  /**
   * Genera y valida un objeto StatisticalEvidenceMatrix de forma integrada.
   */
  public static process(
    projectId: string,
    rawIncidents: any[],
    sieResult: SIECoreResult,
    analysisDate?: string
  ): {
    sem: StatisticalEvidenceMatrix;
    validationStatus: "VALIDATED" | "WARNING" | "FAILED";
    warnings: string[];
  } {
    const sem = StatisticalEvidenceBuilder.build(projectId, rawIncidents, sieResult, analysisDate);
    const validation = StatisticalEvidenceValidator.validate(sem, rawIncidents, sieResult);
    
    // Inyectar el resultado de la validación en el objeto SEM final
    sem.qualityEvidence.validationStatus = validation.validationStatus;
    sem.qualityEvidence.warnings = validation.warnings;

    return {
      sem,
      validationStatus: validation.validationStatus,
      warnings: validation.warnings
    };
  }
}
