import "server-only";
import { getPool } from "@/lib/db";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import type { AuthorizedProjectMetadata, ProjectAccessRelation } from "@/types/institutionalProjectAccess";

export interface InstitutionalProjectAccessRepository {
  findRelation(projectId: string, institutionalUserId: string): Promise<ProjectAccessRelation | null>;
  readProject(projectId: string): Promise<AuthorizedProjectMetadata | null>;
}
export const institutionalProjectAccessRepository: InstitutionalProjectAccessRepository = {
  async findRelation(projectId, institutionalUserId) {
    // Include revoked rows so the service can distinguish revocation from missing reconciliation.
    const result = await getPool().query(`SELECT project_id, institutional_user_id, relation, allowed_actions, revoked_at
      FROM public.institutional_project_access WHERE project_id = $1 AND institutional_user_id = $2 LIMIT 2`,
      [projectId, institutionalUserId]);
    if (result.rows.length > 1) throw new Error("AMBIGUOUS_PROJECT_ACCESS");
    const row = result.rows[0];
    return row ? { projectId: row.project_id, institutionalUserId: row.institutional_user_id,
      relation: row.relation, allowedActions: row.allowed_actions, revokedAt: row.revoked_at } : null;
  },
  async readProject(projectId) {
    const snapshot = await getInstitutionalAdminDb().collection("projects").doc(projectId).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data()!;
    return { deleted: data.deleted, estado: data.estado, status: data.status, canonicalGeography: data.canonicalGeography };
  },
};
