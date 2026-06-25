import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";

export class FacebookProvider implements IProvider {
  getId(): string {
    return "facebook";
  }

  getName(): string {
    return "Facebook OSINT (Simulated)";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_FACEBOOK !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_FACEBOOK",
      authType: "Simulated Public Scraper",
      geographicCoverage: "Local groups",
      outputFormat: "JSON (Simulated Local Community Reports)"
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
          errors: ["Provider is disabled via ENABLE_FACEBOOK."]
        };
      }

      // Mirroring the exact social posts used in Capa 3 simulator to maintain complete functional stability
      const data = [
        {
          platform: "Facebook",
          content: `[Vecinos Vigilantes de ${locationName}] Reportan una camioneta sospechosa de color negro con vidrios polarizados y sin placas rondando por las calles principales de la colonia desde hace media hora. Tomen precauciones y reporten al 911 si ven personas sospechosas bajando.`,
          timestamp: new Date(now - 3600000 * 2).toISOString(),
          url: "https://www.facebook.com/groups/vecinos_vigilantes_ags"
        },
        {
          platform: "Facebook",
          content: `[Venta de Refacciones y más ${locationName}] Alguien sabe si hay paso por la calle principal? Hay patrullas de la estatal tapando la calle y se escuchan sirenas fuertes cerca del parque. Eviten la zona mejor.`,
          timestamp: new Date(now - 3600000 * 6).toISOString(),
          url: "https://www.facebook.com/marketplace"
        }
      ];

      console.log(`[LOG] Provider: facebook | Action: simulated_fetch | Status: ok | Duration: ${Date.now() - start}ms`);

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
      console.error(`[LOG] Provider: facebook | Exception: ${err.message || String(err)}`);
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
        ? "Facebook Provider is enabled in simulation mode. Authentication is bypassed."
        : "Facebook Provider is disabled.",
      timestamp: new Date().toISOString(),
      authenticationStatus: this.isEnabled() ? "bypassed" : "invalid",
      availability: this.isEnabled() ? 100 : 0,
      recordsCount: 2
    };
  }
}
