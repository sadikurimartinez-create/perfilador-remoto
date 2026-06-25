import { CircuitBreaker } from "./circuitBreaker";
import { GeointTelemetry } from "./geointTelemetry";

export interface ProviderHealth {
  provider: string;
  latency_ms: number;
  success_rate: number;
  error_rate: number;
  confidence_score: number;
  last_check: string;
}

export class GeointReliabilityEngine {
  private static healthRegistry: Map<string, ProviderHealth> = new Map();

  /**
   * Calculates a dynamic reliability score [0.0, 1.0] for a provider based on its breaker state,
   * latency, and historical success rates.
   */
  public static getReliabilityScore(providerId: string): number {
    const breaker = CircuitBreaker.getBreaker(providerId);
    const stats = breaker.getStats();

    // 1. If circuit breaker is OPEN, reliability is absolutely zero
    if (stats.state === "OPEN") {
      return 0.0;
    }

    // 2. Compute raw historical success rate
    let successRate = 1.0;
    if (stats.totalRequests > 0) {
      successRate = stats.totalSuccesses / stats.totalRequests;
    }

    // 3. Compute penalty for degraded/latency state (e.g. latency > 8s / 8000ms reduces score)
    const telemetry = GeointTelemetry.getStats();
    const providerTelemetry = telemetry.providers[providerId];
    let latencyPenalty = 0.0;
    if (providerTelemetry && providerTelemetry.average_latency_ms > 8000) {
      latencyPenalty = 0.20; // 20% penalty for sluggish response times
    }

    // 4. Calculate final combined score bound strictly [0.0, 1.0]
    let score = successRate - latencyPenalty;
    if (stats.state === "HALF_OPEN") {
      score = Math.min(score, 0.50); // limit HALF_OPEN reliability to 50% max during trial phase
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Applies the dynamic reliability weighting formula (Fase 1.2):
   * effective_weight = base_weight * reliability_score
   */
  public static getEffectiveWeight(providerId: string, baseWeight: number): number {
    const reliability = this.getReliabilityScore(providerId);
    return parseFloat((baseWeight * reliability).toFixed(3));
  }

  /**
   * Generates a detailed ProviderHealth scoring record for live auditing.
   */
  public static computeHealthScore(providerId: string): ProviderHealth {
    const breaker = CircuitBreaker.getBreaker(providerId);
    const stats = breaker.getStats();
    const telemetry = GeointTelemetry.getStats();
    const provTel = telemetry.providers[providerId];

    const latency = provTel?.average_latency_ms || 0;
    const successRate = stats.totalRequests > 0 ? (stats.totalSuccesses / stats.totalRequests) : 1.0;
    const reliabilityScore = this.getReliabilityScore(providerId);

    const health: ProviderHealth = {
      provider: providerId,
      latency_ms: latency,
      success_rate: parseFloat(successRate.toFixed(3)),
      error_rate: parseFloat((1.0 - successRate).toFixed(3)),
      confidence_score: Math.round(reliabilityScore * 100),
      last_check: new Date().toISOString()
    };

    this.healthRegistry.set(providerId, health);
    return health;
  }

  /**
   * Retrieves health scores of all active providers.
   */
  public static getAllProviderHealths(): Record<string, ProviderHealth> {
    const healths: Record<string, ProviderHealth> = {};
    const trackedProviders = ["noaa", "nasa", "conagua", "inegi", "osint", "hydro_fusion", "google", "copernicus"];

    trackedProviders.forEach(p => {
      healths[p] = this.computeHealthScore(p);
    });

    return healths;
  }
}
export default GeointReliabilityEngine;
