import { NextResponse } from "next/server";
import { PilotValidationEngine } from "@/lib/pilot/pilotValidationEngine";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilot/metrics
 * Returns live GEOINT system stability metrics, volatility indices, authority drift indicators, and consistency ratings.
 */
export async function GET() {
  try {
    const engine = PilotValidationEngine.getInstance();
    const metrics = engine.calculateStabilityScore();

    return NextResponse.json({
      ...metrics,
      stress_mode: engine.getStressMode()
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to calculate pilot validation metrics",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pilot/metrics
 * Allows manual stress simulation triggers during pilots.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scenario } = body;

    if (!scenario) {
      return NextResponse.json(
        { status: "error", message: "Missing parameter: scenario is required." },
        { status: 400 }
      );
    }

    const validScenarios = ["LATENCY_SPIKE", "DATA_LOSS", "OSINT_OVERLOAD", "CONFLICTING_HYDRO", "NONE"];
    if (!validScenarios.includes(scenario)) {
      return NextResponse.json(
        { status: "error", message: `Invalid scenario: must be one of ${validScenarios.join(", ")}` },
        { status: 400 }
      );
    }

    const engine = PilotValidationEngine.getInstance();
    engine.simulateOperationalStress(scenario);
    const metrics = engine.calculateStabilityScore();

    return NextResponse.json({
      status: "ok",
      message: `Successfully simulated stress scenario: ${scenario}`,
      metrics
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to trigger stress simulation",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}
