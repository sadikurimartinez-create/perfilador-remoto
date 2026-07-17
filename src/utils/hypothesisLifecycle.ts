export interface EvidenceReference {
  id: string;
  type: string;
  description: string;
}

export interface GeneralHypothesis {
  id: string;
  type: "GENERAL";
  title: string;
  hypothesis: string;
  analyticalBasis: EvidenceReference[];
  confidenceLevel: "baja" | "media" | "alta";
}

export interface SecondaryAnalyticalFactor {
  type: string;
  description: string;
}

export interface HypothesisLifecycle {
  rawHypotheses: string[];
  hipotesisGeneral: GeneralHypothesis;
  secondaryAnalyticalFactors: SecondaryAnalyticalFactor[];
  consolidationMethod: "manual" | "automatic";
}

export type HypothesisState =
  | "INICIAL"
  | "EN_ANALISIS"
  | "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA"
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

export type ConfidenceLevel =
  | "MUY_BAJO"
  | "BAJO"
  | "MEDIO"
  | "ALTO"
  | "MUY_ALTO";

export interface ConfidenceAdjustmentEvent {
  fecha: number;
  scoreAnterior: number;
  scoreNuevo: number;
  motivo: string;
  evidenciaRelacionada: string[];
  motorResponsable: string;
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
  nivelConfianza: "ALTO" | "MEDIO" | "BAJO"; // Para retrocompatibilidad
  justificacionActual: string;
  historialEvolucion: HypothesisEvolutionEvent[];
  
  // ADR-014
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  confidenceHistory?: ConfidenceAdjustmentEvent[];
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
      historialEvolucion: [],
      confidenceScore: 30, // Score inicial por defecto
      confidenceLevel: "BAJO",
      confidenceHistory: []
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
      historialEvolucion: updatedEvents,
      confidenceScore: hypothesis.confidenceScore,
      confidenceLevel: hypothesis.confidenceLevel,
      confidenceHistory: hypothesis.confidenceHistory || []
    };
  }
}
