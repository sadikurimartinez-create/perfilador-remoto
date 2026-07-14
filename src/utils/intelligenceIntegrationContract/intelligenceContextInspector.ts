import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";

export interface IntegrationInspectionResult {
  status: "VALIDATED" | "VALID_WITH_LIMITATIONS" | "WARNING" | "FAILED";
  messages: string[];
}

export class IntelligenceContextInspector {
  /**
   * Realiza una inspección estructural del estado de integridad y disponibilidad de componentes
   * en el contrato integrado (IIC), determinando el nivel de completitud de evidencias.
   */
  public static inspect(context: IntelligenceIntegrationContext): IntegrationInspectionResult {
    const messages: string[] = [];
    let status: IntelligenceIntegrationContext["qualityControl"]["status"] | "VALIDATED" | "VALID_WITH_LIMITATIONS" = "VALIDATED";

    const sources = context.evidenceSources;
    const sem = sources.SEM;
    const vee = sources.VEE;
    const tie = sources.TIE;
    const hie = sources.HIE;
    const ace = sources.ACE;

    // 1. Caso 6: ACE en estatus FAILED -> Detener de inmediato con FAILED (Bloqueo crítico)
    if (ace.globalStatus === "FAILED" || context.qualityControl.status === "FAILED") {
      status = "FAILED";
      messages.push(`ACE FAILED: Bloqueo crítico de consistencia analytical. Motivo principal: ${ace.alerts?.[0]?.message || "Discrepancia crítica en auditoría"}`);
      return { status, messages };
    }

    // 2. Caso 2: SEM + VEE + TIE completos, pero sin HIE -> VALID_WITH_LIMITATIONS
    if (context.capabilityStatus.statisticalEvidence && 
        context.capabilityStatus.visualEvidence && 
        context.capabilityStatus.territorialEvidence && 
        !hie) {
      status = "VALID_WITH_LIMITATIONS";
      messages.push("COMPLETITUD PARCIAL: Matrices de terreno y estadística completas, pero sin vector de hipótesis (HIE) cargado.");
    }

    // 3. Caso 3: Sin fotos en el expediente -> VALID_WITH_LIMITATIONS
    if (!context.capabilityStatus.visualEvidence) {
      if (status === "VALIDATED") status = "VALID_WITH_LIMITATIONS";
      messages.push("LIVIANO (LIMITADO): No se cargaron evidencias visuales del polígono (analista ni Street View); el perfil opera en capa abstracta.");
    }

    // 4. Caso 4: Evidencia Contradictoria Válida (SEM concentrada pero TIE sin atractores)
    // No es una falla, sino un hallazgo con limitación explicativa -> VALID_WITH_LIMITATIONS
    const isSemConcentrated = sem.spatialEvidence?.spatialPattern?.toLowerCase().includes("concentra") || 
                            (sem.spatialEvidence?.clusterCount && sem.spatialEvidence.clusterCount > 0);
    const isTieWithoutAttractors = !tie || tie.economicAttractors.length === 0 || 
                                   (tie.territorialPressure?.attractorDensityScore ?? 0) < 15;

    if (isSemConcentrated && isTieWithoutAttractors) {
      if (status === "VALIDATED") status = "VALID_WITH_LIMITATIONS";
      messages.push("DIVERGENCIA VÁLIDA CON LIMITACIÓN: Se registra concentración delictiva estadística (SEM) pero nula presencia de atractores comerciales (TIE). El fenómeno delictivo obedece a factores distintos de la atracción económica de suelo.");
      
      const question = "¿La concentración delictiva responde a dinámicas de movilidad, factores sociales o infraestructura no registrada?";
      if (!context.operationalAssessment.unresolvedQuestions.includes(question)) {
        context.operationalAssessment.unresolvedQuestions.push(question);
      }
    }

    // 5. Caso 5: Hipótesis fuerte (HIE) con evidencia estadística de baja representatividad (SEM <= 2 eventos) -> WARNING
    const totalEvents = sem.metadata?.totalCanonicalIncidents ?? sem.criminalEvidence?.totalEvents ?? 0;
    const hasStrongHiePattern = hie && (hie.criticalOpportunity === "HIGH" || hie.spatialPattern === "CONCENTRATED");

    if (hasStrongHiePattern && totalEvents <= 2) {
      status = "WARNING";
      messages.push("ADVERTENCIA: El Hypothesis Engine (HIE) plantea un patrón o vulnerabilidad alta, pero el volumen de eventos de la SEM es insuficiente (2 o menos incidentes).");
    }

    // 6. Caso 7: Expediente mínimo (sin fotos, sin territorio, sin OSINT, sin pandillas) -> VALID_WITH_LIMITATIONS
    const isMinimumProfile = !context.capabilityStatus.visualEvidence && 
                             !context.capabilityStatus.territorialEvidence && 
                             !context.capabilityStatus.gangIntelligence && 
                             !context.capabilityStatus.osintEvidence;

    if (isMinimumProfile) {
      if (status === "VALIDATED") status = "VALID_WITH_LIMITATIONS";
      messages.push("EXPEDIENTE MÍNIMO: El perfilador opera con la capa mínima viable (únicamente evidencia estadística SEM).");
    }

    // Si ACE emitió advertencia general, heredar WARNING
    if (ace.globalStatus === "WARNING") {
      status = "WARNING";
      messages.push(`ACE WARNING: El motor de consistencia identificó advertencias: ${ace.alerts.map(a => a.message).join(" | ")}`);
    }

    return {
      status,
      messages
    };
  }
}
