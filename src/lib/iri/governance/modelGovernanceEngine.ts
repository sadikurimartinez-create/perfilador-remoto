import { ProviderResponse } from "../../providers/baseProvider";

export enum SourceAuthorityClass {
  OPERATIONAL_AUTHORITY = "OPERATIONAL_AUTHORITY",
  GLOBAL_OBSERVATIONAL_AUTHORITY = "GLOBAL_OBSERVATIONAL_AUTHORITY",
  HYDROLOGICAL_FIELD_AUTHORITY = "HYDROLOGICAL_FIELD_AUTHORITY",
  OSINT_UNCERTIFIED_SIGNALS = "OSINT_UNCERTIFIED_SIGNALS",
  UNKNOWN = "UNKNOWN"
}

export interface SourceAuthority {
  providerId: string;
  name: string;
  level: number; // 1 to 6 (1 is highest authority)
  authorityScore: number; // [0, 1] authority weighting
  category: SourceAuthorityClass;
}

export interface GeoTruthObject {
  truth_score: number;
  authoritative_source: string;
  conflict_resolved: boolean;
  suppressed_sources: string[];
  geometry: {
    type: "Point" | "Polygon";
    coordinates: any;
  };
  timestamp: string;
}

// ⚖️ MATRIZ DE AUTORIDAD GLOBAL
export const GLOBAL_AUTHORITY_MATRIX: Record<string, SourceAuthority> = {
  cenapred: {
    providerId: "cenapred",
    name: "CENAPRED",
    level: 1,
    authorityScore: 0.95,
    category: SourceAuthorityClass.OPERATIONAL_AUTHORITY
  },
  conagua: {
    providerId: "conagua",
    name: "CONAGUA",
    level: 2,
    authorityScore: 0.90,
    category: SourceAuthorityClass.OPERATIONAL_AUTHORITY
  },
  noaa: {
    providerId: "noaa",
    name: "NOAA",
    level: 3,
    authorityScore: 0.80,
    category: SourceAuthorityClass.GLOBAL_OBSERVATIONAL_AUTHORITY
  },
  nasa: {
    providerId: "nasa",
    name: "NASA",
    level: 4,
    authorityScore: 0.70,
    category: SourceAuthorityClass.GLOBAL_OBSERVATIONAL_AUTHORITY
  },
  copernicus: {
    providerId: "copernicus",
    name: "Copernicus",
    level: 4,
    authorityScore: 0.70,
    category: SourceAuthorityClass.GLOBAL_OBSERVATIONAL_AUTHORITY
  },
  usgs: {
    providerId: "usgs",
    name: "USGS",
    level: 5,
    authorityScore: 0.65,
    category: SourceAuthorityClass.HYDROLOGICAL_FIELD_AUTHORITY
  },
  telegram: {
    providerId: "telegram",
    name: "Telegram OSINT",
    level: 6,
    authorityScore: 0.30,
    category: SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS
  },
  x: {
    providerId: "x",
    name: "X OSINT",
    level: 6,
    authorityScore: 0.30,
    category: SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS
  },
  reddit: {
    providerId: "reddit",
    name: "Reddit OSINT",
    level: 6,
    authorityScore: 0.30,
    category: SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS
  },
  facebook: {
    providerId: "facebook",
    name: "Facebook OSINT",
    level: 6,
    authorityScore: 0.25,
    category: SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS
  },
  instagram: {
    providerId: "instagram",
    name: "Instagram OSINT",
    level: 6,
    authorityScore: 0.25,
    category: SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS
  }
};

export class ModelGovernanceEngine {
  /**
   * Classifies a source according to its authority level and category.
   */
  public static classifySource(providerId: string): SourceAuthorityClass {
    const authority = GLOBAL_AUTHORITY_MATRIX[providerId.toLowerCase()];
    return authority ? authority.category : SourceAuthorityClass.UNKNOWN;
  }

