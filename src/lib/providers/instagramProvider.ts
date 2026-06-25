import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";

export class InstagramProvider implements IProvider {
  getId(): string {
    return "instagram";
  }

  getName(): string {
    return "Instagram Geotags & Hashtags (Simulated)";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_INSTAGRAM !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_INSTAGRAM",
      authType: "Simulated Public Scraper",
      geographicCoverage: "Global via geotags",
      outputFormat: "JSON (Simulated Geotagged Media Metadata)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const locationName = params?.location || "Aguascalientes";
    const now = Date.now();

    try {
      if (!this.isEnabled()) {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          errors: ["Provider is disabled via ENABLE_INSTAGRAM."]
        };
      }

      const data = [
        {
          platform: "Instagram",
          content: `Post con Geotag en ${locationName}. Foto de grafitis asociados con marcas territoriales de la pandilla 'Los Cholos 13'. #Aguascalientes #UrbanDeterioro #OSINTTerritorial`,
          timestamp: new Date(now - 3600000 * 12).toISOString(),
          url: "https://www.instagram.com/explore/tags/aguascalientes"
        }
      ];

      console.log(`[LOG] Provider: instagram | Action: simulated_fetch | Status: ok | Duration: ${Date.now() - start}ms`);

      const lat = params?.lat || 21.8853;
      const lng = params?.lng || -102.2916;
      const action = params?.action || "simulated_fetch";
      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, data, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, data, normalized);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        metadata: { version: "2.1.0", is_simulated: true },
        ...provenance
      };
    } catch (err: any) {
      console.error(`[LOG] Provider: instagram | Exception: ${err.message || String(err)}`);
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
    return {
      isHealthy: this.isEnabled(),
      latencyMs: Date.now() - start,
      details: this.isEnabled()
        ? "Instagram Provider is enabled in simulation mode. Authentication is bypassed."
        : "Instagram Provider is disabled.",
      timestamp: new Date().toISOString(),
      authenticationStatus: this.isEnabled() ? "bypassed" : "invalid",
      availability: this.isEnabled() ? 100 : 0,
      recordsCount: 1
    };
  }
}
