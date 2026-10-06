import 'server-only';
import type { PandillasPhotoAssetInput } from './institutionalPandillasPhotoAssetService';
import type { PandillasPhotoMutation } from './institutionalPandillasPhotoBoundary';
import type { MemberPhotoIdentity, PhotoAssociation, MemberPrimaryPhotoSelection, PhotoActor, PhotoAsset, PhotoAuditEventType } from '@/modules/pandillas/photo-evidence/contracts';
import { photoHash, photoId, expectedPhotoVersion, primarySelectionId } from '@/modules/pandillas/photo-evidence/storagePaths';
import { legacyMemberFingerprint, verifyLegacyBinding } from '@/modules/pandillas/photo-evidence/identity';
import { validatePhotoAsset, assertPrimaryAssociation } from '@/modules/pandillas/photo-evidence/association';
import { resolvePrimaryPhotoMetadata } from '@/modules/pandillas/photo-evidence/resolver';
import { selectPrimaryPhoto } from '@/modules/pandillas/photo-evidence/primarySelection';
import { assertPhotoAuditSafe } from '@/modules/pandillas/photo-evidence/audit';
import { pandillasR4CertifiedTargets } from './pandillasR4CertifiedTargets';

export const R4_INJECTION_PROJECT_ID = 'UIwlMmZotIAOsAWmNEH2';
export class R4InjectionError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
type Provenance = Pick<PandillasPhotoAssetInput, 'sourceDocumentId' | 'sourceDocumentName' | 'sourceDocumentSha256' | 'sourcePage' | 'sourceImageId'>;
export type R4InjectionItem = Provenance & { gangName: string; memberName: string; memberIdentityRequired: true;
  originalFileName: string; derivedFileName: string; originalSha256: string; derivedSha256: string;
  mimeType: 'image/jpeg' | 'image/png'; derivedMimeType: 'image/jpeg' | 'image/png'; recipeVersion: string;
  selectionType: 'PRIMARY'; associationLevel: 'EXACT' };
export type R4InjectionBody = { mode: 'DRY_RUN' | 'LIVE'; projectId: string; batchLabel: string; items: R4InjectionItem[] };
const fail = (code: string, status = 400): never => { throw new R4InjectionError(code, status); };
function exactKeys(value: any, required: string[], optional: string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('R4_INVALID_BODY');
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 300
    || /[\x00-\x1f\x7f]|https?:|data:|gs:|base64|[?&]token=/i.test(value)) fail('R4_INVALID_TEXT');
}
const excluded = (name: string) => /yordi alejandro|angel ricardo gonzalez sanchez/.test(name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' '));
export function parseR4InjectionBody(value: unknown): R4InjectionBody {
  const body = value as R4InjectionBody;
  exactKeys(body, ['mode', 'projectId', 'batchLabel', 'items']);
  if (!['DRY_RUN', 'LIVE'].includes(body.mode)) fail('R4_INVALID_MODE');
  if (body.projectId !== R4_INJECTION_PROJECT_ID) fail('R4_PROJECT_NOT_CERTIFIED');
  text(body.batchLabel);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 79) fail('R4_INVALID_BATCH_SIZE');
  const members = new Set<string>(), originals = new Set<string>(), derivatives = new Set<string>();
  for (const item of body.items) {
    exactKeys(item, ['gangName', 'memberName', 'memberIdentityRequired', 'sourceDocumentId', 'sourceDocumentName',
      'sourceDocumentSha256', 'sourcePage', 'sourceImageId', 'originalFileName', 'derivedFileName', 'originalSha256',
      'derivedSha256', 'mimeType', 'recipeVersion', 'selectionType', 'associationLevel'], ['derivedMimeType']);
    for (const key of ['gangName', 'memberName', 'sourceDocumentName', 'originalFileName', 'derivedFileName'] as const) text(item[key]);
    if (excluded(item.memberName)) fail('R4_MEMBER_EXCLUDED');
    if (!pandillasR4CertifiedTargets.some(target => target.gangName === item.gangName && target.memberName === item.memberName)) fail('R4_TARGET_NOT_CERTIFIED');
    if (item.memberIdentityRequired !== true || item.selectionType !== 'PRIMARY' || item.associationLevel !== 'EXACT') fail('R4_PRIMARY_EXACT_REQUIRED');
    try { photoId(item.sourceDocumentId); photoId(item.sourceImageId); photoId(item.recipeVersion);
      photoHash(item.sourceDocumentSha256); photoHash(item.originalSha256); photoHash(item.derivedSha256); } catch { fail('R4_INVALID_PROVENANCE'); }
    if (!Number.isSafeInteger(item.sourcePage) || item.sourcePage < 1) fail('R4_INVALID_PROVENANCE');
    const derivedMime = item.derivedMimeType ?? item.mimeType;
    for (const [mime, filename] of [[item.mimeType, item.originalFileName], [derivedMime, item.derivedFileName]]) {
      if (!['image/jpeg', 'image/png'].includes(mime) || !/^[A-Za-z0-9_.-]{1,180}$/.test(filename)
        || filename.includes('..') || !(mime === 'image/png' ? /\.png$/i : /\.jpe?g$/i).test(filename)) fail('R4_INVALID_FILE_METADATA');
    }
    const memberKey = JSON.stringify([item.gangName, item.memberName]);
    if (members.has(memberKey) || originals.has(item.originalSha256) || derivatives.has(item.derivedSha256)) fail('R4_DUPLICATE_ITEM');
    members.add(memberKey); originals.add(item.originalSha256); derivatives.add(item.derivedSha256);
  }
  // Return an isolated metadata-only body. No bytes, paths or URLs are accepted.
  return { ...body, items: body.items.map(item => ({ ...item, derivedMimeType: item.derivedMimeType ?? item.mimeType })) };
}

