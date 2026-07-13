import { SIECoreResult } from "../../statisticalIntelligenceEngineV2/models/statisticalTypes";

export interface StatisticalEvidenceMatrix {
  metadata: {
    projectId: string;
    analysisDate: string;
    sieVersion: string;
    semVersion: string;
    totalCanonicalIncidents: number;
    analysisRadiusMeters: number;
    centerLat: number;
    centerLng: number;
  };
  
  criminalEvidence: {
    totalEvents: number;
    crimeTypes: { type: string; count: number }[];
    dominantCrime: string;
    concentrationScore: number; // Porcentaje que representa el delito dominante del total
  };
  
  temporalEvidence: {
    trendDirection: "increase" | "decrease" | "stable";
    trendSlope: number;
    seasonalityIndex: number;
    criticalPeriods: string[];
    anomalies: { date: string; count: number; deviation: number; severity: "HIGH" | "MEDIUM" | "LOW" }[];
    temporalCoverage: {
      startDate: string;
      endDate: string;
    };
  };
  
  spatialEvidence: {
    hotspots: { id: string; center: { lat: number; lng: number }; events: number; densityScore: number }[];
    clusterCount: number;
    centerOfGravity: { lat: number; lng: number };
    dispersionMeters: number;
    entropy: number;
    spatialPattern: string; // "Alta Concentración", "Dispersión Uniforme", etc.
  };
  
  predictiveEvidence: {
    poissonProbability: number;
    nearRepeatRisk: number;
    modelFit: boolean;
    confidenceMetrics: {
      statisticalConfidence: number; // Kendall's Tau, p-value, etc. (0-100)
      operationalReliability: number; // Utilidad práctica, tamaño de muestra (0-100)
    };
  };
  
  qualityEvidence: {
    dataCompleteness: number; // Porcentaje de completitud de campos críticos
    statisticalValidity: boolean;
    warnings: string[];
    validationStatus: "VALIDATED" | "WARNING" | "FAILED";
  };
  
  limitations: {
    type: "SPATIAL" | "TEMPORAL" | "PREDICTIVE" | "QUALITY";
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
  }[];
  
  variableTraceability: {
    totalEvents: VariableTrace;
    hotspots: VariableTrace;
    poissonRisk: VariableTrace;
    trend: VariableTrace;
  };
  
  intelligenceReadiness: {
    availableForHIE: boolean;
    availableForCIE: boolean;
    availableForReport: boolean;
  };
  
  traceability: {
    source: "historicalIncidents";
    sieVersion: string;
    semVersion: string;
    methodsUsed: string[];
    generatedAt: string;
  };
}

export interface VariableTrace {
  source: string; // e.g. "SIE-SSM-DBSCAN"
  engine: string; // e.g. "Statistical Intelligence Engine"
  version: string; // e.g. "2.0"
  timestamp: string;
}
