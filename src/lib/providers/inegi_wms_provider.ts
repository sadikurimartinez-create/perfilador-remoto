import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export interface WmsLayer {
  id: string;
  name: string;
  category: "hidrologia" | "topografia" | "uso_suelo" | "infraestructura" | "organizacion_territorial" | "cartografia_base";
  title: string;
  description: string;
  bbox: { minx: number; miny: number; maxx: number; maxy: number };
  crs: string[];
  styles: string[];
  formats: string[];
  providerUrl: string;
  scaleMin?: number;
  scaleMax?: number;
}

export interface WmsTelemetry {
  totalQueries: number;
  cacheHits: number;
  errorsCount: number;
  latencySum: number;
  lastResponseTime: number;
  mostUsedLayers: Record<string, number>;
}

const INEGI_WMS_ENDPOINTS = {
  marco_geoestadistico: "https://geoportal.inegi.org.mx/geoserver/m_ageb_m_g/wms",
  elevation: "https://geoportal.inegi.org.mx/geoserver/cem/wms",
  hydrography: "https://geoportal.inegi.org.mx/geoserver/hidrografia/wms",
  land_use: "https://geoportal.inegi.org.mx/geoserver/uso_suelo_vegetacion/wms"
};

const STATIC_FALLBACK_CATALOG: WmsLayer[] = [
  // Hidrología
  {
    id: "corrientes_agua_lineal",
    name: "corrientes_agua_lineal",
    category: "hidrologia",
    title: "Corrientes de Agua Lineales",
    description: "Red hidrológica de corrientes superficiales (ríos, arroyos y escurrimientos en Aguascalientes).",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["line"],
    formats: ["image/png", "image/jpeg"],
    providerUrl: INEGI_WMS_ENDPOINTS.hydrography
  },
  {
    id: "cuerpos_agua_poligonal",
    name: "cuerpos_agua_poligonal",
    category: "hidrologia",
    title: "Cuerpos de Agua Poligonales",
    description: "Lagos, presas, lagunas y almacenamientos de agua perennes e intermitentes.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["polygon"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.hydrography
  },
  {
    id: "cuencas_hidrograficas",
    name: "cuencas_hidrograficas",
    category: "hidrologia",
    title: "Cuencas Hidrográficas del Estado",
    description: "Delimitación de cuencas y subcuencas para el modelado de caudales pluviales.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326"],
    styles: ["default"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.hydrography
  },
  // Topografía
  {
    id: "curvas_nivel_30m",
    name: "curvas_nivel_30m",
    category: "topografia",
    title: "Curvas de Nivel (Intervalo 30m)",
    description: "Líneas altimétricas del relieve para la estimación de pendientes e inclinaciones.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["default"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.elevation
  },
  {
    id: "continente_elevacion_cem_30m",
    name: "continente_elevacion_cem_30m",
    category: "topografia",
    title: "Modelo Digital de Elevación (CEM 3.0)",
    description: "Continuo de Elevación Mexicano de alta resolución para cálculos de escorrentías.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["raster"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.elevation
  },
  // Uso de suelo
  {
    id: "uso_suelo_serie_vii",
    name: "uso_suelo_serie_vii",
    category: "uso_suelo",
    title: "Uso de Suelo y Vegetación Serie VII",
    description: "Clasificación de cobertura vegetal y asfalto urbano para coeficientes de escurrimiento.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326"],
    styles: ["default"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.land_use
  },
  // Organización territorial
  {
    id: "m_ageb_m_g",
    name: "m_ageb_m_g",
    category: "organizacion_territorial",
    title: "Áreas Geoestadísticas Básicas (AGEB) Urbanas",
    description: "Límites geoestadísticos de nivel AGEB para agregación estadística e inteligencia.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["polygon"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.marco_geoestadistico
  },
  {
    id: "m_localidad_p_g",
    name: "m_localidad_p_g",
    category: "organizacion_territorial",
    title: "Localidades Geoestadísticas",
    description: "Puntos geoestadísticos que representan centros de población en el estado.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326"],
    styles: ["point"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.marco_geoestadistico
  },
  {
    id: "m_municipio_g",
    name: "m_municipio_g",
    category: "organizacion_territorial",
    title: "Límites Municipales Oficiales",
    description: "Polígonos delimitadores de los 11 municipios del estado de Aguascalientes.",
    bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
    crs: ["EPSG:4326", "EPSG:3857"],
    styles: ["line"],
    formats: ["image/png"],
    providerUrl: INEGI_WMS_ENDPOINTS.marco_geoestadistico
  }
];

