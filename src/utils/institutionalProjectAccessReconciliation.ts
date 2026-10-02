export type ReconciliationFinding = "RECONCILED" | "NO_ASSOCIATION" | "AMBIGUOUS_USER" | "USER_NOT_FOUND" | "MISSING_GRANT" | "REVOKED_GRANT" | "HISTORICAL_CONFLICT";
/** Pure dry-run only. Historical attribution can identify a discrepancy but
 * cannot create, revoke or modify institutional authority. No I/O adapter. */
export function dryRunInstitutionalProjectReconciliation(input: {
  projects: { id: string; createdBy?: string }[];
  users: { id: string; username: string }[];
  grants: { projectId: string; institutionalUserId: string; revokedAt: string | null }[];
}): { projectId: string; finding: ReconciliationFinding; requiresHumanDecision: boolean }[] {
  return input.projects.map(project => {
    const candidates = input.users.filter(user => user.username === project.createdBy);
    const grants = input.grants.filter(grant => grant.projectId === project.id);
    let finding: ReconciliationFinding;
    if (!project.createdBy?.trim()) finding = "NO_ASSOCIATION";
    else if (!candidates.length) finding = "USER_NOT_FOUND";
    else if (candidates.length !== 1) finding = "AMBIGUOUS_USER";
    else {
      const own = grants.filter(grant => grant.institutionalUserId === candidates[0].id);
      finding = own.length > 1 ? "HISTORICAL_CONFLICT" : !own.length
        ? (grants.length ? "HISTORICAL_CONFLICT" : "MISSING_GRANT")
        : own[0].revokedAt !== null ? "REVOKED_GRANT" : "RECONCILED";
    }
    return { projectId: project.id, finding, requiresHumanDecision: finding !== "RECONCILED" };
  });
}
