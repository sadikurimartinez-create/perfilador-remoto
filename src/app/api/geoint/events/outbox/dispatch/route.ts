import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { GeointOutboxDispatcher } from "@/services/geoint/geointOutboxDispatcher";
import { InstitutionalGeointAdminAdapter } from "@/services/geoint/institutionalGeointAdminAdapter";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  try {
    const sessionToken = cookies().get("ceipol_session")?.value;
    const actor = await resolveInstitutionalSessionIdentity(sessionToken);
    if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) return NextResponse.json({ error: "ADMINISTRATIVE_OPERATION_REQUIRED" }, { status: 403 });
    const grants = await getPool().query("SELECT project_id FROM public.institutional_project_access WHERE institutional_user_id = $1 AND revoked_at IS NULL AND relation = 'ASSIGNED' AND 'WRITE' = ANY(allowed_actions)", [actor.institutionalUserId]);
    if (!grants.rows.length || grants.rows.length > 200) return NextResponse.json({ error: "EXPLICIT_WRITE_GRANT_REQUIRED" }, { status: 403 });
    const result = { candidates: 0, processed: 0, completed: 0, retryable: 0, failedTerminal: 0, skipped: 0, success: 0, failed: 0 };
    let authorizedProjects = 0;
    for (const row of grants.rows) {
      const access = await authorizeInstitutionalProjectAccess({ projectId: row.project_id, action: "WRITE", sessionToken });
      if (!access.allowed) continue;
      authorizedProjects++;
      const adapter = new InstitutionalGeointAdminAdapter(access.projectId);
      const current = await GeointOutboxDispatcher.dispatchPending({ outbox: adapter, ledger: adapter });
      for (const key of Object.keys(result) as (keyof typeof result)[]) result[key] += current[key];
    }
    if (!authorizedProjects) return NextResponse.json({ error: "ACTIVE_PROJECT_GRANT_REQUIRED" }, { status: 403 });
    return NextResponse.json({ status: "DISPATCH_COMPLETED", actor: { username: actor.username, role: actor.role }, result });
  } catch { return NextResponse.json({ error: "GEOINT_DISPATCH_UNAVAILABLE" }, { status: 503 }); }
}
