jest.mock("@/lib/firebase", () => ({ getAuthInstance: () => ({ fixture: true }) }));
jest.mock("firebase/auth", () => ({ inMemoryPersistence: "memory", setPersistence: jest.fn(async () => undefined), signInWithCustomToken: jest.fn(async () => undefined), signOut: jest.fn(async () => undefined) }));
import { signInWithCustomToken, signOut, setPersistence } from "firebase/auth";
import { connectInstitutionalFirebase, disconnectInstitutionalFirebase } from "../src/services/institutionalFirebaseClientBridge";

describe("Firebase client session lifecycle", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ customToken: "mock-token" }) })) as any; });
  afterEach(() => { global.fetch = originalFetch; });
  test("signs in using only the server custom token with in-memory persistence", async () => {
    await connectInstitutionalFirebase();
    expect(setPersistence).toHaveBeenCalledWith(expect.anything(), "memory");
    expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), "mock-token");
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/firebase-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
  });
  test("logout signs out Firebase", async () => {
    await disconnectInstitutionalFirebase(); expect(signOut).toHaveBeenCalledTimes(1);
  });
  test("failed bridge clears prior session and does not sign in", async () => {
    global.fetch = jest.fn(async () => ({ ok: false })) as any;
    await expect(connectInstitutionalFirebase()).rejects.toThrow("FIREBASE_BRIDGE_UNAVAILABLE");
    expect(signOut).toHaveBeenCalled(); expect(signInWithCustomToken).not.toHaveBeenCalled();
  });
  test("logout during token request prevents late sign-in", async () => {
    let resolve!: (value: any) => void;
    global.fetch = jest.fn(() => new Promise(r => { resolve = r; })) as any;
    const connect = connectInstitutionalFirebase();
    await new Promise(r => setImmediate(r));
    const logout = disconnectInstitutionalFirebase();
    resolve({ ok: true, json: async () => ({ customToken: "late" }) });
    await Promise.all([connect, logout]);
    expect(signInWithCustomToken).not.toHaveBeenCalled(); expect(signOut).toHaveBeenCalledTimes(2);
  });
});
