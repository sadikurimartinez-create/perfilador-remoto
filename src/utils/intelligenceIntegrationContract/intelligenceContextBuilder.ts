import { 
  IntelligenceIntegrationContext, 
  OperationalAssessment 
} from "./models/intelligenceContextTypes";
import { CapabilityRegistry } from "./capabilityRegistry";
import { StatisticalEvidenceMatrix } from "../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport, HIEValidationVector } from "../analyticalConsistencyEngine/models/aceTypes";

export class IntelligenceContextBuilder {
  /**
   * Ensambla, unifica y versiona los resultados analíticos certificados en un único
   * IntelligenceIntegrationContext inmutable, aplicando estrictamente la regla de no-recalculación.
   */
  public static build(
    projectId: string,
    sem: StatisticalEvidenceMatrix,
    vee: VisualEvidenceMatrix | null,
    tie: TerritorialEvidenceMatrix | null,
    hieVector: HIEValidationVector | null,
    ace: AnalyticalConsistencyReport,
    cie: any | null = null
  ): IntelligenceIntegrationContext {
    const timestamp = new Date().toISOString();
    const version = "1.0.0";

    // 1. Obtener disponibilidad mediante Capability Registry
    const capabilityStatus = CapabilityRegistry.getCapabilityStatus(sem, vee, tie);

    // 2. Extraer patrones soportados basándose en datos reales provistos (sin analizar de cero)
    const supportedPatterns: string[] = [];
    if (sem.spatialEvidence?.spatialPattern) {
      supportedPatterns.push(`Patrón de Concentración Espacial: ${sem.spatialEvidence.spatialPattern}`);
    }
    if (sem.criminalEvidence?.dominantCrime) {
      supportedPatterns.push(`Concentración de Delito: ${sem.criminalEvidence.dominantCrime}`);
    }
    if (tie?.urbanStructure?.streetGridType) {
      supportedPatterns.push(`Configuración de Trama Vial: ${tie.urbanStructure.streetGridType}`);
    }
    if (hieVector?.spatialPattern) {
      supportedPatterns.push(`Patrón Hipotético Espacial (HIE): ${hieVector.spatialPattern}`);
    }

    // 3. Separación estricta de limitations y unresolvedQuestions
    const limitations: string[] = [];
    const unresolvedQuestions: string[] = [];

    // Limitations (Restricciones técnicas o metodológicas del expediente)
    if (!vee || vee.analystPhotos.length === 0) {
      limitations.push("[VEE-LIMIT] El expediente carece de registro fotográfico directo del investigador.");
    }
    if (sem.metadata?.totalCanonicalIncidents <= 3) {
      limitations.push("[SEM-LIMIT] Muestra estadística reducida; volumen histórico bajo en el polígono.");
    }
    if (!tie || tie.economicAttractors.length === 0) {
      limitations.push("[TIE-LIMIT] Ausencia de atractores económicos registrados en el área de influencia.");
    }

    // Unresolved Questions (Líneas futuras de investigación táctica o brechas explicativas de terreno)
    if (!vee || vee.streetViewEvidence.length === 0) {
      unresolvedQuestions.push("Verificación de campo requerida: Confirmar visibilidad táctica debido a ausencia de Street View en baricentro.");
    }
    if (!tie || tie.economicAttractors.length === 0) {
      unresolvedQuestions.push("Línea futura: Identificar si el desplazamiento de personas responde a polos de atracción informales.");
    }
    unresolvedQuestions.push("Línea futura: Investigar presencia, fronteras invisibles y dinámicas operativas de pandillas organizadas.");
    unresolvedQuestions.push("Línea futura: Consolidar rastreo de redes de mensajería locales y OSINT para este polígono.");

    // 4. Determinar nivel de acuerdo basándose en la auditoría de ACE
    let evidenceAgreement: OperationalAssessment["evidenceAgreement"] = "HIGH";
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

    // 5. Determinar analysisReadiness
    let analysisReadiness: "READY" | "READY_WITH_LIMITATIONS" | "NOT_READY" = "READY";
    
    const totalEvents = sem.criminalEvidence?.totalEvents ?? sem.metadata?.totalCanonicalIncidents ?? 0;
    const isAceFailed = ace.globalStatus === "FAILED";
    const isIntegrityBroken = ((sem.spatialEvidence?.hotspots?.length || 0) > 0) && (!tie || !tie.economicAttractors);

    if (totalEvents < 5 || isAceFailed || isIntegrityBroken) {
      analysisReadiness = "NOT_READY";
    } else if (!capabilityStatus.visualEvidence || !capabilityStatus.territorialEvidence || !capabilityStatus.gangIntelligence || !capabilityStatus.osintEvidence || !capabilityStatus.socialIntelligence) {
      analysisReadiness = "READY_WITH_LIMITATIONS";
    }

    // 6. Preparar contenedores de módulos
    const intelligenceModules = {
      statistical: true,
      territorial: capabilityStatus.territorialEvidence,
      visual: capabilityStatus.visualEvidence,
      gang: capabilityStatus.gangIntelligence,
      osint: capabilityStatus.osintEvidence,
      social: capabilityStatus.socialIntelligence
    };

    // 7. Procedencia consolidada de la unificación
    const provenance = {
      source: "INTELLIGENCE_INTEGRATION_CONTRACT (IIC)",
      engineVersion: version,
      generatedAt: timestamp,
      confidence: ace.overallConfidence ?? 90
    };

    // 8. Reporte de calidad (réplica exacta de la auditoría de ACE sin duplicar lógicas)
    const qualityControl = {
      status: ace.globalStatus,
      aceReference: `ACE-REF-${projectId}-${ace.metadata.auditedAt.replace(/[\/:]/g, "")}`
    };

    return {
      metadata: {
        projectId,
        generatedAt: timestamp,
        version
      },
      evidenceSources: {
        SEM: sem,
        VEE: vee,
        TIE: tie,
        HIE: hieVector,
        CIE: cie,
        ACE: ace
      },
      operationalAssessment,
      capabilityStatus,
      intelligenceModules,
      analysisReadiness,
      provenance,
      qualityControl
    };
  }
}
