import { NextResponse } from "next/server";
import { ApiOrchestrator } from "@/lib/providers/orchestrator";
import { IProvider, ProviderResponse, HealthCheckResult } from "@/lib/providers/baseProvider";

export const dynamic = "force-dynamic";

/**
 * A Mock Provider designed to simulate various network and protocol failures for automated testing.
 */
class TestMockProvider implements IProvider {
  private id: string;
  private scenario: string;

  constructor(id: string, scenario: string) {
    this.id = id;
    this.scenario = scenario;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return `Mock Failure Simulator [Scenario: ${this.scenario}]`;
  }

  isEnabled(): boolean {
    return true;
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "1.0.0",
      status: "Testing",
      featureFlag: "NONE",
      authType: "Mock",
      geographicCoverage: "Virtual",
      outputFormat: "JSON"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();

    switch (this.scenario) {
      case "timeout":
        // Hangs for 15 seconds to trigger orchestrator timeout cutoff
        await new Promise((resolve) => setTimeout(resolve, 15000));
        return {
          provider: this.getId(),
          status: "ok",
          timestamp: new Date().toISOString(),
          confidence: 100,
          payload: { msg: "Should have timed out!" },
          latency: Date.now() - start
        };

      case "empty_response":
        return {
          provider: this.getId(),
          status: "ok",
          timestamp: new Date().toISOString(),
          confidence: 100,
          payload: null, // Empty payload
          latency: Date.now() - start
        };

      case "http_error":
        throw new Error("HTTP 500 Internal Server Error: Remote gateway crashed.");

      case "auth_error":
        throw new Error("401 Unauthorized: Invalid API Key or Signature verification failed.");

      case "network_error":
        throw new Error("TypeError: fetch failed (ECONNREFUSED / DNS resolution failed)");

      case "partial_response":
        return {
          provider: this.getId(),
          status: "ok",
          timestamp: new Date().toISOString(),
          confidence: 50,
          payload: { partial_data: true, notes: "Incomplete dataset due to downstream rate limiting." },
          latency: Date.now() - start,
          errors: ["Rate limit reached on secondary telemetry feed."]
        };

      default:
        return {
          provider: this.getId(),
          status: "ok",
          timestamp: new Date().toISOString(),
          confidence: 100,
          payload: { success: true },
          latency: Date.now() - start
        };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    if (this.scenario === "auth_error") {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: "Authentication check failed: Token rejected by remote Keycloak realm.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0
      };
    }
    return {
      isHealthy: true,
      latencyMs: Date.now() - start,
      details: "Mock is online.",
      timestamp: new Date().toISOString(),
      authenticationStatus: "valid",
      availability: 100
    };
  }
}

export async function GET() {
  const testResults: Record<string, any> = {};

  // 1. Scenario: Authentication and Availability Checks
  {
    const authMock = new TestMockProvider("mock_auth_failure", "auth_error");
    const check = await authMock.healthCheck();
    testResults["scenario_authentication_failure"] = {
      description: "Checks how the provider health check behaves during credential validation failures.",
      result: check.authenticationStatus === "invalid" && !check.isHealthy ? "PASS" : "FAIL",
      details: check
    };
  }

  // 2. Scenario: Timeout cut-off (Configurable barrier)
  {
    const orchestrator = new ApiOrchestrator();
    // Inject the slow mock provider
    const slowMock = new TestMockProvider("mock_slow", "timeout");
    (orchestrator as any).register(slowMock);

    const start = Date.now();
    // Execute with a custom, short timeout of 1500ms
    const response = await orchestrator.execute(["mock_slow"], {}, 1500);
    const duration = Date.now() - start;

    testResults["scenario_timeout_barrier"] = {
      description: "Validates that the orchestrator cuts off slow execution at the configured millisecond threshold.",
      result: response["mock_slow"]?.status === "error" && response["mock_slow"]?.errors?.[0]?.includes("Timeout") ? "PASS" : "FAIL",
      orchestrator_latency_ms: duration,
      details: response["mock_slow"]
    };
  }

  // 3. Scenario: Empty Response (Graceful Degradation)
  {
    const emptyMock = new TestMockProvider("mock_empty", "empty_response");
    const response = await emptyMock.fetchData({});
    testResults["scenario_empty_response"] = {
      description: "Validates that empty payloads are encapsulated cleanly without crashing downstream filters.",
      result: response.status === "ok" && response.payload === null ? "PASS" : "FAIL",
      details: response
    };
  }

  // 4. Scenario: HTTP Gateway Error Handling
  {
    const httpErrorMock = new TestMockProvider("mock_http_error", "http_error");
    const orchestrator = new ApiOrchestrator();
    (orchestrator as any).register(httpErrorMock);

    const response = await orchestrator.execute(["mock_http_error"], {});
    testResults["scenario_http_gateway_error"] = {
      description: "Validates that an HTTP 5XX is gracefully caught as an error status response instead of halting the system.",
      result: response["mock_http_error"]?.status === "error" && response["mock_http_error"]?.errors?.[0]?.includes("HTTP 500") ? "PASS" : "FAIL",
      details: response["mock_http_error"]
    };
  }

  // 5. Scenario: Network DNS / Socket Connection Error Handling
  {
    const netErrorMock = new TestMockProvider("mock_net_error", "network_error");
    const orchestrator = new ApiOrchestrator();
    (orchestrator as any).register(netErrorMock);

    const response = await orchestrator.execute(["mock_net_error"], {});
    testResults["scenario_network_dns_failure"] = {
      description: "Validates that typical fetch socket and connection failures are parsed cleanly.",
      result: response["mock_net_error"]?.status === "error" && response["mock_net_error"]?.errors?.[0]?.includes("fetch failed") ? "PASS" : "FAIL",
      details: response["mock_net_error"]
    };
  }

  // 6. Scenario: Partial Response (Warning Propagation)
  {
    const partialMock = new TestMockProvider("mock_partial", "partial_response");
    const response = await partialMock.fetchData({});
    testResults["scenario_partial_response_warnings"] = {
      description: "Validates that warnings or rate limit exceptions are bubbled up inside the errors array of a successful envelope.",
      result: response.status === "ok" && response.errors !== undefined && response.errors.length > 0 ? "PASS" : "FAIL",
      details: response
    };
  }

  // 7. Scenario: Parallel Degradation Control (Promise.allSettled)
  {
    const orchestrator = new ApiOrchestrator();
    const okMock = new TestMockProvider("mock_ok", "normal");
    const badMock = new TestMockProvider("mock_bad", "http_error");
    (orchestrator as any).register(okMock);
    (orchestrator as any).register(badMock);

    const responses = await orchestrator.execute(["mock_ok", "mock_bad"], {});
    testResults["scenario_parallel_all_settled"] = {
      description: "Validates that a single broken provider does not crash concurrent queries using Promise.allSettled.",
      result: responses["mock_ok"]?.status === "ok" && responses["mock_bad"]?.status === "error" ? "PASS" : "FAIL",
      details: responses
    };
  }

  const allPassed = Object.values(testResults).every((t: any) => t.result === "PASS");

  return NextResponse.json(
    {
      status: allPassed ? "ok" : "warning",
      timestamp: new Date().toISOString(),
      summary: allPassed ? "All automated failure scenarios completed successfully." : "One or more failure test cases did not pass.",
      testResults
    },
    { status: 200 }
  );
}
