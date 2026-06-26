import { ApiOrchestrator } from "../providers/orchestrator";

export type ProviderCategory =
  | "hidrologico"
  | "meteorologico"
  | "satelital"
  | "cartografico"
  | "demografico"
  | "economico"
  | "infraestructura"
  | "criminal"
  | "pandillas"
  | "osint"
  | "redes_sociales"
  | "institucional";

export interface ScoreMetrics {
  authority: number;          // 0.0 - 1.0 (institutional mandate)
  reliability: number;        // 0.0 - 1.0 (noise ratio / confidence)
  spatialResolution: number;  // 0.0 - 1.0 (scale / granularity)
  temporalFreshness: number;  // 0.0 - 1.0 (updates frequency)
  contextRelevance: number;   // 0.0 - 1.0 (context relevance for active module)
  availability: number;       // 0.0 - 1.0 (health / circuit breaker status)
}

export interface CorrelationResult {
  providerId: string;
  name: string;
  categories: ProviderCategory[];
  metrics: ScoreMetrics;
  truthScore: number;         // 0 - 100 percentage
  decision: "use" | "ignore" | "merge" | "degrade";
  explanation: string;
}

export interface CorrelationReport {
  moduleName: "pandillas" | "inundaciones" | "perfil";
  timestamp: string;
  results: CorrelationResult[];
  dominantProvider: string;
  dominantScore: number;
  dominantReason: string;
  activeUsedProviders: string[];
}

export class MultiSourceCorrelationEngine {
  /**
   * Classifies a provider ID into categories.
   */
  static classifyProvider(id: string): ProviderCategory[] {
    const categories: ProviderCategory[] = [];
    const lower = id.toLowerCase();

    // Satellite
    if (lower.includes("nasa") || lower.includes("copernicus")) {
      categories.push("satelital");
    }
    // Hydrological
    if (lower.includes("conagua") || lower.includes("hydro")) {
      categories.push("hidrologico");
    }
    // Meteorological
    if (lower.includes("tomorrow") || lower.includes("noaa") || lower.includes("conagua")) {
      categories.push("meteorologico");
    }
    // Cartographical / Geographical
    if (lower.includes("google") || lower.includes("wms") || lower.includes("inegi")) {
      categories.push("cartografico");
    }
    // Demographic / Economic
    if (lower === "inegi" || lower === "inegi_wms") {
      categories.push("demografico");
      categories.push("economico");
    }
    // Infrastructure
    if (lower.includes("google") || lower.includes("usgs") || lower.includes("inegi_wms")) {
      categories.push("infraestructura");
    }
    // Criminal / Civil Protection
    if (lower.includes("cenapred") || lower === "inegi") {
      categories.push("criminal");
    }
    // OSINT & Social Networks
    if (["telegram", "x", "facebook", "instagram", "reddit"].includes(lower)) {
      categories.push("osint");
      categories.push("redes_sociales");
    }
    // Institutional
    if (["inegi", "inegi_wms", "conagua", "cenapred", "noaa", "copernicus", "nasa", "usgs"].includes(lower)) {
      categories.push("institucional");
    }

    if (categories.length === 0) {
      categories.push("cartografico");
    }
    return categories;
  }

