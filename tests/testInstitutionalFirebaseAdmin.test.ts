jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("firebase-admin/app", () => ({ getApps: jest.fn(() => []), applicationDefault: jest.fn(() => "mock-adc"), initializeApp: jest.fn(() => ({ name: "institutional-admin" })) }));
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn(app => ({ app })) }));
jest.mock("firebase-admin/firestore", () => ({ getFirestore: jest.fn(app => ({ app })) }));
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getInstitutionalAdminAuth } from "../src/lib/firebaseAdmin";

describe("server-only Admin initializer", () => {
  beforeEach(() => jest.clearAllMocks());
  test("uses ADC and a named app without embedding credentials", () => {
    getInstitutionalAdminAuth();
    expect(applicationDefault).toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ credential: "mock-adc" }), "institutional-admin");
  });
  test("reuses existing Admin app", () => {
    jest.mocked(getApps).mockReturnValueOnce([{ name: "institutional-admin" }] as any);
    getInstitutionalAdminAuth(); expect(initializeApp).not.toHaveBeenCalled();
  });
  test("initialization errors are explicit and sanitized", () => {
    jest.mocked(initializeApp).mockImplementationOnce(() => { throw new Error("sensitive"); });
    expect(getInstitutionalAdminAuth).toThrow("FIREBASE_ADMIN_INITIALIZATION_FAILED");
  });
});