export type R4PlanSnapshot = { project: any; gangs: any[]; identities: any[]; documents: any[]; associations: any[]; selections: any[] };
type PlanItem = { gangName: string; memberName: string; status: 'READY' | 'BLOCKED'; actions: string[];
  error?: string; auditEvents?: PhotoAuditEventType[]; requiresHumanApproval?: boolean;
  expectedVersions?: { expectedVersion: number; expectedGangUpdatedAt: number | null; asset: number; association: number; primary: number } };
export async function buildR4InjectionPlan(body: R4InjectionBody, snapshot: R4PlanSnapshot, actor: PhotoActor) {
  if (body.mode !== 'DRY_RUN') fail('R4_LIVE_EXECUTION_NOT_ENABLED', 409);
  const { project, gangs, identities, documents, associations, selections } = snapshot;
  if (!project || project.deleted !== undefined && project.deleted !== false || project.estado === 'ARCHIVADO'
    || project.status === 'ARCHIVADO' || project.lifecycleDeletionPending) fail('R4_PROJECT_UNAVAILABLE', 409);
  if (project.institutionalSourceRevision != null && (!Number.isSafeInteger(project.institutionalSourceRevision) || project.institutionalSourceRevision < 0)) fail('R4_PERSISTED_STATE_INVALID', 409);
  if (gangs.length !== 25 || gangs.some(g => g.projectId !== body.projectId || g.deleted || !Array.isArray(g.integrantes))
    || gangs.reduce((sum, g) => sum + g.integrantes.length, 0) !== 80) fail('R4_INVENTORY_CONFLICT', 409);
  for (const target of pandillasR4CertifiedTargets) {
    const matches = gangs.filter(g => g.nombre === target.gangName);
    if (matches.length !== 1 || matches[0].integrantes.filter((m: any) => m.nombre === target.memberName).length !== 1) fail('R4_LIVE_TARGET_CONFLICT', 409);
  }
  const planSummary = { createIdentities: 0, reuseIdentities: 0, createAssets: 0, reuseAssets: 0,
    createAssociations: 0, reuseAssociations: 0, createPrimarySelections: 0, reusePrimarySelections: 0 };
  const checks: { gangId: string; memberIdentityId: string; documentId: string; derivedSha256: string }[] = [];
  const items: PlanItem[] = [];
  for (const item of body.items) {
    const gang = gangs.find(g => g.nombre === item.gangName)!;
    const actions: string[] = [], auditEvents: PhotoAuditEventType[] = [];
    try {
      photoId(gang.id);
      if (gang.updatedAt != null && (!Number.isSafeInteger(gang.updatedAt) || gang.updatedAt < 0)) throw new Error();
      const fingerprint = await legacyMemberFingerprint(gang.integrantes.find((m: any) => m.nombre === item.memberName));
      const identityMatches = identities.filter(i => i.gangId === gang.id && (i.legacyMemberName === item.memberName || i.legacyMemberFingerprint === fingerprint));
      if (identityMatches.length > 1) throw new Error();
      const identity = identityMatches[0] as MemberPhotoIdentity | undefined;
      if (identity) {
        photoId(identity.id); if (identity.projectId !== body.projectId) throw new Error();
        expectedPhotoVersion(identity.version, identity.version); if (identity.version < 1) throw new Error();
        await verifyLegacyBinding(gang, identity);
      }
      // The existing asset service owns content-addressed IDs and byte validation.
      // Never simulate registration by calling it with mock bytes/dependencies.
      const assetMatches = documents.filter(doc => doc.photoAsset &&
        (doc.photoAsset.original?.sha256 === item.originalSha256 || doc.photoAsset.derived?.sha256 === item.derivedSha256));
      if (assetMatches.length > 1) throw new Error();
      const document = assetMatches[0]; const asset = document?.photoAsset as PhotoAsset | undefined;
      if (asset) {
        validatePhotoAsset(asset, body.projectId, document.id);
        if (document.projectId !== body.projectId || document.expedienteId !== body.projectId || document.deleted || document.lifecycleDeletionPending
          || asset.sourceDocumentId !== item.sourceDocumentId || asset.sourceDocumentName !== item.sourceDocumentName
          || asset.sourceDocumentSha256 !== item.sourceDocumentSha256 || asset.sourcePage !== item.sourcePage
          || asset.sourceImageId !== item.sourceImageId || asset.original.sha256 !== item.originalSha256
          || asset.original.mimeType !== item.mimeType || asset.derived?.sha256 !== item.derivedSha256
          || asset.derived.mimeType !== item.derivedMimeType || asset.derived.recipeVersion !== item.recipeVersion
          || document.multimodalEvidence?.documentId !== document.id || document.multimodalEvidence?.expedienteId !== body.projectId
          || document.multimodalEvidence?.forensicIntegrity?.rawSha256 !== item.originalSha256
          || document.multimodalEvidence?.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH'
          || document.multimodalEvidence?.humanValidationStatus !== 'APPROVED') throw new Error();
      }
      const related = identity ? associations.filter(a => a.memberIdentityId === identity.id && a.imageType === 'MEMBER_PRIMARY_PHOTO' && a.status === 'ACTIVE') : [];
      const associationMatches = related.filter(a => a.documentId === document?.id);
      if (associationMatches.length > 1 || related.some(a => a.projectId !== body.projectId || a.gangId !== gang.id)) throw new Error();
      const association = associationMatches[0] as PhotoAssociation | undefined;
      if (association) {
        photoId(association.id); assertPrimaryAssociation(association);
        expectedPhotoVersion(association.version, association.version); if (association.version < 1) throw new Error();
        if (association.sourcePage !== item.sourcePage || association.sourceImageId !== item.sourceImageId) throw new Error();
      }
      const primaryMatches = identity ? selections.filter(s => s.memberIdentityId === identity.id || s.id === primarySelectionId(gang.id, identity.id)) : [];
      if (primaryMatches.length > 1) throw new Error();
      const primary = primaryMatches[0] as MemberPrimaryPhotoSelection | undefined;
      if (primary) {
        if (!association || primary.associationId !== association.id) throw new Error(); // Never replace a primary in this phase.
        expectedPhotoVersion(primary.version, primary.version); if (primary.version < 1) throw new Error();
        resolvePrimaryPhotoMetadata(body.projectId, gang.id, identity!.id, identity!, primary, association!, document);
        checks.push({ gangId: gang.id, memberIdentityId: identity!.id, documentId: document.id, derivedSha256: item.derivedSha256 });
      } else if (association) {
        // Pure existing selection contract; no persistence or invented review state.
        selectPrimaryPhoto(null, association, 0, actor, Date.now(), body.batchLabel);
      }
      actions.push(identity ? 'REUSE_IDENTITY' : 'CREATE_IDENTITY', asset ? 'REUSE_ASSET' : 'CREATE_ASSET',
        association ? 'REUSE_ASSOCIATION' : 'CREATE_ASSOCIATION', primary ? 'REUSE_PRIMARY' : 'CREATE_PRIMARY');
      const identityMutation: Pick<Extract<PandillasPhotoMutation, { operation: 'CREATE_IDENTITY' }>, 'expectedVersion' | 'expectedGangUpdatedAt'> =
        { expectedVersion: identity?.version ?? 0, expectedGangUpdatedAt: gang.updatedAt ?? null };
      for (const [exists, event] of [
        [!!identity, 'PHOTO_IDENTITY_CREATED'],
        [!!asset, 'PHOTO_IMPORTED'],
        [!!association, 'PHOTO_ASSOCIATED'],
        [!!primary, 'PHOTO_PRIMARY_SELECTED'],
      ] as const) {
        if (!exists) { assertPhotoAuditSafe({ event, actor, timestamp: Date.now(), projectId: body.projectId, gangId: gang.id,
          memberIdentityId: identity?.id ?? null, assetId: asset?.id ?? null, oldValue: null, newValue: null, reason: body.batchLabel }); auditEvents.push(event); }
      }
      items.push({ gangName: item.gangName, memberName: item.memberName, status: 'READY', actions, auditEvents,
        requiresHumanApproval: !asset || !association,
        expectedVersions: { ...identityMutation, asset: asset?.version ?? 0, association: association?.version ?? 0, primary: primary?.version ?? 0 } });
    } catch {
      items.push({ gangName: item.gangName, memberName: item.memberName, status: 'BLOCKED', actions: [], error: 'R4_PERSISTED_STATE_CONFLICT' });
    }
  }
  const blockedItems = items.filter(item => item.status === 'BLOCKED').length;
  const actionCounts = [['CREATE_IDENTITY', 'createIdentities'], ['REUSE_IDENTITY', 'reuseIdentities'], ['CREATE_ASSET', 'createAssets'],
    ['REUSE_ASSET', 'reuseAssets'], ['CREATE_ASSOCIATION', 'createAssociations'], ['REUSE_ASSOCIATION', 'reuseAssociations'],
    ['CREATE_PRIMARY', 'createPrimarySelections'], ['REUSE_PRIMARY', 'reusePrimarySelections']] as const;
  for (const [action, key] of actionCounts) planSummary[key] = items.filter(item => item.status === 'READY' && item.actions.includes(action)).length;
  return { checks, response: { ok: blockedItems === 0, mode: 'DRY_RUN', projectId: body.projectId, targetMembers: 79,
    itemsReceived: body.items.length, itemsValidated: body.items.length - blockedItems, blockedItems, duplicateItems: 0,
    writesPerformed: 0, liveExecutionEnabled: false, executable: false, projectRevision: project.institutionalSourceRevision ?? null,
    deferredValidations: ['REAL_BYTES_SHA256_MIME_DECODE', 'STORAGE_READBACK', 'HUMAN_APPROVAL', 'LIVE_AUTHORIZATION_AND_VERSION_RECHECK'],
    planSummary, items } };
}
