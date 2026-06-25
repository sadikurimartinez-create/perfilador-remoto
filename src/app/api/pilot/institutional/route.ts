import { NextResponse } from "next/server";
import { InstitutionalContextEngine } from "@/lib/pilot/institutionalContextEngine";
import { GeoDecision } from "@/lib/iri/decision/geoDecisionEngine";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilot/institutional
 * Exposes institutional status (inst_005 schema), active operational tier, and full Audit Trail.
 */
export async function GET() {
  try {
    const engine = InstitutionalContextEngine.getInstance();
    const status = engine.getInstitutionalStatus();
    const context = engine.getContext();
    const audit_trail = engine.getAuditTrail();

    return NextResponse.json({
      ...status,
      context,
      audit_trail
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to retrieve institutional operational telemetry",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pilot/institutional
 * Processes institutional decision-making approvals or logs automatic blocked dispatches under Governance.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const engine = InstitutionalContextEngine.getInstance();

    if (!action) {
      return NextResponse.json(
        { status: "error", message: "Missing parameter: action is required." },
        { status: 400 }
      );
    }

    if (action === "process_decision") {
      const { decision, human_approved, actor, justification } = body;
      
      if (!decision || typeof human_approved !== "boolean") {
        return NextResponse.json(
          { status: "error", message: "Missing parameters: 'decision' (GeoDecision) and 'human_approved' (boolean) are required." },
          { status: 400 }
        );
      }

      const result = engine.processInstitutionalDecision(
        decision as GeoDecision,
        human_approved,
        actor || "anonymous_operator",
        justification || ""
      );

      return NextResponse.json({
        success: true,
        ...result
      });
    }

    if (action === "log_manual_override") {
      const { event_id, justification, source_trace } = body;
      if (!event_id || !justification) {
        return NextResponse.json(
          { status: "error", message: "Missing parameters: 'event_id' and 'justification' are required for overrides." },
          { status: 400 }
        );
      }

      const record = engine.logAudit(
        event_id,
        "MANUAL OVERRIDE / FORCE COMMAND",
        "human",
        justification,
        source_trace || ["manual_operator"]
      );

      return NextResponse.json({
        status: "ok",
        message: `Manual override audit log created for event ${event_id}.`,
        audit_record: record
      });
    }

    return NextResponse.json(
      { status: "error", message: `Unsupported institutional action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to execute institutional operation command",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}
