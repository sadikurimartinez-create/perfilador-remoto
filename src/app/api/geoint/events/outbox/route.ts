import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { InstitutionalGeointAdminAdapter } from "@/services/geoint/institutionalGeointAdminAdapter";

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
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    const body = await request.json();
    const missing = REQUIRED_FIELDS.filter((field) => !body?.[field]);

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const access = await authorizeInstitutionalProjectAccess({ sessionToken: cookies().get("ceipol_session")?.value,
      projectId: body.expedienteId, action: body.eventType === "REPORT_CONSUMED" ? "GENERATE_REPORT" : "WRITE" });
    if (!access.allowed) return NextResponse.json({ error: access.code }, { status: 403 });
    if ((String(body.eventType).startsWith("REPORT_") && body.eventType !== "REPORT_CONSUMED") || /(?:CERTIFIED|APPROVED|PUBLISHED|GENERATED)$/.test(String(body.eventType)) || JSON.stringify(body.metadata || {}).length > 100000) return NextResponse.json({ error: "SERVER_EVENT_REQUIRED" }, { status: 403 });
    const entry = await new InstitutionalGeointAdminAdapter(access.projectId).enqueue({
      eventType: body.eventType, expedienteId: access.projectId, traceabilityId: body.traceabilityId,
      actor: `user:${access.actor.institutionalUserId}`, source: "AUTHENTICATED_CLIENT_OBSERVATION",
      status: "CLIENT_REPORTED", entityType: body.entityType, entityId: body.entityId,
      metadata: { ...body.metadata, reportedSource: body.source, reportedStatus: body.status, observation: "CLIENT_REPORTED" },
    });

    return NextResponse.json({
      status: "QUEUED",
      outboxId: entry.outboxId,
      eventId: entry.eventId,
      fingerprint: entry.fingerprint,
    });
  } catch (error) {
    return NextResponse.json({ error: "GEOINT_OUTBOX_UNAVAILABLE" }, { status: 503 });
  }
}
