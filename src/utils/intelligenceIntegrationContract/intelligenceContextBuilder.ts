import { 
  IntelligenceIntegrationContext, 
  EvidenceProvenance, 
  OperationalAssessment,
  CapabilityStatus
} from "./models/intelligenceContextTypes";
import { StatisticalEvidenceMatrix } from "../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport } from "../analyticalConsistencyEngine/models/aceTypes";
import { HIEResult } from "../hypothesisIntelligenceEngine";
import { HIEValidationVectorAdapter } from "../analyticalConsistencyEngine/hieValidationVectorAdapter";

export class IntelligenceContextBuilder {
  /**
   * Ensambla, unifica, versiona y establece la trazabilidad del contexto integrado de inteligencia (IIC)
   * en estricto cumplimiento con la regla de consistencia y no-recalculación.
   */
  public static build(
    projectId: string,
    sem: StatisticalEvidenceMatrix,
    vee: VisualEvidenceMatrix,
    tie: TerritorialEvidenceMatrix,
    hie: HIEResult,
    ace: AnalyticalConsistencyReport
  ): IntelligenceIntegrationContext {
    const timestamp = new Date().toISOString();

    // 1. Crear Provenance de Evidencias (Ajuste Adicional)
    const semProvenance: EvidenceProvenance = {
      source: "SEM",
      engineVersion: sem.metadata.semVersion || "1.0",
      generatedAt: sem.traceability?.generatedAt || timestamp,
      confidence: sem.predictiveEvidence?.confidenceMetrics?.statisticalConfidence || 100
    };

    const veeProvenance: EvidenceProvenance = {
      source: "VEE",
      engineVersion: "1.0",
      generatedAt: timestamp,
      confidence: vee.overallVisualConfidence || 100
    };

    const tieProvenance: EvidenceProvenance = {
      source: "TIE",
      engineVersion: tie.temVersion || "1.0",
      generatedAt: tie.traceability?.queryTimestamp || timestamp,
      confidence: tie.confidence?.operationalConfidence || 100
    };

    const hieProvenance: EvidenceProvenance = {
      source: "HIE",
      engineVersion: "1.0",
      generatedAt: timestamp,
      confidence: hie.confidence?.score || 100
    };

    const aceProvenance: EvidenceProvenance = {
      source: "ACE",
      engineVersion: ace.metadata.aceVersion || "1.0",
      generatedAt: ace.metadata.auditedAt || timestamp,
      confidence: ace.overallConfidence || 100
    };

    // 2. Determinar disponibilidad de módulos (Ajuste 2: CapabilityStatus)
    const capabilityStatus: CapabilityStatus = {
      statisticalEvidence: (sem.criminalEvidence?.totalEvents ?? 0) > 0,
      visualEvidence: vee.analystPhotos.length > 0 || vee.streetViewEvidence.length > 0,
      territorialEvidence: tie.economicAttractors.length > 0 || !!tie.territorialContext?.tipologyName,
      gangIntelligence: false, // Módulo futuro
      osintEvidence: false     // Módulo futuro
    };

    // 3. Extraer Patrones Soportados
    const supportedPatterns: string[] = [];
    if (sem.spatialEvidence?.spatialPattern) {
      supportedPatterns.push(`Patrón Espacial Estadístico: ${sem.spatialEvidence.spatialPattern}`);
    }
    if (sem.criminalEvidence?.dominantCrime) {
      supportedPatterns.push(`Concentración de Delito Dominante: ${sem.criminalEvidence.dominantCrime}`);
    }
    if (tie.urbanStructure?.streetGridType) {
      supportedPatterns.push(`Diseño de Trama Urbana: ${tie.urbanStructure.streetGridType}`);
    }
    if (hie.centralHypothesis?.queOcurre) {
      supportedPatterns.push(`Esquema Hipotético Criminológico: ${hie.centralHypothesis.queOcurre}`);
    }

    // 4. Separación Estricta entre unresolvedQuestions y limitations (Ajuste 3)
    
    // unresolvedQuestions: Líneas futuras de investigación táctica o vacíos en el terreno
    const unresolvedQuestions: string[] = [];
    if (vee.streetViewEvidence.length === 0) {
      unresolvedQuestions.push("Verificación en campo pendiente de visibilidad táctica debido a ausencia de Street View en baricentro.");
    }
    if (tie.economicAttractors.length === 0) {
      unresolvedQuestions.push("Línea futura: Identificar si la movilidad peatonal obedece a atractores informales no registrados.");
    }
    unresolvedQuestions.push("Línea futura: Investigar presencia y dinámicas de grupos organizados (pandillas) en el polígono.");

    // limitations: Restricciones metodológicas o técnicas estrictas
    const limitations: string[] = [];
    if (sem.limitations && Array.isArray(sem.limitations)) {
      sem.limitations.forEach(l => limitations.push(`[SEM-Método] ${l.description}`));
    }
    if (sem.metadata?.totalCanonicalIncidents <= 3) {
      limitations.push("[SEM-Muestra] Volumen histórico estadísticamente reducido en el polígono.");
    }
    if (vee.analystPhotos.length === 0) {
      limitations.push("[VEE-Capa] Ausencia de registro fotográfico directo del investigador.");
    }

    // Concordancia de evidencia basada directamente en ACE (Ajuste 1: ACE es dueño de la consistencia)
    let evidenceAgreement: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
    if (ace.globalStatus === "FAILED") {
      evidenceAgreement = "LOW";
    } else if (ace.globalStatus === "WARNING") {
      evidenceAgreement = "MEDIUM";
    }

    const operationalAssessment: OperationalAssessment = {
      evidenceAgreement,
      supportedPatterns,
      unresolvedQuestions,
      limitations
    };

    // 5. Determinar Estado de Validación del Contrato
    let validationStatus: "VALIDATED" | "VALID_WITH_LIMITATIONS" | "WARNING" | "FAILED" = "VALIDATED";
    
    if (ace.globalStatus === "FAILED") {
      validationStatus = "FAILED";
    } else if (ace.globalStatus === "WARNING") {
      validationStatus = "WARNING";
    } else if (vee.analystPhotos.length === 0 || limitations.length > 0) {
      validationStatus = "VALID_WITH_LIMITATIONS";
    }

    return {
      metadata: {
        projectId,
        generatedAt: timestamp,
        version: "1.0.0"
      },
      capabilityStatus,
      statisticalEvidence: {
        source: "SEM",
        data: sem,
        provenance: semProvenance
      },
      visualEvidence: {
        source: "VEE",
        data: vee,
        provenance: veeProvenance
      },
      territorialEvidence: {
        source: "TIE",
        data: tie,
        provenance: tieProvenance
      },
      hypothesisEvidence: {
        source: "HIE",
        data: hie,
        validationVector: (ace as any).hieContext?.validationVector || HIEValidationVectorAdapter.adapt(hie.centralHypothesis?.porQueOcurre || ""),
        provenance: hieProvenance
      },
      qualityControl: {
        source: "ACE",
        data: ace,
        provenance: aceProvenance
      },
      operationalAssessment,
      validationStatus
    };
  }
}
