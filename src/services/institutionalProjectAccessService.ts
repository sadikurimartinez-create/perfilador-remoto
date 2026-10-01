import "server-only";
import { randomUUID } from "crypto";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { institutionalProjectAccessRepository, type InstitutionalProjectAccessRepository } from "@/services/institutionalProjectAccessRepository";
import { PROJECT_ACCESS_ACTIONS, ProjectAccessError, type InstitutionalActor, type ProjectAccessAction,
  type ProjectAccessAudit, type ProjectAccessCode, type ProjectAccessResult } from "@/types/institutionalProjectAccess";

export const PROJECT_ACCESS_POLICY_VERSION = "EXPLICIT_ACTION_GRANT_V1";
type Dependencies = {
  identity: (token: unknown) => Promise<InstitutionalActor>;
  repository: InstitutionalProjectAccessRepository;
};

export async function authorizeInstitutionalProjectAccess(input: {
  sessionToken?: unknown; projectId: unknown; action: unknown;
}, overrides: Partial<Dependencies> = {}): Promise<ProjectAccessResult> {
  const deps = { identity: resolveInstitutionalSessionIdentity, repository: institutionalProjectAccessRepository, ...overrides };
  let actor: InstitutionalActor | null = null;
  let projectId: string | null = null;
  let action: ProjectAccessAction | null = null;
  const correlationId = randomUUID();
  const audit = (outcome: "ALLOW" | "DENY", basis: string): ProjectAccessAudit => ({
    correlationId, institutionalUserId: actor?.institutionalUserId ?? null,
    username: actor?.username ?? null, role: actor?.role ?? null, projectId, action,
    outcome, authorizationBasis: basis, policyVersion: PROJECT_ACCESS_POLICY_VERSION, timestamp: new Date().toISOString(),
  });
  const deny = (code: ProjectAccessCode): ProjectAccessResult => ({ allowed: false, code, audit: audit("DENY", code) });
  try {
    actor = await deps.identity(input.sessionToken);
    const normalized = typeof input.projectId === "string" ? input.projectId.trim() : "";
    if (!normalized || normalized === "." || normalized === ".." || /[\/\x00-\x1f\x7f]/.test(normalized) || Buffer.byteLength(normalized, "utf8") > 1500) {
      return deny("PROJECT_ACCESS_INVALID_PROJECT_ID");
    }
    projectId = normalized;
    if (!PROJECT_ACCESS_ACTIONS.includes(input.action as ProjectAccessAction)) return deny("PROJECT_ACCESS_ACTION_UNSUPPORTED");
    action = input.action as ProjectAccessAction;
    const relation = await deps.repository.findRelation(projectId, actor.institutionalUserId);
    if (!relation) return deny("PROJECT_ACCESS_RECONCILIATION_REQUIRED");
    if (relation.projectId !== projectId || relation.institutionalUserId !== actor.institutionalUserId || relation.relation !== "ASSIGNED") return deny("PROJECT_ACCESS_DENIED");
    if (relation.revokedAt !== null) return deny("PROJECT_ACCESS_REVOKED");
    if (!Array.isArray(relation.allowedActions) || !relation.allowedActions.length ||
        relation.allowedActions.some(value => !PROJECT_ACCESS_ACTIONS.includes(value)) || !relation.allowedActions.includes(action)) return deny("PROJECT_ACCESS_DENIED");
    // No role bypass: even administrators require an explicit grant for this action.
    const project = await deps.repository.readProject(projectId);
    if (!project) return deny("PROJECT_ACCESS_PROJECT_NOT_FOUND");
    if (project.deleted !== undefined && project.deleted !== false) return deny("PROJECT_ACCESS_PROJECT_DELETED");
    if (project.status === "ARCHIVADO" || project.estado === "ARCHIVADO") return deny("PROJECT_ACCESS_PROJECT_INACCESSIBLE");
    return { allowed: true, actor, projectId, action, authorizationBasis: "EXPLICIT_ACTIVE_ACTION_GRANT",
      policyVersion: PROJECT_ACCESS_POLICY_VERSION, project, audit: audit("ALLOW", "EXPLICIT_ACTIVE_ACTION_GRANT") };
  } catch (error) {
    return deny(error instanceof ProjectAccessError ? error.code : "PROJECT_ACCESS_UNAVAILABLE");
  }
}
