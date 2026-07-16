import { InvestigationHypothesis } from "./hypothesisLifecycle";
import { IntelligenceEvidenceObject } from "./evidenceGovernanceEngine";
import { FusionResult } from "./hypothesisCorrelationEngine";
import { HypothesisConfidenceAssessment } from "./hypothesisConfidenceCalibrationEngine";
import { DecisionOutcomeTracker } from "./decisionOutcomeTracker";

export type DecisionPriority =
  | "BAJA"
  | "MEDIA"
  | "ALTA"
  | "CRITICA";

export type DecisionType =
  | "PREVENTIVA"
  | "DISUASIVA"
  | "AMBIENTAL"
  | "INVESTIGATIVA"
  | "INTERINSTITUCIONAL";

export interface OperationalDecisionObject {
  id: string;
  hypothesisId: string;
  confidenceScore: number;
  decisionType: DecisionType;
  priority: DecisionPriority;
  objective: string;
  evidenceBasis: string[];
  operationalVariables: {
    zona: string;
    horario?: string;
    factorIntervencion: string;
    poblacionObjetivo?: string;
  };
  expectedImpact: string;
  successIndicators: string[];
  limitations: string[];
  createdAt: number;
}

export class HypothesisDecisionIntelligenceEngine {
  /**
   * Genera de forma sistemática una decisión operacional proporcional sustentada en la hipótesis,
   * sus evidencias gobernadas, su correlación y su score de confianza calibrado (HCCS).
   */
  public static generateDecision(
    hl: InvestigationHypothesis,
    registry: IntelligenceEvidenceObject[],
    correlation: FusionResult,
    ca: HypothesisConfidenceAssessment
  ): OperationalDecisionObject {
    const score = ca.confidenceScore;
    let decisionType: DecisionType = "PREVENTIVA";
    let objective = "";
    let expectedImpact = "";
    let factorIntervencion = "";
    let horario = "Vespertino/Nocturno (Periodo de mayor concentración)";
    let poblacionObjetivo = "Infractores y transeúntes vulnerables";
    let successIndicators: string[] = [];
    let limitations: string[] = [];

    // Resolver antecedentes negativos en la zona a través de DecisionOutcomeTracker
    const previousOutcomes = DecisionOutcomeTracker.getOutcomesForHypothesis(hl.id);
    const hasPreviousFailures = previousOutcomes.some(o => o.resultado === "NEGATIVA" || o.resultado === "SIN_CAMBIO");

    // FASE 6: Reglas de asignación según nivel de confianza
    if (score < 40) {
      // Confianza Baja: Recomendación Exploratoria
      decisionType = "PREVENTIVA";
      factorIntervencion = "Monitoreo preventivo pasivo y censo táctico complementario de campo.";
      objective = `Realizar monitoreo y recopilación de indicios tácticos iniciales en el sector de estudio.`;
      expectedImpact = "Incrementar el volumen de evidencia primaria para validar o descartar la hipótesis.";
      successIndicators = ["Porcentaje de nuevas evidencias registradas", "Índice de madurez del lote analítico"];
      limitations = ["Baja certeza evidencial impide desplegar recursos operativos masivos."];
    } else if (score < 70) {
      // Confianza Media: Acciones Preventivas Focalizadas
      decisionType = "AMBIENTAL";
      factorIntervencion = hasPreviousFailures 
        ? "Remodelación urbana prioritaria y alumbrado LED asistido, variando el enfoque preventivo por fracaso previo."
        : "Recuperación del entorno mediante poda de maleza, reparación de luminarias e iluminación focalizada.";
      objective = "Reducir los facilitadores de oportunidad criminógena situacionales detectados en el polígono.";
      expectedImpact = "Mitigación del riesgo de oportunidad situacional and disminución de reportes ciudadanos.";
      successIndicators = ["Luminarias reparadas", "Metros cuadrados de maleza desbrozada", "Variación de reportes de oportunidad"];
      limitations = ["Requiere coordinación con servicios municipales de Aguascalientes", "No disuelve células delictivas organizadas"];
    } else if (score < 90) {
      // Confianza Alta: Acciones Operativas Específicas
      decisionType = "DISUASIVA";
      factorIntervencion = hasPreviousFailures
        ? "Implementación de patrullas encubiertas e investigación táctica dirigida, variando el enfoque disuasivo por fracaso previo."
        : "Implementación de puntos de control disuasivo y filtros tácticos dinámicos de patrullaje.";
      objective = "Focalizar patrullaje dinámico y presencia policial visible en los micro-hotspots geo-referenciados.";
      expectedImpact = "Disuasión activa en puntos críticos y descenso en la incidencia delictiva del polígono.";
      successIndicators = ["Filtros policiales instalados", "Variación porcentual de delitos en los micro-hotspots"];
      limitations = ["Riesgo de desplazamiento del delito a sectores adyacentes no vigilados", "Saturación de personal operativo"];
    } else {
      // Confianza Muy Alta: Intervenciones Coordinadas de Mayor Alcance
      decisionType = "INTERINSTITUCIONAL";
      factorIntervencion = hasPreviousFailures
        ? "Mapeo de redes complejas y congelamiento de activos coordinado, variando el operativo táctico directo por fracaso previo."
        : "Operativo táctico interinstitucional coordinado con mandos de la Fiscalía General de Aguascalientes.";
      objective = "Ejecutar intervenciones tácticas dirigidas de alto impacto sobre factores delictivos consolidados.";
      expectedImpact = "Desarticulación de focos criminales recurrentes e impacto estructural medible en el polígono.";
      successIndicators = ["Órdenes de cateo/clausuras ejecutadas", "Variación de delitos graves en el cuadrante principal", "Índice de judicialización"];
      limitations = ["Requiere autorizaciones judiciales estrictas", "Complejidad logística interinstitucional"];
    }

    const priority = this.calculateDecisionPriority(hl, registry, correlation, ca);

    const relatedEvidenceIds = registry
      .filter(e => e.hipotesisRelacionadas.includes(hl.id) && e.estadoValidacion === "VALIDADA")
      .map(e => e.id);

    return {
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      hypothesisId: hl.id,
      confidenceScore: score,
      decisionType,
      priority,
      objective,
      evidenceBasis: relatedEvidenceIds.length > 0 ? relatedEvidenceIds : ["ev-photo-base-fallback"],
      operationalVariables: {
        zona: hl.hipotesisActual.includes("Sector") 
          ? hl.hipotesisActual 
          : "Sector Paseos de Aguascalientes (Área perimetral)",
        horario,
        factorIntervencion,
        poblacionObjetivo
      },
      expectedImpact,
      successIndicators,
      limitations,
      createdAt: Date.now()
    };
  }

