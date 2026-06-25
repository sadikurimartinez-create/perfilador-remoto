import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { searchX } from "@/utils/socialProviders";

export class XProvider implements IProvider {
  getId(): string {
    return "x";
  }

  getName(): string {
    return "X / Twitter API";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_X !== "false" && !!(
      process.env.PGP_X_BEARER_TOKEN || process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN || process.env.PGP_X_ACCESS_TOKEN || process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN
    );
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_X",
      authType: "X Developer Bearer Token",
      geographicCoverage: "Global",
      outputFormat: "JSON (Recent Tweets / Georeferenced Status)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const query = params?.query || "Aguascalientes";
    const errors: string[] = [];

    try {
      if (!this.isEnabled()) {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          errors: ["Provider is disabled via ENABLE_X."]
        };
      }

      const data = await searchX(query);

      console.log(`[LOG] Provider: x | Action: search | Status: ok | Duration: ${Date.now() - start}ms`);

      const lat = params?.lat || 21.8853;
      const lng = params?.lng || -102.2916;
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
      console.error(`[LOG] Provider: x | Exception: ${err.message || String(err)}`);
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
      const token = process.env.PGP_X_BEARER_TOKEN || process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN || process.env.PGP_X_ACCESS_TOKEN || process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN || "";
      if (!this.isEnabled() || !token) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "X Provider is disabled or Bearer Token is missing.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const url = "https://api.twitter.com/2/tweets/search/recent?query=ping&max_results=10";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`X/Twitter API returned HTTP status ${res.status}`);
      }

      const data = await res.json();
      const recordsCount = data?.meta?.result_count || 0;

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "X/Twitter API bearer token validated successfully.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount
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
