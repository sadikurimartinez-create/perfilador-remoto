export interface DecisionOutcome {
  decisionId: string;
  fechaEvaluacion: number;
  resultado:
    | "EXITOSA"
    | "PARCIAL"
    | "SIN_CAMBIO"
    | "NEGATIVA";
  indicadoresMedidos: string[];
  variacionIncidencia?: number;
  observaciones: string;
}

export class DecisionOutcomeTracker {
  private static outcomeRegistry: DecisionOutcome[] = [];
  // Mapa de decisión a hipótesis para rastrear resultados a nivel hipótesis
  private static decisionToHypothesisMap = new Map<string, string>();

  /**
   * Registra el resultado post-intervención de una decisión operacional.
   */
  public static registerOutcome(outcome: DecisionOutcome, hypothesisId?: string) {
    this.outcomeRegistry.push(outcome);
    if (hypothesisId) {
      this.decisionToHypothesisMap.set(outcome.decisionId, hypothesisId);
    }
  }

  /**
   * Recupera los resultados asociados a una decisión específica.
   */
  public static getOutcome(decisionId: string): DecisionOutcome | undefined {
    return this.outcomeRegistry.find(o => o.decisionId === decisionId);
  }

  /**
   * Recupera todos los resultados históricos de intervención registrados en el sistema.
   */
  public static getAllOutcomes(): DecisionOutcome[] {
    return [...this.outcomeRegistry];
  }

  /**
   * Obtiene todos los resultados previos vinculados a hipótesis asociadas para guiar decisiones futuras.
   */
  public static getOutcomesForHypothesis(hypothesisId: string): DecisionOutcome[] {
    const outcomes: DecisionOutcome[] = [];
    for (const outcome of this.outcomeRegistry) {
      const mappedHypId = this.decisionToHypothesisMap.get(outcome.decisionId);
      if (mappedHypId === hypothesisId) {
        outcomes.push(outcome);
      }
    }
    return outcomes;
  }

  /**
   * Limpia el registro en memoria (útil para aislar suites de pruebas).
   */
  public static clearRegistry() {
    this.outcomeRegistry = [];
    this.decisionToHypothesisMap.clear();
  }
}