  /**
   * Verifica la proporcionalidad operacional y coherencia de una decisión respecto a su score de confianza.
   * Regla de Proporcionalidad Operacional (FASE 4):
   * La intensidad de la decisión nunca debe superar la confianza disponible.
   */
  public static evaluateDecisionConsistency(
    decision: OperationalDecisionObject,
    ca: HypothesisConfidenceAssessment
  ): { status: "COHERENTE" | "INCONSISTENTE"; reason?: string } {
    const score = ca.confidenceScore;
    const type = decision.decisionType;

    // Validación HDIE-2: Bloqueo de intensidad superior a confianza
    if (score < 40 && type !== "PREVENTIVA") {
      return {
        status: "INCONSISTENTE",
        reason: `[PROPORCIONALIDAD DE DECISIÓN] Confianza insuficiente (HCCS: ${score}/100 < 40). Para niveles de confianza bajos únicamente se permiten recomendaciones de tipo PREVENTIVA con carácter exploratorio o recopilatorio.`
      };
    }

    if (score < 70 && (type === "DISUASIVA" || type === "INVESTIGATIVA" || type === "INTERINSTITUCIONAL")) {
      return {
        status: "INCONSISTENTE",
        reason: `[PROPORCIONALIDAD DE DECISIÓN] Confianza insuficiente (HCCS: ${score}/100 < 70). No se autoriza desplegar intervenciones operativas específicas o de investigación táctica sin un score matemático calibrado de confianza mínimo de 70/100.`
      };
    }

    if (score < 90 && type === "INTERINSTITUCIONAL") {
      return {
        status: "INCONSISTENTE",
        reason: `[PROPORCIONALIDAD DE DECISIÓN] Confianza insuficiente (HCCS: ${score}/100 < 90). No se permiten intervenciones masivas o interinstitucionales coordinadas sin un score matemático calibrado de confianza mínimo de 90/100.`
      };
    }

    return { status: "COHERENTE" };
  }

  /**
   * Calcula de manera cuantitativa la prioridad de la decisión.
   * Considera: Severidad, presencia de evidencias de campo sólidas, y confianza de la hipótesis.
   */
  public static calculateDecisionPriority(
    hl: InvestigationHypothesis,
    registry: IntelligenceEvidenceObject[],
    correlation: FusionResult,
    ca: HypothesisConfidenceAssessment
  ): DecisionPriority {
    const score = ca.confidenceScore;
    const relatedEvs = registry.filter(e => e.hipotesisRelacionadas.includes(hl.id));
    const hasSevereCrime = hl.hipotesisActual.toLowerCase().includes("organizado") || hl.hipotesisActual.toLowerCase().includes("armas") || hl.hipotesisActual.toLowerCase().includes("robo");

    let priorityPoints = 0;

    // Puntos por confianza
    if (score >= 80) priorityPoints += 40;
    else if (score >= 50) priorityPoints += 25;
    else priorityPoints += 10;

    // Puntos por gravedad/severidad
    if (hasSevereCrime) priorityPoints += 30;

    // Puntos por concentración de evidencias
    if (relatedEvs.length >= 3) priorityPoints += 30;
    else if (relatedEvs.length >= 1) priorityPoints += 15;

    if (priorityPoints >= 80) return "CRITICA";
    if (priorityPoints >= 60) return "ALTA";
    if (priorityPoints >= 35) return "MEDIA";
    return "BAJA";
  }
}
