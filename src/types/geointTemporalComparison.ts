/**
 * ADR-019 v1.0 — GEOINT Temporal Comparative Evidence Engine
 * Contratos de datos y taxonomía oficial de valoración probatoria.
 */

export type EvidenceClass = "EVIDENCIA_PRIMARIA_CAMPO" | "EVIDENCIA_CONTEXTUAL_TEMPORAL";

export type ComparisonType = "TEMPORAL_VISUAL_DELTA" | "VARIABILITY_STRUCTURAL" | "ENVIRONMENTAL_CHANGE";

export type AnalystValidationStatus = "PENDING_REVIEW" | "APPROVED_EVIDENCE" | "REJECTED_FINDING";

export interface PrimaryEvidenceRef {
  id: string;
  code: string; // ej. EV-00123
  title?: string;
  url: string;
  evidenceClass: "EVIDENCIA_PRIMARIA_CAMPO";
  timestamp: string; // Fecha de inspección en campo
  lat?: number;
  lng?: number;
}

export interface ContextualEvidenceRef {
  id: string;
  code: string; // ej. SV-00456
  title?: string;
  url: string;
  evidenceClass: "EVIDENCIA_CONTEXTUAL_TEMPORAL";
  panoramaTimestamp: string; // Fecha disponible del panorama Street View
  lat?: number;
  lng?: number;
  heading?: number;
}

export interface TemporalComparisonAiAnalysis {
  temporalDeltaDays: number;
  temporalDeltaFormatted: string; // ej. "1,255 días (3.4 años)"
  observedChanges: string[];
  structuralModifications: string[];
  riskDiscrepancies: string[];
  confidenceScore: number;
  calibratedObservation: string; // Texto redactado con lenguaje temporal gobernado
}

export interface EvidenceComparison {
  comparisonId: string;
  projectId: string;
  primaryEvidence: PrimaryEvidenceRef;
  contextualEvidence: ContextualEvidenceRef;
  comparisonType: ComparisonType;
  createdBy: string;
  createdAt: string;
  aiAnalysis: TemporalComparisonAiAnalysis;
  analystValidationStatus: AnalystValidationStatus;
  validationComment?: string;
  validatedBy?: string;
  validatedAt?: string;
}
