import { verifySession } from "@/utils/authCrypto";

export interface StreetViewSessionIdentity {
  id?: string | number | null;
  username: string;
  role?: string | null;
  name?: string | null;
}

const SYNTHETIC_REVIEWER_IDS = new Set([
  "ANALISTA",
  "ANALISTA CEIPOL",
  "US-CEIPOL-ANALISTA",
  "UNAVAILABLE",
]);

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function reviewerLabel(value: unknown): string | null {
  if (typeof value === "string") return present(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const data = value as Record<string, unknown>;
    return present(data.username) || present(data.id) || present(data.name);
  }
  return null;
}

export function isSyntheticStreetViewReviewer(value: unknown): boolean {
  const label = reviewerLabel(value);
  return Boolean(label && SYNTHETIC_REVIEWER_IDS.has(label.toUpperCase()));
}

export function resolveStreetViewSessionIdentity(sessionToken: string | null | undefined): StreetViewSessionIdentity | null {
  const payload = sessionToken ? verifySession(sessionToken) : null;
  const username = present(payload?.username);
  if (!username || isSyntheticStreetViewReviewer(username)) return null;
  return {
    id: payload?.id ?? username,
    username,
    role: present(payload?.role),
    name: present(payload?.name),
  };
}

export function streetViewValidatedBy(identity: StreetViewSessionIdentity) {
  return {
    id: String(identity.id ?? identity.username),
    username: identity.username,
    role: identity.role ?? null,
    name: identity.name ?? null,
  };
}
