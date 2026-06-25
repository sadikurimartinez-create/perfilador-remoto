import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { searchTelegram } from "@/utils/socialProviders";
import { getTelegramOsintData } from "@/lib/osintActions";

export class TelegramProvider implements IProvider {
  getId(): string {
    return "telegram";
  }

  getName(): string {
    return "Telegram OSINT Channel Monitoring";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_TELEGRAM !== "false" && !!(
      process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_PGP_TELEGRAM_BOT_TOKEN
    );
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_TELEGRAM",
      authType: "Telegram Bot API Token",
      geographicCoverage: "Global / Local channels",
      outputFormat: "JSON (Scraped Channels / Message Telemetry)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "search";
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
          errors: ["Provider is disabled via ENABLE_TELEGRAM."]
        };
      }

      let data: any = null;
      let confidence = 100;

      if (action === "search") {
        data = await searchTelegram(query);
      } else if (action === "analysis") {
        data = await getTelegramOsintData(query);
      } else {
        throw new Error(`Unknown action: '${action}' for Telegram provider.`);
      }

      console.log(`[LOG] Provider: telegram | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);

      const lat = params?.lat || 21.8853;
      const lng = params?.lng || -102.2916;
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
      console.error(`[LOG] Provider: telegram | Action: ${action} | Exception: ${err.message || String(err)}`);
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
      const token = process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_PGP_TELEGRAM_BOT_TOKEN || "";
      if (!this.isEnabled() || !token) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "Telegram Provider is disabled or Bot Token is missing.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const url = `https://api.telegram.org/bot${token}/getMe`;
      const res = await fetch(url);
      const resData = await res.json();
      
      if (!res.ok || !resData.ok) {
        throw new Error(`Telegram Bot API responded with error: ${resData.description || "Unknown"}`);
      }

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: `Telegram Bot authenticated as @${resData.result?.username || "Bot"}.`,
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount: 1
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
