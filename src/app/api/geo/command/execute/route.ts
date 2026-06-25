import { NextResponse } from "next/server";
import { GeoCommandCenter } from "@/lib/geo-command/geoCommandCenter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Strictly dynamic to prevent production build static rendering errors
export const maxDuration = 60; // 60s max execution time

/**
 * POST /api/geo/command/execute
 *
 * Near Real-Time Command System Human-in-the-Loop (HITL) Execution Endpoint.
 * Receives an operation ID, manual operator approval toggle, and dry run settings,
 * processes the manual override layer, and records audit trail and feedback indicators.
 *
 * Input JSON:
 * {
 *   "operation_id": "OP-001",
 *   "mode": "dry_run" | "live",
 *   "approval": true
 * }
 */
export async function POST(req: Request) {
  try {
    let body: any = {};

    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const { operation_id, mode, approval } = body;

    if (!operation_id || typeof operation_id !== "string") {
      return NextResponse.json(
        { error: "Missing required string property 'operation_id'." },
        { status: 400 }
      );
    }

    // Default approval to true if not explicitly set to false
    const isApproved = approval !== false;
    
    // Default execution mode to dry run for security compliance
    const isDryRun = mode !== "live";

    const commandCenter = new GeoCommandCenter();

    // Process the manual Human-in-the-Loop approval/rejection verdict
    const result = commandCenter.processCommandApproval(
      operation_id,
      isApproved,
      "CMD-OPERATOR-INT", // Operator signature
      isDryRun
    );

    if (!result.success) {
      console.warn(`[POST_COMMAND_EXECUTE_FAILED] Op_ID: ${operation_id}. Reason: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 422 } // Unprocessable Entity
      );
    }

    const updatedOp = result.operation!;

    console.log(
      `[POST_COMMAND_EXECUTE] Operation ${operation_id} processed. Approval: ${isApproved}. Status: ${updatedOp.state}.`
    );

    // Return the exact requested schema
    return NextResponse.json({
      status: isApproved ? "APPROVED" : "REJECTED",
      execution_state: updatedOp.state,
      audit_id: result.audit_id || `AUD-CMD-${operation_id}-ERR`,
      impact_tracking: result.feedback || {}
    });

  } catch (error: any) {
    console.error("[POST_COMMAND_EXECUTE_ERROR] Internal server error processing command execution:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred during command operation execution.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
