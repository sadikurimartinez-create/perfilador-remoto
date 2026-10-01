jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("firebase-admin/app", () => ({ getApps: jest.fn(() => []), cert: jest.fn(() => "mock-cert"), applicationDefault: jest.fn(() => "mock-adc"), initializeApp: jest.fn(() => ({ name: "institutional-admin" })) }));
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn(app => ({ app })) }));
jest.mock("firebase-admin/firestore", () => ({ getFirestore: jest.fn(app => ({ app })) }));
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getInstitutionalAdminAuth } from "../src/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";

// Synthetic configuration only: never inspect or copy real credential values.
const complete = { FIREBASE_ADMIN_PROJECT_ID: "perfilador-remoto", FIREBASE_ADMIN_CLIENT_EMAIL: "fixture@perfilador-remoto.iam.gserviceaccount.com", FIREBASE_ADMIN_PRIVATE_KEY: "fixture-line-1\\nfixture-line-2\\n" };

describe("server-only Admin initializer", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.replaceProperty(process, "env", {}); });
  afterEach(() => jest.restoreAllMocks());
  test.each([{}, { GCP_PROJECT_ID: "other-fixture", GCP_CLIENT_EMAIL: "fixture@other-fixture.iam.gserviceaccount.com", GCP_PRIVATE_KEY: "fixture-gcp-key" }])("missing Firebase credentials never use ADC or GCP fallback", gcp => {
    Object.assign(process.env, gcp);
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_REQUIRED");
    expect(applicationDefault).not.toHaveBeenCalled(); expect(cert).not.toHaveBeenCalled(); expect(initializeApp).not.toHaveBeenCalled();
  });
  test.each([
    ["FIREBASE_ADMIN_PROJECT_ID", "other-fixture", "FIREBASE_ADMIN_PROJECT_MISMATCH"],
    ["FIREBASE_ADMIN_PROJECT_ID", " perfilador-remoto ", "FIREBASE_ADMIN_PROJECT_MISMATCH"],
    ["FIREBASE_ADMIN_CLIENT_EMAIL", "fixture@other-fixture.iam.gserviceaccount.com", "FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH"],
    ["FIREBASE_ADMIN_CLIENT_EMAIL", "@perfilador-remoto.iam.gserviceaccount.com", "FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH"],
    ["FIREBASE_ADMIN_CLIENT_EMAIL", "fixture@other@perfilador-remoto.iam.gserviceaccount.com", "FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH"],
  ])("wrong project or signer rejects before auth/token access", (name, value, message) => {
    Object.assign(process.env, complete, { [name]: value });
    expect(getInstitutionalAdminAuth).toThrow(message);
    expect(getAuth).not.toHaveBeenCalled(); expect(cert).not.toHaveBeenCalled(); expect(initializeApp).not.toHaveBeenCalled();
  });
  test("complete explicit credentials use cert and normalize escaped newlines in memory", () => {
    Object.assign(process.env, complete, { GCP_PROJECT_ID: "other-fixture", GCP_CLIENT_EMAIL: "other@example.invalid", GCP_PRIVATE_KEY: "fixture-gcp-key" });
    getInstitutionalAdminAuth();
    expect(cert).toHaveBeenCalledWith({ projectId: complete.FIREBASE_ADMIN_PROJECT_ID, clientEmail: complete.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: "fixture-line-1\nfixture-line-2\n" });
    expect(applicationDefault).not.toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledWith({ credential: "mock-cert", projectId: complete.FIREBASE_ADMIN_PROJECT_ID }, "institutional-admin");
    expect(process.env.FIREBASE_ADMIN_PRIVATE_KEY).toBe(complete.FIREBASE_ADMIN_PRIVATE_KEY);
  });
  test("existing literal newlines are retained", () => {
    Object.assign(process.env, complete, { FIREBASE_ADMIN_PRIVATE_KEY: "fixture-first\nfixture-second" });
    getInstitutionalAdminAuth();
    expect(cert).toHaveBeenCalledWith(expect.objectContaining({ privateKey: "fixture-first\nfixture-second" }));
  });
  test.each([1, 2, 3, 4, 5, 6])("partial explicit configuration fails closed (mask %i)", mask => {
    Object.entries(complete).forEach(([name, value], index) => { if (mask & (1 << index)) process.env[name] = value; });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
    expect(initializeApp).not.toHaveBeenCalled(); expect(cert).not.toHaveBeenCalled(); expect(applicationDefault).not.toHaveBeenCalled();
  });
  test("empty configured credential fails closed", () => {
    Object.assign(process.env, complete, { FIREBASE_ADMIN_PRIVATE_KEY: "  " });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
  });
  test("reuses existing Admin app", () => {
    Object.assign(process.env, complete);
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin", options: { projectId: complete.FIREBASE_ADMIN_PROJECT_ID, credential: { clientEmail: complete.FIREBASE_ADMIN_CLIENT_EMAIL } } }] as any);
    getInstitutionalAdminAuth(); expect(initializeApp).not.toHaveBeenCalled(); expect(applicationDefault).not.toHaveBeenCalled();
  });
  test("credential errors do not expose values or log secrets", () => {
    Object.assign(process.env, complete);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(cert).mockImplementationOnce(() => { throw new Error(complete.FIREBASE_ADMIN_PRIVATE_KEY); });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_INITIALIZATION_FAILED");
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(initializeApp).not.toHaveBeenCalled();
  });
  test("initialization errors are explicit and sanitized", () => {
    Object.assign(process.env, complete);
    jest.mocked(initializeApp).mockImplementationOnce(() => { throw new Error("sensitive"); });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_INITIALIZATION_FAILED");
  });
  test("server-only import and browser guard are preserved", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/firebaseAdmin.ts"), "utf8");
    expect(source).toContain('import "server-only"');
    (global as any).window = {};
    try { expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_SERVER_ONLY"); }
    finally { delete (global as any).window; }
    expect(initializeApp).not.toHaveBeenCalled();
  });
  test.each([
    ["other-fixture", complete.FIREBASE_ADMIN_CLIENT_EMAIL, "FIREBASE_ADMIN_PROJECT_MISMATCH"],
    [complete.FIREBASE_ADMIN_PROJECT_ID, "fixture@other-fixture.iam.gserviceaccount.com", "FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH"],
    [complete.FIREBASE_ADMIN_PROJECT_ID, undefined, "FIREBASE_ADMIN_CREDENTIAL_PROJECT_MISMATCH"],
  ])("retained incompatible app cannot bypass validation", (projectId, clientEmail, message) => {
    Object.assign(process.env, complete);
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin", options: { projectId, credential: { clientEmail } } }] as any);
    expect(getInstitutionalAdminAuth).toThrow(message);
    expect(getAuth).not.toHaveBeenCalled();
  });
});