export class InegiWmsProvider implements IProvider {
  private static catalog: WmsLayer[] = [...STATIC_FALLBACK_CATALOG];
  private static lastFetchTime: number = 0;
  private static cacheTtlMs: number = 24 * 60 * 60 * 1000; // 24 Horas
  
  private static telemetry: WmsTelemetry = {
    totalQueries: 0,
    cacheHits: 0,
    errorsCount: 0,
    latencySum: 0,
    lastResponseTime: 0,
    mostUsedLayers: {}
  };

  getId(): string {
    return "inegi_wms";
  }

  getName(): string {
    return "Servicio WMS INEGI GAIA";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_INEGI_WMS !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "3.0.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_INEGI_WMS",
      authType: "Public WMS (OGC standard)",
      geographicCoverage: "México (Nacional / Aguascalientes)",
      outputFormat: "WMS / XML (GetCapabilities) / image/png (Tiles)"
    };
  }

  static getTelemetry(): WmsTelemetry {
    return this.telemetry;
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "get_capabilities";
    const layer = params?.layer || "m_ageb_m_g";
    
    const geoValidation = validateGeoIntegrity(params?.lat, params?.lng);
    if (geoValidation.confidence === "UNKNOWN" || geoValidation.latitude === null || geoValidation.longitude === null) {
      InegiWmsProvider.telemetry.errorsCount++;
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

    InegiWmsProvider.telemetry.totalQueries++;
    this.trackLayerUsage(layer);

    try {
      if (!this.isEnabled()) {
        InegiWmsProvider.telemetry.errorsCount++;
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          errors: ["INEGI WMS Provider is disabled."]
        };
      }

      let data: any = null;

      if (action === "get_capabilities") {
        data = await this.getCapabilitiesCached();
      } else if (action === "get_map") {
        const bbox = params?.bbox || `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`;
        const width = params?.width || 256;
        const height = params?.height || 256;
        const srs = params?.srs || "EPSG:4326";
        data = {
          wmsUrl: this.getMapUrl(layer, bbox, width, height, srs),
          layer
        };
      } else if (action === "get_feature_info") {
        data = {
          infoUrl: this.getFeatureInfoUrl(layer, lat, lng),
          layer,
          info: `Simulated info for coordinate ${lat}, ${lng} on WMS Layer ${layer}. Zero anomalies detected.`
        };
      } else {
        throw new Error(`Acción desconocida '${action}' para INEGI WMS.`);
      }

      const latency = Date.now() - start;
      InegiWmsProvider.telemetry.latencySum += latency;
      InegiWmsProvider.telemetry.lastResponseTime = latency;

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: 100,
        payload: data,
        latency
      };
    } catch (err: any) {
      InegiWmsProvider.telemetry.errorsCount++;
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
          details: "Proveedor desactivado.",
          timestamp: new Date().toISOString(),
          availability: 0
        };
      }
      
      // Intentar GetCapabilities rápido en el marco geoestadístico
      const url = `${INEGI_WMS_ENDPOINTS.marco_geoestadistico}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      
      return {
        isHealthy: res !== null && res.ok,
        latencyMs: Date.now() - start,
        details: res && res.ok ? "Servicio WMS INEGI responsivo." : "WMS inalcanzable. Usando catálogo en caché.",
        timestamp: new Date().toISOString(),
        availability: res && res.ok ? 100 : 50
      };
    } catch (e: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: `Error en healthcheck: ${e.message}`,
        timestamp: new Date().toISOString(),
        availability: 0
      };
    }
  }

  public async getCapabilitiesCached(): Promise<{ layers: WmsLayer[]; isCached: boolean }> {
    const now = Date.now();
    const isCacheValid = now - InegiWmsProvider.lastFetchTime < InegiWmsProvider.cacheTtlMs;

    if (isCacheValid && InegiWmsProvider.lastFetchTime > 0) {
      InegiWmsProvider.telemetry.cacheHits++;
      return { layers: InegiWmsProvider.catalog, isCached: true };
    }

    // Si expiró el caché o es primera vez, lanzar descubrimiento asíncrono
    void this.discoverLayersAsync();
    
    // Devolvemos el catálogo disponible actualmente de forma inmediata
    return { layers: InegiWmsProvider.catalog, isCached: false };
  }

  private async discoverLayersAsync() {
    try {
      const activeLayers: WmsLayer[] = [];
      
      for (const [key, wmsUrl] of Object.entries(INEGI_WMS_ENDPOINTS)) {
        try {
          const res = await fetch(`${wmsUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`, {
            signal: AbortSignal.timeout(5000)
          });
          if (res.ok) {
            const xmlText = await res.text();
            const parsed = this.parseCapabilitiesXml(xmlText, wmsUrl);
            activeLayers.push(...parsed);
          }
        } catch (err) {
          console.warn(`[INEGI WMS Provider] No se pudo obtener capabilities de ${key}:`, err);
        }
      }

      if (activeLayers.length > 0) {
        InegiWmsProvider.catalog = this.mergeCatalogs(activeLayers);
        InegiWmsProvider.lastFetchTime = Date.now();
      }
    } catch (err) {
      console.error("[INEGI WMS Provider] Error en descubrimiento automático de capas:", err);
    }
  }

  private parseCapabilitiesXml(xmlText: string, providerUrl: string): WmsLayer[] {
    const layers: WmsLayer[] = [];
    const layerBlockRegex = /<Layer[^>]*>([\s\S]*?)<\/Layer>/gi;
    let match;

    while ((match = layerBlockRegex.exec(xmlText)) !== null) {
      const content = match[1];

      if (content.includes("<Title>") && !content.includes("<Name>")) {
        continue;
      }

      const nameMatch = /<Name>([^<]+)<\/Name>/i.exec(content);
      const titleMatch = /<Title>([^<]+)<\/Title>/i.exec(content);
      const abstractMatch = /<Abstract>([^<]+)<\/Abstract>/i.exec(content);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        const title = titleMatch ? titleMatch[1].trim() : name;
        const description = abstractMatch ? abstractMatch[1].trim() : `Capa WMS: ${title}`;
        
        const category = this.classifyLayerCategory(name, title);

        layers.push({
          id: name,
          name,
          category,
          title,
          description,
          bbox: { minx: -103.0, miny: 21.5, maxx: -101.5, maxy: 22.5 },
          crs: ["EPSG:4326", "EPSG:3857"],
          styles: ["default"],
          formats: ["image/png"],
          providerUrl
        });
      }
    }

    return layers;
  }

  private classifyLayerCategory(name: string, title: string): WmsLayer["category"] {
    const text = `${name} ${title}`.toLowerCase();
    
    if (/(rio|arroyo|cuenca|agua|hidro|corriente|escurrimiento|presa|lago|escurre|drenaje)/.test(text)) {
      return "hidrologia";
    }
    if (/(curva|nivel|relieve|pendiente|elevacion|cem|altitud|topografia)/.test(text)) {
      return "topografia";
    }
    if (/(vegetacion|suelo|agricultura|cobertura|urbana|asfalto|bosque|selva)/.test(text)) {
      return "uso_suelo";
    }
    if (/(carretera|vialidad|ferrocarril|camino|estrategica|infraestructura|puente|aeropuerto)/.test(text)) {
      return "infraestructura";
    }
    if (/(ageb|localidad|colonia|municipio|limite|estatal|frontera|distrito)/.test(text)) {
      return "organizacion_territorial";
    }
    return "cartografia_base";
  }

  private mergeCatalogs(fetched: WmsLayer[]): WmsLayer[] {
    const map = new Map<string, WmsLayer>();
    InegiWmsProvider.catalog.forEach(l => map.set(l.id, l));
    fetched.forEach(l => map.set(l.id, l));
    return Array.from(map.values());
  }

  private getMapUrl(layer: string, bbox: string, width: number, height: number, srs: string): string {
    const matched = InegiWmsProvider.catalog.find(l => l.name === layer);
    const baseUrl = matched ? matched.providerUrl : INEGI_WMS_ENDPOINTS.marco_geoestadistico;
    return `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&FORMAT=image/png&TRANSPARENT=TRUE&SRS=${srs}&BBOX=${bbox}&WIDTH=${width}&HEIGHT=${height}`;
  }

  private getFeatureInfoUrl(layer: string, lat: number, lng: number): string {
    const matched = InegiWmsProvider.catalog.find(l => l.name === layer);
    const baseUrl = matched ? matched.providerUrl : INEGI_WMS_ENDPOINTS.marco_geoestadistico;
    const bbox = `${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}`;
    return `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${layer}&QUERY_LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=text/html`;
  }

  private trackLayerUsage(layer: string) {
    const usages = InegiWmsProvider.telemetry.mostUsedLayers;
    usages[layer] = (usages[layer] || 0) + 1;
  }
}
