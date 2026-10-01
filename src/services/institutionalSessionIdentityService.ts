import "server-only";
import { verifySession } from "@/utils/authCrypto";
import { getPool } from "@/lib/db";
import { institutionalFirebaseIdentity, type InstitutionalIdentity } from "@/utils/institutionalFirebaseIdentity";
import { ProjectAccessError, type InstitutionalActor } from "@/types/institutionalProjectAccess";

type Dependencies = {
  verify: (token: string) => any;
  resolve: (username: string) => Promise<InstitutionalIdentity | null>;
  now: () => number;
};
const defaults: Dependencies = {
  verify: verifySession,
  now: Date.now,
  async resolve(username) {
    const result = await getPool().query("SELECT id, username, role FROM users WHERE username = $1 LIMIT 2", [username]);
    if (result.rows.length !== 1) return null;
    return result.rows[0];
  },
};

export async function resolveInstitutionalSessionIdentity(
  sessionToken: unknown, overrides: Partial<Dependencies> = {}
): Promise<InstitutionalActor> {
  const deps = { ...defaults, ...overrides };
  try {
    if (typeof sessionToken !== "string" || !sessionToken) throw new ProjectAccessError("PROJECT_ACCESS_UNAUTHENTICATED");
    const session = deps.verify(sessionToken);
    const age = typeof session?.createdAt === "number" ? deps.now() - session.createdAt : NaN;
    if (typeof session?.username !== "string" || !session.username.trim() ||
        !["string", "number"].includes(typeof session?.id) || !String(session.id).trim() ||
        !Number.isFinite(age) || age < 0 || age >= 2 * 60 * 60 * 1000) {
      throw new ProjectAccessError("PROJECT_ACCESS_UNAUTHENTICATED");
    }
    const user = await deps.resolve(session.username);
    if (!user || String(user.id) !== String(session.id) || user.username !== session.username) {
      throw new ProjectAccessError("PROJECT_ACCESS_IDENTITY_NOT_FOUND");
    }
    let identity;
    try { identity = institutionalFirebaseIdentity(user); }
    catch { throw new ProjectAccessError("PROJECT_ACCESS_ROLE_UNSUPPORTED"); }
    return { institutionalUserId: identity.claims.institutionalUserId, username: user.username,
      role: identity.claims.role as InstitutionalActor["role"] };
  } catch (error) {
    if (error instanceof ProjectAccessError) throw error;
    throw new ProjectAccessError("PROJECT_ACCESS_UNAVAILABLE");
  }
}
