import { InvestigationHypothesis, HypothesisState, ConfidenceLevel, ConfidenceAdjustmentEvent } from "./hypothesisLifecycle";
import { IntelligenceEvidenceObject } from "./evidenceGovernanceEngine";
import { FusionResult } from "./hypothesisCorrelationEngine";

export interface HypothesisConfidenceAssessment {
  id: string;
  hypothesisId: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  evidenceContribution: number;
  correlationContribution: number;
  temporalConsistency: number;
  contradictionPenalty: number;
  analyticalStability: number;
  justification: string;
  calculatedAt: number;
  maxAllowedConfidence: number;
  penaltiesApplied: string[];
  limitingFactors: string[];
  validationRequirements: string[];
}

export class HypothesisConfidenceCalibrationEngine {
  /**
   * Determina la capacidad demostrativa máxima permitida (Tope Epistemológico HCCE-5)
   */
  public static determineMaxAllowedConfidence(
    evidences: IntelligenceEvidenceObject[]
  ): { cap: number; reasons: string[] } {
    const validatedEvidences = evidences.filter(e => e.estadoValidacion === "VALIDADA");
    if (validatedEvidences.length === 0) {
      return {
        cap: 30,
        reasons: ["Ausencia de evidencia primaria validada. Se restringe a nivel mínimo de sospecha."]
      };
    }

    const domains = new Set<string>();
    validatedEvidences.forEach(ev => {
      if (ev.tipo === "FIELD_PHOTO") domains.add("FIELD_PHOTO");
      else if (ev.tipo === "STREET_VIEW") domains.add("STREET_VIEW");
      else if (ev.tipo === "CRIME_STATISTICS" || ev.tipo === "GIS_LAYER") domains.add("STATISTICAL");
      else if (ev.tipo === "OSINT" || ev.tipo === "SOCIAL_MEDIA") domains.add("OSINT");
      else domains.add("OTHER");
    });

    const numDomains = domains.size;
    if (numDomains === 1) {
      return {
        cap: 60,
        reasons: ["Evidencia monocultural detectada. La hipótesis carece de contraste multi-disciplinario."]
      };
    } else if (numDomains === 2) {
      return {
        cap: 80,
        reasons: ["Soporte de dos dominios analíticos. No alcanza la plenitud epistemológica trans-disciplinaria."]
      };
    }

    return {
      cap: 100,
      reasons: []
    };
  }

  /**
   * Calcula y calibra la confianza de una hipótesis aplicando el modelo matemático del ADR-014.
   */
  public static calibrate(
    hypothesis: InvestigationHypothesis,
    evidences: IntelligenceEvidenceObject[],
    fusionResult?: FusionResult,
    hasEpistemologicalLeap = false,
    hasUnresolvedConflicts = false,
    hasTraceabilityIssues = false
  ): HypothesisConfidenceAssessment {
    const penaltiesApplied: string[] = [];
    const limitingFactors: string[] = [];
    const validationRequirements: string[] = [];

    // Filtrar evidencias asociadas
    const relatedEvidences = evidences.filter(ev =>
      ev.hipotesisRelacionadas.includes(hypothesis.id) ||
      ev.hipotesisRelacionadas.includes(hypothesis.expedienteId)
    );

    const validatedEvidences = relatedEvidences.filter(e => e.estadoValidacion === "VALIDADA");

    // 1. Evidencia Gobernada (Evg) - 35%
    let evidenceContribution = 0;
    if (validatedEvidences.length > 0) {
      const totalWeight = validatedEvidences.reduce((sum, e) => sum + e.pesoEvidencial, 0);
      evidenceContribution = totalWeight / validatedEvidences.length;
    } else {
      limitingFactors.push("Falta de evidencia de campo validada.");
      validationRequirements.push("Realizar inspecciones de campo o colectar bases estadísticas validadas.");
    }

    // 2. Correlación Multidominio (Cor) - 30%
    let correlationContribution = fusionResult ? fusionResult.hcsScore : 0;
    if (correlationContribution < 50) {
      limitingFactors.push("Baja convergencia entre los dominios analíticos.");
      validationRequirements.push("Cruzar hallazgos con fuentes OSINT o capas GIS del Atlas Cartográfico.");
    }

    // 3. Evolución Histórica (Evo) - 15%
    const numEvents = hypothesis.historialEvolucion ? hypothesis.historialEvolucion.length : 0;
    let evolutionScore = 0;
    if (numEvents === 1) evolutionScore = 50;
    else if (numEvents === 2) evolutionScore = 80;
    else if (numEvents >= 3) evolutionScore = 100;
    else {
      limitingFactors.push("La hipótesis no presenta evolución ni maduración en su historial.");
      validationRequirements.push("Registrar formalmente los eventos de evaluación o reorientación de hipótesis.");
    }

    // 4. Consistencia Temporal (Con) - 10%
    let temporalConsistency = 0;
    if (validatedEvidences.length > 1) {
      const dates = validatedEvidences.map(e => e.fechaCaptura).filter(f => !isNaN(f));
      if (dates.length > 1) {
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const diffMs = maxDate - minDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 1) {
          temporalConsistency = 100;
        } else if (diffMs > 0) {
          temporalConsistency = 60;
        } else {
          temporalConsistency = 30;
        }
      } else {
        temporalConsistency = 30;
      }
    } else if (validatedEvidences.length === 1) {
      temporalConsistency = 30;
      limitingFactors.push("Registro en un solo punto temporal. Riesgo de sesgo situacional efímero.");
      validationRequirements.push("Obtener evidencias de fechas diferidas para demostrar persistencia.");
    } else {
      temporalConsistency = 0;
    }

