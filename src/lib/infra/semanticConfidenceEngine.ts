export interface SemanticAnalysisResult {
  hydro_truth_score: number;
  confidence: number;
  redundancy_penalty: number;
  independence_score: number;
  sources: Record<string, "correlated" | "partially_independent" | "independent">;
}

export class SemanticConfidenceEngine {
  /**
   * Evaluates and refines multiple hydrometeorological signals,
   * discounting false consensus arising from highly correlated sources.
   *
   * Signal Dependency Graph:
   * - NOAA <-> CONAGUA: HIGH correlation (same weather event / precipitation phenomenon)
   * - CENAPRED: Moderate independent signal (structural risk, historical terrain susceptibility)
   * - NASA: Highly independent satellite layer (macro-soil moisture anomaly)
   */
  public static analyze(signals: {
    noaa?: number;       // [0, 1] signal strength
    conagua?: number;    // [0, 1] signal strength
    cenapred?: number;   // [0, 1] signal strength
    nasa?: number;       // [0, 1] signal strength
  }): SemanticAnalysisResult {
    const activeSources = new Set<string>();
    if (signals.noaa !== undefined) activeSources.add("NOAA");
    if (signals.conagua !== undefined) activeSources.add("CONAGUA");
    if (signals.cenapred !== undefined) activeSources.add("CENAPRED");
    if (signals.nasa !== undefined) activeSources.add("NASA");

    const n_sources = activeSources.size;
    if (n_sources === 0) {
      return {
        hydro_truth_score: 0.0,
        confidence: 0.0,
        redundancy_penalty: 0.0,
        independence_score: 1.0,
        sources: {}
      };
    }

    // Determine semantic status for each source
    const sourcesStatus: Record<string, "correlated" | "partially_independent" | "independent"> = {};
    
    // NOAA and CONAGUA are highly correlated when both are active
    const hasNoaa = activeSources.has("NOAA");
    const hasConagua = activeSources.has("CONAGUA");
    
    if (hasNoaa) {
      sourcesStatus["NOAA"] = hasConagua ? "correlated" : "independent";
    }
    if (hasConagua) {
      sourcesStatus["CONAGUA"] = hasNoaa ? "correlated" : "independent";
    }
    if (activeSources.has("CENAPRED")) {
      sourcesStatus["CENAPRED"] = "partially_independent";
    }
    if (activeSources.has("NASA")) {
      sourcesStatus["NASA"] = "independent";
    }

    // 1. Calculate Redundancy Penalty
    // If NOAA and CONAGUA both report, they are overlapping.
    // Penalty is higher when their signals are both high and agree.
    let redundancy_penalty = 0.0;
    if (hasNoaa && hasConagua) {
      const valNoaa = signals.noaa || 0;
      const valConagua = signals.conagua || 0;
      // High correlation penalty up to 0.20 when both are active and matching
      const signalAgreement = 1.0 - Math.abs(valNoaa - valConagua);
      redundancy_penalty = parseFloat((0.15 * signalAgreement + 0.03).toFixed(3));
    }

    // 2. Calculate Independence Score [0, 1]
    // A system with purely independent sources (like NASA + CENAPRED) has an independence score of 1.0.
    // Overlapping correlated sources (NOAA + CONAGUA) drag it down.
    let totalPossiblePairs = 0;
    let correlatedPairs = 0;
    
    if (n_sources > 1) {
      totalPossiblePairs = (n_sources * (n_sources - 1)) / 2;
      if (hasNoaa && hasConagua) {
        correlatedPairs += 1.0; // 100% correlation
      }
      if (hasNoaa && activeSources.has("CENAPRED")) {
        correlatedPairs += 0.3; // moderate correlation
      }
      if (hasConagua && activeSources.has("CENAPRED")) {
        correlatedPairs += 0.3; // moderate correlation
      }
    }
    
    const correlationRatio = totalPossiblePairs > 0 ? (correlatedPairs / totalPossiblePairs) : 0.0;
    const independence_score = parseFloat((1.0 - correlationRatio).toFixed(3));

    // 3. Calculate Confidence with diminishing returns curve: log(1 + n_sources)
    // base log gain normalized so that 1 source gives ~70%, and multiple sources approach limit without linear sum
    const logFactor = Math.log(1 + n_sources) / Math.log(2); // log2(1 + n_sources) -> for 1 is 1, for 2 is 1.58, for 3 is 2.0
    let baseConfidence = 0.70 + (logFactor - 1) * 0.15; // 1 source = 0.70, 2 sources = 0.787, 3 sources = 0.85
    
    // Penalize confidence if there is high redundancy
    const confidence = parseFloat(Math.min(0.98, Math.max(0.10, baseConfidence - redundancy_penalty * 0.5)).toFixed(3));

    // 4. Calculate HydroTruthScore using Refinement Rule:
    // HydroTruthScore = base_signal + independent_signal_bonus - uncertainty_penalty_adjustment
    // Let's identify the base signal (the primary local hydrology/precipitation measurement)
    // Conagua is local reality, NOAA is global prediction, CENAPRED is susceptibility, NASA is satellite
    const base_signal = signals.conagua !== undefined ? signals.conagua 
                      : signals.noaa !== undefined ? signals.noaa 
                      : signals.cenapred !== undefined ? signals.cenapred 
                      : signals.nasa || 0.0;

    // Independent signal bonus (from CENAPRED / NASA which are not highly correlated)
    let independent_signal_bonus = 0.0;
    if (activeSources.has("CENAPRED") && (hasNoaa || hasConagua)) {
      independent_signal_bonus += (signals.cenapred || 0) * 0.12; // up to +0.12 bonus for independent terrain verification
    }
    if (activeSources.has("NASA")) {
      independent_signal_bonus += (signals.nasa || 0) * 0.15; // up to +0.15 bonus for independent satellite verification
    }

    // Uncertainty penalty adjustment (higher redundancy or disagreement increases uncertainty penalty)
    let uncertainty_penalty_adjustment = 0.0;
    if (hasNoaa && hasConagua) {
      // Disagreement or consensus on extreme rain without local ground truth confirmation
      const delta = Math.abs((signals.noaa || 0) - (signals.conagua || 0));
      uncertainty_penalty_adjustment = (redundancy_penalty * 0.8) + (delta * 0.15);
    }

    const hydro_truth_score = parseFloat(
      Math.min(1.0, Math.max(0.0, base_signal + independent_signal_bonus - uncertainty_penalty_adjustment)).toFixed(3)
    );

    return {
      hydro_truth_score,
      confidence,
      redundancy_penalty,
      independence_score,
      sources: sourcesStatus
    };
  }
}
