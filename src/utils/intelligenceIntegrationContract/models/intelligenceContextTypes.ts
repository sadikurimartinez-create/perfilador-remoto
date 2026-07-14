import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport, HIEValidationVector } from "../../analyticalConsistencyEngine/models/aceTypes";
import { HIEResult } from "../../hypothesisIntelligenceEngine";

export interface EvidenceProvenance {
  source: string;
  engineVersion: string;
  generatedAt: string;
  confidence: number;
}

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

  statisticalEvidence: {
    source: "SEM";
    data: StatisticalEvidenceMatrix;
    provenance: EvidenceProvenance;
  };

  visualEvidence: {
    source: "VEE";
    data: VisualEvidenceMatrix;
    provenance: EvidenceProvenance;
  };

  territorialEvidence: {
    source: "TIE";
    data: TerritorialEvidenceMatrix;
    provenance: EvidenceProvenance;
  };

  hypothesisEvidence: {
    source: "HIE";
    data: HIEResult;
    validationVector?: HIEValidationVector;
    provenance: EvidenceProvenance;
  };

  qualityControl: {
    source: "ACE";
    data: AnalyticalConsistencyReport;
    provenance: EvidenceProvenance;
  };

  operationalAssessment: OperationalAssessment;
  
  validationStatus: "VALIDATED" | "VALID_WITH_LIMITATIONS" | "WARNING" | "FAILED";
}
