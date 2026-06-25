import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GoogleProvider } from "./googleProvider";
import { InegiProvider } from "./inegiProvider";
import { NasaProvider } from "./nasaProvider";
import { CopernicusProvider } from "./copernicusProvider";
import { UsgsProvider } from "./usgsProvider";
import { CenapredProvider } from "./cenapredProvider";
import { ConaguaProvider } from "./conaguaProvider";
import { TomorrowIoProvider } from "./tomorrowIoProvider";
import { TelegramProvider } from "./telegramProvider";
import { XProvider } from "./xProvider";
import { FacebookProvider } from "./facebookProvider";
import { InstagramProvider } from "./instagramProvider";
import { RedditProvider } from "./redditProvider";

export class ApiOrchestrator {
  private providers: Map<string, IProvider> = new Map();

  constructor() {
    this.registerProviders();
  }

  /**
   * Discovers and registers all 13 unified providers.
   */
  private registerProviders() {
    this.register(new GoogleProvider());
    this.register(new InegiProvider());
    this.register(new NasaProvider());
    this.register(new CopernicusProvider());
    this.register(new UsgsProvider());
    this.register(new CenapredProvider());
    this.register(new ConaguaProvider());
    this.register(new TomorrowIoProvider());
    this.register(new TelegramProvider());
    this.register(new XProvider());
    this.register(new FacebookProvider());
    this.register(new InstagramProvider());
    this.register(new RedditProvider());
  }

  private register(provider: IProvider) {
    this.providers.set(provider.getId(), provider);
  }

  /**
   * Returns all registered providers.
   */
  public getProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Retrieves a single provider by ID.
   */
  public getProvider(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Helper to run a promise with a timeout barrier.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, providerId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout limit of ${ms}ms exceeded for provider '${providerId}'`));
      }, ms);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Executes a list of selected providers in parallel with timeout, fallbacks, and error boundaries.
   * Uses Promise.allSettled to guarantee that slow or failing providers do not crash the query.
   */
  public async execute(
    providerIds: string[],
    params: any,
    timeoutMs: number = 8000
  ): Promise<Record<string, ProviderResponse>> {
    const results: Record<string, ProviderResponse> = {};
    const promises: Promise<{ id: string; response: ProviderResponse }>[] = [];

    for (const id of providerIds) {
      const provider = this.getProvider(id);
      const start = Date.now();

      if (!provider) {
        const duration = Date.now() - start;
        results[id] = {
          provider: id,
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: duration,
          errors: [`Provider '${id}' was not discovered or registered.`]
        };
        // Log structured error
        this.logStructured(id, start, duration, "error", new Error("Not discovered or registered"));
        continue;
      }

      if (!provider.isEnabled()) {
        const duration = Date.now() - start;
        results[id] = {
          provider: id,
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: duration,
          errors: [`Provider '${id}' is disabled via feature flags.`]
        };
        // Log structured disabled status
        this.logStructured(id, start, duration, "disabled");
        continue;
      }

      // Wrap execution in timeout and error handler
      const execPromise = this.withTimeout(provider.fetchData(params), timeoutMs, id)
        .then((response) => {
          const duration = Date.now() - start;
          this.logStructured(id, start, duration, "ok", undefined, response.metadata?.is_simulated ? "simulated_fallback" : undefined);
          return { id, response };
        })
        .catch((error: any) => {
          const duration = Date.now() - start;
          this.logStructured(id, start, duration, "error", error);
          return {
            id,
            response: {
              provider: id,
              status: "error" as const,
              timestamp: new Date().toISOString(),
              confidence: 0,
              payload: null,
              latency: duration,
              errors: [error.message || "Execution failed."]
            } as ProviderResponse,
          };
        });

      promises.push(execPromise);
    }

    const settled = await Promise.allSettled(promises);

    settled.forEach((item) => {
      if (item.status === "fulfilled") {
        results[item.value.id] = item.value.response;
      }
    });

    return results;
  }

  /**
   * Executes all registered and enabled providers in parallel.
   */
  public async executeAll(params: any, timeoutMs: number = 10000): Promise<Record<string, ProviderResponse>> {
    const activeProviderIds = Array.from(this.providers.values())
      .filter((p) => p.isEnabled())
      .map((p) => p.getId());

    return this.execute(activeProviderIds, params, timeoutMs);
  }

  /**
   * Runs diagnostics and health checks on all registered providers in parallel.
   */
  public async runHealthChecks(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    const promises: Promise<{ id: string; check: HealthCheckResult }>[] = [];

    for (const [id, provider] of this.providers.entries()) {
      const checkPromise = provider.healthCheck()
        .then((check) => ({ id, check }))
        .catch((err: any) => ({
          id,
          check: {
            isHealthy: false,
            latencyMs: 0,
            details: `Uncaught health check error: ${err.message || String(err)}`,
            timestamp: new Date().toISOString(),
            authenticationStatus: "unknown" as any,
            availability: 0
          },
        }));
      promises.push(checkPromise);
    }

    const settled = await Promise.allSettled(promises);
    settled.forEach((item) => {
      if (item.status === "fulfilled") {
        results[item.value.id] = item.value.check;
      }
    });

    return results;
  }

  /**
   * Structured logging utility according to guidelines.
   * Logs provider, date/time, duration, result, exception, fallback used.
   * Never leaks credentials.
   */
  private logStructured(
    providerId: string,
    startTime: number,
    durationMs: number,
    resultStatus: "ok" | "error" | "disabled",
    exception?: Error,
    fallbackUsed?: string
  ) {
    const logEntry = {
      provider: providerId,
      time: new Date(startTime).toISOString(),
      duration: `${durationMs}ms`,
      result: resultStatus,
      exception: exception ? exception.message || String(exception) : null,
      fallback: fallbackUsed || (resultStatus === "error" ? "error_boundary_graceful_degradation" : "none")
    };
    
    // Server console logging
    console.log(`[STRUCTURED_LOG] ${JSON.stringify(logEntry)}`);
  }
}
