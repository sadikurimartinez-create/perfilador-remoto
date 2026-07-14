export interface VisualEvidenceInternal {
  id: string;
  source: "ANALYST" | "STREET_VIEW";
  image: string; // Base64 or preview URL
  category: string;
  observation: string;
  riskLevel: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
  lat: number;
  lng: number;
  capturedAt: string;
  relationToHotspot?: string;
  relationToHypothesis?: string;
  graffitiConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface VisualEvidenceEditorial {
  image: string;
  title: string;
  description: string;
  finding: string;
  operationalImpact: string;
}

export interface VisualEvidenceMatrix {
  projectId: string;
  overallVisualConfidence: number;
  analystPhotos: VisualEvidenceEditorial[];
  streetViewEvidence: VisualEvidenceEditorial[];
  graffitiEvidence: VisualEvidenceEditorial[];
  territorialFindings: {
    criticalVulnerabilityCount: number;
    primaryRiskFactor: string;
    impactAreaSqm: number;
  };
  executiveAbstract: string;
  matrix56: {
    evidenceType: string;
    finding: string;
    impact: string;
  }[];
}
