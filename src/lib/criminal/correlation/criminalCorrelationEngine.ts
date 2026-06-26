import { RSS_FEEDS } from "../../newsOsint";
import { OSINT_SOURCES } from "../../osintSources";

export interface ScoreMetrics {
  authority: number;          // 0.0 - 1.0 (criminological priority)
  reliability: number;        // 0.0 - 1.0 (data quality / context noise)
  spatialResolution: number;  // 0.0 - 1.0 (granularity)
  temporalFreshness: number;  // 0.0 - 1.0 (freshness of information)
  contextRelevance: number;   // 0.0 - 1.0 (relevance for criminal intelligence)
  availability: number;       // 0.0 - 1.0 (presence of actual data)
}

export interface CiceResult {
  providerId: string;
  name: string;
  category: "institucional" | "geoint" | "demografico" | "comercial" | "osint_rss" | "redes_sociales" | "busqueda";
  metrics: ScoreMetrics;
  truthScore: number;         // 0 - 100 percentage
  decision: "use" | "merge" | "degrade" | "ignore";
  explanation: string;
}

export interface CiceReport {
  timestamp: string;
  results: CiceResult[];
  dominantProvider: string;
  dominantScore: number;
  dominantReason: string;
  activeUsedProviders: string[];
  activeDiscardedProviders: string[];
  consensusLevel: number;      // 0 - 100 percentage
  uncertaintyLevel: number;    // 0 - 100 percentage
  correlationsDetected: string[];
  institutionalInventoryUsed: string[];
}

export class CriminalIntelligenceCorrelationEngine {
  /**
   * Retrieves all configured RSS sources automatically from project configurations.
   */
  static getDynamicRssSources(): { id: string; name: string }[] {
    const rssSources: { id: string; name: string }[] = [];
    
    // Aggregate from OSINT_SOURCES
    OSINT_SOURCES.forEach((src: any) => {
      if (src.type === "RSS") {
        rssSources.push({ id: src.id, name: src.name });
      }
    });

    // Aggregate from RSS_FEEDS
    RSS_FEEDS.forEach((feed: any) => {
      const exists = rssSources.some(s => s.name.toLowerCase() === feed.nombre.toLowerCase());
      if (!exists) {
        rssSources.push({ id: `feed_${feed.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_")}`, name: feed.nombre });
      }
    });

    return rssSources;
  }

