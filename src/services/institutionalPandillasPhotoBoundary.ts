import 'server-only';
import { randomUUID } from 'crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import type { MemberPhotoIdentity, PhotoAssociation, MemberPrimaryPhotoSelection, PhotoAuditEvent, PhotoActor, PhotoImageType, PhotoAssociationLevel } from '@/modules/pandillas/photo-evidence/contracts';
import { expectedPhotoVersion, photoId, primarySelectionId } from '@/modules/pandillas/photo-evidence/storagePaths';
import { legacyMemberFingerprint, verifyLegacyBinding } from '@/modules/pandillas/photo-evidence/identity';
import { validatePhotoAsset } from '@/modules/pandillas/photo-evidence/association';
import { selectPrimaryPhoto } from '@/modules/pandillas/photo-evidence/primarySelection';
import { resolvePrimaryPhotoMetadata, resolveAdditionalPhotoMetadata } from '@/modules/pandillas/photo-evidence/resolver';
import { assertPhotoAuditSafe } from '@/modules/pandillas/photo-evidence/audit';
import type { PhotoAsset } from '@/modules/pandillas/photo-evidence/contracts';
import type { MultimodalEvidenceContract } from '@/utils/multimodalEvidenceContract';
import { getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';
import { verifyPandillasStoredPhotoFile } from './institutionalPandillasPhotoAssetService';

type Scope = { projectId: string; gangId: string };
export type PandillasPhotoMutation = Scope & { expectedVersion: number; reason: string } & (
  { operation: 'CREATE_IDENTITY'; legacyMemberName: string; expectedGangUpdatedAt: number | null } |
  { operation: 'ASSOCIATE'; documentId: string; memberIdentityId?: string; imageType: PhotoImageType; associationLevel: PhotoAssociationLevel; associationBasis: string; sourcePage: number; sourceImageId: string; expectedDocumentVersion: number } |
  { operation: 'SELECT_PRIMARY'; memberIdentityId: string; associationId: string; expectedAssociationVersion: number; expectedDocumentVersion: number } |
  { operation: 'RETIRE_ASSOCIATION'; associationId: string }
);
type Dependencies = { authorize: typeof authorizeInstitutionalProjectAccess; database: () => Firestore; now: () => number; uuid: () => string };
const defaults: Dependencies = { authorize: authorizeInstitutionalProjectAccess, database: getInstitutionalAdminDb, now: Date.now, uuid: randomUUID };
const collection = (projectId: string, kind: 'Identities' | 'Associations' | 'Selections') => `projects/${projectId}/pandillas${kind === 'Identities' ? 'MemberIdentities' : kind === 'Associations' ? 'PhotoAssociations' : 'PrimarySelections'}`;
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000 || /https?:|data:|gs:|base64|[?&]token=/i.test(value)) throw new Error('R4_INVALID_TEXT');
}
async function authorized(session: unknown, scope: Scope, action: 'READ' | 'WRITE', deps: Dependencies) {
  photoId(scope.projectId); photoId(scope.gangId);
  const access = await deps.authorize({ sessionToken: session, projectId: scope.projectId, action });
  if (!access.allowed) throw new Error('R4_ACCESS_DENIED');
  return { institutionalUserId: access.actor.institutionalUserId, username: access.actor.username };
}
async function context(db: Firestore, tx: Transaction, scope: Scope) {
  const parent = db.doc(`projects/${scope.projectId}`);
  const project = (await tx.get(parent)).data();
  const gang = (await tx.get(db.doc(`pandillas/${scope.gangId}`))).data();
  if (!project || project.deleted !== undefined && project.deleted !== false || project.estado === 'ARCHIVADO' || project.status === 'ARCHIVADO') throw new Error('R4_PROJECT_UNAVAILABLE');
  if (!gang || gang.projectId !== scope.projectId || gang.deleted) throw new Error('R4_GANG_CROSS_PROJECT');
  return { parent, project, gang };
}
async function identityFor(db: Firestore, tx: Transaction, scope: Scope, id: string, gang: any): Promise<MemberPhotoIdentity> {
  photoId(id);
  const identity = (await tx.get(db.doc(`${collection(scope.projectId, 'Identities')}/${id}`))).data() as MemberPhotoIdentity | undefined;
  if (!identity || identity.id !== id || identity.projectId !== scope.projectId || identity.gangId !== scope.gangId) throw new Error('R4_IDENTITY_CROSS_PROJECT');
  await verifyLegacyBinding(gang, identity);
  return identity;
}
async function documentFor(db: Firestore, tx: Transaction, projectId: string, documentId: string) {
  photoId(documentId);
  const data = (await tx.get(db.doc(`projects/${projectId}/documents/${documentId}`))).data();
  if (!data || data.projectId !== projectId || data.expedienteId && data.expedienteId !== projectId || data.deleted || data.lifecycleDeletionPending || !data.photoAsset) throw new Error('R4_DOCUMENT_UNAVAILABLE');
  validatePhotoAsset(data.photoAsset, projectId, documentId);
  if (!data.multimodalEvidence || data.multimodalEvidence.expedienteId !== projectId || data.multimodalEvidence.documentId !== documentId || data.multimodalEvidence.forensicIntegrity?.rawSha256 !== data.photoAsset.original.sha256 || data.multimodalEvidence.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH') throw new Error('R4_DOCUMENT_INTEGRITY_REQUIRED');
  return { ...data, id: documentId, projectId, photoAsset: data.photoAsset as PhotoAsset, multimodalEvidence: data.multimodalEvidence as MultimodalEvidenceContract };
}
function audit(db: Firestore, tx: Transaction, id: string, event: PhotoAuditEvent) {
  assertPhotoAuditSafe(event);
  tx.create(db.doc(`audit_logs/${id}`), { ...event, action: event.event, actorInstitutionalUserId: event.actor.institutionalUserId, source: 'SERVER' });
}
export async function mutateInstitutionalPandillasPhoto(session: unknown, input: PandillasPhotoMutation, overrides: Partial<Dependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  if (!['CREATE_IDENTITY', 'ASSOCIATE', 'SELECT_PRIMARY', 'RETIRE_ASSOCIATION'].includes(input.operation)) throw new Error('R4_OPERATION_INVALID');
  text(input.reason); expectedPhotoVersion(input.expectedVersion, input.expectedVersion);
  const actor: PhotoActor = await authorized(session, input, 'WRITE', deps);
  const db = deps.database(); const operationId = deps.uuid(); const entityId = deps.uuid();
  photoId(operationId); photoId(entityId);
  return db.runTransaction(async tx => {
    const { parent, project, gang } = await context(db, tx, input);
    const now = deps.now();
    const base = { actor, timestamp: now, projectId: input.projectId, gangId: input.gangId, reason: input.reason };
    let result: MemberPhotoIdentity | PhotoAssociation | MemberPrimaryPhotoSelection;
    let event: PhotoAuditEvent;
    let target: ReturnType<Firestore['doc']>;
    if (input.operation === 'CREATE_IDENTITY') {
      expectedPhotoVersion(0, input.expectedVersion); text(input.legacyMemberName);
      if ((gang.updatedAt ?? null) !== input.expectedGangUpdatedAt) throw new Error('R4_GANG_VERSION_CONFLICT');
      // R4.5D.0 resolves Yordi's name; the out-of-inventory exclusion remains.
      if (input.legacyMemberName === 'Ángel Ricardo González Sánchez') throw new Error('R4_DOCUMENTARY_IDENTITY_BLOCKED');
      const members = (gang.integrantes || []).filter((member: any) => member.nombre === input.legacyMemberName);
      if (members.length !== 1) throw new Error('R4_LEGACY_MEMBER_NOT_EXACT');
      const fingerprint = await legacyMemberFingerprint(members[0]);
      const existing = await tx.get(db.collection(collection(input.projectId, 'Identities')).where('gangId', '==', input.gangId));
      if (existing.docs.some(doc => doc.data().legacyMemberFingerprint === fingerprint)) throw new Error('R4_IDENTITY_ALREADY_REGISTERED');
      result = { id: entityId, projectId: input.projectId, gangId: input.gangId, legacyMemberName: input.legacyMemberName, legacyMemberFingerprint: fingerprint, gangVersionAtReview: input.expectedGangUpdatedAt, status: 'ACTIVE', reviewedBy: actor, reviewedAt: now, createdBy: actor, createdAt: now, updatedAt: now, version: 1 };
      target = db.doc(`${collection(input.projectId, 'Identities')}/${entityId}`);
      event = { ...base, event: 'PHOTO_IDENTITY_CREATED', memberIdentityId: entityId, assetId: null, oldValue: null, newValue: { id: entityId, version: 1, status: 'ACTIVE', sha256: fingerprint } };
    } else if (input.operation === 'ASSOCIATE') {
      expectedPhotoVersion(0, input.expectedVersion); text(input.associationBasis); photoId(input.sourceImageId);
      if (!['EXACT', 'PROBABLE_DOCUMENTARY', 'AMBIGUOUS', 'NONE'].includes(input.associationLevel) || !['MEMBER_PRIMARY_PHOTO', 'MEMBER_EVIDENCE_ATTACHMENT', 'GANG_ALBUM', 'GRAFFITI', 'DOCUMENT_ATTACHMENT'].includes(input.imageType)) throw new Error('R4_ASSOCIATION_INVALID');
      if (input.imageType.startsWith('MEMBER_') && !input.memberIdentityId || !input.imageType.startsWith('MEMBER_') && input.memberIdentityId) throw new Error('R4_ASSOCIATION_SCOPE_INVALID');
      if (input.memberIdentityId) await identityFor(db, tx, input, input.memberIdentityId, gang);
      const document = await documentFor(db, tx, input.projectId, input.documentId);
      expectedPhotoVersion(document.photoAsset.version, input.expectedDocumentVersion);
      if (input.sourcePage !== document.photoAsset.sourcePage || input.sourceImageId !== document.photoAsset.sourceImageId) throw new Error('R4_PROVENANCE_MISMATCH');
      result = { id: entityId, projectId: input.projectId, gangId: input.gangId, ...(input.memberIdentityId ? { memberIdentityId: input.memberIdentityId } : {}), documentId: input.documentId, sourcePage: input.sourcePage, sourceImageId: input.sourceImageId, imageType: input.imageType, associationLevel: input.associationLevel, associationBasis: input.associationBasis, status: 'ACTIVE', reviewedBy: actor, reviewedAt: now, createdBy: actor, createdAt: now, updatedAt: now, version: 1 };
      target = db.doc(`${collection(input.projectId, 'Associations')}/${entityId}`);
      event = { ...base, event: 'PHOTO_ASSOCIATED', memberIdentityId: input.memberIdentityId ?? null, assetId: input.documentId, oldValue: null, newValue: { id: entityId, version: 1, status: 'ACTIVE', documentId: input.documentId, sha256: document.photoAsset.original.sha256 } };
    } else {
      photoId(input.associationId);
      const association = (await tx.get(db.doc(`${collection(input.projectId, 'Associations')}/${input.associationId}`))).data() as PhotoAssociation | undefined;
      if (!association || association.id !== input.associationId || association.projectId !== input.projectId || association.gangId !== input.gangId) throw new Error('R4_ASSOCIATION_CROSS_PROJECT');
      if (association.status !== 'ACTIVE') throw new Error('R4_ASSOCIATION_RETIRED');
      if (input.operation === 'RETIRE_ASSOCIATION') {
        expectedPhotoVersion(association.version, input.expectedVersion);
        if (association.memberIdentityId) {
          const primary = (await tx.get(db.doc(`${collection(input.projectId, 'Selections')}/${primarySelectionId(input.gangId, association.memberIdentityId)}`))).data();
          if (primary?.status === 'PRIMARY' && primary.associationId === association.id) throw new Error('R4_PRIMARY_REPLACEMENT_REQUIRED');
        }
        result = { ...association, status: 'RETIRED', updatedAt: now, version: association.version + 1 };
        target = db.doc(`${collection(input.projectId, 'Associations')}/${association.id}`);
        event = { ...base, event: 'PHOTO_ASSOCIATION_RETIRED', memberIdentityId: association.memberIdentityId ?? null, assetId: association.documentId, oldValue: { id: association.id, version: association.version, status: 'ACTIVE' }, newValue: { id: association.id, version: result.version, status: 'RETIRED' } };
      } else {
        if (association.memberIdentityId !== input.memberIdentityId) throw new Error('R4_IDENTITY_CROSS_PROJECT');
        await identityFor(db, tx, input, input.memberIdentityId, gang);
        expectedPhotoVersion(association.version, input.expectedAssociationVersion);
        const document = await documentFor(db, tx, input.projectId, association.documentId);
        expectedPhotoVersion(document.photoAsset.version, input.expectedDocumentVersion);
        if (!document.photoAsset.derived || document.multimodalEvidence.humanValidationStatus !== 'APPROVED') throw new Error('R4_DERIVED_OR_REVIEW_REQUIRED');
        if (association.sourcePage !== document.photoAsset.sourcePage || association.sourceImageId !== document.photoAsset.sourceImageId) throw new Error('R4_PROVENANCE_MISMATCH');
        target = db.doc(`${collection(input.projectId, 'Selections')}/${primarySelectionId(input.gangId, input.memberIdentityId)}`);
        const prior = (await tx.get(target)).data() as MemberPrimaryPhotoSelection | undefined;
        const selected = selectPrimaryPhoto(prior ?? null, association, input.expectedVersion, actor, now, input.reason);
        result = selected.selection;
        const previous = selected.replaced;
        event = { ...base, event: previous ? 'PHOTO_PRIMARY_REPLACED' : 'PHOTO_PRIMARY_SELECTED', memberIdentityId: input.memberIdentityId, assetId: association.documentId, oldValue: previous ? { id: previous.id, version: previous.version, status: previous.status, associationId: previous.associationId } : null, newValue: { id: result.id, version: result.version, status: result.status, associationId: result.associationId, sha256: document.photoAsset.derived.sha256 } };
      }
    }
    // All reads precede all writes. Mutation and immutable history commit together.
    audit(db, tx, operationId, event);
    if (input.operation === 'CREATE_IDENTITY' || input.operation === 'ASSOCIATE') tx.create(target, result);
    else tx.set(target, result);
    tx.update(parent, { institutionalSourceRevision: Number.isSafeInteger(project.institutionalSourceRevision) ? project.institutionalSourceRevision + 1 : 1 });
    return result;
  });
}
export async function resolveMemberPrimaryPhoto(session: unknown, input: Scope & { memberIdentityId: string }, overrides: Partial<Dependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  photoId(input.memberIdentityId); await authorized(session, input, 'READ', deps);
  const db = deps.database();
  return db.runTransaction(async tx => {
    const { gang } = await context(db, tx, input);
    const identity = await identityFor(db, tx, input, input.memberIdentityId, gang);
    const selection = (await tx.get(db.doc(`${collection(input.projectId, 'Selections')}/${primarySelectionId(input.gangId, input.memberIdentityId)}`))).data() as MemberPrimaryPhotoSelection | undefined;
    if (!selection) return null;
    photoId(selection.associationId);
    const association = (await tx.get(db.doc(`${collection(input.projectId, 'Associations')}/${selection.associationId}`))).data() as PhotoAssociation | undefined;
    if (!association) throw new Error('R4_ASSOCIATION_CROSS_PROJECT');
    const document = await documentFor(db, tx, input.projectId, association.documentId);
    if (document.multimodalEvidence.humanValidationStatus !== 'APPROVED') throw new Error('R4_DOCUMENT_NOT_REVIEWED');
    return resolvePrimaryPhotoMetadata(input.projectId, input.gangId, input.memberIdentityId, identity, selection, association, document);
  });
}

/** Dossier batch adapter for the existing resolver. No mutation, upload or legacy patch.
 * Reads identities once, then selections/associations/documents with grouped getAll. */
export async function resolveGangPrimaryPhotoUrls(session: unknown, input: Scope,
  overrides: Partial<Dependencies> & { bucket?: typeof getInstitutionalAdminBucket } = {}) {
  const deps = { ...defaults, ...overrides };
  photoId(input.projectId); photoId(input.gangId);
  const grant = await deps.authorize({ sessionToken: session, projectId: input.projectId, action: 'READ' });
  if (!grant.allowed) throw new ProjectAccessError(grant.code);
  const db = deps.database();
  const resolved = await db.runTransaction(async tx => {
    const { project, gang } = await context(db, tx, input);
    if (project.lifecycleDeletionPending || gang.lifecycleDeletionPending || !Array.isArray(gang.integrantes)
      || gang.integrantes.length > 200) throw new Error('R4_DOSSIER_UNAVAILABLE');
    const identities = await tx.get(db.collection(collection(input.projectId, 'Identities')).where('gangId', '==', input.gangId).limit(201));
    if (identities.size > 200) throw new Error('R4_DOSSIER_CAPACITY');
    const rows = identities.docs.map(doc => ({ ...doc.data(), _documentId: doc.id })) as Array<MemberPhotoIdentity & { _documentId: string }>;
    const valid = rows.filter(row => row.id === row._documentId && row.projectId === input.projectId && row.gangId === input.gangId && row.status === 'ACTIVE');
    const getAll = async (paths: string[]) => {
      const unique = [...new Set(paths)];
      if (!unique.length) return new Map<string, any>();
      return new Map((await tx.getAll(...unique.map(path => db.doc(path)))).map(doc => [doc.id, doc.exists ? doc.data() : undefined]));
    };
    const selections = await getAll(valid.map(row => `${collection(input.projectId, 'Selections')}/${primarySelectionId(input.gangId, row.id)}`));
    const associationIds = [...selections.values()].filter(row => row && typeof row.associationId === 'string').map(row => row.associationId)
      .filter(id => { try { photoId(id); return true; } catch { return false; } });
    const associations = await getAll(associationIds.map(id => `${collection(input.projectId, 'Associations')}/${id}`));
    const additionalSnapshot = await tx.get(db.collection(collection(input.projectId, 'Associations')).where('gangId', '==', input.gangId).limit(1001));
    if (additionalSnapshot.size > 1000) throw new Error('R4_DOSSIER_CAPACITY');
    const additionalRows = additionalSnapshot.docs.map(doc => ({ ...doc.data(), _documentId: doc.id })) as Array<PhotoAssociation & { _documentId: string }>;
    const documentIds = [...associations.values(), ...additionalRows].filter(row => row && typeof row.documentId === 'string').map(row => row.documentId)
      .filter(id => { try { photoId(id); return true; } catch { return false; } });
    const documents = await getAll(documentIds.map(id => `projects/${input.projectId}/documents/${id}`));
    return Promise.all(gang.integrantes.map(async (member: any) => {
      const memberFingerprint = await legacyMemberFingerprint(member);
      const fallback = { memberFingerprint, memberId: null as string | null, photo: null as ReturnType<typeof resolvePrimaryPhotoMetadata>, derivedSize: 0, additional: [] as Array<{ photo: ReturnType<typeof resolveAdditionalPhotoMetadata>; derivedSize: number }> };
      // The image injection deliberately excludes these documentary identities.
      const normalized = String(member.nombre).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (/yordi alejandro|angel ricardo gonzalez sanchez/.test(normalized)) return fallback;
      // Include invalid/retired rows in ambiguity detection: never choose around an inconsistent binding.
      const matches = rows.filter(row => row.legacyMemberName === member.nombre || row.legacyMemberFingerprint === memberFingerprint);
      if (matches.length !== 1) return fallback;
      const identity = matches[0];
      try {
        if (!valid.includes(identity)) return fallback;
        await verifyLegacyBinding(gang, identity);
        const additional = additionalRows.filter(a => a.id === a._documentId && a.memberIdentityId === identity.id).flatMap(a => {
          try {
            const doc = documents.get(a.documentId);
            if (doc?.multimodalEvidence?.humanValidationStatus !== 'APPROVED'
              || doc.multimodalEvidence.documentId !== doc.id || doc.multimodalEvidence.expedienteId !== input.projectId
              || doc.multimodalEvidence.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH'
              || doc.multimodalEvidence.forensicIntegrity?.rawSha256 !== doc.photoAsset?.original?.sha256) return [];
            return [{ photo: resolveAdditionalPhotoMetadata(input.projectId, input.gangId, identity, a, doc), derivedSize: doc.photoAsset.derived.size }];
          } catch { return []; }
        }).sort((a, b) => a.photo.associationId.localeCompare(b.photo.associationId));
        const selection = selections.get(primarySelectionId(input.gangId, identity.id));
        if (!selection) return { ...fallback, memberId: identity.id, additional };
        const association = associations.get(selection.associationId);
        const document = association && documents.get(association.documentId);
        if (!document || document.id !== association.documentId || document.multimodalEvidence?.humanValidationStatus !== 'APPROVED'
          || document.multimodalEvidence?.documentId !== document.id || document.multimodalEvidence?.expedienteId !== input.projectId
          || document.multimodalEvidence?.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH'
          || document.multimodalEvidence?.forensicIntegrity?.rawSha256 !== document.photoAsset?.original?.sha256) return { ...fallback, memberId: identity.id };
        const photo = resolvePrimaryPhotoMetadata(input.projectId, input.gangId, identity.id, identity, selection, association, document);
        return { memberFingerprint, memberId: identity.id, photo, derivedSize: document.photoAsset.derived.size, additional };
      } catch { return fallback; }
    }));
  }, { readOnly: true });
  // Recheck READ after the snapshot and before producing any capability URL.
  const fresh = await deps.authorize({ sessionToken: session, projectId: input.projectId, action: 'READ' });
  if (!fresh.allowed) throw new ProjectAccessError(fresh.code);
  if (fresh.actor.institutionalUserId !== grant.actor.institutionalUserId) throw new ProjectAccessError('PROJECT_ACCESS_DENIED');
  const expiresAt = deps.now() + 120000;
  const bucket = resolved.some(row => row.photo || row.additional.length) ? (overrides.bucket ?? getInstitutionalAdminBucket)() : null;
  const signPhoto = async (entry: { photo: NonNullable<ReturnType<typeof resolvePrimaryPhotoMetadata>> | ReturnType<typeof resolveAdditionalPhotoMetadata>; derivedSize: number }) => {
    if (!bucket) return null;
    try {
      const { photo } = entry;
      const file = bucket.file(photo.storagePathDerived);
      const [metadata] = await file.getMetadata();
      if (metadata.contentType !== photo.mimeType || !metadata.generation) return null;
      await verifyPandillasStoredPhotoFile(bucket, { storagePath: photo.storagePathDerived, sha256: photo.derivedSha256,
        mimeType: photo.mimeType as 'image/jpeg' | 'image/png', size: entry.derivedSize, width: photo.width, height: photo.height }, metadata);
      const [derivedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt, queryParams: { generation: String(metadata.generation) } });
      if (!derivedUrl.startsWith('https://')) return null;
      return { assetId: photo.documentId, associationId: photo.associationId, derivedSha256: photo.derivedSha256,
        documentVersion: photo.documentVersion, associationVersion: photo.associationVersion,
        ...('selectionVersion' in photo ? { selectionVersion: photo.selectionVersion } : {}),
        mimeType: photo.mimeType, width: photo.width, height: photo.height, derivedUrl };
    } catch { return null; }
  };
  const items = await Promise.all(resolved.map(async row => {
    const primary = row.photo ? await signPhoto({ photo: row.photo, derivedSize: row.derivedSize }) : null;
    // Exclude selected PRIMARY by asset AND hash even when its Storage resource is unavailable.
    const seenAssets = new Set(row.photo ? [row.photo.documentId] : []);
    const seenHashes = new Set(row.photo ? [row.photo.derivedSha256] : []);
    const additionalPhotos = [];
    for (const entry of row.additional) {
      if (seenAssets.has(entry.photo.documentId) || seenHashes.has(entry.photo.derivedSha256)) continue;
      seenAssets.add(entry.photo.documentId); seenHashes.add(entry.photo.derivedSha256);
      const photo = await signPhoto(entry);
      if (photo) additionalPhotos.push(photo);
    }
    return { memberId: row.memberId, memberFingerprint: row.memberFingerprint, hasPrimaryPhoto: !!primary,
      assetId: primary?.assetId ?? null, derivedUrl: primary?.derivedUrl ?? null, primaryPhoto: primary, additionalPhotos };
  }));
  const final = await deps.authorize({ sessionToken: session, projectId: input.projectId, action: 'READ' });
  if (!final.allowed) throw new ProjectAccessError(final.code);
  if (final.actor.institutionalUserId !== grant.actor.institutionalUserId) throw new ProjectAccessError('PROJECT_ACCESS_DENIED');
  return { projectId: input.projectId, gangId: input.gangId, expiresAt, items };
}
