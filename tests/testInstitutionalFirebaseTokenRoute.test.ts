jest.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "signed-cookie" }) }) }));
jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown, options: any = {}) => ({ body, status: options.status || 200, headers: options.headers }) } }));
jest.mock("@/services/institutionalFirebaseTokenService", () => ({
  issueInstitutionalFirebaseToken: jest.fn(async () => "fixture-token"),
  FirebaseBridgeError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
import { POST } from "../src/app/api/auth/firebase-token/route";
import { issueInstitutionalFirebaseToken, FirebaseBridgeError } from "../src/services/institutionalFirebaseTokenService";

describe("Firebase custom token HTTP boundary", () => {
  beforeEach(() => jest.clearAllMocks());
  test("client cannot impose UID, role, claims or project authorization", async () => {
    const result: any = await POST(new Request("https://fixture.test/api/auth/firebase-token", {
      method: "POST", headers: { origin: "https://fixture.test", "content-type": "application/json" },
      body: JSON.stringify({ uid: "attacker", role: "SUPER_ADMIN", claims: { admin: true }, projectId: "other" }),
    }));
    expect(issueInstitutionalFirebaseToken).toHaveBeenCalledWith("signed-cookie");
    expect(result.body).toEqual({ customToken: "fixture-token" });
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });
  test.each([undefined, "https://other.test"])("missing or cross-site origin is rejected", async origin => {
    const result: any = await POST(new Request("https://fixture.test/api/auth/firebase-token", { method: "POST", headers: origin ? { origin } : {} }));
    expect(result.status).toBe(403); expect(issueInstitutionalFirebaseToken).not.toHaveBeenCalled();
  });
  test("invalid session produces 401", async () => {
    jest.mocked(issueInstitutionalFirebaseToken).mockRejectedValueOnce(new FirebaseBridgeError(401, "INVALID_SESSION"));
    const result: any = await POST(new Request("https://fixture.test/api/auth/firebase-token", { method: "POST", headers: { origin: "https://fixture.test" } }));
    expect(result.status).toBe(401);
  });
  test("Admin failure is sanitized and fails closed", async () => {
    jest.mocked(issueInstitutionalFirebaseToken).mockRejectedValueOnce(new Error("sensitive configuration"));
    const result: any = await POST(new Request("https://fixture.test/api/auth/firebase-token", { method: "POST", headers: { origin: "https://fixture.test" } }));
    expect(result.status).toBe(503); expect(result.body).toEqual({ error: "FIREBASE_BRIDGE_UNAVAILABLE" });
  });
});
