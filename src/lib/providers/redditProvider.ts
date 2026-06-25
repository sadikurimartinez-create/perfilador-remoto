import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { searchReddit } from "@/utils/socialProviders";

export class RedditProvider implements IProvider {
  getId(): string {
    return "reddit";
  }

  getName(): string {
    return "Reddit Search API";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_REDDIT !== "false" && !!(
      process.env.PGP_REDDIT_USER_AGENT || process.env.NEXT_PUBLIC_PGP_REDDIT_USER_AGENT || "Mozilla/5.0"
    );
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_REDDIT",
      authType: "Public Search / User-Agent",
      geographicCoverage: "Global",
      outputFormat: "JSON (Recent Subreddit Posts)"
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
          errors: ["Provider is disabled via ENABLE_REDDIT."]
        };
      }

      const data = await searchReddit(query);

      console.log(`[LOG] Provider: reddit | Action: search | Status: ok | Duration: ${Date.now() - start}ms`);

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
      console.error(`[LOG] Provider: reddit | Exception: ${err.message || String(err)}`);
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
          details: "Reddit Provider is disabled via ENABLE_REDDIT.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const userAgent = process.env.PGP_REDDIT_USER_AGENT || "Mozilla/5.0";
      const url = "https://www.reddit.com/search.json?q=ping&limit=1";
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent }
      });
      
      if (!res.ok) {
        throw new Error(`Reddit API returned HTTP status ${res.status}`);
      }

      const data = await res.json();
      const recordsCount = data?.data?.children?.length || 0;

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "Reddit search API is responsive.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "bypassed", // public open json api
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
