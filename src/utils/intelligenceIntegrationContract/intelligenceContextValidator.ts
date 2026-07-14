import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";

export interface IntegrationAuditResult {
  status: "VALIDATED" | "VALID_WITH_LIMITATIONS" | "WARNING" | "FAILED";
  messages: string[];
}

export class IntelligenceContextValidator {
  /**
   * Evalúa de forma cruzada y audita la coherencia de la integración táctica de evidencias.
   */
  public static validate(context: IntelligenceIntegrationContext): IntegrationAuditResult {
    const messages: string[] = [];
    let status = context.validationStatus;

    const sem = context.statisticalEvidence.data;
    const tie = context.territorialEvidence.data;
    const hie = context.hypothesisEvidence.data;
    const ace = context.qualityControl.data;

    // 1. Validar Autoridad Suprema de ACE (Ajuste 1)
    if (ace.globalStatus === "FAILED") {
      status = "FAILED";
      messages.push(`ACE FAILED: Bloqueo de consistencia cruzada debido a: ${ace.alerts.map(a => a.message).join(" | ")}`);
      return { status, messages };
    }

    // 2. Inconsistencia SEM-TIE: Contradictoria pero VÁLIDA (Caso de Prueba 6)
    // SEM indica alta concentración, pero TIE indica baja o nula presencia de atractores.
    // Esto es una contradicción real y factual (hallazgo de campo), por ende es VALID_WITH_LIMITATIONS, nunca FAILED.
    const isSemConcentrated = sem.spatialEvidence?.spatialPattern?.toLowerCase().includes("concentra") || 
                            (sem.spatialEvidence?.clusterCount && sem.spatialEvidence.clusterCount > 0);
    const isTieDispersed = tie.territorialPressure?.attractorDensityScore < 20 && 
                           tie.economicAttractors.length === 0;

    if (isSemConcentrated && isTieDispersed) {
      if (status === "VALIDATED") {
        status = "VALID_WITH_LIMITATIONS";
      }
      messages.push("HALLAZGO DE CONTRADICCIÓN VÁLIDA: Se registra alta concentración espacial estadística (SEM) pero nula presencia de atractores comerciales (TIE). El fenómeno delictivo obedece a factores distintos de la atracción económica del suelo.");
    }

    // 3. Hipótesis sobredimensionada vs baja evidencia SEM (Caso de Prueba 4)
    const totalEvents = sem.metadata?.totalCanonicalIncidents ?? sem.criminalEvidence?.totalEvents ?? 0;
    const hasStrongHypothesis = hie.centralHypothesis?.porQueOcurre?.length > 15 && 
                                hie.confidence?.score > 70;

    if (hasStrongHypothesis && totalEvents <= 2) {
      if (status !== "FAILED") status = "WARNING";
      messages.push("ADVERTENCIA: El Hypothesis Engine (HIE) formula una hipótesis causal fuerte, pero el volumen delictivo de la SEM es estadísticamente insuficiente (menor o igual a 2 incidentes).");
    }

    // 4. Caso 3 & Caso 7: Ausencia de fotos u OSINT en VEE no debe bloquear (VALID_WITH_LIMITATIONS)
    const hasNoVisualEvidence = context.visualEvidence.data.analystPhotos.length === 0 && 
                                context.visualEvidence.data.streetViewEvidence.length === 0;

    if (hasNoVisualEvidence) {
      if (status === "VALIDATED") {
        status = "VALID_WITH_LIMITATIONS";
      }
      messages.push("LIVIANO (LIMITADO): No se cargaron evidencias visuales del entorno físico, se limita el perfil a la capa abstracta.");
    }

    return {
      status,
      messages
    };
  }
}
