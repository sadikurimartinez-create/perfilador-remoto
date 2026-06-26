import { NextResponse } from "next/server";
import { InegiWmsProvider } from "@/lib/providers/inegi_wms_provider";
import { ApiOrchestrator } from "@/lib/providers/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const telemetry = InegiWmsProvider.getTelemetry();
    const orchestrator = new ApiOrchestrator();
    const checks = await orchestrator.runHealthChecks();
    const wmsHealth = checks["inegi_wms"] || {
      isHealthy: false,
      latencyMs: 0,
      details: "No registrado",
      timestamp: new Date().toISOString(),
      availability: 0
    };

    return NextResponse.json({
      telemetry,
      health: wmsHealth
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
