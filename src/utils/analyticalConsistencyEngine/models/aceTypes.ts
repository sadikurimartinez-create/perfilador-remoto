import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { ACEGimPayload } from "../../gangIntelligenceEngine/adapters/gimToAceAdapter";

export interface HIEValidationVector {
  spatialPattern: "CONCENTRATED" | "DISPERSED" | "STABLE" | "UNIFORM";
  temporalPattern: "SEASONAL" | "STABLE" | "TRENDING";
  criticalOpportunity: "HIGH" | "MEDIUM" | "LOW";
}

export interface ACEPayload {
  projectId: string;
  tceContext: {
    centroid: { lat: number; lng: number };
    radiusMeters: number;
    startDate: string;
    endDate: string;
  };
  sieEventsCount: number;
  semContext: StatisticalEvidenceMatrix;
  cieContext: {
    centroid: { lat: number; lng: number };
    radiusMeters: number;
    eventsCount: number;
    hotspotsCount: number;
  };
  hieContext: {
    validationVector: HIEValidationVector; // Vector estructurado semántico (Ajuste 3)
  };
  reportContext: {
    mapCount: number;
    chartsCount: number;
    startDate: string;
    endDate: string;
    eventsCount: number;
  };
  gimContext?: ACEGimPayload | null;
}

export interface ACEAlert {
  type: "QUANTITATIVE" | "SPATIAL" | "TEMPORAL" | "CRIMINOLOGICAL" | "DOCUMENT";
  category: "TECHNICAL" | "ANALYTICAL"; // Clasificación de alertas (Ajuste 2)
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  source: string;
  expected?: any;
  received?: any;
}

export interface ACEBlockingReason {
  module: "QUANTITATIVE" | "SPATIAL" | "TEMPORAL" | "CRIMINOLOGICAL" | "DOCUMENT";
  variable: string;
  expected: any;
  received: any;
  message: string;
}

export interface ACEAuditLog {
  date: string;
  execution: "EXPORT" | "VALIDATE";
  status: "PASS" | "WARNING" | "FAILED";
  warnings: number;
  aceVersion: string;
}

export interface AnalyticalConsistencyReport {
  metadata: {
    projectId: string;
    auditedAt: string;
    aceVersion: string;
  };
  
  quantitativeConsistency: {
    status: "PASS" | "WARNING" | "FAILED";
    difference: number;
    severity: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  };
  
  spatialConsistency: {
    status: "PASS" | "WARNING" | "FAILED";
    centroidDistanceMeters: number;
    radiusDifferencePercentage: number;
  };
  
  temporalConsistency: {
    status: "PASS" | "WARNING" | "FAILED";
    coverageInconsistent: boolean;
  };
  
  criminologicalConsistency: {
    status: "PASS" | "WARNING" | "FAILED";
    hypothesisContradictory: boolean;
  };
  
  documentConsistency: {
    status: "PASS" | "WARNING" | "FAILED";
    mapsOrChartsInconsistent: boolean;
  };
  
  globalStatus: "PASS" | "WARNING" | "FAILED";
  overallConfidence: number; // Nivel de confianza global de auditoría (Ajuste 4)
  alerts: ACEAlert[];
  
  blockingReason?: ACEBlockingReason[]; // Detalles legibles e institucionales de bloqueo (Ajuste 1)
  auditHistory?: ACEAuditLog[]; // Registro histórico de auditorías (Ajuste 5)
  certifiedGimOutput?: CertifiedGangAnalysisPayload | null; // Salida certificada GIM autorizada para publicación
  certifiedOsintOutput?: CertifiedOSINTAnalysisPayload | null; // Salida certificada OSINT autorizada para publicación (ADR-009.11)
}

export interface CertifiedOSINTAnalysisPayload {
  schemaVersion: "OSINT-CERT-1.0";
  validationStatus: "CERTIFIED" | "CERTIFIED_WITH_LIMITATIONS" | "NOT_CERTIFIED";
  validatedByACE: boolean;
  qualitySummary: string[];
  analyticalFindings: string[];
  limitations: string[];
  territorialSummary: string[];
  traceabilityReference: string;
  generatedAt: string;
}

export interface CertifiedGangAnalysisPayload {
  schemaVersion: "GIM-REPORT-1.0";
  validationStatus: "CERTIFIED" | "READY_WITH_LIMITATIONS" | "NOT_CERTIFIED";
  confidenceScore: number;
  validatedByACE: boolean;
  humanValidationStatus?: "NOT_REQUIRED" | "READY_FOR_HUMAN_REVIEW" | "APPROVED" | "REJECTED";
  validatedByUserId?: string | null;
  humanValidatedAt?: string | null;
  limitations: string[];
  analyticalFindings: string[];           // Listado de afirmaciones cualitativas seguras y neutralizadas
  territorialSummary: string[];           // Listado de zonas geográficas sanitizadas
  evidenceSummary: string[];              // Recuento de evidencias factuales visuales y OSINT
  traceabilityReference: string;          // Hash único para auditoría pública y trazabilidad legal
  lineage?: {
    evidenceIds: string[];
    findingIds: string[];
    analysisIds: string[];
    providerProvenance: string[];
  };
}
