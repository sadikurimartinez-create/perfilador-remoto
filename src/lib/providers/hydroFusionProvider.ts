import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import { NoaaProvider } from "./noaa_provider";
import { ConaguaProvider } from "./conaguaProvider";
import { CenapredProvider } from "./cenapredProvider";
import { SemanticConfidenceEngine, SemanticAnalysisResult } from "../infra/semanticConfidenceEngine";

export interface UnifiedHydroDataset {
  fused_at: string;
  location: { lat: number; lng: number };
  confidence_score: number;
  sources_used: string[];
  noaa: {
    precipitation_mm: number;
    hourly_rate: number;
    active_storms: any[];
    soil_saturation_proxy: number;
    is_simulated: boolean;
  };
  conagua: {
    dams: any[];
    river_channels: any[];
    alerts: string[];
    is_simulated: boolean;
  };
  cenapred: {
    flood_susceptibility: "Alta" | "Media" | "Baja";
    slope_instability: "Alta" | "Baja";
    vulnerability_score: number;
    historical_incidents: any[];
    is_simulated: boolean;
  };
  fused_metrics: {
    precipitation_mm_hr: number;
    soil_saturation: number;
    dam_risk_factor: number;
    river_risk_factor: number;
    susceptibility_weight: number;
    vulnerability_index: number;
    combined_physical_risk: number; // calculated physical truth index [0, 1]
  };
  semantic_analysis?: SemanticAnalysisResult;
}

export class HydroFusionProvider implements IProvider {
  // Simple in-memory cache to prevent redundant queries (10 min TTL)
  private static cache: Map<string, { data: any; expiry: number }> = new Map();
  private static CACHE_TTL_MS = 10 * 60 * 1000;

  getId(): string {
    return "hydro_fusion";
  }