  /**
   * Extracts a standardized physical signal [0, 1] from a provider response.
   */
  public static extractSignal(resp: ProviderResponse, context: "hydrology" | "meteorology" | "risk" | "infrastructure"): number {
    if (!resp || resp.status !== "ok" || !resp.payload) return 0.0;

    const providerId = resp.provider.toLowerCase();
    const payload = resp.payload;
    const innerPayload = payload.payload || payload;

    switch (providerId) {
      case "cenapred":
        if (context === "risk" || context === "infrastructure") {
          const flood = innerPayload?.assessment?.flood_susceptibility || innerPayload?.flood_susceptibility;
          if (flood === "Alta") return 0.90;
          if (flood === "Media") return 0.50;
          return 0.15;
        }
        return innerPayload?.assessment?.vulnerability_score ? innerPayload.assessment.vulnerability_score / 100 : 0.40;

      case "conagua":
        if (context === "hydrology") {
          let max_dam = 0.0;
          if (Array.isArray(innerPayload?.monitored_dams)) {
            innerPayload.monitored_dams.forEach((d: any) => {
              if (d.percentage_capacity > max_dam) max_dam = d.percentage_capacity;
            });
          }
          let max_river = 0.0;
          if (Array.isArray(innerPayload?.river_channels)) {
            innerPayload.river_channels.forEach((r: any) => {
              if (r.capacity_level_percentage > max_river) max_river = r.capacity_level_percentage;
            });
          }
          return Math.min(1.0, Math.max(max_dam, max_river) / 100);
        }
        if (context === "meteorology") {
          return innerPayload?.alerts && innerPayload.alerts.length > 0 ? 0.85 : 0.10;
        }
        return 0.30;

      case "noaa":
        if (context === "meteorology") {
          const precip = innerPayload?.precipitation_mm ?? innerPayload?.daily_summary?.precipitation_mm ?? 0.0;
          const storms = Array.isArray(innerPayload?.active_storms) ? innerPayload.active_storms.length * 0.40 : 0.0;
          return Math.min(1.0, Math.max(precip / 50, storms));
        }
        return innerPayload?.hydrology || 0.20;

      case "usgs":
        if (context === "hydrology") {
          const ts = innerPayload?.timeSeries || innerPayload?.payload?.timeSeries;
          if (Array.isArray(ts) && ts.length > 0) {
            const val = ts[0]?.values?.[0]?.value || 0;
            return Math.min(1.0, val / 50); // Normalized against 50 cfs limit
          }
        }
        return 0.15;

      case "nasa":
      case "copernicus":
        return innerPayload?.soil_moisture_anomaly ?? innerPayload?.fused_metrics?.soil_saturation ?? 0.35;

      case "telegram":
      case "x":
      case "reddit":
      case "facebook":
      case "instagram":
        // OSINT Signal strength based on emergency keywords
        const str = JSON.stringify(innerPayload).toLowerCase();
        let matches = 0;
        const keywords = ["lluvia", "inundación", "charco", "anegado", "desborde", "agua", "tormenta"];
        keywords.forEach(kw => {
          const regex = new RegExp(kw, "g");
          const m = str.match(regex);
          if (m) matches += m.length;
        });
        return Math.min(1.0, matches / 10);

      default:
        return typeof innerPayload === "number" ? innerPayload : (innerPayload?.risk_score || innerPayload?.value || 0.20);
    }
  }

  /**
   * Contextual Authority Resolver to determine which source dominates a given context.
   */
  private static getDominantSource(
    activeProviders: string[],
    context: "hydrology" | "meteorology" | "risk" | "infrastructure",
    signals: Record<string, number>
  ): string {
    const recognized = activeProviders.filter(p => GLOBAL_AUTHORITY_MATRIX[p.toLowerCase()] !== undefined);
    if (recognized.length === 0) {
      return activeProviders[0] || "unknown";
    }

    // Apply strict contextual governance dominants
    if (context === "hydrology") {
      // USGS dominates physical river flows, CONAGUA dominates local water infrastructure
      if (activeProviders.includes("usgs")) return "usgs";
      if (activeProviders.includes("conagua")) return "conagua";
    } else if (context === "meteorology") {
      const noaaVal = signals["noaa"] || 0;
      const conaguaVal = signals["conagua"] || 0;
      // Heuristic: If NOAA signals a major global storm and CONAGUA is low, NOAA dominates.
      // Otherwise, CONAGUA as the local operational authority dominates local weather.
      if (activeProviders.includes("noaa") && noaaVal > conaguaVal + 0.30) {
        return "noaa";
      }
      if (activeProviders.includes("conagua")) return "conagua";
    } else if (context === "risk") {
      if (activeProviders.includes("cenapred")) return "cenapred";
    } else if (context === "infrastructure") {
      if (activeProviders.includes("cenapred")) return "cenapred";
      if (activeProviders.includes("inegi")) return "inegi";
    }

    // Default: Sort by global hierarchy level (level 1 is highest)
    recognized.sort((a, b) => {
      const authA = GLOBAL_AUTHORITY_MATRIX[a.toLowerCase()];
      const authB = GLOBAL_AUTHORITY_MATRIX[b.toLowerCase()];
      return authA.level - authB.level;
    });

    return recognized[0];
  }

