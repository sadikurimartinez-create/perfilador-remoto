import type { GangEntity, GangMember } from './pandillas.mapper';
import type { PhotoActor } from './photo-evidence/contracts';
import { computeSha256FromBytes } from '@/utils/forensicFileIntegrity';

export type PandillasMasterVersion = Readonly<{ strategy: 'LEGACY_UPDATED_AT'; updatedAt: number | null }>;
export interface PandillasMasterScope {
  readonly kind: 'MASTER'; readonly gangId: string; readonly memberId?: string;
  readonly version?: PandillasMasterVersion;
}
/** MASTER ownership is institutional. This project is only legacy custody/authorization. */
export interface PandillasCustodyScope {
  readonly kind: 'LEGACY_PROJECT_BACKED'; readonly masterGangId: string;
  readonly custodyProjectId: string;
  readonly memberIdentitiesPath: string; readonly associationsPath: string;
  readonly primarySelectionsPath: string; readonly documentsPath: string;
  readonly storagePrefix: string;
  readonly authorizationPolicy: 'EXISTING_PROJECT_GRANTS';
}
export type PandillasMasterGang = Omit<GangEntity, 'id' | 'projectId'> & {
  id: string; scope: PandillasMasterScope; custody: PandillasCustodyScope;
};
export interface PandillasCaseProvenance {
  readonly sourceScope: 'MASTER'; readonly actor: Readonly<PhotoActor>;
  readonly operationId: string;
}
export interface PandillasCaseReference {
  readonly caseProjectId: string; readonly masterGangId: string;
  readonly masterVersion: PandillasMasterVersion; readonly createdAt: number;
  readonly provenance: PandillasCaseProvenance;
}
/** Explicit minimal projection; never a complete GangEntity or embedded photograph. */
export interface PandillasCaseSnapshot extends PandillasCaseReference {
  readonly snapshotAt: number;
  readonly minimalPayload: Readonly<{ nombre: string }>;
  readonly digest: Readonly<{ algorithm: 'SHA-256'; canonicalization: 'PANDILLAS_CASE_V1'; value: string }>;
}
/** Future mutations are contracts only. R5.3C exposes no executable write methods. */
export interface PandillasFutureMasterMutations {
  saveGang: { gangId: string; expectedVersion: PandillasMasterVersion; patch: Partial<GangEntity> };
  saveMember: { gangId: string; memberId: string; expectedVersion: PandillasMasterVersion; patch: Partial<GangMember> };
  setPrimaryPhoto: { gangId: string; memberId: string; associationId: string; expectedSelectionVersion: number };
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('PANDILLAS_SCOPE_INVALID');
}
export function resolvePandillasMasterVersion(gang: Pick<GangEntity, 'updatedAt'>): PandillasMasterVersion {
  const value = gang.updatedAt;
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('PANDILLAS_VERSION_INVALID');
  }
  return Object.freeze({ strategy: 'LEGACY_UPDATED_AT', updatedAt: value ?? null });
}
export function resolveLegacyPandillasCustody(gang: Pick<GangEntity, 'id' | 'projectId'>): PandillasCustodyScope {
  id(gang.id); id(gang.projectId);
  const base = `projects/${gang.projectId}`;
  return Object.freeze({ kind: 'LEGACY_PROJECT_BACKED', masterGangId: gang.id,
    custodyProjectId: gang.projectId, memberIdentitiesPath: `${base}/pandillasMemberIdentities`,
    associationsPath: `${base}/pandillasPhotoAssociations`, primarySelectionsPath: `${base}/pandillasPrimarySelections`,
    documentsPath: `${base}/documents`, storagePrefix: `${base}/pandillas/evidence/assets/`,
    authorizationPolicy: 'EXISTING_PROJECT_GRANTS' });
}
function exactKeys(value: object, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('PANDILLAS_CASE_FIELDS_INVALID');
}
export function validatePandillasCaseReference(value: PandillasCaseReference): void {
  if (!value || !value.provenance || !value.provenance.actor || !value.masterVersion) throw new Error('PANDILLAS_CASE_INVALID');
  exactKeys(value, ['caseProjectId', 'masterGangId', 'masterVersion', 'createdAt', 'provenance']);
  id(value.caseProjectId); id(value.masterGangId); id(value.provenance.operationId);
  exactKeys(value.provenance, ['sourceScope', 'actor', 'operationId']);
  exactKeys(value.provenance.actor, ['institutionalUserId', 'username']);
  id(value.provenance.actor.institutionalUserId);
  if (!value.provenance.actor.username?.trim() || value.provenance.sourceScope !== 'MASTER'
    || !Number.isFinite(value.createdAt) || value.createdAt < 0) throw new Error('PANDILLAS_CASE_INVALID');
  exactKeys(value.masterVersion, ['strategy', 'updatedAt']);
  if (value.masterVersion.strategy !== 'LEGACY_UPDATED_AT' || value.masterVersion.updatedAt !== null
    && (typeof value.masterVersion.updatedAt !== 'number' || !Number.isFinite(value.masterVersion.updatedAt)
      || value.masterVersion.updatedAt < 0)) throw new Error('PANDILLAS_VERSION_INVALID');
}
/** Pure builders do not authorize, persist or mutate MASTER; callers must authorize CASE separately. */
export function createPandillasCaseReference(value: PandillasCaseReference): PandillasCaseReference {
  validatePandillasCaseReference(value);
  return Object.freeze({ ...value, masterVersion: Object.freeze({ ...value.masterVersion }),
    provenance: Object.freeze({ ...value.provenance, actor: Object.freeze({ ...value.provenance.actor }) }) });
}
type SnapshotInput = PandillasCaseReference & { snapshotAt: number; minimalPayload: { nombre: string } };
function snapshotContent(value: SnapshotInput) {
  const { snapshotAt, minimalPayload, ...reference } = value;
  validatePandillasCaseReference(reference);
  exactKeys(minimalPayload, ['nombre']);
  if (!minimalPayload.nombre?.trim() || !Number.isFinite(snapshotAt) || snapshotAt < reference.createdAt) {
    throw new Error('PANDILLAS_SNAPSHOT_INVALID');
  }
  // Fixed field order and a versioned encoding; SHA-256 itself uses the institutional helper.
  return { caseProjectId: reference.caseProjectId, masterGangId: reference.masterGangId,
    masterVersion: { strategy: reference.masterVersion.strategy, updatedAt: reference.masterVersion.updatedAt },
    createdAt: reference.createdAt, provenance: { sourceScope: reference.provenance.sourceScope,
      actor: { institutionalUserId: reference.provenance.actor.institutionalUserId, username: reference.provenance.actor.username },
      operationId: reference.provenance.operationId }, snapshotAt, minimalPayload: { nombre: minimalPayload.nombre } };
}
export async function createPandillasCaseSnapshot(value: SnapshotInput): Promise<PandillasCaseSnapshot> {
  const content = snapshotContent(value);
  const digest = await computeSha256FromBytes(new TextEncoder().encode(JSON.stringify(content)));
  const { snapshotAt, minimalPayload, ...reference } = content;
  return Object.freeze({ ...createPandillasCaseReference(reference), snapshotAt,
    minimalPayload: Object.freeze(minimalPayload),
    digest: Object.freeze({ algorithm: 'SHA-256', canonicalization: 'PANDILLAS_CASE_V1', value: digest }) });
}
export async function validatePandillasCaseSnapshot(value: PandillasCaseSnapshot): Promise<void> {
  const { digest, ...input } = value;
  if (!digest) throw new Error('PANDILLAS_SNAPSHOT_DIGEST_INVALID');
  exactKeys(digest, ['algorithm', 'canonicalization', 'value']);
  const expected = await createPandillasCaseSnapshot(input);
  if (digest.algorithm !== 'SHA-256' || digest.canonicalization !== 'PANDILLAS_CASE_V1'
    || digest.value !== expected.digest.value) throw new Error('PANDILLAS_SNAPSHOT_DIGEST_INVALID');
}
