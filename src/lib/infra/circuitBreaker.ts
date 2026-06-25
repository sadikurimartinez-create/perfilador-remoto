export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export class CircuitBreaker {
  private static registry: Map<string, CircuitBreaker> = new Map();

  // Settings
  private static readonly FAILURE_THRESHOLD_RATE = 0.50; // > 50% failure rate
  private static readonly CONSECUTIVE_FAILURE_LIMIT = 3;   // 3 consecutive failures
  private static readonly COOLDOWN_PERIOD_MS = 30 * 1000;  // 30 seconds cooldown
  private static readonly ROLLING_WINDOW_SIZE = 10;        // last 10 requests

  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures: number = 0;
  private recentResults: boolean[] = []; // true for success, false for failure
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(public readonly providerId: string) {}

  /**
   * Retrieves or creates a Circuit Breaker instance for a specific provider.
   */
  public static getBreaker(providerId: string): CircuitBreaker {
    let breaker = CircuitBreaker.registry.get(providerId);
    if (!breaker) {
      breaker = new CircuitBreaker(providerId);
      CircuitBreaker.registry.set(providerId, breaker);
    }
    return breaker;
  }

  /**
   * Retrieves states of all registered circuit breakers.
   */
  public static getAllBreakersStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [id, breaker] of CircuitBreaker.registry.entries()) {
      stats[id] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Resets all circuit breakers to CLOSED.
   */
  public static resetAll(): void {
    for (const breaker of CircuitBreaker.registry.values()) {
      breaker.reset();
    }
  }

  /**
   * Returns current breaker statistics.
   */
  public getStats(): CircuitBreakerStats {
    this.checkCooldownExpiry();
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Determines if a request should be allowed through.
   */
  public canExecute(): boolean {
    this.checkCooldownExpiry();

    if (this.state === "OPEN") {
      return false;
    }

    return true;
  }

  /**
   * Records a successful execution.
   */
  public recordSuccess(): void {
    this.totalRequests++;
    this.totalSuccesses++;
    this.consecutiveFailures = 0;
    this.recordRollingResult(true);

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.nextAttemptTime = null;
      console.log(`[CIRCUIT_BREAKER] Provider '${this.providerId}' has fully recovered. Transitioned HALF_OPEN -> CLOSED.`);
    }
  }

  /**
   * Records a failed execution.
   */
  public recordFailure(): void {
    this.totalRequests++;
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.recordRollingResult(false);

    const failureRate = this.calculateFailureRate();

    if (this.state === "CLOSED") {
      if (
        this.consecutiveFailures >= CircuitBreaker.CONSECUTIVE_FAILURE_LIMIT ||
        (this.recentResults.length >= 5 && failureRate >= CircuitBreaker.FAILURE_THRESHOLD_RATE)
      ) {
        this.trip();
      }
    } else if (this.state === "HALF_OPEN") {
      this.trip();
    }
  }

  /**
   * Trips the breaker to the OPEN state.
   */
  private trip(): void {
    this.state = "OPEN";
    this.nextAttemptTime = Date.now() + CircuitBreaker.COOLDOWN_PERIOD_MS;
    console.warn(`[CIRCUIT_BREAKER] Provider '${this.providerId}' tripped! State: OPEN. Cooldown expires in ${CircuitBreaker.COOLDOWN_PERIOD_MS / 1000}s.`);
  }

  /**
   * Checks if the cooldown period has expired to try recovery (HALF_OPEN).
   */
  private checkCooldownExpiry(): void {
    if (this.state === "OPEN" && this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
      this.state = "HALF_OPEN";
      this.nextAttemptTime = null;
      console.log(`[CIRCUIT_BREAKER] Provider '${this.providerId}' cooling period expired. Transitioned OPEN -> HALF_OPEN.`);
    }
  }

  /**
   * Resets the breaker to a healthy CLOSED state.
   */
  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.recentResults = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  private recordRollingResult(success: boolean): void {
    this.recentResults.push(success);
    if (this.recentResults.length > CircuitBreaker.ROLLING_WINDOW_SIZE) {
      this.recentResults.shift();
    }
  }

  private calculateFailureRate(): number {
    if (this.recentResults.length === 0) return 0;
    const failures = this.recentResults.filter(r => !r).length;
    return failures / this.recentResults.length;
  }
}
