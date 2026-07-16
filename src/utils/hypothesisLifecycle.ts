export type HypothesisState =
  | "INICIAL"
  | "EN_ANALISIS"
  | "CONFIRMADA"
  | "REFUTADA"
  | "MODIFICADA"
  | "FENOMENO_CONFIRMADO";

export type EvolutionType =
  | "CONFIRMACION"
  | "REFUTACION"
  | "AMPLIACION"
  | "REORIENTACION";

export interface HypothesisEvolutionEvent {
  fecha: number;
  estadoAnterior: HypothesisState;
  estadoNuevo: HypothesisState;
  tipoCambio: EvolutionType;
  evidenciaRelacionada: string[]; // IDs de fotos o fuentes estadísticas
  justificacionAnalitica: string;
  motorQueGeneroCambio: string; // p. ej. "VisualEvidenceEngine", "Analista", "StatisticalEngine"
  usuarioResponsable: string;
}

export interface InvestigationHypothesis {
  id: string;
  expedienteId: string;
  hipotesisInicial: string; // Pregunta u origen original
  hipotesisActual: string;  // Interpretación refinada del analista/IA
  variablesIniciales: string[]; // p. ej. "incidencia", "territorio", "actores", "oportunidad"
  estadoActual: HypothesisState;
  evidenciaConfirmatoria: string[];
  evidenciaContradictoria: string[];
  nivelConfianza: "ALTO" | "MEDIO" | "BAJO";
  justificacionActual: string;
  historialEvolucion: HypothesisEvolutionEvent[];
}

export class HypothesisLifecycleManager {
  /**
   * Crea una hipótesis de investigación inicial para un expediente.
   */
  public static create(
    expedienteId: string,
    hipotesisInicial: string,
    variablesIniciales: string[] = ["territorio", "oportunidad", "incidencia"],
    usuario = "Analista Responsable"
  ): InvestigationHypothesis {
    return {
      id: `hyp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      expedienteId,
      hipotesisInicial: hipotesisInicial.trim(),
      hipotesisActual: hipotesisInicial.trim(),
      variablesIniciales,
      estadoActual: "INICIAL",
      evidenciaConfirmatoria: [],
      evidenciaContradictoria: [],
      nivelConfianza: "MEDIO",
      justificacionActual: "Hipótesis inicial registrada por el analista responsable.",
      historialEvolucion: []
    };
  }

  /**
   * Transiciona el estado de una hipótesis registrando un evento de evolución.
   */
  public static transition(
    hypothesis: InvestigationHypothesis,
    newState: HypothesisState,
    tipoCambio: EvolutionType,
    evidencia: string[],
    justificacion: string,
    motor = "Analista",
    usuario = "Analista Responsable"
  ): InvestigationHypothesis {
    const event: HypothesisEvolutionEvent = {
      fecha: Date.now(),
      estadoAnterior: hypothesis.estadoActual,
      estadoNuevo: newState,
      tipoCambio,
      evidenciaRelacionada: evidencia,
      justificacionAnalitica: justificacion,
      motorQueGeneroCambio: motor,
      usuarioResponsable: usuario
    };

    const updatedEvents = [...hypothesis.historialEvolucion, event];
    
    // Si hay evidencia relacionada y el cambio es confirmación, agregar a confirmatoria
    let newConf = [...hypothesis.evidenciaConfirmatoria];
    let newContra = [...hypothesis.evidenciaContradictoria];

    if (tipoCambio === "CONFIRMACION") {
      newConf = Array.from(new Set([...newConf, ...evidencia]));
    } else if (tipoCambio === "REFUTACION") {
      newContra = Array.from(new Set([...newContra, ...evidencia]));
    }

    return {
      ...hypothesis,
      estadoActual: newState,
      evidenciaConfirmatoria: newConf,
      evidenciaContradictoria: newContra,
      justificacionActual: justificacion,
      historialEvolucion: updatedEvents
    };
  }
}
