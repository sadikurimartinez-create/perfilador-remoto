export interface TelemetryStats {
  system: {
    total_requests: number;
    success_rate: number;
    failure_rate: number;
    average_latency_ms: number;
  };
  providers: Record<string, {
    total_requests: number;
    total_successes: number;
    total_failures: number;
    average_latency_ms: number;
    status: "healthy" | "degraded" | "blocked";
  }>;
  geo: {
    active_events: number;
    critical_zones: number;
    decision_latency_ms: number;
  };
}

export class GeointTelemetry {
  // Global Aggregates
  private static system_total_requests = 0;
  private static system_successes = 0;
  private static system_failures = 0;
  private static system_cumulative_latency = 0;

  // Provider-Specific stats
  private static providerStats: Map<string, {
    requests: number;
    successes: number;
    failures: number;
    cumulative_latency: number;
  }> = new Map();

  // Geo Metrics
  private static active_events_count = 0;
  private static critical_zones_count = 0;
  private static last_decision_latency = 0;

  /**
   * Records a request execution trace in telemetry.
   */
  public static recordRequest(
    providerId: string,
    latencyMs: number,
    isSuccess: boolean
  ): void {
    // 1. Update Global System stats
    this.system_total_requests++;
    if (isSuccess) {
      this.system_successes++;
    } else {
      this.system_failures++;
    }
    this.system_cumulative_latency += latencyMs;

    // 2. Update Provider-specific stats
    let stats = this.providerStats.get(providerId);
    if (!stats) {
      stats = { requests: 0, successes: 0, failures: 0, cumulative_latency: 0 };
    }
    stats.requests++;
    if (isSuccess) {
      stats.successes++;
    } else {
      stats.failures++;
    }
    stats.cumulative_latency += latencyMs;
    this.providerStats.set(providerId, stats);
  }

  /**
   * Updates real-time Geo Operations metrics.
   */
  public static updateGeoMetrics(
    activeEvents: number,
    criticalZones: number,
    decisionLatencyMs?: number
  ): void {
    this.active_events_count = activeEvents;
    this.critical_zones_count = criticalZones;
    if (decisionLatencyMs !== undefined) {
      this.last_decision_latency = decisionLatencyMs;
    }
  }

  /**
   * Resets all telemetry data.
   */
  public static reset(): void {
    this.system_total_requests = 0;
    this.system_successes = 0;
    this.system_failures = 0;
    this.system_cumulative_latency = 0;
    this.providerStats.clear();
    this.active_events_count = 0;
    this.critical_zones_count = 0;
    this.last_decision_latency = 0;
  }

  /**
   * Computes and returns the complete real-time Observability telemetry payload.
   */
  public static getStats(): TelemetryStats {
    const avgLatency = this.system_total_requests > 0 
      ? Math.round(this.system_cumulative_latency / this.system_total_requests)
      : 0;

    const successRate = this.system_total_requests > 0
      ? parseFloat((this.system_successes / this.system_total_requests).toFixed(3))
      : 1.0;

    const failureRate = this.system_total_requests > 0
      ? parseFloat((this.system_failures / this.system_total_requests).toFixed(3))
      : 0.0;

    const providers: TelemetryStats["providers"] = {};

    // Standard list of providers we want to ensure always appear in telemetry reports
    const expectedProviders = ["noaa", "nasa", "conagua", "inegi", "osint", "hydro_fusion", "google", "copernicus"];

    expectedProviders.forEach(p => {
      const stats = this.providerStats.get(p);
      if (!stats) {
        providers[p] = {
          total_requests: 0,
          total_successes: 0,
          total_failures: 0,
          average_latency_ms: 0,
          status: "healthy"
        };
      } else {
        const provAvgLatency = stats.requests > 0 ? Math.round(stats.cumulative_latency / stats.requests) : 0;
        const provSuccessRate = stats.requests > 0 ? stats.successes / stats.requests : 1.0;

        let status: "healthy" | "degraded" | "blocked" = "healthy";
        if (provSuccessRate < 0.50) {
          status = "blocked";
        } else if (provSuccessRate < 0.85 || provAvgLatency > 5000) {
          status = "degraded";
        }

        providers[p] = {
          total_requests: stats.requests,
          total_successes: stats.successes,
          total_failures: stats.failures,
          average_latency_ms: provAvgLatency,
          status
        };
      }
    });

    return {
      system: {
        total_requests: this.system_total_requests,
        success_rate: successRate,
        failure_rate: failureRate,
        average_latency_ms: avgLatency
      },
      providers,
      geo: {
        active_events: this.active_events_count,
        critical_zones: this.critical_zones_count,
        decision_latency_ms: this.last_decision_latency
      }
    };
  }
}
export default GeointTelemetry;
