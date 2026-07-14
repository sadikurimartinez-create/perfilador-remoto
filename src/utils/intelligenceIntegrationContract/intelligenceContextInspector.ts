import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";

export interface IntegrationInspectionResult {
  status: "VALIDATED" | "VALID_WITH_LIMITATIONS" | "WARNING" | "FAILED";
  messages: string[];
}

export class IntelligenceContextInspector {
  /**
   * Realiza una inspección estructural de integridad, disponibilidad de componentes y
   * alertas de inconsistencia en el contrato unificado (IIC).
   */
  public static inspect(context: IntelligenceIntegrationContext): IntegrationInspectionResult {
    const messages: string[] = [];
    let status = context.validationStatus;

    const sem = context.statisticalEvidence.data;
    const tie = context.territorialEvidence.data;
    const hie = context.hypothesisEvidence.data;
    const ace = context.qualityControl.data;

    // 1. Validar Autoridad Suprema de ACE (Bloqueo crítico)
    if (ace.globalStatus === "FAILED") {
      status = "FAILED";
      messages.push(`ACE FAILED: Bloqueo de consistencia cruzada debido a: ${ace.alerts.map(a => a.message).join(" | ")}`);
      return { status, messages };
    }

    // 2. Caso 6: Evidencia Contradictoria Válida (SEM concentrada + TIE sin atractores)
    // No es un fallo técnico, pero sí una brecha explicativa del entorno -> VALID_WITH_LIMITATIONS.
    const isSemConcentrated = sem.spatialEvidence?.spatialPattern?.toLowerCase().includes("concentra") || 
                            (sem.spatialEvidence?.clusterCount && sem.spatialEvidence.clusterCount > 0);
    const isTieDispersed = tie.territorialPressure?.attractorDensityScore < 20 && 
                           tie.economicAttractors.length === 0;

    if (isSemConcentrated && isTieDispersed) {
      if (status === "VALIDATED") {
        status = "VALID_WITH_LIMITATIONS";
      }
      messages.push("DIVERGENCIA VÁLIDA CON LIMITACIÓN: Se registra concentración delictiva estadística (SEM) pero nula presencia de atractores comerciales (TIE). El fenómeno delictivo obedece a factores distintos de la atracción económica de suelo.");
      
      // Añadir la pregunta de investigación recomendada
      if (!context.operationalAssessment.unresolvedQuestions.includes("¿La concentración delictiva responde a dinámicas de movilidad, factores sociales o infraestructura no registrada?")) {
        context.operationalAssessment.unresolvedQuestions.push("¿La concentración delictiva responde a dinámicas de movilidad, factores sociales o infraestructura no registrada?");
      }
    }

    // 3. Hipótesis sobredimensionada vs baja evidencia SEM (Caso de Prueba 4)
    const totalEvents = sem.metadata?.totalCanonicalIncidents ?? sem.criminalEvidence?.totalEvents ?? 0;
    const hasStrongHypothesis = hie.centralHypothesis?.porQueOcurre?.length > 15 && 
                                hie.confidence?.score > 70;

    if (hasStrongHypothesis && totalEvents <= 2) {
      if (status !== "FAILED") status = "WARNING";
      messages.push("ADVERTENCIA: El Hypothesis Engine (HIE) formula una hipótesis causal fuerte, pero el volumen delictivo de la SEM es insuficiente (menor o igual a 2 incidentes).");
    }

    // 4. Caso 3 & Caso 7: Ausencia de fotos u otros componentes no bloqueante (VALID_WITH_LIMITATIONS)
    if (!context.capabilityStatus.visualEvidence) {
      if (status === "VALIDATED") {
        status = "VALID_WITH_LIMITATIONS";
      }
      messages.push("LIVIANO (LIMITADO): No se cargaron evidencias visuales del polígono (analista ni Street View); el perfil opera en capa abstracta.");
    }

    return {
      status,
      messages
    };
  }
}
