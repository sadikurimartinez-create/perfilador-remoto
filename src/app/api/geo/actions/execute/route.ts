import { NextResponse } from "next/server";
import { GeoActionOrchestrator } from "@/lib/iri/actions/geoActionOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Strictly dynamic to prevent production build static rendering errors
export const maxDuration = 60; // 60s max execution time

/**
 * POST /api/geo/actions/execute
 *
 * Operational Action and Institutional Alert Orchestration Endpoint.
 * Receives a decision ID, validates permissions and duplication, maps the decision to actions,
 * and executes (or simulates) the institutional alert routing.
 *
 * Input JSON:
 * {
 *   "decision_id": "DEC-001",
 *   "dry_run": true
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

    const { decision_id, dry_run } = body;

    if (!decision_id || typeof decision_id !== "string") {
      return NextResponse.json(
        { error: "Missing required string property 'decision_id'." },
        { status: 400 }
      );
    }

    // Default dry_run to true as mandated by security rules
    const isDryRun = dry_run !== false;

    const orchestrator = new GeoActionOrchestrator();

    // 1. Retrieve the decision from cache
    const decision = GeoActionOrchestrator.getDecision(decision_id);

    // 2. Run Validation Layer
    const validation = orchestrator.validateDecision(decision_id, decision);
    if (!validation.isValid) {
      console.warn(`[POST_ACTIONS_EXECUTE_VALIDATION_FAILED] Decision_ID: ${decision_id}. Reason: ${validation.reason}`);
      
      // If duplicate or already processed, we can retrieve the previously executed actions
      if (validation.reason?.includes("duplicate prevented")) {
        const existingActions = GeoActionOrchestrator.getExecutedActions(decision_id) || [];
        return NextResponse.json({
          actions: existingActions.map(act => ({
            action_id: act.action_id,
            type: act.type,
            target: act.target,
            status: act.status,
            priority: act.priority
          })),
          metadata: {
            decision_id,
            dry_run: isDryRun,
            status: "ALREADY_PROCESSED_PREVENTED",
            timestamp: new Date().toISOString()
          }
        });
      }

      return NextResponse.json(
        { error: validation.reason },
        { status: 422 } // Unprocessable Entity
      );
    }

    // Safe non-null assertion since validation passed
    const validDecision = decision!;

    // 3. Action Mapping Engine: Map decision to actions
    const mappedActions = orchestrator.mapDecisionToActions(decision_id, validDecision);

    // 4. Execution Layer: Dispatch (or simulate dispatch) based on dry_run mode
    const executedActions = orchestrator.executeActions(decision_id, mappedActions, isDryRun);

    console.log(
      `[POST_ACTIONS_EXECUTE] Handled decision ${decision_id} (${validDecision.classification}). Generated ${executedActions.length} actions in ${isDryRun ? "DRY_RUN" : "LIVE_SIM"} mode.`
    );

    // Return exact requested schema
    return NextResponse.json({
      actions: executedActions.map(act => ({
        action_id: act.action_id,
        type: act.type,
        target: act.target,
        status: act.status,
        priority: act.priority
      })),
      metadata: {
        decision_id,
        event_id: validDecision.event_id,
        classification: validDecision.classification,
        ops_score: validDecision.ops_score,
        dry_run: isDryRun,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("[POST_ACTIONS_EXECUTE_ERROR] Internal server error executing action orchestration:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred during action orchestration.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
