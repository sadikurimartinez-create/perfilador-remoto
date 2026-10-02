"use server";
import { cookies } from "next/headers";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { getPool } from "@/lib/db";
import { buildNumeroExpedienteFields, resolvePerfiladorIniciales } from "@/utils/documentIdentity";

export async function assignInstitutionalNumeroExpediente(projectId: string) {
  const access = await authorizeInstitutionalProjectAccess({ projectId, action: "WRITE", sessionToken: cookies().get("ceipol_session")?.value });
  if (!access.allowed) throw new Error(`PROJECT_FOLIO_ACCESS_DENIED:${access.code}`);
  const db = getInstitutionalAdminDb();
  const project = db.collection("projects").doc(access.projectId);
  const counter = db.collection("counters").doc("projects");
  const profile = await getPool().query("SELECT profile FROM users WHERE id::text = $1", [access.actor.institutionalUserId]);
  if (profile.rows.length !== 1) throw new Error("PROJECT_FOLIO_IDENTITY_UNAVAILABLE");
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(project);
    if (!snapshot.exists) throw new Error("PROJECT_NOT_FOUND");
    const data = snapshot.data()!;
    if ((data.deleted !== undefined && data.deleted !== false) || data.estado === "ARCHIVADO" || data.status === "ARCHIVADO") throw new Error("PROJECT_FOLIO_INACCESSIBLE");
    if (typeof data.numeroExpediente === "string" && /^\d{8}-\d{4}-[A-ZÑ]{2,5}$/.test(data.numeroExpediente.trim().toLocaleUpperCase("es-MX"))) {
      return { numeroExpediente: data.numeroExpediente.trim(), numeroExpedienteAsignadoAt: data.numeroExpedienteAsignadoAt,
        numeroExpedienteSequence: data.numeroExpedienteSequence, perfiladorIniciales: data.perfiladorIniciales, numeroExpedienteVersion: data.numeroExpedienteVersion };
    }
    const count = (await transaction.get(counter)).data()?.count ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) throw new Error("PROJECT_COUNTER_INVALID");
    const fields = buildNumeroExpedienteFields({ createdAt: new Date(), sequence: count + 1,
      perfiladorIniciales: resolvePerfiladorIniciales({ profile: profile.rows[0].profile }) });
    transaction.set(counter, { count: count + 1 });
    transaction.update(project, { ...fields });
    transaction.create(db.collection("audit_logs").doc(), { projectId: access.projectId, action: "FOLIO_ASSIGNED",
      actorInstitutionalUserId: access.actor.institutionalUserId, timestamp: new Date().toISOString(), source: "SERVER",
      numeroExpediente: fields.numeroExpediente, policyVersion: access.policyVersion });
    return fields;
  });
}
