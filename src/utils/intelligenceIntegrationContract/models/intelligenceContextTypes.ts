import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport, HIEValidationVector } from "../../analyticalConsistencyEngine/models/aceTypes";

export interface CapabilityStatus {
  statisticalEvidence: boolean;
  visualEvidence: boolean;
  territorialEvidence: boolean;
  gangIntelligence: boolean;
  osintEvidence: boolean;
  socialIntelligence: boolean;
}

export interface IntelligenceModules {
  statistical: boolean;
  territorial: boolean;
  visual: boolean;
  gang: boolean;
  osint: boolean;
  social: boolean;
}

export type AnalysisReadiness = "READY" | "READY_WITH_LIMITATIONS" | "NOT_READY";

export interface OperationalAssessment {
  evidenceAgreement: "HIGH" | "MEDIUM" | "LOW";
  supportedPatterns: string[];
  unresolvedQuestions: string[];
  limitations: string[];
}

export interface IntelligenceIntegrationContext {
  metadata: {
    projectId: string;
    generatedAt: string;
    version: string;
  };

  evidenceSources: {
    SEM: StatisticalEvidenceMatrix;
    VEE: VisualEvidenceMatrix | null;
    TIE: TerritorialEvidenceMatrix | null;
    HIE: HIEValidationVector | null;
    CIE: any | null; // Cartographic Intelligence Engine (CIE) result
    ACE: AnalyticalConsistencyReport;
  };

  operationalAssessment: OperationalAssessment;

  capabilityStatus: CapabilityStatus;
  intelligenceModules: IntelligenceModules;
  analysisReadiness: AnalysisReadiness;

  provenance: {
    source: string;
    engineVersion: string;
    generatedAt: string;
    confidence: number;
  };

  qualityControl: {
    status: "PASS" | "WARNING" | "FAILED";
    aceReference: string;
  };
}
