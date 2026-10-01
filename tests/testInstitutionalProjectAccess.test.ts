import { authorizeInstitutionalProjectAccess } from "../src/services/institutionalProjectAccessService";
import { institutionalProjectAccessRepository } from "../src/services/institutionalProjectAccessRepository";
import { getPool } from "../src/lib/db";
import { getInstitutionalAdminDb } from "../src/lib/firebaseAdmin";
import { PROJECT_ACCESS_ACTIONS, ProjectAccessError, type InstitutionalActor, type ProjectAccessRelation } from "../src/types/institutionalProjectAccess";
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/db", () => ({ getPool: jest.fn() }));
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminDb: jest.fn() }));
jest.mock("@/utils/authCrypto", () => ({ verifySession: jest.fn() }));

const actor: InstitutionalActor = { institutionalUserId: "7", username: "analyst", role: "USER" };
const grant: ProjectAccessRelation = { projectId: "project-1", institutionalUserId: "7", relation: "ASSIGNED", allowedActions: ["READ"], revokedAt: null };
function dependencies() {
  return { identity: jest.fn(async () => actor), repository: {
    findRelation: jest.fn(async (): Promise<ProjectAccessRelation | null> => grant),
    readProject: jest.fn(async (): Promise<any> => ({ deleted: false, estado: "ABIERTO" })),
  } };
}
const request = { sessionToken: "cookie", projectId: "project-1", action: "READ" };
describe("explicit institutional project action policy", () => {
  test("active USER assignment allows READ with sanitized audit", async () => {
    const deps = dependencies(); const result = await authorizeInstitutionalProjectAccess(request, deps);
    expect(result.allowed).toBe(true);
    expect(result.audit).toMatchObject({ outcome: "ALLOW", institutionalUserId: "7", action: "READ", authorizationBasis: "EXPLICIT_ACTIVE_ACTION_GRANT" });
    expect(JSON.stringify(result)).not.toContain("cookie");
  });
  test.each(PROJECT_ACCESS_ACTIONS)("allows only the explicitly granted %s action", async action => {
    const deps = dependencies(); deps.repository.findRelation.mockResolvedValue({ ...grant, allowedActions: [action] });
    for (const candidate of PROJECT_ACCESS_ACTIONS) {
      expect((await authorizeInstitutionalProjectAccess({ ...request, action: candidate }, deps)).allowed).toBe(candidate === action);
    }
  });
  test.each(["ADMIN", "SUPER_ADMIN"] as const)("%s has no bypass and needs explicit permission", async role => {
    const deps = dependencies(); deps.identity.mockResolvedValue({ ...actor, role });
    expect((await authorizeInstitutionalProjectAccess(request, deps)).allowed).toBe(true);
    expect((await authorizeInstitutionalProjectAccess({ ...request, action: "WRITE" }, deps)).allowed).toBe(false);
    deps.repository.findRelation.mockResolvedValue(null);
    expect(await authorizeInstitutionalProjectAccess(request, deps)).toMatchObject({ allowed: false, code: "PROJECT_ACCESS_RECONCILIATION_REQUIRED" });
    expect(deps.repository.readProject).toHaveBeenCalledTimes(1);
  });
  test("missing legacy association denies before Firestore read", async () => {
    const deps = dependencies(); deps.repository.findRelation.mockResolvedValue(null);
    expect(await authorizeInstitutionalProjectAccess(request, deps)).toMatchObject({ allowed: false, code: "PROJECT_ACCESS_RECONCILIATION_REQUIRED" });
    expect(deps.repository.readProject).not.toHaveBeenCalled();
  });
  test("revoked association denies before Firestore read", async () => {
    const deps = dependencies(); deps.repository.findRelation.mockResolvedValue({ ...grant, revokedAt: "2026-10-01" });
    expect(await authorizeInstitutionalProjectAccess(request, deps)).toMatchObject({ allowed: false, code: "PROJECT_ACCESS_REVOKED" });
    expect(deps.repository.readProject).not.toHaveBeenCalled();
  });
  test("foreign project or identity returned by repository denies", async () => {
    for (const relation of [{ ...grant, projectId: "other" }, { ...grant, institutionalUserId: "other" }]) {
      const deps = dependencies(); deps.repository.findRelation.mockResolvedValue(relation);
      expect(await authorizeInstitutionalProjectAccess(request, deps)).toMatchObject({ allowed: false, code: "PROJECT_ACCESS_DENIED" });
      expect(deps.repository.readProject).not.toHaveBeenCalled();
    }
  });
  test.each([null, { deleted: true }, { estado: "ARCHIVADO" }])("missing/deleted/archived project denies %#", async project => {
    const deps = dependencies(); deps.repository.readProject.mockResolvedValue(project);
    expect((await authorizeInstitutionalProjectAccess(request, deps)).allowed).toBe(false);
  });
  test.each(["", "a/b", "..", "a\nb", 42])("rejects invalid project ID %#", async projectId => {
    const deps = dependencies();
    expect((await authorizeInstitutionalProjectAccess({ ...request, projectId }, deps)).allowed).toBe(false);
    expect(deps.repository.findRelation).not.toHaveBeenCalled();
  });
  test("unknown action denies without repository access", async () => {
    const deps = dependencies();
    expect(await authorizeInstitutionalProjectAccess({ ...request, action: "DELETE" }, deps)).toMatchObject({ code: "PROJECT_ACCESS_ACTION_UNSUPPORTED" });
    expect(deps.repository.findRelation).not.toHaveBeenCalled();
  });
  test("client role, ID, username and geometry cannot change resolved actor", async () => {
    const deps = dependencies();
    const forged = { ...request, role: "ADMIN", userId: "other", username: "other", canonicalGeography: {} };
    const result = await authorizeInstitutionalProjectAccess(forged, deps);
    expect(result).toMatchObject({ allowed: true, actor });
    expect(deps.repository.findRelation).toHaveBeenCalledWith("project-1", "7");
  });
  test("identity denial and infrastructure errors fail closed without disclosure", async () => {
    const deps = dependencies(); deps.identity.mockRejectedValue(new ProjectAccessError("PROJECT_ACCESS_UNAUTHENTICATED"));
    expect(await authorizeInstitutionalProjectAccess(request, deps)).toMatchObject({ allowed: false, code: "PROJECT_ACCESS_UNAUTHENTICATED", audit: { institutionalUserId: null, outcome: "DENY" } });
    expect(deps.repository.findRelation).not.toHaveBeenCalled();
    const failing = dependencies(); failing.repository.findRelation.mockRejectedValue(new Error("SQL secret cookie"));
    expect(JSON.stringify(await authorizeInstitutionalProjectAccess(request, failing))).not.toMatch(/SQL|secret|cookie/);
  });
});

describe("project access repository", () => {
  test("uses parameterized SQL and preserves revoked status", async () => {
    const query = jest.fn(async () => ({ rows: [{ project_id: "project-1", institutional_user_id: "7", relation: "ASSIGNED", allowed_actions: ["READ"], revoked_at: "revoked" }] }));
    (getPool as jest.Mock).mockReturnValue({ query });
    expect(await institutionalProjectAccessRepository.findRelation("project-1", "7")).toMatchObject({ revokedAt: "revoked" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("project_id = $1"), ["project-1", "7"]);
  });
  test("Admin read returns only necessary metadata, never ownership or content", async () => {
    const get = jest.fn(async () => ({ exists: true, data: () => ({ deleted: false, canonicalGeography: {}, createdBy: "legacy", sensitiveContent: "excluded" }) }));
    const doc = jest.fn(() => ({ get }));
    (getInstitutionalAdminDb as jest.Mock).mockReturnValue({ collection: jest.fn(() => ({ doc })) });
    const result = await institutionalProjectAccessRepository.readProject("project-1");
    expect(result).not.toHaveProperty("createdBy"); expect(result).not.toHaveProperty("sensitiveContent");
    expect(doc).toHaveBeenCalledWith("project-1");
  });
});
