jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/db", () => ({ getPool: jest.fn() }));
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminAuth: jest.fn(), getInstitutionalAdminDb: jest.fn(), getFirebaseAdminRuntimeDiagnostic: jest.fn() }));
jest.mock("@/utils/authCrypto", () => ({ verifySession: jest.fn() }));
import { issueInstitutionalFirebaseToken } from "../src/services/institutionalFirebaseTokenService";
import { institutionalFirebaseIdentity } from "../src/utils/institutionalFirebaseIdentity";
import { getPool } from "../src/lib/db";
import { getInstitutionalAdminDb, getInstitutionalAdminAuth, getFirebaseAdminRuntimeDiagnostic } from "../src/lib/firebaseAdmin";

describe("institutional Firebase token authority", () => {
  const session = { id: 42, username: "fixture", role: "SUPER_ADMIN", createdAt: 1000 };
  function dependencies() {
    return {
      verify: jest.fn(() => session), now: () => 2000,
      resolve: jest.fn(async () => ({ id: 42, username: "fixture", role: "USER" })),
      mint: jest.fn(async () => "mock-custom-token"),
    };
  }
  test("valid session mints server-derived claims, ignoring stale session role", async () => {
    const deps = dependencies();
    await expect(issueInstitutionalFirebaseToken("signed", deps)).resolves.toBe("mock-custom-token");
    expect(deps.mint).toHaveBeenCalledWith("user:42", { role: "USER", institutionalUserId: "42" });
  });
  test("absent session fails before lookup or mint", async () => {
    const deps = dependencies();
    await expect(issueInstitutionalFirebaseToken(undefined, deps)).rejects.toMatchObject({ status: 401 });
    expect(deps.resolve).not.toHaveBeenCalled(); expect(deps.mint).not.toHaveBeenCalled();
  });
  test.each([null, { ...session, createdAt: 0 }, { ...session, createdAt: 3000 }, { ...session, createdAt: undefined }])("invalid or expired session is rejected: %j", async value => {
    const deps = { ...dependencies(), verify: jest.fn(() => value), now: () => value?.createdAt === 0 ? 7200001 : 2000 };
    await expect(issueInstitutionalFirebaseToken("signed", deps)).rejects.toMatchObject({ status: 401 });
    expect(deps.mint).not.toHaveBeenCalled();
  });
  test.each([null, { id: 99, username: "fixture", role: "USER" }, { id: 42, username: "fixture", role: "PPC" }])("missing, mismatched or invalid user is rejected", async user => {
    const deps = { ...dependencies(), resolve: jest.fn(async () => user) };
    await expect(issueInstitutionalFirebaseToken("signed", deps)).rejects.toMatchObject({ status: 403 });
    expect(deps.mint).not.toHaveBeenCalled();
  });
  test("UID remains stable across username changes; roles normalized", () => {
    expect(institutionalFirebaseIdentity({ id: 42, username: "changed", role: "SUPERADMIN" })).toEqual({ uid: "user:42", claims: { role: "SUPER_ADMIN", institutionalUserId: "42" } });
  });
  test("unavailable trusted database never falls back to public Firestore users", async () => {
    jest.mocked(getPool).mockReturnValue({ query: jest.fn(async () => { throw new Error("database unavailable"); }) } as any);
    const deps = dependencies();
    await expect(issueInstitutionalFirebaseToken("signed", { verify: deps.verify, now: deps.now, mint: deps.mint })).rejects.toThrow("database unavailable");
    expect(deps.mint).not.toHaveBeenCalled(); expect(getInstitutionalAdminDb).not.toHaveBeenCalled();
  });
  test("default mint emits exactly the permitted diagnostic before token creation", async () => {
    const diagnostic = { adminProjectMatchesExpected: false, credentialProjectMatchesExpected: "unknown" as const, explicitCredentialsMode: false };
    jest.mocked(getFirebaseAdminRuntimeDiagnostic).mockReturnValueOnce(diagnostic);
    const mint = jest.fn(async () => "fixture-token-never-logged");
    jest.mocked(getInstitutionalAdminAuth).mockReturnValueOnce({ createCustomToken: mint } as any);
    const log = jest.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const deps = dependencies();
      await issueInstitutionalFirebaseToken("fixture-cookie-never-logged", { verify: deps.verify, resolve: deps.resolve, now: deps.now });
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith("[FIREBASE_AUTH_DIAGNOSTIC]", JSON.stringify(diagnostic));
      expect(log.mock.invocationCallOrder[0]).toBeLessThan(mint.mock.invocationCallOrder[0]);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/fixture-token|fixture-cookie|username|claims|user:42|@/);
    } finally { log.mockRestore(); }
  });
});
