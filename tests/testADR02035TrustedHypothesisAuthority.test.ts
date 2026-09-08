import fs from "node:fs";
import path from "node:path";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  authorizeTrustedProjectHypothesis,
  type TrustedHypothesisAuthorityDependencies,
} from "../src/utils/trustedProjectHypothesisAuthority.server";
import {
  GENERATE_PROFILE_SESSION_EXPIRED_MESSAGE,
  assertGenerateProfileServerSession,
  shouldRetryGenerateProfileRequest,
} from "../src/utils/generateProfileAuthPolicy";

const projectId = "project-adr02035";
const validHypothesis = formulateHumanHypothesis({
  projectId,
  text: "Hipótesis humana persistida y gobernada.",
  authorId: "analyst-1",
  createdAt: "2026-09-02T12:00:00.000Z",
});

function dependencies(project: Record<string, unknown> | null, validSession = true): TrustedHypothesisAuthorityDependencies {
  return {
    verifySessionToken: () => validSession ? { username: "analyst-1", role: "USER" } : null,
    readProject: async () => project,
  };
}

describe("ADR-020.35 trusted hypothesis authority", () => {
  test("TEST A client hypothesis cannot replace a missing persisted hypothesis", async () => {
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "signed-session",
      dependencies: dependencies({ createdBy: "analyst-1", canonicalHypothesis: null }),
    });

    expect(result).toMatchObject({ allowed: false, status: 422, code: "HUMAN_HYPOTHESIS_REQUIRED" });
  });

  test("TEST B client hypothesis cannot replace an invalid persisted hypothesis", async () => {
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "signed-session",
      dependencies: dependencies({
        createdBy: "analyst-1",
        canonicalHypothesis: { ...validHypothesis, authorType: "AI_SUGGESTION", status: "DRAFT" },
      }),
    });

    expect(result).toMatchObject({ allowed: false, status: 422, code: "HUMAN_HYPOTHESIS_REQUIRED" });
  });

  test("TEST C persisted HUMAN FORMULATED hypothesis authorizes the gate", async () => {
    const project = { createdBy: "analyst-1", canonicalHypothesis: validHypothesis };
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "signed-session",
      dependencies: dependencies(project),
    });

    expect(result).toMatchObject({ allowed: true, canonicalHypothesis: validHypothesis, project });
  });

  test("TEST D invalid session is rejected before project access", async () => {
    const readProject = jest.fn(async () => ({ createdBy: "analyst-1", canonicalHypothesis: validHypothesis }));
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "invalid-session",
      dependencies: { verifySessionToken: () => null, readProject },
    });

    expect(result).toMatchObject({ allowed: false, status: 401, code: "INVALID_SESSION" });
    expect(readProject).not.toHaveBeenCalled();
  });

  test("TEST E nonexistent project is rejected", async () => {
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "signed-session",
      dependencies: dependencies(null),
    });

    expect(result).toMatchObject({ allowed: false, status: 404, code: "PROJECT_NOT_FOUND" });
  });

  test("generate-profile uses persisted authority instead of client canonicalHypothesis", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/generate-profile/route.ts"), "utf8");

    expect(source).toContain("authorizeTrustedProjectHypothesis");
    expect(source).toContain("safeBody.canonicalHypothesis = hypothesisAuthority.canonicalHypothesis");
    expect(source).not.toContain("canonicalHypothesis: safeBody.canonicalHypothesis ?? null");
  });

  test("TEST F generate-profile session preflight accepts server-confirmed sessions", async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ username: "analyst-1" }),
    })) as unknown as typeof fetch;

    await expect(assertGenerateProfileServerSession(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
  });

  test("TEST G missing or expired server session stops before report generation", async () => {
    const fetcher = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sesión inválida o expirada." }),
    })) as unknown as typeof fetch;

    await expect(assertGenerateProfileServerSession(fetcher)).rejects.toThrow(
      GENERATE_PROFILE_SESSION_EXPIRED_MESSAGE
    );
  });

  test("TEST H client state cannot make an invalid server session retryable", async () => {
    const project = { createdBy: "client-claimed-user", canonicalHypothesis: validHypothesis };
    const result = await authorizeTrustedProjectHypothesis({
      projectId,
      sessionToken: "expired-session",
      dependencies: {
        verifySessionToken: () => null,
        readProject: jest.fn(async () => project),
      },
    });

    expect(result).toMatchObject({ allowed: false, status: 401, code: "INVALID_SESSION" });
    expect(shouldRetryGenerateProfileRequest(401, 1, 3)).toBe(false);
    expect(shouldRetryGenerateProfileRequest(403, 1, 3)).toBe(false);
  });

  test("TEST I transient statuses remain retryable until attempts are exhausted", () => {
    expect(shouldRetryGenerateProfileRequest(429, 1, 3)).toBe(true);
    expect(shouldRetryGenerateProfileRequest(500, 1, 3)).toBe(true);
    expect(shouldRetryGenerateProfileRequest(503, 2, 3)).toBe(true);
    expect(shouldRetryGenerateProfileRequest(503, 3, 3)).toBe(false);
    expect(shouldRetryGenerateProfileRequest(400, 1, 3)).toBe(false);
  });
});
