import { computeSha256FromBytes } from '@/utils/forensicFileIntegrity';
import type { MemberPhotoIdentity } from './contracts';
/** Snapshot fingerprint is evidence of a reviewed binding, NEVER a canonical identity. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export async function legacyMemberFingerprint(member: unknown): Promise<string> {
  return computeSha256FromBytes(new TextEncoder().encode(JSON.stringify(canonical(member))));
}
export async function verifyLegacyBinding(gang: { integrantes?: Array<{ nombre: string }> }, identity: MemberPhotoIdentity): Promise<void> {
  if (identity.status !== 'ACTIVE') throw new Error('R4_IDENTITY_INACTIVE');
  const matches = (gang.integrantes || []).filter(member => member.nombre === identity.legacyMemberName);
  if (matches.length !== 1 || await legacyMemberFingerprint(matches[0]) !== identity.legacyMemberFingerprint) throw new Error('R4_IDENTITY_RECONCILIATION_REQUIRED');
}