  /**
   * Core conflict resolution engine which prevents averaging or simple linear sums,
   * arbitrating based on contextual authority instead.
   */
  public static resolve(
    signals: Record<string, number>,
    context: "hydrology" | "meteorology" | "risk" | "infrastructure",
    geometry?: any
  ): GeoTruthObject {
    const activeEntries = Object.entries(signals).filter(([_, val]) => val !== undefined && val >= 0.0);
    const activeProviders = activeEntries.map(([prov]) => prov.toLowerCase());

    const geom = geometry || {
      type: "Unknown",
      coordinates: []
    };

    if (activeEntries.length === 0) {
      return {
        truth_score: 0.0,
        authoritative_source: "NONE",
        conflict_resolved: false,
        suppressed_sources: [],
        geometry: geom,
        timestamp: new Date().toISOString()
      };
    }

    if (activeEntries.length === 1) {
      const [prov, val] = activeEntries[0];
      const formalName = GLOBAL_AUTHORITY_MATRIX[prov.toLowerCase()]?.name || prov.toUpperCase();
      return {
        truth_score: val,
        authoritative_source: formalName,
        conflict_resolved: false,
        suppressed_sources: [],
        geometry: geom,
        timestamp: new Date().toISOString()
      };
    }

    // --- STEP 1: DETECT CONFLICT ---
    // If the difference between max and min signals is > 0.35, we trigger conflict resolution.
    const values = activeEntries.map(([_, val]) => val);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const conflict_detected = (maxVal - minVal) > 0.35;

    // --- STEP 2 & 3: IDENTIFY CONTEXTUAL DOMINANT SOURCE ---
    const dominantKey = this.getDominantSource(activeProviders, context, signals);
    const dominantVal = signals[dominantKey] ?? 0.0;
    const dominantAuthority = GLOBAL_AUTHORITY_MATRIX[dominantKey];
    const authoritative_source = dominantAuthority ? dominantAuthority.name : dominantKey.toUpperCase();

    const suppressed_sources: string[] = [];
    const supporting_sources: string[] = [];

    // --- STEP 4: FILTER SECONDARY SOURCES ---
    for (const [prov, val] of activeEntries) {
      if (prov.toLowerCase() === dominantKey.toLowerCase()) continue;

      const diff = Math.abs(val - dominantVal);
      const auth = GLOBAL_AUTHORITY_MATRIX[prov.toLowerCase()];
      const isOsint = auth?.category === SourceAuthorityClass.OSINT_UNCERTIFIED_SIGNALS;

      // Disagreeing sources (> 0.35 delta) or uncertified OSINT sources contradicting authoritative measurements
      if (diff > 0.35 || (isOsint && diff > 0.15)) {
        suppressed_sources.push(auth ? auth.name : prov.toUpperCase());
      } else {
        supporting_sources.push(auth ? auth.name : prov.toUpperCase());
      }
    }

    // --- STEP 5: GENERATE FINAL TRUTH SCORE ---
    let truth_score = dominantVal;

    if (conflict_detected) {
      // NO AVERAGING: Dominant source provides the solid baseline.
      // Agreeing supporting sources provide a highly restricted, diminishing returns bonus (max +0.08 cumulative)
      let supporting_bonus = 0.0;
      supporting_sources.forEach(src => {
        const key = src.toLowerCase().split(" ")[0]; // map back to key
        const val = signals[key] ?? 0.0;
        supporting_bonus += val * 0.04;
      });

      // Suppressed sources have their signal drastically degraded by a factor of 0.01 to eliminate their noise impact
      let suppressed_remnant = 0.0;
      suppressed_sources.forEach(src => {
        const key = src.toLowerCase().split(" ")[0];
        const val = signals[key] ?? 0.0;
        suppressed_remnant += val * 0.01;
      });

      truth_score = dominantVal + Math.min(0.08, supporting_bonus) + Math.min(0.02, suppressed_remnant);
    } else {
      // CONSENSUS (NO CONFLICT): Smoothly blend signals using a weighted authority ratio
      let totalAuthority = 0.0;
      let weightedSum = 0.0;

      activeEntries.forEach(([prov, val]) => {
        const auth = GLOBAL_AUTHORITY_MATRIX[prov.toLowerCase()];
        const weight = auth ? auth.authorityScore : 0.40;
        weightedSum += val * weight;
        totalAuthority += weight;
      });

      truth_score = totalAuthority > 0 ? (weightedSum / totalAuthority) : dominantVal;
    }

    // Ensure truth_score is strictly capped [0, 1]
    truth_score = parseFloat(Math.min(1.0, Math.max(0.0, truth_score)).toFixed(3));

    return {
      truth_score,
      authoritative_source,
      conflict_resolved: conflict_detected,
      suppressed_sources,
      geometry: geom,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Entry point for running governance over direct ProviderResponses.
   */
  public static governResponses(
    responses: Record<string, ProviderResponse>,
    context: "hydrology" | "meteorology" | "risk" | "infrastructure",
    geometry?: any
  ): GeoTruthObject {
    const signals: Record<string, number> = {};

    Object.entries(responses).forEach(([prov, resp]) => {
      if (resp && resp.status === "ok") {
        signals[prov] = this.extractSignal(resp, context);
      }
    });

    return this.resolve(signals, context, geometry);
  }
}
