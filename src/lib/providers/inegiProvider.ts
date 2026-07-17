import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { getInegiDemographics } from "@/lib/inegiIndicators";
import { getDenueData } from "@/lib/osintActions";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export class InegiProvider implements IProvider {
  getId(): string {
    return "inegi";
  }

  getName(): string {
    return "Instituto Nacional de Estadística y Geografía (INEGI)";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_INEGI !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_INEGI",
      authType: "API Token (DENUE and Indicators)",
      geographicCoverage: "Mexico (Nacional / Aguascalientes)",
      outputFormat: "JSON (Demographics / DENUE) / OGC GeoServer Catalog"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "denue";
    
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

      if (action === "scince") {
        const municipio = params?.municipio || "Aguascalientes";
        const estado = params?.estado || "Aguascalientes";
        data = await getInegiDemographics(municipio, estado);
      } else if (action === "denue") {
        const radio = params?.radio || 500;
        data = await getDenueData(lat, lng, radio);
      } else if (action === "marco_geoestadistico") {
        // Infrastructure ready for Marco Geoestadístico layer integration
        data = {
          status: "ready_for_integration",
          layer_type: "WFS / GeoJSON",
          endpoints: {
            wfs: "https://geoportal.inegi.org.mx/geoserver/wfs",
            download: "https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=889463807469"
          },
          target_layers: ["m_ageb_m_g", "m_localidad_p_g", "m_municipio_g"],
          description: "División político-administrativa y desglose por Áreas Geoestadísticas Básicas (AGEB) urbanas y rurales."
        };
      } else if (action === "elevation_model") {
        // Infrastructure ready for Modelo Digital de Elevación (CEM 3.0)
        data = {
          status: "ready_for_integration",
          layer_type: "KML / GeoTIFF / WMS",
          endpoints: {
            wms: "https://geoportal.inegi.org.mx/geoserver/cem/wms",
            download: "https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=889463842859"
          },
          target_layers: ["continente_elevacion_cem_30m"],
          description: "Continuo de Elevación Mexicano de alta resolución (30 metros) para cálculos hidrológicos de escurrimiento."
        };
      } else if (action === "hydrography") {
        // Infrastructure ready for Hidrografía layers (corrientes de agua, cuerpos de agua)
        data = {
          status: "ready_for_integration",
          layer_type: "WMS / GeoJSON",
          endpoints: {
            wms: "https://geoportal.inegi.org.mx/geoserver/hidrografia/wms"
          },
          target_layers: ["corrientes_agua_lineal", "cuerpos_agua_poligonal"],
          description: "Red hidrológica nacional de corrientes superficiales perennes e intermitentes, arroyos y escurrimientos."
        };
      } else if (action === "land_use") {
        // Infrastructure ready for Uso de Suelo y Vegetación layers
        data = {
          status: "ready_for_integration",
          layer_type: "WMS",
          endpoints: {
            wms: "https://geoportal.inegi.org.mx/geoserver/uso_suelo_vegetacion/wms"
          },
          target_layers: ["uso_suelo_serie_vii"],
          description: "Clasificación de cobertura vegetal y asfalto urbano para modelar coeficientes de impermeabilidad de suelo."
        };
      } else {
        throw new Error(`Unknown action: '${action}' for INEGI provider.`);
      }

      console.log(`[LOG] Provider: inegi | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);

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
      console.error(`[LOG] Provider: inegi | Action: ${action} | Exception: ${err.message || String(err)}`);
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
          details: "INEGI Provider is disabled via ENABLE_INEGI.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const token = process.env.INEGI_DENUE_TOKEN || "dbf9098a-165e-4938-a5fc-841bd476e357";
      const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/21.8818,-102.2950/10/${token}`;
      const res = await fetch(url, { headers: { "User-Agent": "PerfiladorRemoto/1.0" } });
      
      if (!res.ok) {
        throw new Error(`INEGI DENUE endpoint returned HTTP status ${res.status}`);
      }

      const data = await res.json();
      const recordsCount = Array.isArray(data) ? data.length : 0;

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "INEGI DENUE indicators and geoserver directories are authenticated and active.",
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
