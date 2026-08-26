/**
 * ADR-019 v1.0 / ADR-019.13 — GEOINT Temporal Comparative Evidence Engine
 * Contratos de datos unificados para la comparación temporal universal GeoEvidence A vs GeoEvidence B y Gobernanza Humana (ADR-019.13-F4).
 */

import { GeoEvidence, GeoEvidenceStatus } from "./geointEvidence";
import { GeointGovernanceStatusValue } from "./geointGovernance";

export type EvidenceClass = "EVIDENCIA_PRIMARIA_CAMPO" | "EVIDENCIA_CONTEXTUAL_TEMPORAL";

export type ComparisonType = "TEMPORAL_VISUAL_DELTA" | "VARIABILITY_STRUCTURAL" | "ENVIRONMENTAL_CHANGE";

export type AnalystValidationStatus = GeointGovernanceStatusValue;

/**
 * Registro de Persistencia de Comparación Temporal ADR-019.8 / ADR-019.13-F4
 */
export interface TemporalComparisonRecord {
  id: string;
  expedienteId: string;
  traceabilityId: string;
  sourceEvidenceId: string;

  evidenceA: {
    id: string;
    traceabilityId: string;
    sourceEvidenceId: string;
    source: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    captureDate?: string;
    imageReference?: string;
  };

  evidenceB: {
    id: string;
    traceabilityId: string;
    sourceEvidenceId: string;
    source: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    captureDate?: string;
    imageReference?: string;
  };

  spatialValidation: {
    compatible: boolean;
    distanceMeters: number;
  };

  temporalValidation: {
    valid: boolean;
    deltaDays?: number;
    status: "VALID" | "FECHA_NO_DISPONIBLE";
  };

  analystValidation: {
    status: AnalystValidationStatus;
    reviewerId?: string;
    reviewedAt?: string;
    comments?: string;
  };

  createdAt: string;
  updatedAt?: string;
}

/**
 * Solicitud de comparación temporal universal entre dos entidades GeoEvidence.
 */
export interface UniversalTemporalComparisonRequest {
  evidenceA: GeoEvidence;
  evidenceB: GeoEvidence;
  analystId?: string;
  comparisonType?: ComparisonType;
  toleranceMeters?: number;
  metadata?: {
    expedienteId?: string;
  };
}

export interface TemporalComparisonAiAnalysis {
  temporalDeltaDays?: number;
  temporalDeltaFormatted?: string; // ej. "1,255 días (~3.4 años)" o "FECHA_NO_DISPONIBLE"
  observedChanges: string[];
  structuralModifications: string[];
  riskDiscrepancies: string[];
  confidenceScore: number;
  calibratedObservation: string;
}

/**
 * Resultado unificado de comparación temporal entre GeoEvidence A y GeoEvidence B.
 */
export interface UniversalEvidenceComparison {
  comparisonId: string;
  expedienteId: string;
  traceabilityId: string;
  sourceEvidenceId: string;
  evidenceA: GeoEvidence;
  evidenceB: GeoEvidence;
  comparisonType: ComparisonType;
  spatialValidation: {
    isCompatible: boolean;
    distanceMeters: number;
    reason?: string;
  };
  temporalValidation: {
    isValid: boolean;
    dateA?: string;
    dateB?: string;
    dateDifferenceDays?: number;
    dateDifferenceFormatted?: string;
  };
  createdBy: string;
  createdAt: string;
  aiAnalysis: TemporalComparisonAiAnalysis;
  analystValidationStatus: AnalystValidationStatus;
  validationComment?: string;
  validatedBy?: string;
  validatedAt?: string;
  persistenceRecord?: TemporalComparisonRecord;
}

/**
 * CONTRATOS LEGACY DE ADAPTACIÓN RETROCOMPATIBLE (ADR-019.13)
 */
export interface PrimaryEvidenceRef {
  id: string;
  code: string;
  title?: string;
  url: string;
  evidenceClass: "EVIDENCIA_PRIMARIA_CAMPO";
  timestamp: string;
  lat?: number;
  lng?: number;
}

export interface ContextualEvidenceRef {
  id: string;
  code: string;
  title?: string;
  url: string;
  evidenceClass: "EVIDENCIA_CONTEXTUAL_TEMPORAL";
  panoramaTimestamp: string;
  lat?: number;
  lng?: number;
  heading?: number;
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
