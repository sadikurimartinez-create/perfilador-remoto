export interface StandardCrimeRecord {
  id: string;
  delito: string; // Will store the homologated delito_homologado_SAI
  delitoOriginal: string;
  delito_homologado_SAI: string;
  nivel_confianza: number;
  reglas_aplicadas: string[];
  variables_detectadas: string[];
  requiere_revision_humana: boolean;
  tipo_homicidio?: "DOLOSO" | "CULPOSO" | "EJECUCIÓN" | "OTRO";
  fechaStr: string; // YYYY-MM-DD
  horaStr: string; // HH:MM
  lat: number;
  lng: number;
  fechaObj: Date;
  horaNum: number; // 0.0 - 23.99
  diaSemana: number; // 0-6 (0=Domingo)
  colonia: string;
  arma: string;
  violencia: boolean;
  distancia_m: number;
}

export interface ExclusionLog {
  id: number;
  motivo: string;
  registro: any;
}

export interface SIECoreResult {
  metadata: {
    totalEvents: number;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
    generatedAt: string;
    engineVersion: string;
  };
  temporalAnalysis: {
    trendSlope: number;
    trendDirection: "increase" | "decrease" | "stable";
    trendConfidence: number;
    seasonalityIndex: number;
    annualPattern: string; // Mes con mayor cantidad de eventos
    monthlyVariation: number; // Coeficiente de variación de eventos por mes
    seasonalRiskPeriods: string[]; // Rango de días o turnos críticos
    anomalies: { date: string; count: number; deviation: number; severity: "HIGH" | "MEDIUM" | "LOW" }[];
    monthlyDistribution: number[]; // Frecuencia por mes de enero(0) a diciembre(11)
    weeklyDistribution: number[]; // Frecuencia de Domingo(0) a Sábado(6)
    hourlyDistribution: number[]; // Frecuencia por hora (0-23)
  };
  spatialAnalysis: {
    centerOfGravity: { lat: number; lng: number };
    dispersionMeters: number; // Desviación estándar espacial en metros (Standard Distance)
    spatialEntropy: number; // Shannon Entropy espacial
    spatialEntropyInterpretation: "concentrated" | "distributed";
    clusters: {
      id: string;
      center: { lat: number; lng: number };
      pointsCount: number;
      pointsList: string[]; // lista de ids de incidentes
    }[];
    hotspots: {
      id: string;
      center: { lat: number; lng: number };
      events: number;
      densityScore: number; // Eventos / Area de buffer del clúster
    }[];
  };
  predictiveAnalysis: {
    poissonProbabilityTomorrow: number; // 0.0 - 1.0
    poissonProbabilityWeekly: number; // 0.0 - 1.0
    poissonExpectedEventsWeekly: number;
    poissonModelFitScore: number; // Chi-Square p-value
    poissonModelValidity: boolean;
    nearRepeatScore: number; // 0-100% de tasa de contagio
    riskZones: { lat: number; lng: number; radiusMeters: number; riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" }[];
  };
  qualityMetrics: {
    completenessPercentage: number;
    excludedRecordsCount: number;
    recordsTrawledCount: number;
  };
  exclusionLogs: ExclusionLog[];
}
