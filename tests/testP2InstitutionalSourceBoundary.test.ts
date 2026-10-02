jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminDb: jest.fn() }));
import { resolveAuthorizedInstitutionalReportSource } from "../src/services/institutionalReportSourceService";
import { getInstitutionalAdminDb } from "../src/lib/firebaseAdmin";

const allowed = { allowed: true, projectId: "p1", actor: { institutionalUserId: "7", username: "Servidor", role: "ADMIN" } };
function deps(project: any = { id: "p1", numeroExpediente: "N1" }) {
  return { authorize: jest.fn(async () => allowed) as any, readProject: jest.fn(async () => project) };
}
describe("P2 GENERATE_REPORT server source boundary", () => {
  test("forces GENERATE_REPORT and server actor identity", async () => {
    const dependencies = deps();
    const result = await resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie", role: "ADMIN", userId: "attacker", username: "attacker", ownership: true } as any, dependencies);
    expect(dependencies.authorize).toHaveBeenCalledWith({ projectId: "p1", sessionToken: "cookie", action: "GENERATE_REPORT" });
    expect(result.actor).toEqual({ uid: "user:7", displayName: "Servidor" });
    expect(JSON.stringify(result)).not.toContain("cookie");
  });
  test.each(["PROJECT_ACCESS_DENIED", "PROJECT_ACCESS_REVOKED", "PROJECT_ACCESS_RECONCILIATION_REQUIRED"])("denial %s precedes persisted input reads", async code => {
    const dependencies = deps(); dependencies.authorize.mockResolvedValue({ allowed: false, code });
    await expect(resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, dependencies)).rejects.toThrow(code);
    expect(dependencies.readProject).not.toHaveBeenCalled();
  });
  test.each([null, { id: "other" }, { id: "p1", deleted: true }, { id: "p1", estado: "ARCHIVADO" }])("unavailable/foreign project blocks %#", async project => {
    await expect(resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, deps(project))).rejects.toThrow("SOURCE_UNAVAILABLE");
  });
  test("nested persisted analysis and hypothesis survive without client state", async () => {
    const project = { id: "p1", analysisOutputs: [], iaAnalysis: { analysisOutputs: [{ outputId: "a1", summary: "persisted" }] },
      canonicalHypothesis: { text: "humana", revision: 4 }, documents: [{ id: "d1", type: "application/pdf", humanValidationStatus: "PENDING_REVIEW" }] };
    const result = await resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, deps(project));
    expect(result.project.analysisOutputs).toEqual(project.iaAnalysis.analysisOutputs);
    expect(result.project.canonicalHypothesis).toEqual(project.canonicalHypothesis);
    expect(result.project.documents).toEqual(project.documents);
  });
  test("fingerprint changes when persisted analytical source changes", async () => {
    const a = await resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, deps({ id: "p1", findings: [{ id: "f1", text: "one" }] }));
    const b = await resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, deps({ id: "p1", findings: [{ id: "f1", text: "two" }] }));
    expect(a.sourceFingerprint).not.toEqual(b.sourceFingerprint);
  });
  test("default server reader includes persisted subcollections and excludes deleted items", async () => {
    const collections = jest.fn((name: string) => ({ get: jest.fn(async () => ({ docs: name === "photos" ? [
      { id: "photo1", data: () => ({ url: "persisted-url", humanValidationStatus: "PENDING_REVIEW" }) },
      { id: "deleted1", data: () => ({ deleted: true }) },
    ] : [{ id: "doc1", data: () => ({ type: "application/pdf" }) }] })) }));
    (getInstitutionalAdminDb as jest.Mock).mockReturnValue({ collection: () => ({ doc: () => ({
      get: async () => ({ exists: true, id: "p1", data: () => ({ numeroExpediente: "N1" }) }), collection: collections,
    }) }) });
    const result = await resolveAuthorizedInstitutionalReportSource({ projectId: "p1", sessionToken: "cookie" }, { authorize: deps().authorize });
    expect(collections.mock.calls.map(call => call[0])).toEqual(["photos", "documents", "geographicEntities"]);
    expect(result.project.photoEvidence).toHaveLength(1);
    expect(result.project.photoEvidence[0]).toMatchObject({ id: "photo1", previewUrl: "persisted-url", humanValidationStatus: "PENDING_REVIEW" });
    expect(result.project.documents[0].id).toBe("doc1");
  });
});
