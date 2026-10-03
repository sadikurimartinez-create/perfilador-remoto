import "server-only";
import { createHash } from "crypto";
import { getPool } from "@/lib/db";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { AUTHORIZATION_POLICY, synchronizeInstitutionalAuthorization, type AuthorizationProjectionAdapter, type AuthorizationProjection } from "./institutionalAuthorizationProjectionService";
import type { InstitutionalActor } from "@/types/institutionalProjectAccess";

export class AdminAuthorizationProjectionAdapter implements AuthorizationProjectionAdapter {
  async commit(actor: InstitutionalActor, projections: AuthorizationProjection[], timestamp: number) {
    const db = getInstitutionalAdminDb();
    const index = db.collection("authorizationUsers").doc(actor.institutionalUserId);
    const auditId = createHash("sha256").update(JSON.stringify({ actor, projections, timestamp })).digest("hex");
    const auditRef = db.collection("authorizationAudit").doc(auditId);
    await db.runTransaction(async transaction => {
      // A prior receipt does not establish that the derived mirrors still exist.
      // Reapply the authoritative snapshot; keep the audit receipt immutable.
      const audited = (await transaction.get(auditRef)).exists;
      const previous = await transaction.get(index);
      const oldIds: unknown = previous.data()?.projectIds ?? [];
      if (!Array.isArray(oldIds) || oldIds.some(id => typeof id !== "string") || oldIds.length + projections.length > 200) {
        throw new Error("AUTHORIZATION_PROJECTION_CAPACITY_OR_INDEX_INVALID");
      }
      const ids = [...new Set([...oldIds, ...projections.map(p => p.projectId)])];
      const refs = ids.map(id => db.collection("projectAccess").doc(id).collection("members").doc(actor.institutionalUserId));
      const existing = refs.length ? await transaction.getAll(...refs) : [];
      for (let i = 0; i < ids.length; i++) {
        const next = projections.find(p => p.projectId === ids[i]);
        const prior = existing[i]?.data();
        if (next) transaction.set(refs[i], next);
        else if (prior) transaction.set(refs[i], { ...prior, allowedActions: [], revoked: true,
          revokedAt: prior.revokedAt ?? new Date(timestamp).toISOString(), synchronizedAt: timestamp,
          expiresAt: timestamp, source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY });
      }
      transaction.set(index, { projectIds: ids, synchronizedAt: timestamp });
      // Same transaction as the mirror: an audit failure cannot return success.
      if (!audited) transaction.create(auditRef, {
        institutionalUserId: actor.institutionalUserId, action: "PROJECTION_SYNCHRONIZED",
        source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY, timestamp,
        projectedCount: projections.length, tombstoneCount: ids.length - projections.length,
      });
    });
  }
}
export async function refreshInstitutionalAuthorization(actor: InstitutionalActor) {
  return synchronizeInstitutionalAuthorization(async () => {
    // One authoritative SQL snapshot. Read only; never reconcile createdBy.
    const result = await getPool().query(
      `SELECT u.id, u.username, u.role, a.project_id, a.institutional_user_id,
       a.relation, a.allowed_actions, a.revoked_at
       FROM users u LEFT JOIN public.institutional_project_access a
       ON a.institutional_user_id = u.id::text WHERE u.id::text = $1`, [actor.institutionalUserId]);
    if (!result.rows.length || result.rows.some(row => row.username !== actor.username ||
      (row.role === "SUPERADMIN" ? "SUPER_ADMIN" : row.role) !== actor.role)) throw new Error("AUTHORIZATION_IDENTITY_CHANGED");
    return { actor, source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY,
      relations: result.rows.filter(row => row.project_id !== null).map(row => ({
        projectId: row.project_id, institutionalUserId: row.institutional_user_id, relation: row.relation,
        allowedActions: row.allowed_actions, revokedAt: row.revoked_at,
      })) };
  }, new AdminAuthorizationProjectionAdapter());
}
