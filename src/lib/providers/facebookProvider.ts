import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";

export class FacebookProvider implements IProvider {
  getId(): string {
    return "facebook";
  }

  getName(): string {
    return "Facebook OSINT Connection";
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
      authType: "Public Reachability Check / Access Point",
      geographicCoverage: "Global",
      outputFormat: "JSON (Real-Time Reachability Status)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
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

      // Real network reachability fetch to check connection to Facebook
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://www.facebook.com", { 
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      clearTimeout(id);

      const latency = Date.now() - start;
      const ok = res.status < 500;

      if (!ok) {
        throw new Error(`Facebook server responded with HTTP status ${res.status}`);
      }

      const dummyData = [
        {
          platform: "Facebook",
          content: "Enlace perimetral con Facebook verificado y activo.",
          timestamp: new Date().toISOString()
        }
      ];

      const lat = params?.lat || 21.8853;
      const lng = params?.lng || -102.2916;
      const action = params?.action || "health_check";
      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, dummyData, lat, lng);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        confidence: 100,
        payload: normalized,
        latency,
        metadata: { version: "2.1.0", connection: "active" }
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
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://www.facebook.com", {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      clearTimeout(id);

      const latencyMs = Date.now() - start;
      if (res.status >= 500) {
        throw new Error(`Facebook status error: ${res.status}`);
      }

      return {
        isHealthy: true,
        latencyMs,
        details: "Conectado al servidor de Facebook de manera exitosa.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount: 1
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: `Error de red: ${err.message || String(err)}`,
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0
      };
    }
  }
}
