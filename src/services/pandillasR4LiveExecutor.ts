import 'server-only';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { resolveInstitutionalSessionIdentity } from './institutionalSessionIdentityService';
import { mutateInstitutionalPandillasPhoto, resolveMemberPrimaryPhoto } from './institutionalPandillasPhotoBoundary';
import { registerInstitutionalPandillasPhotoAsset, verifyPandillasStoredPhotoFile } from './institutionalPandillasPhotoAssetService';
import { commitInstitutionalEvidenceReview } from './institutionalEvidenceReviewBoundary';
import { verifyR4HumanApproval, verifyR4ReadinessReceipt, validateR4ReadinessBytes, prepareCertifiedR4ReviewRequest } from './pandillasR4LiveReadiness';
import { guardedR4Database, readR4LiveState } from './pandillasR4LiveState';
import { buildR4InjectionPlan, parseR4InjectionBody, R4InjectionError, R4_INJECTION_PROJECT_ID, type R4InjectionBody, type R4PlanSnapshot } from './pandillasR4ImageInjectionPlan';
import { r4HumanApprovals } from './pandillasR4HumanApprovalBatch';
import type { InstitutionalActor } from '@/types/institutionalProjectAccess';

const defaults = { database: getInstitutionalAdminDb, bucket: getInstitutionalAdminBucket,
  authorize: authorizeInstitutionalProjectAccess, identity: resolveInstitutionalSessionIdentity,
  mutate: mutateInstitutionalPandillasPhoto, register: registerInstitutionalPandillasPhotoAsset,
  review: commitInstitutionalEvidenceReview, resolve: resolveMemberPrimaryPhoto,
  guard: guardedR4Database, read: readR4LiveState };
