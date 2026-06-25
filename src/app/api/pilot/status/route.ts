import { NextResponse } from "next/server";
import { GeointPilotController } from "@/lib/pilot/geointPilotController";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilot/status
 * Retrieves live GEOINT Pilot Control Center telemetry, configurations, and intercepted events.
 */
export async function GET() {
  try {
    const controller = GeointPilotController.getInstance();
    const stats = controller.getTelemetryStats();
    const config = controller.getConfig();
    const events = controller.getEvents();

    return NextResponse.json({
      ...stats,
      config,
      events
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to retrieve pilot status telemetry",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pilot/status
 * Handles dynamic command actions such as updating configs or resolving pending Human-in-the-Loop events.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const controller = GeointPilotController.getInstance();

    if (!action) {
      return NextResponse.json(
        { status: "error", message: "Missing parameter: action is required." },
        { status: 400 }
      );
    }

    if (action === "update_config") {
      const { config } = body;
      if (!config) {
        return NextResponse.json(
          { status: "error", message: "Missing parameter: config payload is required." },
          { status: 400 }
        );
      }
      const updated = controller.updateConfig(config);
      return NextResponse.json({
        status: "ok",
        message: "Pilot configuration updated successfully.",
        config: updated
      });
    }

    if (action === "resolve_hitl") {
      const { eventId, approval } = body;
      if (!eventId || !approval) {
        return NextResponse.json(
          { status: "error", message: "Missing parameters: eventId and approval ('APPROVE' | 'REJECT' | 'HOLD') are required." },
          { status: 400 }
        );
      }

      const updatedEvent = controller.resolveHITLAction(eventId, approval);
      return NextResponse.json({
        status: "ok",
        message: `Successfully resolved Human-in-the-Loop approval for event ${eventId}.`,
        event: updatedEvent
      });
    }

    if (action === "trigger_event") {
      const { id, severity, description, payload } = body;
      if (!id || !severity || !description) {
        return NextResponse.json(
          { status: "error", message: "Missing parameters: id, severity, and description are required." },
          { status: 400 }
        );
      }

      const newEvent = controller.interceptEvent(id, severity, description, payload || {});
      return NextResponse.json({
        status: "ok",
        message: `Manually triggered and intercepted event: ${id}`,
        event: newEvent
      });
    }

    return NextResponse.json(
      { status: "error", message: `Unsupported action command: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to process command action",
        error: err.message || String(err)
      },
      { status: 500 }
    );
  }
}
