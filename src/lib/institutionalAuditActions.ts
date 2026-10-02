"use server";
import { cookies } from "next/headers";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";

export async function appendInstitutionalOperationalAudit(input: Record<string, unknown>) {
  if (typeof input.action !== "string" || input.action.length > 120 || typeof input.projectId !== "string" ||
      JSON.stringify(input).length > 100000) throw new Error("AUDIT_REQUEST_INVALID");
  const access = await authorizeInstitutionalProjectAccess({ sessionToken: cookies().get("ceipol_session")?.value,
    projectId: input.projectId, action: "WRITE" });
  if (!access.allowed) throw new Error("AUDIT_ACCESS_DENIED");
  const now = new Date();
  await getInstitutionalAdminDb().collection("audit_logs").doc().create({
    projectId: access.projectId, action: input.action, module: input.module || "Expedientes",
    projectName: input.projectName || "", numeroExpediente: input.numeroExpediente || "", ceipolId: input.ceipolId || "",
    perfiladorIniciales: input.perfiladorIniciales || "", details: input.details || "",
    user: access.actor.username, userName: access.actor.username, userRole: access.actor.role,
    actorInstitutionalUserId: access.actor.institutionalUserId, timestamp: now.getTime(),
    date: now.toLocaleDateString("es-MX"), time: now.toLocaleTimeString("es-MX", { hour12: false }),
    result: "CLIENT_REPORTED", reportedResult: input.result || null,
    source: "SERVER_AUTHENTICATED_CLIENT_OBSERVATION", policyVersion: access.policyVersion,
  });
}
/** Canonical image deletion requires the atomic lifecycle boundary. */
export async function appendInstitutionalImageDeletionAudit(_input: Record<string, unknown>) {
  throw new Error('ATOMIC_LIFECYCLE_BOUNDARY_REQUIRED');
}