export class R4LiveExecutionError extends R4InjectionError {
  constructor(public readonly writesPerformed: number, public readonly completedStages: string[], code = 'R4_LIVE_STOPPED') { super(code, 409); }
}
export async function executeR4Live(session: unknown, actor: InstitutionalActor, body: R4InjectionBody,
  snapshot: R4PlanSnapshot, files: { original: Uint8Array; derived: Uint8Array }, receipt: unknown,
  overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  if (body.mode !== 'LIVE' || body.projectId !== R4_INJECTION_PROJECT_ID || body.batchLabel !== 'R4_PRIMARY_IMAGE_INJECTION_V1'
    || body.items.length !== 1 || !files) throw new R4InjectionError('R4_LIVE_SINGLE_MULTIPART_REQUIRED', 400);
  const item = body.items[0];
  const approval = verifyR4HumanApproval(item);
  const proof = verifyR4ReadinessReceipt(receipt, actor.institutionalUserId, snapshot);
  if (proof.documentaryId !== approval.documentaryId) throw new R4InjectionError('R4_READINESS_ITEM_MISMATCH', 409);
  await validateR4ReadinessBytes(item, files.original, files.derived);
  const reauthorize = async () => {
    const fresh = await deps.identity(session);
    if (fresh.institutionalUserId !== actor.institutionalUserId || !['ADMIN', 'SUPER_ADMIN'].includes(fresh.role)) throw new R4InjectionError('R4_ACCESS_DENIED', 403);
    for (const action of ['READ', 'WRITE'] as const) {
      const access = await deps.authorize({ sessionToken: session, projectId: body.projectId, action });
      if (!access.allowed || access.actor.institutionalUserId !== actor.institutionalUserId || !['ADMIN', 'SUPER_ADMIN'].includes(access.actor.role)) throw new R4InjectionError('R4_ACCESS_DENIED', 403);
    }
  };
  await reauthorize();
  const plan = await buildR4InjectionPlan({ ...body, mode: 'DRY_RUN' }, snapshot,
    { institutionalUserId: actor.institutionalUserId, username: actor.username }, { humanApprovalVerified: candidate => !!verifyR4HumanApproval(candidate) });
  if (!plan.response.ok) throw new R4InjectionError('R4_PERSISTED_STATE_CONFLICT', 409);
  const db = deps.database();
  const guard = deps.guard(db, snapshot, reauthorize);
  const stage: string[] = ['HASH_VERIFIED'];
  const gang = snapshot.gangs.find(row => row.nombre === item.gangName)!;
  const scope = { projectId: body.projectId, gangId: gang.id };
  const reason = `R4 certified PRIMARY ${approval.documentaryId}`;
  try {
    await guard.assertCurrent();
    let identity = snapshot.identities.find(row => row.gangId === gang.id && row.legacyMemberName === item.memberName);
    if (!identity) identity = await deps.mutate(session, { ...scope, operation: 'CREATE_IDENTITY', expectedVersion: 0,
      expectedGangUpdatedAt: gang.updatedAt ?? null, legacyMemberName: item.memberName, reason }, { database: () => guard.database });
    const asset = await deps.register(session, { ...scope, sourceDocumentId: item.sourceDocumentId, sourceDocumentName: item.sourceDocumentName,
      sourceDocumentSha256: item.sourceDocumentSha256, sourcePage: item.sourcePage, sourceImageId: item.sourceImageId, reason,
      original: { bytes: files.original, mimeType: item.mimeType, sha256: item.originalSha256 },
      derived: { bytes: files.derived, mimeType: item.derivedMimeType, sha256: item.derivedSha256, recipeVersion: item.recipeVersion } },
    { database: () => guard.database });
    stage.push('ASSET_REGISTERED');
    const document = guard.state().documents.find(row => row.id === asset.documentId);
    const review = prepareCertifiedR4ReviewRequest(item, document);
    if (review) await deps.review(guard.database, actor, review);
    await guard.assertCurrent();
    let association = guard.state().associations.find(row => row.memberIdentityId === identity!.id
      && row.documentId === asset.documentId && row.imageType === 'MEMBER_PRIMARY_PHOTO' && row.status === 'ACTIVE');
    if (!association) association = await deps.mutate(session, { ...scope, operation: 'ASSOCIATE', expectedVersion: 0, reason,
      documentId: asset.documentId, memberIdentityId: identity.id, imageType: 'MEMBER_PRIMARY_PHOTO', associationLevel: 'EXACT',
      associationBasis: reason, sourcePage: item.sourcePage, sourceImageId: item.sourceImageId,
      expectedDocumentVersion: asset.photoAsset.version }, { database: () => guard.database });
    stage.push('ASSOCIATED');
    await guard.assertCurrent();
    const primary = guard.state().selections.find(row => row.memberIdentityId === identity!.id);
    if (primary && (primary.associationId !== association.id || primary.status !== 'PRIMARY')) throw new R4InjectionError('R4_PRIMARY_CONFLICT', 409);
    if (!primary) await deps.mutate(session, { ...scope, operation: 'SELECT_PRIMARY', expectedVersion: 0, reason,
      memberIdentityId: identity.id, associationId: association.id, expectedAssociationVersion: association.version,
      expectedDocumentVersion: asset.photoAsset.version }, { database: () => guard.database });
    stage.push('PRIMARY_SELECTED');
    await guard.assertCurrent();
    const current = await deps.resolve(session, { ...scope, memberIdentityId: identity.id }, { database: () => guard.database });
    if (!current || current.documentId !== asset.documentId || current.derivedSha256 !== item.derivedSha256) throw new R4InjectionError('R4_PRIMARY_REREAD_CONFLICT', 409);
    stage.push('DONE');
    return { ok: true, mode: 'LIVE', liveExecutionEnabled: true, documentaryId: approval.documentaryId, status: 'DONE',
      completedStages: stage, writesPerformed: guard.writes(), actions: plan.response.items[0].actions,
      storageOriginalVerified: true, storageDerivedVerified: true, primaryResolverPass: true };
  } catch (error) {
    // Partial writes are durable for a fresh READINESS + idempotent retry. Never claim zero writes after a failed stage.
    const allowed = ['R4_ASSET_CONFLICT', 'R4_REGISTERED_OBJECT_MISSING', 'R4_ACCESS_DENIED', 'R4_GANG_VERSION_CONFLICT',
      'R4_LEGACY_MEMBER_NOT_EXACT', 'R4_PROVENANCE_MISMATCH', 'R4_DOCUMENT_INTEGRITY_REQUIRED'];
    const code = error instanceof R4InjectionError ? error.code
      : error instanceof Error && allowed.includes(error.message) ? error.message : 'R4_LIVE_STOPPED';
    throw new R4LiveExecutionError(guard.writes(), stage, code);
  }
}
export async function verifyR4LiveFinal(session: unknown, actor: InstitutionalActor, overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  const db = deps.database(); const snapshot = await deps.read(db);
  const items = r4HumanApprovals.map(({ documentaryId, decision, decisionSource, reviewedBy, reviewedAt,
    originalSize, originalWidth, originalHeight, derivedSize, derivedWidth, derivedHeight, ...item }) => item);
  const body = parseR4InjectionBody({ mode: 'DRY_RUN', projectId: R4_INJECTION_PROJECT_ID, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', items });
  const plan = await buildR4InjectionPlan(body, snapshot, { institutionalUserId: actor.institutionalUserId, username: actor.username },
    { humanApprovalVerified: item => !!verifyR4HumanApproval(item) });
  if (!plan.response.ok || plan.checks.length !== 79 || plan.response.items.some(item => item.actions.some(action => action.startsWith('CREATE_')))) throw new R4InjectionError('R4_FINAL_INCOMPLETE', 409);
  if (snapshot.identities.length !== 79 || snapshot.associations.length !== 79 || snapshot.selections.length !== 79
    || snapshot.documents.filter(document => document.photoAsset).length !== 79) throw new R4InjectionError('R4_FINAL_UNEXPECTED_COUNTS', 409);
  const bucket = deps.bucket();
  for (const check of plan.checks) {
    const document = snapshot.documents.find(row => row.id === check.documentId)!;
    await verifyPandillasStoredPhotoFile(bucket, document.photoAsset.original);
    await verifyPandillasStoredPhotoFile(bucket, document.photoAsset.derived);
    const primary = await deps.resolve(session, { projectId: body.projectId, gangId: check.gangId, memberIdentityId: check.memberIdentityId });
    if (!primary || primary.documentId !== check.documentId || primary.derivedSha256 !== check.derivedSha256) throw new R4InjectionError('R4_PRIMARY_REREAD_CONFLICT', 409);
  }
  const after = await deps.read(db);
  const { assertR4LivePrecondition, r4LivePreconditionFingerprint } = await import('./pandillasR4LiveReadiness');
  assertR4LivePrecondition(r4LivePreconditionFingerprint(snapshot), after);
  return { ok: true, mode: 'VERIFY', successfulMembers: 79, failedMembers: 0, existingIdentities: 79,
    existingPhotoAssets: 79, existingAssociations: 79, existingPrimarySelections: 79,
    storageOriginalVerified: 79, storageDerivedVerified: 79, primaryResolverPass: 79,
    gangsFinal: 25, membersFinal: 80, yordiIncluded: false, angelRicardoIncluded: false, writesPerformed: 0 };
}
