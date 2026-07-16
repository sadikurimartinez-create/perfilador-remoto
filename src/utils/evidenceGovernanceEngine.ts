import { EvidenceReliabilityEngine } from "./evidenceReliabilityEngine";

export type EvidenceType =
  | "FIELD_PHOTO"
  | "STREET_VIEW"
  | "CRIME_STATISTICS"
  | "OSINT"
  | "GIS_LAYER"
  | "DENUE"
  | "SOCIAL_MEDIA"
  | "DOCUMENT"
  | "TESTIMONY";

export type EvidenceNature =
  | "OBSERVACIONAL"
  | "ESTADISTICA"
  | "DOCUMENTAL"
  | "DERIVADA";

export type EvidenceValidationState =
  | "REGISTRADA"
  | "VALIDADA"
  | "OBSERVADA"
  | "DESCARTADA";

export type EvidenceReliability =
  | "ALTA"
  | "MEDIA"
  | "BAJA";

export interface EvidenceUsageEvent {
  fecha: number;
  capituloDestino: string;
  analisisDondeSeUso: string;
  autorCambio: string;
}

export interface IntelligenceEvidenceObject {
  id: string;
  expedienteId: string;
  tipo: EvidenceType;
  naturaleza: EvidenceNature;
  fuente: string;
  fechaCaptura: number;
  capturadaPor: string;
  descripcion: string;
  ubicacion?: string;
  archivoReferencia?: string;
  
  // Relación ADR-011
  hipotesisRelacionadas: string[];
  
  // Capacidad analítica permitida y limitaciones
  capacidadesInferenciales: string[];
  limitacionesInferenciales: string[];
  
  pesoEvidencial: number; // 0-100 calculado por EvidenceReliabilityEngine
  nivelConfiabilidad: EvidenceReliability; // ALTA | MEDIA | BAJA
  estadoValidacion: EvidenceValidationState;
  
  validada: boolean; // Para retrocompatibilidad simple, equivale a estadoValidacion === "VALIDADA"
  isIAGenerated?: boolean; // Para control EGE-5 de evidencia primaria
  
  historialUso: EvidenceUsageEvent[];
}

export class EvidenceGovernanceEngine {
  /**
   * Registra y valida una nueva evidencia bajo las reglas de gobernanza institucional.
   */
  public static registerEvidence(
    evidence: Omit<IntelligenceEvidenceObject, "id" | "pesoEvidencial" | "nivelConfiabilidad" | "validada" | "historialUso">
  ): IntelligenceEvidenceObject {
    const id = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Cálculo automático de confiabilidad y peso epistemológico inicial
    const ageDays = Math.floor((Date.now() - evidence.fechaCaptura) / (1000 * 60 * 60 * 24));
    const pesoEvidencial = EvidenceReliabilityEngine.calculateWeight(
      evidence.naturaleza,
      evidence.estadoValidacion,
      evidence.tipo,
      ageDays
    );
    const nivelConfiabilidad = EvidenceReliabilityEngine.determineReliability(
      pesoEvidencial,
      evidence.estadoValidacion
    );

    return {
      ...evidence,
      id,
      pesoEvidencial,
      nivelConfiabilidad,
      validada: evidence.estadoValidacion === "VALIDADA",
      historialUso: []
    };
  }

  /**
   * Vincula una evidencia a un planteamiento de hipótesis del ADR-011.
   */
  public static linkEvidenceToHypothesis(
    evidence: IntelligenceEvidenceObject,
    hypothesisId: string
  ): IntelligenceEvidenceObject {
    const linked = [...(evidence.hipotesisRelacionadas || [])];
    if (!linked.includes(hypothesisId)) {
      linked.push(hypothesisId);
    }
    return {
      ...evidence,
      hipotesisRelacionadas: linked
    };
  }

  /**
   * Registra un evento de trazabilidad cada vez que un capítulo o IA consuma la evidencia.
   */
  public static logEvidenceUsage(
    evidence: IntelligenceEvidenceObject,
    capituloDestino: string,
    analisisDondeSeUso: string,
    autorCambio = "Analista Responsable"
  ): IntelligenceEvidenceObject {
    const usageEvent: EvidenceUsageEvent = {
      fecha: Date.now(),
      capituloDestino,
      analisisDondeSeUso,
      autorCambio
    };
    return {
      ...evidence,
      historialUso: [...(evidence.historialUso || []), usageEvent]
    };
  }

  /**
   * Valida si una inferencia pretendida cumple con los umbrales de capacidad inferencial de la evidencia.
   */
  public static validateInferenceThreshold(
    evidence: IntelligenceEvidenceObject,
    inferenciaSolicitada: string
  ): boolean {
    if (evidence.estadoValidacion === "DESCARTADA") return false;

    // Verificar si la inferencia viola límites declarados
    const normalizedInferencia = inferenciaSolicitada.toLowerCase();
    const isLimited = (evidence.limitacionesInferenciales || []).some(limit => 
      normalizedInferencia.includes(limit.toLowerCase())
    );
    if (isLimited) return false;

    // Verificar si cumple con alguna capacidad analítica declarada
    const hasCapability = (evidence.capacidadesInferenciales || []).some(cap => 
      normalizedInferencia.includes(cap.toLowerCase())
    );
    
    // Si no tiene capacidades definidas, por defecto permitimos el paso si no viola limitaciones directas
    if ((evidence.capacidadesInferenciales || []).length === 0) {
      return !isLimited;
    }

    return hasCapability;
  }
}
