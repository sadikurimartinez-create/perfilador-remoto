import type {
  CrimeCoverageStatus,
  CrimeDatasetValidationStatus,
  CrimeIncidenceQuerySource,
  CrimeIncidenceSourceStatus,
  CrimeQueryLineage,
} from "@/utils/crimeIncidenceCanonicalPipeline";

export const CRIME_INCIDENCE_INSTITUTIONAL_BRANDING = {
  institutionHeader: "Centro de Estudios en Seguridad y Política Criminal",
  institutionFooter: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
  watermark: "CEIPOL",
} as const;

export type CrimeIncidenceAnalyticLevel =
  | "DESCRIPTIVE"
  | "ASSOCIATIVE"
  | "INFERENTIAL"
  | "PREDICTIVE";

export type CrimeIncidenceQueryGeometry =
  | {
      mode: "POINT_RADIUS";
      geometry: { type: "Point"; coordinates: [number, number] };
      radiusMeters: number;
    }
  | {
      mode: "CORRIDOR_COVERAGE";
      geometry: { type: "LineString"; coordinates: Array<[number, number]> };
      corridorWidthMeters?: number;
    }
  | {
      mode: "POLYGON_BOUNDARY";
      geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
    };

export interface CrimeIncidenceDatasetCoverage {
  temporal?: {
    start: string | null;
    end: string | null;
    status: "KNOWN" | "TEMPORAL_COVERAGE_UNKNOWN";
  };
  geographic?: CrimeCoverageStatus;
}

export interface CrimeIncidenceDatasetProvenance {
  datasetId?: string;
  datasetVersion?: string;
  sourceFile?: string;
  sourceReference?: string;
  ingestedAt?: string;
  recordCount?: number;
  acceptedCount?: number;
  rejectedCount?: number;
  deduplicatedCount?: number;
  validationStatus?: CrimeDatasetValidationStatus;
  coverage?: CrimeIncidenceDatasetCoverage;
  lineage?: CrimeQueryLineage;
}

export interface CanonicalCrimeIncident {
  id: string;
  incidentType: string | null;
  occurredDate: string | null;
  occurredTime: string | null;
  timeRange: string | null;
  coordinates: {
    lat: number | null;
    lng: number | null;
    originalLat: number | null;
    originalLng: number | null;
  };
  location: {
    municipality?: string;
    neighborhood?: string;
    street?: string;
    reference?: string;
  };
  source: {
    querySource: CrimeIncidenceQuerySource;
    sourceStatus: CrimeIncidenceSourceStatus;
    sourceFile?: string;
    datasetId?: string;
    datasetVersion?: string;
    sourceReference?: string;
  };
  coverage: CrimeIncidenceDatasetCoverage;
  geoValidation: string | null;
  lineage: CrimeQueryLineage;
  rawReference?: string;
  distanceMeters?: number;
}

export interface CrimeIncidenceQueryEnvelope {
  records: CanonicalCrimeIncident[];
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  coverageStatus: CrimeCoverageStatus;
  lineage: CrimeQueryLineage;
  bibliography: string | null;
  queryGeometry: CrimeIncidenceQueryGeometry;
  queryParameters: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  dataset: CrimeIncidenceDatasetProvenance;
}

export interface CrimeIncidenceVisualProductMetadata {
  visualId: string;
  visualType: "MAP" | "CHART";
  title: string;
  datasetReference: string;
  variables: string[];
  transformation: string;
  analyticLevel: CrimeIncidenceAnalyticLevel;
  sourceReference: string;
  lineage: CrimeQueryLineage;
  watermark: typeof CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark;
  method?: string;
  limitations?: string[];
  associationDescription?: string;
  predictiveModelReference?: string;
}
