"use server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { AUTHORIZATION_POLICY, validateAuthorizationSnapshot } from "@/services/institutionalAuthorizationProjectionService";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";

export async function canWriteInstitutionalProject(projectId: string): Promise<boolean> {
  const result = await authorizeInstitutionalProjectAccess({ sessionToken: cookies().get("ceipol_session")?.value, projectId, action: "WRITE" });
  return result.allowed;
}

export async function readInstitutionalCollection(name: string): Promise<Record<string, any>[]> {
  if (!["projects", "analyses", "audit_logs", "trash", "users", "pandillas"].includes(name)) throw new Error("INSTITUTIONAL_COLLECTION_UNSUPPORTED");
  const actor = await resolveInstitutionalSessionIdentity(cookies().get("ceipol_session")?.value);
  if (name === "users") {
    const administrator = ["ADMIN", "SUPER_ADMIN"].includes(actor.role);
    const result = await getPool().query(administrator
      ? "SELECT id, username, role, profile FROM users ORDER BY username"
      : "SELECT id, username, role, profile FROM users WHERE id::text = $1", administrator ? [] : [actor.institutionalUserId]);
    return result.rows.map(row => ({ ...row.profile, id: String(row.id), username: row.username,
      role: row.role === "SUPERADMIN" ? "SUPER_ADMIN" : row.role }));
  }
  const result = await getPool().query(`SELECT project_id, institutional_user_id, relation, allowed_actions, revoked_at
    FROM public.institutional_project_access WHERE institutional_user_id = $1`, [actor.institutionalUserId]);
  const grants = validateAuthorizationSnapshot({ actor, source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY,
    relations: result.rows.map(row => ({ projectId: row.project_id, institutionalUserId: row.institutional_user_id,
      relation: row.relation, allowedActions: row.allowed_actions, revokedAt: row.revoked_at })) }, Date.now());
  const readable = grants.filter(grant => !grant.revoked && grant.allowedActions.includes("READ"));
  if (readable.length > 200) throw new Error("INSTITUTIONAL_COLLECTION_CAPACITY_EXCEEDED");
  if (!readable.length) return [];
  const db = getInstitutionalAdminDb();
  const projects = (await db.getAll(...readable.map(grant => db.collection("projects").doc(grant.projectId))))
    .filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id } as Record<string, any>))
    .filter(data => name === 'trash' || ((data.deleted === undefined || data.deleted === false) && (name === 'projects' || (data.estado !== 'ARCHIVADO' && data.status !== 'ARCHIVADO'))));
  if (name === "projects") return JSON.parse(JSON.stringify(projects.map(project => project.estado === 'ARCHIVADO' || project.status === 'ARCHIVADO'
    ? { id: project.id, nombre: project.nombre || '', numeroExpediente: project.numeroExpediente || '', estado: 'ARCHIVADO', createdAt: project.createdAt || 0 } : project).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))));
  const ids = projects.map(project => project.id);
  const records: Record<string, any>[] = [];
  for (let offset = 0; offset < ids.length; offset += 30) {
    const snap = await db.collection(name).where("projectId", "in", ids.slice(offset, offset + 30)).get();
    records.push(...snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
  }
  return JSON.parse(JSON.stringify(records));
}
