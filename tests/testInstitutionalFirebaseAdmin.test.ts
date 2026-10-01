jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("firebase-admin/app", () => ({ getApps: jest.fn(() => []), cert: jest.fn(() => "mock-cert"), applicationDefault: jest.fn(() => "mock-adc"), initializeApp: jest.fn(() => ({ name: "institutional-admin" })) }));
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn(app => ({ app })) }));
jest.mock("firebase-admin/firestore", () => ({ getFirestore: jest.fn(app => ({ app })) }));
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getInstitutionalAdminAuth, getFirebaseAdminRuntimeDiagnostic } from "../src/lib/firebaseAdmin";
import fs from "node:fs";
import path from "node:path";

// Synthetic configuration only: never inspect or copy real credential values.
const complete = { GCP_PROJECT_ID: "fixture-project", GCP_CLIENT_EMAIL: "fixture@example.invalid", GCP_PRIVATE_KEY: "fixture-line-1\\nfixture-line-2\\n" };

describe("server-only Admin initializer", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.replaceProperty(process, "env", {}); });
  afterEach(() => jest.restoreAllMocks());
  test("no explicit configuration uses ADC and known public project", () => {
    getInstitutionalAdminAuth();
    expect(applicationDefault).toHaveBeenCalledTimes(1); expect(cert).not.toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledWith({ credential: "mock-adc", projectId: "perfilador-remoto" }, "institutional-admin");
  });
  test("ADC honors Firebase Admin project override", () => {
    process.env.FIREBASE_ADMIN_PROJECT_ID = "fixture-override";
    getInstitutionalAdminAuth();
    expect(initializeApp).toHaveBeenCalledWith({ credential: "mock-adc", projectId: "fixture-override" }, "institutional-admin");
  });
  test("complete explicit credentials use cert and normalize escaped newlines in memory", () => {
    Object.assign(process.env, complete, { FIREBASE_ADMIN_PROJECT_ID: "ignored-override" });
    getInstitutionalAdminAuth();
    expect(cert).toHaveBeenCalledWith({ projectId: complete.GCP_PROJECT_ID, clientEmail: complete.GCP_CLIENT_EMAIL, privateKey: "fixture-line-1\nfixture-line-2\n" });
    expect(applicationDefault).not.toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledWith({ credential: "mock-cert", projectId: complete.GCP_PROJECT_ID }, "institutional-admin");
    expect(process.env.GCP_PRIVATE_KEY).toBe(complete.GCP_PRIVATE_KEY);
  });
  test("existing literal newlines are retained", () => {
    Object.assign(process.env, complete, { GCP_PRIVATE_KEY: "fixture-first\nfixture-second" });
    getInstitutionalAdminAuth();
    expect(cert).toHaveBeenCalledWith(expect.objectContaining({ privateKey: "fixture-first\nfixture-second" }));
  });
  test.each([1, 2, 3, 4, 5, 6])("partial explicit configuration fails closed (mask %i)", mask => {
    Object.entries(complete).forEach(([name, value], index) => { if (mask & (1 << index)) process.env[name] = value; });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
    expect(initializeApp).not.toHaveBeenCalled(); expect(cert).not.toHaveBeenCalled(); expect(applicationDefault).not.toHaveBeenCalled();
  });
  test("empty configured credential fails closed", () => {
    Object.assign(process.env, complete, { GCP_PRIVATE_KEY: "  " });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_EXPLICIT_CREDENTIALS_INCOMPLETE");
  });
  test("reuses existing Admin app", () => {
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin" }] as any);
    getInstitutionalAdminAuth(); expect(initializeApp).not.toHaveBeenCalled(); expect(applicationDefault).not.toHaveBeenCalled();
  });
  test("credential errors do not expose values or log secrets", () => {
    Object.assign(process.env, complete);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(cert).mockImplementationOnce(() => { throw new Error(complete.GCP_PRIVATE_KEY); });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_INITIALIZATION_FAILED");
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(initializeApp).not.toHaveBeenCalled();
  });
  test("initialization errors are explicit and sanitized", () => {
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
    ["perfilador-remoto", "fixture@perfilador-remoto.iam.gserviceaccount.com", true, true],
    ["different-fixture-project", "fixture@different-fixture-project.iam.gserviceaccount.com", false, false],
    [undefined, undefined, "unknown", "unknown"],
  ])("diagnostic returns only comparisons for match, mismatch or absence", (projectId, clientEmail, adminMatch, credentialMatch) => {
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin", options: { projectId, credential: { clientEmail, privateKey: "fixture-private-material" } } }] as any);
    const result = getFirebaseAdminRuntimeDiagnostic();
    expect(result).toEqual({ adminProjectMatchesExpected: adminMatch, credentialProjectMatchesExpected: credentialMatch, explicitCredentialsMode: clientEmail !== undefined });
    expect(Object.values(result).every(value => typeof value === "boolean" || value === "unknown")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/different-fixture-project|@|fixture-private-material|token|jwt/i);
  });
  test("diagnostic reports retained app configuration, not later environment changes", () => {
    Object.assign(process.env, complete);
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin", options: { projectId: "perfilador-remoto", credential: { clientEmail: "fixture@perfilador-remoto.iam.gserviceaccount.com" } } }] as any);
    expect(getFirebaseAdminRuntimeDiagnostic()).toEqual({ adminProjectMatchesExpected: true, credentialProjectMatchesExpected: true, explicitCredentialsMode: true });
    expect(cert).not.toHaveBeenCalled();
  });
});
