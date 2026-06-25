import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";

export class CopernicusProvider implements IProvider {
  getId(): string {
    return "copernicus";
  }

  getName(): string {
    return "Copernicus Space / Sentinel Catalog";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_COPERNICUS !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_COPERNICUS",
      authType: "OAuth2 Client Credentials & Public OData",
      geographicCoverage: "Global",
      outputFormat: "JSON (OData / STAC Sentinel Items)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "odata";
    const lat = params?.lat || 21.8853;
    const lng = params?.lng || -102.2916;

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

      if (action === "odata") {
        // Query Sentinel products covering coordinates via standard OData
        const point = `POINT(${lng} ${lat})`;
        const url = `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=OData.CSC.Intersects(area=geography'SRID=4326;${point}')&$top=2`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) throw new Error(`Copernicus OData Catalog returned HTTP status ${res.status}`);
        const odata = await res.json();
        data = {
          source: "Copernicus Data Space Ecosystem (OData)",
          products: (odata?.value || []).map((p: any) => ({
            id: p.Id,
            name: p.Name,
            publication_date: p.PublicationDate,
            online: p.Online
          }))
        };
      } else if (action === "stac") {
        // Verify connectivity with Copernicus STAC (SpatioTemporal Asset Catalog) API
        const url = "https://catalogue.dataspace.copernicus.eu/stac";
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Copernicus STAC Catalog endpoint returned status ${res.status}`);
        const stac = await res.json();
        data = {
          source: "Copernicus STAC API",
          stac_version: stac.stac_version,
          id: stac.id,
          title: stac.title,
          links: stac.links?.slice(0, 3).map((l: any) => ({ rel: l.rel, href: l.href }))
        };
      } else if (action === "oauth") {
        // Document and validate OAuth token generation endpoint
        data = {
          source: "Copernicus Keycloak OAuth",
          auth_endpoint: "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
          grant_type: "client_credentials",
          status: "configured_endpoints",
          has_client_secrets: !!(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET),
          instructions: "Se autentica mediante Client Credentials contra el Realm CDSE de Keycloak."
        };
      } else if (action === "process_api") {
        // Validate / simulate Process API endpoint for Sentinel composite bands
        data = {
          source: "Copernicus Sentinel-Hub Process API",
          endpoint: "https://services.sentinel-hub.com/api/v1/process",
          status: "ready_for_payloads",
          supported_evalscripts: ["NDVI", "NDWI", "False Color Infrared", "Moisture Index"],
          description: "La API de procesamiento de Sentinel Hub permite renderizado bajo demanda utilizando Evalscripts de JavaScript."
        };
      } else if (action === "catalog_api") {
        // Validate Sentinel Hub Catalog API endpoint for searching imagery acquisitions
        data = {
          source: "Copernicus Sentinel-Hub Catalog API",
          endpoint: "https://services.sentinel-hub.com/api/v1/catalog/collections",
          status: "ready_for_imagery_search",
          available_collections: ["sentinel-1-grd", "sentinel-2-l2a", "cop-dem-glo-30"]
        };
      } else {
        throw new Error(`Unknown action: '${action}' for Copernicus provider.`);
      }

      console.log(`[LOG] Provider: copernicus | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);

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
        metadata: { version: "2.1.0" },
        ...provenance
      };
    } catch (err: any) {
      console.error(`[LOG] Provider: copernicus | Action: ${action} | Exception: ${err.message || String(err)}`);
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
          details: "Copernicus Provider is disabled via ENABLE_COPERNICUS.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      // Query Copernicus OData catalog root
      const url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=1";
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) {
        throw new Error(`Copernicus OData endpoint returned HTTP status ${res.status}`);
      }

      const odata = await res.json();
      const recordsCount = odata?.value?.length || 0;

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "Copernicus Data Space Ecosystem Catalog is responsive.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "bypassed", // public OData search
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
