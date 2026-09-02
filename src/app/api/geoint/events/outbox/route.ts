import { NextRequest, NextResponse } from "next/server";
import { GeointEventOutboxService } from "@/services/geoint/geointEventOutboxService";

const REQUIRED_FIELDS = [
  "eventType",
  "expedienteId",
  "traceabilityId",
  "actor",
  "source",
  "status",
  "entityType",
  "entityId",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const missing = REQUIRED_FIELDS.filter((field) => !body?.[field]);

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const entry = await GeointEventOutboxService.enqueueEvent(
      body.eventType,
      body.expedienteId,
      body.traceabilityId,
      body.actor,
      body.source,
      body.status,
      body.entityType,
      body.entityId,
      body.metadata || {}
    );

    return NextResponse.json({
      status: "QUEUED",
      outboxId: entry.outboxId,
      eventId: entry.eventId,
      fingerprint: entry.fingerprint,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
