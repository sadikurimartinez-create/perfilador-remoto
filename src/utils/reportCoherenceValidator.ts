/**
 * ReportCoherenceValidator - Validador de Coherencia de la Cadena de Evidencia de CEIPOL.
 * Implementa la matriz de "Certification Status Control" que evalúa la solidez metodológica y determina si un reporte califica para certificación.
 */

export interface CoherenceValidationResult {
  canExport: boolean;
  status: "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "NOT_CERTIFIED";
  messages: string[];
  hypothesisCount: number;
  evidenceCount: number;
  conclusionCount: number;
  hasHypothesis: boolean;
  hasEvidence: boolean;
  hasConclusions: boolean;
}

export class ReportCoherenceValidator {
  /**
   * Valida la coherencia de la cadena analítica del reporte: Hipótesis -> Evidencia -> Conclusión.
   */
  public static validate(payload: any): CoherenceValidationResult {
    const messages: string[] = [];
    
    // 1. Validar Hipótesis
    const hypothesisText = payload.finalHypothesis || payload.hipotesisPrincipal?.queOcurre || payload.hypothesisLifecycle?.hipotesisActual || "";
    const hasHypothesis = typeof hypothesisText === "string" && hypothesisText.trim().length > 30 && !hypothesisText.includes("Información no disponible");
    const hypothesisCount = hasHypothesis ? 1 : 0;

    // 2. Validar Evidencia
    const photoCount = Array.isArray(payload.photoEvidence) ? payload.photoEvidence.length : 0;
    const svCount = Array.isArray(payload.streetViewAnalysis) ? payload.streetViewAnalysis.length : 0;
    const evidenceCount = photoCount + svCount;
    const hasEvidence = evidenceCount > 0;

    // 3. Validar Conclusiones
    const conclusiones = payload.conclusiones;
    const hasConclusionsList = conclusiones && (
      (Array.isArray(conclusiones.hallazgosCriticos) && conclusiones.hallazgosCriticos.length > 0) ||
      (Array.isArray(conclusiones.recomendacionesTacticas) && conclusiones.recomendacionesTacticas.length > 0) ||
      (Array.isArray(conclusiones.recomendacionesEstrategicas) && conclusiones.recomendacionesEstrategicas.length > 0)
    );
    const conclusionsText = payload.conclusionesText || "";
    const hasConclusionsText = typeof conclusionsText === "string" && conclusionsText.trim().length > 30 && !conclusionsText.includes("Información no disponible");
    const hasConclusions = hasConclusionsList || hasConclusionsText;
    const conclusionCount = hasConclusions ? 1 : 0;

    // --- APLICACIÓN DE LA MATRIZ DE CERTIFICATION STATUS CONTROL ---
    let status: CoherenceValidationResult["status"] = "NOT_CERTIFIED";
    let canExport = false;

    if (!hasHypothesis) {
      status = "NOT_CERTIFIED";
      canExport = false;
      messages.push("❌ No certificado: Ausencia de hipótesis central de investigación.");
    } else if (!hasEvidence) {
      status = "NOT_CERTIFIED";
      canExport = false;
      messages.push("❌ No certificado: No se incorporaron evidencias cartográficas ni fotográficas en el expediente.");
    } else if (hasHypothesis && hasEvidence && !hasConclusions) {
      status = "NOT_CERTIFIED";
      canExport = false;
      messages.push("❌ No certificado: El informe carece de conclusiones operativas y tácticas.");
    } else if (hasHypothesis && hasEvidence && hasConclusions) {
      // Validar si la evidencia es completa o parcial
      const hasFullEvidence = photoCount >= 2 || svCount >= 2;
      
      if (hasFullEvidence) {
        status = "CERTIFIED";
        canExport = true;
        messages.push("✅ Certificado: Cadena analítica completa y validada (Hipótesis + Evidencia + Conclusiones).");
      } else {
        status = "CERTIFIED_WITH_WARNINGS";
        canExport = true;
        messages.push("⚠️ Exportado con advertencia: Cuenta con hipótesis, pero la evidencia territorial incorporada es parcial.");
      }
    }

    return {
      canExport,
      status,
      messages,
      hypothesisCount,
      evidenceCount,
      conclusionCount,
      hasHypothesis,
      hasEvidence,
      hasConclusions
    };
  }
}
