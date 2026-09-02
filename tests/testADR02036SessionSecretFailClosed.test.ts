import { signSession, verifySession } from "../src/utils/authCrypto";

const TEST_SECRET = "adr-020-36-isolated-test-secret";

describe("ADR-020.36 session secret fail-closed hardening", () => {
  const originalSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSecret;
    }
  });

  test("TEST A configured SESSION_SECRET signs and verifies a session", () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const token = signSession({ username: "analyst-test", role: "USER" });
    const payload = verifySession(token);

    expect(token).toMatch(/^[^.]+\.[^.]+$/);
    expect(payload).toMatchObject({ username: "analyst-test", role: "USER" });
  });

  test("TEST B missing SESSION_SECRET makes signing fail explicitly", () => {
    delete process.env.SESSION_SECRET;

    expect(() => signSession({ username: "analyst-test" })).toThrow("SESSION_SECRET_NOT_CONFIGURED");
  });

  test("TEST C missing SESSION_SECRET cannot verify a previously signed token", () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    const token = signSession({ username: "analyst-test" });
    delete process.env.SESSION_SECRET;

    expect(() => verifySession(token)).toThrow("SESSION_SECRET_NOT_CONFIGURED");
  });

  test("TEST D manipulated token is rejected", () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    const token = signSession({ username: "analyst-test", role: "USER" });
    const [encodedPayload, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const manipulatedPayload = Buffer.from(JSON.stringify({ ...payload, role: "SUPER_ADMIN" })).toString("base64url");

    expect(verifySession(`${manipulatedPayload}.${signature}`)).toBeNull();
  });

  test("authCrypto resolves SESSION_SECRET at operation time, not module import time", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signSession({ username: "analyst-test" })).toThrow("SESSION_SECRET_NOT_CONFIGURED");

    process.env.SESSION_SECRET = TEST_SECRET;
    expect(verifySession(signSession({ username: "analyst-test" }))).toMatchObject({ username: "analyst-test" });
  });
});
