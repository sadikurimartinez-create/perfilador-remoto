import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import { inspectTelegramBotRuntime, searchTelegram } from "@/utils/socialProviders";
import { getTelegramOsintData } from "@/lib/osintActions";
import { classifyExternalFailure } from "@/utils/externalProviderError";

export class TelegramProvider implements IProvider {
  getId(): string {
    return "telegram";
  }

  getName(): string {
    return "Telegram Bot API (updates recibidos)";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_TELEGRAM !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_TELEGRAM",
      authType: "Telegram Bot API token",
      geographicCoverage: "Chats, grupos y canales donde el bot recibe updates",
      outputFormat: "JSON (updates entregados al bot)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "search";
    
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

      const token = process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
      let data: any = null;

      if (token) {
        if (action === "search") {
          data = await searchTelegram(query);
        } else {
          data = await getTelegramOsintData(query);
        }
      } else {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          metadata: {
            version: "2.1.0",
            sourceFamily: "TELEGRAM",
            operationalMode: "NOT_CONFIGURED",
            acquisitionStatus: "NOT_CONFIGURED",
            authoritative: false,
          },
          errors: ["Telegram Bot API token is not configured."]
        };
      }

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
    try {
      const tokenConfigured = Boolean(process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
      if (!tokenConfigured) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "Telegram Bot API no está configurado.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0,
          recordsCount: 0,
        };
      }

      const runtime = await inspectTelegramBotRuntime();
      const available = runtime.longPollingStatus === "LONG_POLLING_AVAILABLE";
      return {
        isHealthy: available,
        latencyMs: Date.now() - start,
        details: available
          ? "Bot autenticado; webhook inactivo; long polling disponible."
          : "Bot autenticado; webhook activo; long polling bloqueado.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: available ? 100 : 0,
        recordsCount: 1,
      };
    } catch (error) {
      const failure = classifyExternalFailure(error).failure;
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: failure.message,
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0,
        recordsCount: 0,
      };
    }
  }
}
