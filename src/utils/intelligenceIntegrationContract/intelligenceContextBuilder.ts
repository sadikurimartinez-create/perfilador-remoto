import { 
  IntelligenceIntegrationContext, 
  EvidenceProvenance, 
  OperationalAssessment 
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

    // 2. Extraer Patrones Soportados y Limitaciones Cruzadas (Ajuste 2: operationalAssessment controlado)
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

    // Gaps y dudas analíticas
    const unresolvedQuestions: string[] = [...(hie.missingEvidence || [])];
    if (vee.streetViewEvidence.length === 0) {
      unresolvedQuestions.push("No se cuenta con capturas de Google Street View en el baricentro del polígono.");
    }
    if (tie.economicAttractors.length === 0) {
      unresolvedQuestions.push("Baja densidad o ausencia de atractores comerciales DENUE registrados en el radio táctico.");
    }

    // Limitaciones consolidadas
    const limitations: string[] = [];
    if (sem.limitations && Array.isArray(sem.limitations)) {
      sem.limitations.forEach(l => limitations.push(`[SEM] ${l.description}`));
    }
    if (hie.contradictoryEvidence && Array.isArray(hie.contradictoryEvidence)) {
      hie.contradictoryEvidence.forEach(c => limitations.push(`[HIE] Contradicción: ${c}`));
    }

    // Concordancia de evidencia basada directamente en la consistencia de ACE (Ajuste 1: ACE es dueño de la consistencia)
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

    // 3. Determinar Estado de Validación del Contrato
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