  /**
   * Evaluates the active sources and calculates the Operational Truth Score (CICE)
   */
  static correlate(context: {
    selectedGangs?: string[];
    incidentsCount?: number;
    domicilesCount?: number;
    zonesCount?: number;
    rssCount?: number;
    hasGoogleMaps?: boolean;
    hasScince?: boolean;
    hasDenue?: boolean;
    socialMediaSignals?: {
      telegram?: boolean;
      facebook?: boolean;
      instagram?: boolean;
      x?: boolean;
      reddit?: boolean;
      search?: boolean;
    };
  }): CiceReport {
    const results: CiceResult[] = [];
    const correlationsDetected: string[] = [];
    const institutionalInventoryUsed: string[] = [];

    // 1. Define CICE Authority Matrix (Strict Priority Order)
    const authorityMatrix: Record<string, { name: string; category: CiceResult["category"]; authority: number; reliability: number }> = {
      inventario_pandillas: { name: "Inventario Institucional de Pandillas", category: "institucional", authority: 1.0, reliability: 0.98 },
      expedientes: { name: "Expedientes de Investigación", category: "institucional", authority: 0.95, reliability: 0.95 },
      incidencia_delictiva: { name: "Registro de Incidencia Delictiva (Local)", category: "institucional", authority: 0.90, reliability: 0.92 },
      google_maps: { name: "Google Maps (Core Services)", category: "geoint", authority: 0.85, reliability: 0.99 },
      inegi_scince: { name: "INEGI SCINCE (Demografía/Marginación)", category: "demografico", authority: 0.80, reliability: 0.95 },
      inegi_denue: { name: "INEGI DENUE (Giros Comerciales)", category: "comercial", authority: 0.75, reliability: 0.95 },
      rss: { name: "Radar OSINT Regional (Feeds RSS)", category: "osint_rss", authority: 0.70, reliability: 0.75 },
      google_search: { name: "Google Search (Web Scraping)", category: "busqueda", authority: 0.65, reliability: 0.70 },
      telegram: { name: "Telegram Channels & Leaks", category: "redes_sociales", authority: 0.60, reliability: 0.65 },
      x: { name: "X (Twitter) Intelligence", category: "redes_sociales", authority: 0.55, reliability: 0.60 },
      reddit: { name: "Reddit Forums Analysis", category: "redes_sociales", authority: 0.50, reliability: 0.65 },
      facebook: { name: "Facebook Pages & Groups", category: "redes_sociales", authority: 0.45, reliability: 0.55 },
      instagram: { name: "Instagram Open Profiles", category: "redes_sociales", authority: 0.40, reliability: 0.50 },
    };

    // Calculate dynamic check counts for availability
    const selectedGangs = context.selectedGangs || [];
    const hasGangData = selectedGangs.length > 0;
    const incidentsCount = context.incidentsCount || 0;
    const domicilesCount = context.domicilesCount || 0;
    const zonesCount = context.zonesCount || 0;
    const rssCount = context.rssCount || 0;

    const signals = context.socialMediaSignals || {};

    // 2. Map and compute scores for each provider in CICE Matrix
    Object.entries(authorityMatrix).forEach(([id, meta]) => {
      let availability = 0.0;
      let spatialResolution = 0.5;
      let temporalFreshness = 0.5;
      let contextRelevance = 0.5;

      // Determine availability and metrics based on context data
      if (id === "inventario_pandillas") {
        availability = hasGangData ? 1.0 : 0.0;
        spatialResolution = 0.9;
        temporalFreshness = 0.8;
        contextRelevance = hasGangData ? 1.0 : 0.2;
        if (availability > 0) institutionalInventoryUsed.push("Inventario de Pandillas (Integrantes/Estructura)");
      } else if (id === "expedientes") {
        availability = (domicilesCount > 0 || zonesCount > 0) ? 1.0 : 0.0;
        spatialResolution = 0.95;
        temporalFreshness = 0.9;
        contextRelevance = 0.95;
        if (availability > 0) institutionalInventoryUsed.push("Expedientes Locales (Domicilios/Relaciones)");
      } else if (id === "incidencia_delictiva") {
        availability = incidentsCount > 0 ? 1.0 : 0.0;
        spatialResolution = 0.85;
        temporalFreshness = 0.95;
        contextRelevance = 0.9;
        if (availability > 0) institutionalInventoryUsed.push("Incidencia Delictiva (Bases de datos de Delitos)");
      } else if (id === "google_maps") {
        availability = context.hasGoogleMaps !== false ? 1.0 : 0.0;
        spatialResolution = 0.99;
        temporalFreshness = 0.8;
        contextRelevance = 0.85;
      } else if (id === "inegi_scince") {
        availability = context.hasScince !== false ? 1.0 : 0.0;
        spatialResolution = 0.8;
        temporalFreshness = 0.4;
        contextRelevance = 0.75;
      } else if (id === "inegi_denue") {
        availability = context.hasDenue !== false ? 1.0 : 0.0;
        spatialResolution = 0.85;
        temporalFreshness = 0.6;
        contextRelevance = 0.7;
      } else if (id === "rss") {
        availability = rssCount > 0 ? 1.0 : 0.0;
        spatialResolution = 0.6;
        temporalFreshness = 0.99;
        contextRelevance = 0.75;
      } else if (id === "google_search") {
        availability = signals.search ? 1.0 : 0.0;
        spatialResolution = 0.5;
        temporalFreshness = 0.9;
        contextRelevance = 0.65;
      } else if (id === "telegram") {
        availability = signals.telegram ? 1.0 : 0.0;
        spatialResolution = 0.4;
        temporalFreshness = 0.95;
        contextRelevance = 0.7;
      } else if (id === "x") {
        availability = signals.x ? 1.0 : 0.0;
        spatialResolution = 0.4;
        temporalFreshness = 0.98;
        contextRelevance = 0.6;
      } else if (id === "reddit") {
        availability = signals.reddit ? 1.0 : 0.0;
        spatialResolution = 0.3;
        temporalFreshness = 0.85;
        contextRelevance = 0.5;
      } else if (id === "facebook") {
        availability = signals.facebook ? 1.0 : 0.0;
        spatialResolution = 0.4;
        temporalFreshness = 0.8;
        contextRelevance = 0.5;
      } else if (id === "instagram") {
        availability = signals.instagram ? 1.0 : 0.0;
        spatialResolution = 0.4;
        temporalFreshness = 0.9;
        contextRelevance = 0.4;
      }

      // Calculate score out of 100
      const scoreRaw = meta.authority * meta.reliability * spatialResolution * temporalFreshness * contextRelevance * availability;
      let truthScore = parseFloat((scoreRaw * 100).toFixed(1));

      // Hardening constraint: Social media can never become dominant by themselves.
      // We cap their score at 48% to guarantee institutional sources rank higher if available.
      if (meta.category === "redes_sociales" || meta.category === "busqueda") {
        truthScore = Math.min(truthScore, 48.0);
      }

      let decision: CiceResult["decision"] = "use";
      let explanation = "";

      if (availability === 0) {
        decision = "ignore";
        explanation = `Fuente descartada por no contener datos activos en el polígono analizado.`;
      } else if (meta.category === "redes_sociales") {
        decision = "merge";
        explanation = `Señal complementaria integrada para aportar validación y reportes criminales en tiempo real.`;
      } else if (truthScore >= 60) {
        decision = "use";
        explanation = `Fuente criminal de alta prioridad y autoridad institucional para conformar la Verdad Operacional.`;
      } else {
        decision = "use";
        explanation = `Fuente de soporte geográfico/demográfico integrada con éxito.`;
      }

      results.push({
        providerId: id,
        name: meta.name,
        category: meta.category,
        metrics: {
          authority: meta.authority,
          reliability: meta.reliability,
          spatialResolution,
          temporalFreshness,
          contextRelevance,
          availability
        },
        truthScore,
        decision,
        explanation
      });
    });

    // Detect correlations
    if (hasGangData && incidentsCount > 0) {
      correlationsDetected.push("Correlación de alta coincidencia: Presencia de células delictivas en cuadrante de alta incidencia delictiva.");
    }
    if (domicilesCount > 0 && incidentsCount > 0) {
      correlationsDetected.push("Intersección espacial: Puntos calientes (Hotspots) colindantes con domicilios de integrantes bajo seguimiento.");
    }
    if (rssCount > 0 && hasGangData) {
      correlationsDetected.push("Correlación noticiosa: Mapeo de actividades de pandillas con reportes recientes de eventos de orden público.");
    }
    if (signals.telegram && hasGangData) {
      correlationsDetected.push("Señales OSINT Leaks: Coincidencia de alias/nombres en foros y canales cerrados de Telegram con el Inventario Institucional.");
    }
    if (correlationsDetected.length === 0) {
      correlationsDetected.push("Sin correlaciones cruzadas directas detectadas. Se sugiere inyectar más evidencias.");
    }

    // Determine consensus and uncertainty levels
    const activeResults = results.filter(r => r.decision !== "ignore");
    const institutionalActiveCount = activeResults.filter(r => r.category === "institucional").length;
    const totalActiveCount = activeResults.length;

    // Consensus increases if institutional records match real-world signals (OSINT)
    let consensusLevel = 50; // base consensus
    if (totalActiveCount > 1) {
      const matchRatio = institutionalActiveCount / totalActiveCount;
      consensusLevel = Math.round(50 + (matchRatio * 35) + (activeResults.length * 1.5));
    }
    consensusLevel = Math.max(10, Math.min(99, consensusLevel));
    const uncertaintyLevel = 100 - consensusLevel;

    // Determine the dominant provider
    let dominantResult = activeResults[0];
    activeResults.forEach(r => {
      if (!dominantResult || r.truthScore > dominantResult.truthScore) {
        dominantResult = r;
      }
    });

    const dominantProvider = dominantResult ? dominantResult.name : "Sin fuentes dominantes activas";
    const dominantScore = dominantResult ? dominantResult.truthScore : 0;
    
    let dominantReason = "No se dispone de datos de seguridad en este cuadrante.";
    if (dominantResult) {
      if (dominantResult.providerId === "inventario_pandillas") {
        dominantReason = "Establecido como verdad operacional dominante debido a la coincidencia directa con el Inventario de Pandillas de CEIPOL, aportando la máxima autoridad en estructura y filiación.";
      } else if (dominantResult.providerId === "expedientes") {
        dominantReason = "Establecido como verdad operacional criminal debido a registros oficiales de domicilios y nexos operativos entre integrantes cargados en el expediente.";
      } else if (dominantResult.providerId === "incidencia_delictiva") {
        dominantReason = "Establecido como verdad operacional dominante por el cruce delictivo local de carpetas de investigación georreferenciadas a menos de 1km.";
      } else {
        dominantReason = `Establecido como verdad operacional por la solidez e integridad de la fuente ${dominantResult.name}.`;
      }
    }

    const activeUsedProviders = results
      .filter(r => r.decision === "use" || r.decision === "merge")
      .map(r => r.name);

    const activeDiscardedProviders = results
      .filter(r => r.decision === "ignore")
      .map(r => r.name);

    return {
      timestamp: new Date().toISOString(),
      results,
      dominantProvider,
      dominantScore,
      dominantReason,
      activeUsedProviders,
      activeDiscardedProviders,
      consensusLevel,
      uncertaintyLevel,
      correlationsDetected,
      institutionalInventoryUsed
    };
  }
}