  /**
   * Evaluates the matrix and correlates data from all registered providers.
   */
  static correlate(
    moduleName: "pandillas" | "inundaciones" | "perfil",
    context?: { lat?: number; lng?: number; query?: string }
  ): CorrelationReport {
    const orchestrator = new ApiOrchestrator();
    const activeProviders = orchestrator.getProviders();
    const queryLower = (context?.query || "").toLowerCase();

    const results: CorrelationResult[] = [];

    activeProviders.forEach((provider) => {
      const id = provider.getId();
      const name = provider.getName();
      const isEnabled = provider.isEnabled();
      const categories = this.classifyProvider(id);

      // Determine metrics based on provider type and module priorities
      let authority = 0.5;
      let reliability = 0.8;
      let spatialResolution = 0.7;
      let temporalFreshness = 0.6;
      let contextRelevance = 0.5;
      let availability = isEnabled ? 1.0 : 0.0;

      // Module specific priorities
      if (moduleName === "inundaciones") {
        // Priority: CONAGUA > CENAPRED > NOAA > Copernicus > NASA > USGS > INEGI WMS > Google
        if (id === "conagua") {
          authority = 1.0; reliability = 0.95; spatialResolution = 0.8; temporalFreshness = 0.9; contextRelevance = 1.0;
        } else if (id === "cenapred") {
          authority = 0.95; reliability = 0.9; spatialResolution = 0.75; temporalFreshness = 0.7; contextRelevance = 0.95;
        } else if (id === "noaa") {
          authority = 0.9; reliability = 0.95; spatialResolution = 0.6; temporalFreshness = 0.95; contextRelevance = 0.9;
        } else if (id === "copernicus") {
          authority = 0.85; reliability = 0.9; spatialResolution = 0.9; temporalFreshness = 0.6; contextRelevance = 0.85;
        } else if (id === "nasa") {
          authority = 0.8; reliability = 0.95; spatialResolution = 0.85; temporalFreshness = 0.5; contextRelevance = 0.8;
        } else if (id === "usgs") {
          authority = 0.75; reliability = 0.9; spatialResolution = 0.8; temporalFreshness = 0.5; contextRelevance = 0.75;
        } else if (id === "inegi_wms") {
          authority = 0.7; reliability = 0.95; spatialResolution = 0.85; temporalFreshness = 0.7; contextRelevance = 0.7;
        } else if (id === "google") {
          authority = 0.6; reliability = 0.99; spatialResolution = 0.95; temporalFreshness = 0.8; contextRelevance = 0.6;
        } else if (categories.includes("osint")) {
          authority = 0.3; reliability = 0.4; spatialResolution = 0.5; temporalFreshness = 0.99; contextRelevance = 0.5;
        }
      } else if (moduleName === "pandillas") {
        // Priority: Base institucional (inegi/gis) > Geoint GIS > OSINT > Google > INEGI > Redes Sociales
        if (id === "hydro_fusion") {
          // Special institutional GIS / Decision
          authority = 1.0; reliability = 0.95; spatialResolution = 0.9; temporalFreshness = 0.8; contextRelevance = 1.0;
        } else if (categories.includes("osint")) {
          authority = 0.85; reliability = 0.5; spatialResolution = 0.7; temporalFreshness = 0.99; contextRelevance = 0.9;
        } else if (id === "google") {
          authority = 0.8; reliability = 0.99; spatialResolution = 0.95; temporalFreshness = 0.85; contextRelevance = 0.8;
        } else if (id === "inegi" || id === "inegi_wms") {
          authority = 0.75; reliability = 0.95; spatialResolution = 0.85; temporalFreshness = 0.6; contextRelevance = 0.75;
        }
      } else {
        // default / "perfil" module
        // Priority: Google > INEGI > DENUE > SCINCE > WMS > OSINT > Redes Sociales
        if (id === "google") {
          authority = 0.95; reliability = 0.99; spatialResolution = 0.95; temporalFreshness = 0.9; contextRelevance = 1.0;
        } else if (id === "inegi" || id === "inegi_wms") {
          authority = 0.9; reliability = 0.95; spatialResolution = 0.85; temporalFreshness = 0.7; contextRelevance = 0.9;
        } else if (categories.includes("osint")) {
          authority = 0.5; reliability = 0.4; spatialResolution = 0.5; temporalFreshness = 0.99; contextRelevance = 0.6;
        }
      }

      // Adjust context relevance if context query mentions specifics
      if (queryLower.length > 0) {
        if (categories.includes("hidrologico") && /(agua|inundacion|canal|rio|arroyo|lluvia)/.test(queryLower)) {
          contextRelevance = Math.min(1.0, contextRelevance + 0.1);
        }
        if (categories.includes("osint") && /(reporte|ciudadano|alerta|redes|vecinos|noticia)/.test(queryLower)) {
          contextRelevance = Math.min(1.0, contextRelevance + 0.1);
        }
      }

      // Operational Truth Score Formula
      const truthScoreRaw = authority * reliability * spatialResolution * temporalFreshness * contextRelevance * availability;
      const truthScore = parseFloat((truthScoreRaw * 100).toFixed(1));

      // Selection logic decisions (Use, Ignore, Merge, Degrade)
      let decision: CorrelationResult["decision"] = "use";
      let explanation = "";

      if (!isEnabled) {
        decision = "ignore";
        explanation = `Fuente desactivada institucionalmente en variables de entorno (${id.toUpperCase()}).`;
      } else if (truthScore < 10) {
        decision = "ignore";
        explanation = `Descartado debido a baja relevancia de contexto (${contextRelevance}) y baja fiabilidad (${reliability}).`;
      } else if (truthScore < 30) {
        decision = "degrade";
        explanation = `Degradado a fuente de soporte secundario por baja resolución espacial o cobertura temporal desactualizada.`;
      } else if (categories.includes("osint") && moduleName !== "pandillas") {
        decision = "merge";
        explanation = `Fusionado con fuentes institucionales para aportar validación ciudadana táctica y reportes OSINT en tiempo real.`;
      } else {
        decision = "use";
        explanation = `Fuente primaria consultada por alta autoridad institucional (${authority}) e impecable fiabilidad histórica.`;
      }

      results.push({
        providerId: id,
        name,
        categories,
        metrics: { authority, reliability, spatialResolution, temporalFreshness, contextRelevance, availability },
        truthScore,
        decision,
        explanation
      });
    });

    // Determine the dominant provider
    const enabledResults = results.filter(r => r.decision !== "ignore");
    let dominantResult = enabledResults[0];
    
    enabledResults.forEach(r => {
      if (!dominantResult || r.truthScore > dominantResult.truthScore) {
        dominantResult = r;
      }
    });

    const dominantProvider = dominantResult ? dominantResult.providerId : "default";
    const dominantScore = dominantResult ? dominantResult.truthScore : 0;
    const dominantReason = dominantResult 
      ? `Establecido como verdad operacional debido a su autoridad ponderada del ${(dominantResult.metrics.authority * 100)}% y su relevancia contextual.`
      : "No se identificaron proveedores activos dominantes.";

    const activeUsedProviders = results
      .filter(r => r.decision === "use" || r.decision === "merge")
      .map(r => r.providerId);

    return {
      moduleName,
      timestamp: new Date().toISOString(),
      results,
      dominantProvider,
      dominantScore,
      dominantReason,
      activeUsedProviders
    };
  }
}
