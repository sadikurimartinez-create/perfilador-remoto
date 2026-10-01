import { resolveInstitutionalSessionIdentity } from "../src/services/institutionalSessionIdentityService";
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/db", () => ({ getPool: jest.fn() }));
jest.mock("@/utils/authCrypto", () => ({ verifySession: jest.fn() }));

const now = 10_000_000;
const session = { id: 7, username: "analyst", role: "ADMIN", createdAt: now - 1000 };
const user = { id: 7, username: "analyst", role: "USER" };
function dependencies() {
  return { verify: jest.fn((): any => session), resolve: jest.fn(async (): Promise<any> => user), now: () => now };
}
describe("institutional server-side session identity", () => {
  test("valid session uses current PostgreSQL identity instead of signed stale role", async () => {
    expect(await resolveInstitutionalSessionIdentity("cookie", dependencies())).toEqual({ institutionalUserId: "7", username: "analyst", role: "USER" });
  });
  test.each(["USER", "ADMIN", "SUPER_ADMIN", "SUPERADMIN"])("accepts and normalizes role %s", async role => {
    const deps = dependencies(); deps.resolve.mockResolvedValue({ ...user, role });
    expect((await resolveInstitutionalSessionIdentity("cookie", deps)).role).toBe(role === "SUPERADMIN" ? "SUPER_ADMIN" : role);
  });
  test.each([undefined, "", 42])("rejects missing or invalid cookie %s", async token => {
    const deps = dependencies();
    await expect(resolveInstitutionalSessionIdentity(token, deps)).rejects.toThrow("PROJECT_ACCESS_UNAUTHENTICATED");
    expect(deps.resolve).not.toHaveBeenCalled();
  });
  test.each([null, { ...session, createdAt: undefined }, { ...session, createdAt: now + 1 },
    { ...session, createdAt: now - 7_200_000 }, { ...session, id: undefined }])("rejects invalid/expired session %#", async value => {
    const deps = dependencies(); deps.verify.mockReturnValue(value);
    await expect(resolveInstitutionalSessionIdentity("cookie", deps)).rejects.toThrow("PROJECT_ACCESS_UNAUTHENTICATED");
    expect(deps.resolve).not.toHaveBeenCalled();
  });
  test.each([null, { ...user, id: 8 }, { ...user, username: "other" }])("rejects nonexistent or mismatched user %#", async value => {
    const deps = dependencies(); deps.resolve.mockResolvedValue(value);
    await expect(resolveInstitutionalSessionIdentity("cookie", deps)).rejects.toThrow("PROJECT_ACCESS_IDENTITY_NOT_FOUND");
  });
  test("rejects unsupported current role", async () => {
    const deps = dependencies(); deps.resolve.mockResolvedValue({ ...user, role: "ROOT" });
    await expect(resolveInstitutionalSessionIdentity("cookie", deps)).rejects.toThrow("PROJECT_ACCESS_ROLE_UNSUPPORTED");
  });
  test("does not disclose upstream errors or use fallback identity", async () => {
    const deps = dependencies(); deps.resolve.mockRejectedValue(new Error("SQL cookie credential detail"));
    await expect(resolveInstitutionalSessionIdentity("cookie", deps)).rejects.toThrow(/^PROJECT_ACCESS_UNAVAILABLE$/);
  });
});
