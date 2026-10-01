export const PROJECT_ACCESS_ACTIONS = ["READ", "WRITE", "ANALYZE_SCINCE", "GENERATE_REPORT"] as const;
export type ProjectAccessAction = typeof PROJECT_ACCESS_ACTIONS[number];
export type InstitutionalActor = {
  institutionalUserId: string;
  username: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
};
export type ProjectAccessRelation = {
  projectId: string;
  institutionalUserId: string;
  relation: "ASSIGNED";
  allowedActions: ProjectAccessAction[];
  revokedAt: string | Date | null;
};
export type AuthorizedProjectMetadata = {
  deleted?: unknown;
  estado?: unknown;
  status?: unknown;
  canonicalGeography?: unknown;
};
export type ProjectAccessCode =
  | "PROJECT_ACCESS_UNAUTHENTICATED" | "PROJECT_ACCESS_IDENTITY_NOT_FOUND"
  | "PROJECT_ACCESS_ROLE_UNSUPPORTED" | "PROJECT_ACCESS_INVALID_PROJECT_ID"
  | "PROJECT_ACCESS_ACTION_UNSUPPORTED" | "PROJECT_ACCESS_RECONCILIATION_REQUIRED"
  | "PROJECT_ACCESS_REVOKED" | "PROJECT_ACCESS_DENIED"
  | "PROJECT_ACCESS_PROJECT_NOT_FOUND" | "PROJECT_ACCESS_PROJECT_DELETED"
  | "PROJECT_ACCESS_PROJECT_INACCESSIBLE" | "PROJECT_ACCESS_UNAVAILABLE";
export class ProjectAccessError extends Error {
  constructor(public readonly code: ProjectAccessCode) { super(code); }
}
export type ProjectAccessAudit = {
  correlationId: string;
  institutionalUserId: string | null;
  username: string | null;
  role: InstitutionalActor["role"] | null;
  projectId: string | null;
  action: ProjectAccessAction | null;
  outcome: "ALLOW" | "DENY";
  authorizationBasis: string;
  policyVersion: string;
  timestamp: string;
};
export type ProjectAccessResult =
  | { allowed: true; actor: InstitutionalActor; projectId: string; action: ProjectAccessAction;
      authorizationBasis: "EXPLICIT_ACTIVE_ACTION_GRANT"; policyVersion: string;
      project: AuthorizedProjectMetadata; audit: ProjectAccessAudit }
  | { allowed: false; code: ProjectAccessCode; audit: ProjectAccessAudit };
