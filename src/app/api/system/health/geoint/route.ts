import { NextResponse } from "next/server";
import { CircuitBreaker } from "@/lib/infra/circuitBreaker";
import { GeointTelemetry } from "@/lib/infra/geointTelemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const telemetry = GeointTelemetry.getStats();
  const breakers = CircuitBreaker.getAllBreakersStats();

  const openBreakers: string[] = [];
  const halfOpenBreakers: string[] = [];

  for (const [id, stats] of Object.entries(breakers)) {
    if (stats.state === "OPEN") {
      openBreakers.push(id);
    } else if (stats.state === "HALF_OPEN") {
      halfOpenBreakers.push(id);
    }
  }

  // Determine overall system status
  let status = "OPERATIONAL";
  if (openBreakers.length > 0) {
    if (openBreakers.includes("hydro_fusion") || openBreakers.includes("noaa")) {
      status = "DEGRADED"; // Core critical provider is down
    } else {
      status = "PARTIALLY_DEGRADED";
    }
  }

  // Format provider health statuses
  const providers: Record<string, string> = {};
  for (const [id, details] of Object.entries(telemetry.providers)) {
    providers[id] = details.status;
  }

  // Ensure default providers are always mapped in the response payload
  const tracked = ["noaa", "nasa", "conagua", "inegi", "osint", "hydro_fusion", "google", "copernicus"];
  tracked.forEach(p => {
    if (!providers[p]) {
      const breakerState = CircuitBreaker.getBreaker(p).getStats().state;
      providers[p] = breakerState === "OPEN" ? "blocked" : breakerState === "HALF_OPEN" ? "degraded" : "healthy";
    }
  });

  const responsePayload = {
    status,
    providers,
    system_latency: telemetry.system.average_latency_ms || 0,
    error_rate: telemetry.system.failure_rate,
    circuit_breakers: {
      open: openBreakers,
      half_open: halfOpenBreakers
    }
  };

  return NextResponse.json(responsePayload);
}
