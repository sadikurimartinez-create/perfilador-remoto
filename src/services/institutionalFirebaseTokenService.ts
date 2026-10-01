import "server-only";
import { verifySession } from "@/utils/authCrypto";
import { getPool } from "@/lib/db";
import { getInstitutionalAdminAuth, getFirebaseAdminRuntimeDiagnostic } from "@/lib/firebaseAdmin";
import { institutionalFirebaseIdentity, type InstitutionalIdentity } from "@/utils/institutionalFirebaseIdentity";

export class FirebaseBridgeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function resolveUser(username: string): Promise<InstitutionalIdentity | null> {
  // Publicly writable Firestore users cannot authorize Firebase claims.
  // Database unavailability fails closed; no fallback to that untrusted collection.
  const result = await getPool().query("SELECT id, username, role FROM users WHERE username = $1 LIMIT 2", [username]);
  if (result.rows.length > 1) throw new FirebaseBridgeError(403, "INSTITUTIONAL_IDENTITY_AMBIGUOUS");
  return result.rows[0] || null;
}

type Dependencies = {
  verify: typeof verifySession;
  resolve: (username: string) => Promise<InstitutionalIdentity | null>;
  mint: (uid: string, claims: { role: string; institutionalUserId: string }) => Promise<string>;
  now: () => number;
};

export async function issueInstitutionalFirebaseToken(cookie: string | undefined, overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    verify: verifySession, resolve: resolveUser,
    mint: (uid, claims) => {
      const auth = getInstitutionalAdminAuth();
      console.info("[FIREBASE_AUTH_DIAGNOSTIC]", JSON.stringify(getFirebaseAdminRuntimeDiagnostic()));
      return auth.createCustomToken(uid, claims);
    },
    now: Date.now, ...overrides,
  };
  if (!cookie) throw new FirebaseBridgeError(401, "INVALID_SESSION");
  const session = deps.verify(cookie);
  const age = deps.now() - session?.createdAt;
  if (!session?.username || !session?.id || !Number.isFinite(age) || age < 0 || age >= 2 * 60 * 60 * 1000) {
    throw new FirebaseBridgeError(401, "INVALID_SESSION");
  }
  const user = await deps.resolve(session.username);
  if (!user || String(user.id) !== String(session.id) || user.username !== session.username) {
    throw new FirebaseBridgeError(403, "INSTITUTIONAL_USER_NOT_FOUND");
  }
  let identity;
  try { identity = institutionalFirebaseIdentity(user); }
  catch { throw new FirebaseBridgeError(403, "INSTITUTIONAL_IDENTITY_INVALID"); }
  return deps.mint(identity.uid, identity.claims);
}
