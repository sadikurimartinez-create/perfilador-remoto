import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import { searchReddit } from "@/utils/socialProviders";

function hasRedditBearer(): boolean {
  return Boolean((process.env.PGP_REDDIT_BEARER_TOKEN || process.env.REDDIT_BEARER_TOKEN)?.trim());
}

export class RedditProvider implements IProvider {
  getId(): string {
    return "reddit";
  }

  getName(): string {
    return "Reddit Search API";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_REDDIT !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_REDDIT",
      authType: "Public Search / User-Agent Connection Check",
      geographicCoverage: "Global",
      outputFormat: "JSON (Recent Subreddit Posts)"
    };
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
    const query = params?.query || "Aguascalientes";

    try {
      if (!this.isEnabled()) {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          errors: ["Provider is disabled."]
        };
      }

      if (!hasRedditBearer()) {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          metadata: {
            version: "2.1.0",
            sourceFamily: "REDDIT",
            operationalMode: "NOT_CONFIGURED",
            acquisitionStatus: "NOT_CONFIGURED",
            authoritative: false,
          },
          errors: ["Reddit OAuth Bearer token is not configured."],
        };
      }

      const data = await searchReddit(query);

      const action = params?.action || "search";
      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, data, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, data, normalized);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        metadata: { version: "2.1.0" },
        ...provenance
      };
    } catch (err: any) {
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
    if (!hasRedditBearer()) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: "Reddit OAuth Bearer token is not configured.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "unknown",
        availability: 0,
        recordsCount: 0,
      };
    }

    try {
      const data = await searchReddit("ping");
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "Reddit OAuth search is responsive.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount: data.length,
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
