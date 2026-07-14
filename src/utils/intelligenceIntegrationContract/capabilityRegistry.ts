import { CapabilityStatus } from "./models/intelligenceContextTypes";
import { StatisticalEvidenceMatrix } from "../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { GangEvidenceMatrix } from "../gangIntelligenceEngine/models/gangIntelligenceTypes";

export class CapabilityRegistry {
  /**
   * Determina de forma estructurada qué capacidades de evidencia analítica están cargadas y activas.
   * Esto previene que los motores de redacción intenten referenciar componentes o capítulos ausentes.
   */
  public static getCapabilityStatus(
    sem: StatisticalEvidenceMatrix,
    vee: VisualEvidenceMatrix | null,
    tie: TerritorialEvidenceMatrix | null,
    gem?: GangEvidenceMatrix | null
  ): CapabilityStatus {
    const hasStatistical = !!sem && (sem.criminalEvidence?.totalEvents ?? 0) > 0;
    
    const hasVisual = !!vee && (
      (vee.analystPhotos && vee.analystPhotos.length > 0) || 
      (vee.streetViewEvidence && vee.streetViewEvidence.length > 0) ||
      (vee.graffitiEvidence && vee.graffitiEvidence.length > 0)
    );

    const hasTerritorial = !!tie && (
      (tie.economicAttractors && tie.economicAttractors.length > 0) ||
      !!tie.territorialContext?.tipologyName ||
      !!tie.urbanStructure?.streetGridType
    );

    const hasGang = !!gem && (gem.status === "READY" || gem.status === "READY_WITH_LIMITATIONS");

    return {
      statisticalEvidence: hasStatistical,
      visualEvidence: hasVisual,
      territorialEvidence: hasTerritorial,
      gangIntelligence: hasGang,
      osintEvidence: false,     // Futuro Módulo (Capítulo 8)
      socialIntelligence: false  // Futuro Módulo (Capítulo 7.1)
    };
  }
}
