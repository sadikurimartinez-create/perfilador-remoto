export interface ProviderResponse<T = any> {
  provider: string;
  status: "ok" | "error" | "disabled";
  timestamp: string;
  geometry?: any; // geojson-like geometry (Point, Polygon, etc.) if available
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
    name?: string;
  };
  confidence: number; // 0 to 100 percentage of data validity/reliability
  payload: T | null; // normalized specific provider payload
  metadata?: {
    version?: string;
    source_url?: string;
    [key: string]: any;
  };
  license?: string; // data license, if available
  latency: number; // in milliseconds
  errors?: string[]; // array of non-fatal execution errors

  // Data Provenance Layer (Fase 2B.2)
  raw_payload?: any; // original raw data without transformation
  normalized_payload?: any; // output of GeoDataNormalizerEngine
  transformations?: string[]; // list of transformations applied
  confidence_path?: string[]; // factors that determine confidence score
  source_chain?: string[]; // chain of origin from primary source to final API
}

export interface HealthCheckResult {
  isHealthy: boolean;
  latencyMs?: number;
  details?: string;
  timestamp: string;
  authenticationStatus?: "valid" | "invalid" | "bypassed" | "unknown";
  tokenExpiration?: string | null;
  availability?: number; // percentage (e.g. 100)
  recordsCount?: number;
}

export interface IProvider {
  getId(): string;
  getName(): string;
  isEnabled(): boolean;
  fetchData(params: any): Promise<ProviderResponse>;
  healthCheck(): Promise<HealthCheckResult>;
  getCatalogDetails(): {
    name: string;
    version: string;
    status: string;
    featureFlag: string;
    authType: string;
    geographicCoverage: string;
    outputFormat: string;
  };
}