    // 5. Estabilidad Analítica (Est) - 10%
    let analyticalStability = 100;
    if (hypothesis.evidenciaContradictoria && hypothesis.evidenciaContradictoria.length > 0) {
      analyticalStability -= 30;
    }
    const hasReorientation = hypothesis.historialEvolucion && hypothesis.historialEvolucion.some(e => e.tipoCambio === "REORIENTACION" || e.tipoCambio === "REFUTACION");
    if (hasReorientation) {
      analyticalStability -= 20;
    }
    analyticalStability = Math.max(0, analyticalStability);

    // Calcular HCCS Base
    let baseScore =
      (evidenceContribution * 0.35) +
      (correlationContribution * 0.30) +
      (evolutionScore * 0.15) +
      (temporalConsistency * 0.10) +
      (analyticalStability * 0.10);

    // Aplicar Penalizaciones
    let contradictionPenalty = 0;
    if (hasUnresolvedConflicts || (fusionResult && fusionResult.conflicts.length > 0)) {
      contradictionPenalty = 20;
      baseScore -= 20;
      penaltiesApplied.push("Contradicción analítica no resuelta (-20 pts).");
      limitingFactors.push("Discrepancias severas activas entre estadística oficial e información táctica de campo.");
      validationRequirements.push("Declarar formalmente el tratamiento del conflicto en la matriz de inconsistencias.");
    }

    // Evidencia Monocultural (menos de 2 dominios)
    const capDetails = this.determineMaxAllowedConfidence(relatedEvidences);
    if (capDetails.cap === 60) {
      baseScore -= 15;
      penaltiesApplied.push("Evidencia monocultural detectada (-15 pts).");
      limitingFactors.push("Dependencia de un único tipo de datos primarios.");
      validationRequirements.push("Integrar por lo menos una fuente alternativa de diferente naturaleza.");
    }

    if (hasEpistemologicalLeap) {
      baseScore -= 30;
      penaltiesApplied.push("Salto epistemológico detectado (-30 pts).");
      limitingFactors.push("Transición directa a crimen organizado sin reorientación metodológica documentada.");
      validationRequirements.push("Registrar formalmente el evento intermedio de reorientación o ampliación táctica.");
    }

    if (hasTraceabilityIssues) {
      baseScore -= 25;
      penaltiesApplied.push("Ausencia de trazabilidad (-25 pts).");
      limitingFactors.push("Evidencias de conclusiones analíticas sin vínculo formal en el ciclo de vida.");
      validationRequirements.push("Completar el mapeo de evidencias primarias sustentadoras en la matriz de trazabilidad.");
    }

    // Redondear y limitar a rango 0 - 100
    let calibratedScore = Math.max(0, Math.min(100, Math.round(baseScore)));

    // Aplicar Tope Epistemológico (HCCE-5)
    const maxCap = capDetails.cap;
    if (calibratedScore > maxCap) {
      calibratedScore = maxCap;
      penaltiesApplied.push(`Aplicado tope epistemológico estricto (Máximo permitido: ${maxCap}/100).`);
      capDetails.reasons.forEach(r => limitingFactors.push(r));
    }

    // Determinar nivel cualitativo de confianza (Fase 4)
    let confidenceLevel: ConfidenceLevel = "MUY_BAJO";
    let justification = "No existe soporte suficiente para sostener la hipótesis.";

    if (calibratedScore >= 86) {
      confidenceLevel = "MUY_ALTO";
      justification = "La hipótesis presenta convergencia robusta, soporte multi-disciplinario completo y bajo o nulo nivel de contradicción.";
    } else if (calibratedScore >= 66) {
      confidenceLevel = "ALTO";
      justification = "La hipótesis cuenta con soporte multidominio suficiente y sólida consistencia temporal.";
    } else if (calibratedScore >= 41) {
      confidenceLevel = "MEDIO";
      justification = "La hipótesis presenta elementos compatibles con la realidad, pero requiere validación y contraste adicional.";
    } else if (calibratedScore >= 21) {
      confidenceLevel = "BAJO";
      justification = "La hipótesis requiere mayor evidencia primaria y maduración en la trayectoria analítica.";
    }

    return {
      id: `hcca-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      hypothesisId: hypothesis.id,
      confidenceScore: calibratedScore,
      confidenceLevel,
      evidenceContribution: Math.round(evidenceContribution),
      correlationContribution: Math.round(correlationContribution),
      temporalConsistency: Math.round(temporalConsistency),
      contradictionPenalty,
      analyticalStability: Math.round(analyticalStability),
      justification,
      calculatedAt: Date.now(),
      maxAllowedConfidence: maxCap,
      penaltiesApplied,
      limitingFactors,
      validationRequirements
    };
  }
}