  getName(): string {
    return "GEOINT Coordinated HydroFusion Core Provider";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_HYDRO_FUSION !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "1.0.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_HYDRO_FUSION",
      authType: "Coordinated Multi-Provider Aggregation Layer",
      geographicCoverage: "Mexico & Global Meteorological Overlays",
      outputFormat: "JSON (UnifiedHydroDataset)"
    };
  }

  private getCacheKey(lat: number, lng: number): string {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    
    const geoValidation = validateGeoIntegrity(params?.lat, params?.lng);
    if (geoValidation.confidence === "UNKNOWN" || geoValidation.latitude === null || geoValidation.longitude === null) {
      return {
        provider: this.getId(),
        status: "error",
        timestamp: new Date().toISOString(),
        confidence: 0,
        payload: null,
        latency: Date.now() - start,
        errors: ["Ausencia de coordenadas geográficas válidas. Consulta cancelada para preservar la integridad."]
      };
    }
    const lat = geoValidation.latitude;
    const lng = geoValidation.longitude;
    const errors: string[] = [];

    const cacheKey = this.getCacheKey(lat, lng);
    const cached = HydroFusionProvider.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      const duration = Date.now() - start;
      console.log(`[LOG] Provider: hydro_fusion | Cache HIT | Duration: ${duration}ms`);
      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: cached.data.confidence?.score || 95,
        payload: cached.data,
        latency: duration,
        metadata: { version: "1.0.0", cache_hit: true }
      };
    }

    try {
      if (!this.isEnabled()) {
        throw new Error("GEOINT HydroFusion Provider is disabled via feature flags.");
      }

      // Instantiate underlying high-fidelity adapters
      const noaa = new NoaaProvider();
      const conagua = new ConaguaProvider();
      const cenapred = new CenapredProvider();

      // Query adapters in parallel with safe error boundaries
      const [noaaPrecip, noaaStorm, noaaTemp, conaguaHydro, cenapredRisk] = await Promise.allSettled([
        noaa.fetchData({ ...params, action: "precipitation" }),
        noaa.fetchData({ ...params, action: "storm_events" }),
        noaa.fetchData({ ...params, action: "temperature_anomalies" }),
        conagua.fetchData({ ...params, action: "hydrology" }),
        cenapred.fetchData({ ...params, action: "risk_assessment" })
      ]);

      // 1. Process NOAA metrics
      let noaa_precip_mm = 0.0;
      let noaa_hourly_rate = 0.0;
      let noaa_active_storms: any[] = [];
      let noaa_soil_saturation = 0.42;
      let noaa_is_simulated = false;

      if (noaaPrecip.status === "fulfilled" && noaaPrecip.value.status === "ok") {
        const resp = noaaPrecip.value;
        noaa_is_simulated = !!resp.metadata?.is_simulated || !!resp.raw_payload?.source?.includes("Simulated");
        const raw = resp.raw_payload;
        if (raw) {
          noaa_precip_mm = raw.precipitation_mm ?? raw.daily_summary?.precipitation_mm ?? 0.0;
          noaa_hourly_rate = raw.hourly_rate ?? raw.daily_summary?.hourly_rate ?? 0.0;
        }
      } else if (noaaPrecip.status === "rejected") {
        errors.push(`NOAA Precipitation failed: ${noaaPrecip.reason?.message || String(noaaPrecip.reason)}`);
      }

      if (noaaStorm.status === "fulfilled" && noaaStorm.value.status === "ok") {
        const resp = noaaStorm.value;
        const raw = resp.raw_payload;
        if (raw && Array.isArray(raw.active_storms)) {
          noaa_active_storms = raw.active_storms;
        }
      } else if (noaaStorm.status === "rejected") {
        errors.push(`NOAA Storm Events failed: ${noaaStorm.reason?.message || String(noaaStorm.reason)}`);
      }

      if (noaaTemp.status === "fulfilled" && noaaTemp.value.status === "ok") {
        const resp = noaaTemp.value;
        const raw = resp.raw_payload;
        if (raw) {
          noaa_soil_saturation = raw.soil_saturation_proxy ?? 0.42;
        }
      } else if (noaaTemp.status === "rejected") {
        errors.push(`NOAA Temp Anomalies failed: ${noaaTemp.reason?.message || String(noaaTemp.reason)}`);
      }

      // 2. Process CONAGUA metrics
      let conagua_dams: any[] = [];
      let conagua_river_channels: any[] = [];
      let conagua_alerts: string[] = [];
      let conagua_is_simulated = false;

      if (conaguaHydro.status === "fulfilled" && conaguaHydro.value.status === "ok") {
        const resp = conaguaHydro.value;
        conagua_is_simulated = !!resp.metadata?.is_simulated || !!resp.raw_payload?.source?.includes("Simulator");
        const raw = resp.raw_payload;
        if (raw) {
          if (Array.isArray(raw.monitored_dams)) conagua_dams = raw.monitored_dams;
          if (Array.isArray(raw.river_channels)) conagua_river_channels = raw.river_channels;
          if (raw.general_bulletin) conagua_alerts.push(raw.general_bulletin);
        }
      } else if (conaguaHydro.status === "rejected") {
        errors.push(`CONAGUA Hydrology failed: ${conaguaHydro.reason?.message || String(conaguaHydro.reason)}`);
      }

      // 3. Process CENAPRED risk assessments
      let cenapred_flood_susceptibility: "Alta" | "Media" | "Baja" = "Media";
      let cenapred_slope_instability: "Alta" | "Baja" = "Baja";
      let cenapred_vulnerability_score = 50.0;
      let cenapred_historical_incidents: any[] = [];
      let cenapred_is_simulated = false;

      if (cenapredRisk.status === "fulfilled" && cenapredRisk.value.status === "ok") {
        const resp = cenapredRisk.value;
        cenapred_is_simulated = !!resp.metadata?.is_simulated || !!resp.raw_payload?.source?.includes("Fallback") || !!resp.raw_payload?.source?.includes("Mock");
        const raw = resp.raw_payload;
        if (raw) {
          if (raw.assessment) {
            cenapred_flood_susceptibility = raw.assessment.flood_susceptibility ?? "Media";
            cenapred_slope_instability = raw.assessment.slope_instability ?? "Baja";
            cenapred_vulnerability_score = raw.assessment.vulnerability_score ?? 50.0;
          }
          if (Array.isArray(raw.historical_incidents)) {
            cenapred_historical_incidents = raw.historical_incidents;
          }
        }
      } else if (cenapredRisk.status === "rejected") {
        errors.push(`CENAPRED Risk assessment failed: ${cenapredRisk.reason?.message || String(cenapredRisk.reason)}`);
      }

      // 4. Mathematical Fusion of Physical Indicators
      // Pillar A: Meteorological Severity
      const precip_factor = Math.min(1.0, noaa_precip_mm / 50); // 50mm daily limit
      const storm_factor = noaa_active_storms.length > 0 ? 0.8 : 0.0;
      const weather_risk = Math.max(precip_factor, storm_factor);

      // Pillar B: Hydrological Level & Spill Risk
      let max_dam_pct = 0.0;
      conagua_dams.forEach((dam: any) => {
        if (dam.percentage_capacity > max_dam_pct) {
          max_dam_pct = dam.percentage_capacity;
        }
      });
      const dam_risk_factor = Math.min(1.0, max_dam_pct / 100);

      let max_river_pct = 0.0;
      conagua_river_channels.forEach((river: any) => {
        if (river.capacity_level_percentage > max_river_pct) {
          max_river_pct = river.capacity_level_percentage;
        }
      });
      const river_risk_factor = Math.min(1.0, max_river_pct / 100);
      const hydrology_risk = Math.max(dam_risk_factor, river_risk_factor);

      // Pillar C: Land susceptibility & institutional vulnerability rating
      const susceptibility_weight = cenapred_flood_susceptibility === "Alta" ? 1.0 : cenapred_flood_susceptibility === "Media" ? 0.5 : 0.15;
      const slope_factor = cenapred_slope_instability === "Alta" ? 0.8 : 0.2;
      const vulnerability_index = cenapred_vulnerability_score / 100;
      const terrain_vulnerability_risk = (susceptibility_weight * 0.5) + (slope_factor * 0.2) + (vulnerability_index * 0.3);

      // Semantic Signal Normalization Layer v2 — SEMANTIC CONFIDENCE CONTROLLER
      const semanticAnalysis = SemanticConfidenceEngine.analyze({
        noaa: weather_risk,
        conagua: hydrology_risk,
        cenapred: terrain_vulnerability_risk
      });

      const combined_physical_risk = semanticAnalysis.hydro_truth_score;

      // Compile UnifiedHydroDataset
      const sourcesUsed: string[] = [];
      if (noaaPrecip.status === "fulfilled") sourcesUsed.push("NOAA");
      if (conaguaHydro.status === "fulfilled") sourcesUsed.push("CONAGUA");
      if (cenapredRisk.status === "fulfilled") sourcesUsed.push("CENAPRED");

      const dataset: UnifiedHydroDataset = {
        fused_at: new Date().toISOString(),
        location: { lat, lng },
        confidence_score: Math.round(semanticAnalysis.confidence * 100),
        sources_used: sourcesUsed,
        noaa: {
          precipitation_mm: noaa_precip_mm,
          hourly_rate: noaa_hourly_rate,
          active_storms: noaa_active_storms,
          soil_saturation_proxy: noaa_soil_saturation,
          is_simulated: noaa_is_simulated
        },
        conagua: {
          dams: conagua_dams,
          river_channels: conagua_river_channels,
          alerts: conagua_alerts,
          is_simulated: conagua_is_simulated
        },
        cenapred: {
          flood_susceptibility: cenapred_flood_susceptibility,
          slope_instability: cenapred_slope_instability,
          vulnerability_score: cenapred_vulnerability_score,
          historical_incidents: cenapred_historical_incidents,
          is_simulated: cenapred_is_simulated
        },
        fused_metrics: {
          precipitation_mm_hr: noaa_hourly_rate,
          soil_saturation: noaa_soil_saturation,
          dam_risk_factor,
          river_risk_factor,
          susceptibility_weight,
          vulnerability_index,
          combined_physical_risk
        },
        semantic_analysis: semanticAnalysis
      };

      console.log(`[LOG] Provider: hydro_fusion | Combined Physical Risk: ${combined_physical_risk} | Status: ok | Duration: ${Date.now() - start}ms`);

      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), "latest_continuous", dataset, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), "latest_continuous", dataset, normalized);

      const response: ProviderResponse = {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          version: "1.0.0",
          is_simulated: noaa_is_simulated && conagua_is_simulated && cenapred_is_simulated
        },
        ...provenance
      };

      // Store in Cache
      HydroFusionProvider.cache.set(cacheKey, {
        data: normalized,
        expiry: Date.now() + HydroFusionProvider.CACHE_TTL_MS
      });

      return response;

    } catch (err: any) {
      console.error(`[LOG] Provider: hydro_fusion | Exception: ${err.message || String(err)}`);
      return {
        provider: this.getId(),
        status: "error",
        timestamp: new Date().toISOString(),
        confidence: 0,
        payload: null,
        latency: Date.now() - start,
        errors: [err.message || String(err)]
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      if (!this.isEnabled()) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "HydroFusion Provider is disabled.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      // Check endpoints of components
      const noaa = new NoaaProvider();
      const conagua = new ConaguaProvider();
      const cenapred = new CenapredProvider();

      const [noaaH, conaguaH, cenapredH] = await Promise.all([
        noaa.healthCheck(),
        conagua.healthCheck(),
        cenapred.healthCheck()
      ]);

      const isHealthy = noaaH.isHealthy || conaguaH.isHealthy || cenapredH.isHealthy;

      return {
        isHealthy,
        latencyMs: Date.now() - start,
        details: `HydroFusion aggregate check. NOAA: ${noaaH.isHealthy ? "OK" : "Error"}, CONAGUA: ${conaguaH.isHealthy ? "OK" : "Error"}, CENAPRED: ${cenapredH.isHealthy ? "OK" : "Error"}.`,
        timestamp: new Date().toISOString(),
        authenticationStatus: "bypassed",
        availability: isHealthy ? 100 : 0
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: err.message || String(err),
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0
      };
    }
  }
}
