export interface EconomicAttractor {
  id: string;
  name: string;
  activityCode: string;
  category: "COMERCIO" | "ESCUELA" | "SERVICIO" | "PARQUE" | "TRANSPORTE" | "PUNTO_REUNION";
  address: string;
  lat: number;
  lng: number;
  coordinates?: { lat: number; lng: number };
  sourceEvidenceId?: string;
  traceabilityId?: string;
  expedienteId?: string;
  geographyId?: string;
  geographyType?: string;
  source?: string;
  provider?: string;
  epistemicIntegrity?: unknown;
  observedAt?: string | null;
  acquiredAt?: string | null;
  rawSourceReference?: string;
  sourceReference?: string;
  territorialStatus?: string;
  publicationRole?: "TERRITORIAL_CONTEXT";
  semanticRole?: "SOURCE_FACT";
  evidenceDomain?: "TERRITORIAL_CONTEXT";
  isCriminalEvidence?: false;
  distanceToHotspotMeters: number;
  situationalInfluenceLevel: "HIGH" | "MEDIUM" | "LOW";
  criminologicalRole: string; // Exposición, concentración temporal, permanencia, movilidad
}

export interface UrbanStructure {
  landUse: string; // Residencial, comercial, mixto, industrial
  streetGridType: "GRID" | "ORGANIC" | "LINEAR" | "CUL_DE_SAC";
  vesselVulnerability: "HIGH" | "MEDIUM" | "LOW";
  permeabilityScore: number; // 0-100
}

export interface MobilityFactor {
  transportNodeCount: number;
  mainAccessPoints: string[];
  vulnerabilityDescription: string;
  pedestrianExposure: "HIGH" | "MEDIUM" | "LOW";
}

export interface EnvironmentalRiskFactor {
  lightingScore: "SUFFICIENT" | "DEFICIENT" | "CRITICAL";
  visibilityObstructions: string[]; // vegetación, bardas continuas, matorrales
  abandonedLotsCount: number;
  structuralDeterioration: "HIGH" | "MEDIUM" | "LOW";
}

export interface OperationalImplication {
  directiveType: "PATROL_INCREASE" | "PHYSICAL_REMEDIATION" | "COMMUNITY_SURVEILLANCE" | "TACTICAL_POINT";
  locationReference: string;
  rationale: string;
}

export interface TerritorialPressureIndex {
  hotspotProximityScore: number; // 0-100
  attractorDensityScore: number; // 0-100
  mobilityExposureScore: number; // 0-100
  environmentalVulnerabilityScore: number; // 0-100
}

export interface TerritorialEvidenceMatrix {
  projectId: string;
  projectName: string;
  temVersion: string;
  territorialContext: {
    tipologyName: string;
    areaSizeMeters: number;
    description: string;
  };
  urbanStructure: UrbanStructure;
  economicAttractors: EconomicAttractor[];
  mobilityFactors: MobilityFactor;
  environmentalRiskFactors: EnvironmentalRiskFactor;
  territorialPressure: TerritorialPressureIndex;
  operationalImplications: OperationalImplication[];
  traceability: {
    variablesQueried: string[];
    denueVersion: string;
    queryTimestamp: string;
  };
  confidence: {
    operationalConfidence: number; // 0-100
    evidenceSupportCount: number;
  };
  validationStatus: "VALIDATED" | "WARNING" | "FAILED";
}
