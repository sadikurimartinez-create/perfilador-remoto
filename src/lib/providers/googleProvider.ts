import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { analyzeStreetViewWithGemini } from "@/utils/socialProviders";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

export class GoogleProvider implements IProvider {
  getId(): string {
    return "google";
  }

  getName(): string {
    return "Google Cloud Platform";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_GOOGLE !== "false" && !!(
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    );
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_GOOGLE",
      authType: "API Key & GCP ADC",
      geographicCoverage: "Global",
      outputFormat: "JSON (Places / Vision / StreetView / Elevation / Routes)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "places";
    
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
    const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
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
          errors: ["Provider is disabled."]
        };
      }

      let data: any = null;
      let confidence = 100;

      if (action === "places") {
        const radius = params?.radius || 500;
        data = await searchPlacesAround(lat, lng, radius);
        if (!data) {
          confidence = 0;
          throw new Error("Google Places query returned null.");
        }
      } else if (action === "routes") {
        const destLat = Number(params?.destLat);
        const destLng = Number(params?.destLng);
        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
          throw new Error("Google Directions requiere destLat/destLng trazables; no se usa destino hardcoded.");
        }
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lng}&destination=${destLat},${destLng}&key=${key}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Google Directions API returned HTTP ${res.status}`);
        }
        const json = await res.json();
        data = {
          routes: json.routes?.map((r: any) => ({
            summary: r.summary,
            overview_polyline: r.overview_polyline,
            warnings: r.warnings || [],
            legs: r.legs?.map((l: any) => ({
              distance: l.distance,
              duration: l.duration,
              duration_in_traffic: l.duration_in_traffic,
              start_address: l.start_address,
              end_address: l.end_address,
              steps: l.steps
            }))
          })) || []
        };
      } else if (action === "geocoding") {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google Geocoding API returned HTTP ${res.status}`);
        const json = await res.json();
        data = {
          formatted_address: json.results?.[0]?.formatted_address || "Unknown",
          place_id: json.results?.[0]?.place_id,
          types: json.results?.[0]?.types || []
        };
      } else if (action === "elevation") {
        const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google Elevation API returned HTTP ${res.status}`);
        const json = await res.json();
        data = {
          elevation: json.results?.[0]?.elevation ?? null,
          resolution: json.results?.[0]?.resolution ?? null
        };
      } else if (action === "streetview_metadata") {
        // Safe check for Street View imagery availability
        const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google StreetView metadata returned HTTP ${res.status}`);
        data = await res.json();
      } else if (action === "streetview_analysis") {
        data = await analyzeStreetViewWithGemini(lat, lng);
      } else if (action === "vision") {
        const imageBase64 = params?.imageBase64;
        if (!imageBase64) throw new Error("Missing parameter: imageBase64 required for action: 'vision'");
        data = await analyzeBrokenWindowsWithVision({ imageBase64 });
      } else if (action === "earth_engine_connectivity") {
        // Validate Earth Engine connectivity (public asset)
        const url = "https://earthengine.googleapis.com/v1/projects/earthengine-public";
        const res = await fetch(url);
        data = {
          status: res.status,
          ok: res.ok,
          message: "Earth Engine endpoint reachable."
        };
      } else if (action === "vertex_connectivity") {
        // Validate Vertex AI connectivity (pure ping, no synthesis)
        if (!GCP_PROJECT_ID) {
          throw new Error("Vertex AI check failed: Missing GCP_PROJECT_ID.");
        }
        const authOptions = GCP_PRIVATE_KEY
          ? {
              credentials: {
                client_email: GCP_CLIENT_EMAIL,
                private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
              },
            }
          : undefined;

        const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
        const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
        // Minimal token footprint
        const contentRes = await model.generateContent("ping");
        data = {
          status: "connected",
          candidateCount: contentRes.response?.candidates?.length || 0
        };
      } else {
        throw new Error(`Unknown action: '${action}' for Google provider.`);
      }

      console.log(`[LOG] Provider: google | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);

      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, data, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, data, normalized);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { version: "2.1.0" },
        ...provenance
      };
    } catch (err: any) {
      console.error(`[LOG] Provider: google | Action: ${action} | Exception: ${err.message || String(err)}`);
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
          details: "Google Provider is disabled via ENABLE_GOOGLE.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=21.8818,-102.2950&key=${key}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Google API gateway responded with HTTP status ${res.status}`);
      }

      const data = await res.json();
      if (data.status === "REQUEST_DENIED") {
        throw new Error(`Google API REQUEST_DENIED: ${data.error_message || "Invalid Key"}`);
      }

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "Google Geocoding and Maps services are authenticated and functional.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount: data.results?.length || 0
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
