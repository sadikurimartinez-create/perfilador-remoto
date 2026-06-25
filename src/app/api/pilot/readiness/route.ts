import { NextResponse } from "next/server";
import { InstitutionalContextEngine } from "@/lib/pilot/institutionalContextEngine";
import { PilotValidationEngine } from "@/lib/pilot/pilotValidationEngine";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilot/readiness
 * Retrieves the formalized final GEOINT readiness and certification telemetry payload (final_003).
 */
export async function GET() {
  try {
    const instEngine = InstitutionalContextEngine.getInstance();
    const valEngine = PilotValidationEngine.getInstance();

    const stabilityStats = valEngine.calculateStabilityScore();
    const instStatus = instEngine.getInstitutionalStatus();

    // Verify system readiness statuses based on live engines
    const iri_engine_status = stabilityStats.iri_volatility < 0.40 ? "STABLE" : "SENSITIVE_MONITORING";
    const governance_status = instStatus.decision_flow === "HITL_CONTROLLED" ? "ACTIVE" : "INACTIVE";
    const pilot_status = stabilityStats.stability_score > 0.70 ? "READY" : "DEGRADED_PILOT";
    const audit_status = instStatus.audit_status === "ACTIVE" ? "ENABLED" : "DISABLED";

    const certificationPayload = {
      status: "OPERATIONAL",
      mode: "INSTITUTIONAL",
      iri_engine: iri_engine_status,
      governance: governance_status,
      pilot: pilot_status,
      audit: audit_status,
      certification_code: "DEPLOYMENT_CERTIFIED_IRS_2026",
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(certificationPayload);
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to retrieve final readiness certification",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}
