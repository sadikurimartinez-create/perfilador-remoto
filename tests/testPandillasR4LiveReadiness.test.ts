jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'mock-session' }) }) }));
jest.mock('@/services/institutionalSessionIdentityService', () => ({ resolveInstitutionalSessionIdentity: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoBoundary', () => ({ resolveMemberPrimaryPhoto: jest.fn(), mutateInstitutionalPandillasPhoto: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoAssetService', () => ({
  ...jest.requireActual('@/services/institutionalPandillasPhotoAssetService'), registerInstitutionalPandillasPhotoAsset: jest.fn(),
}));
jest.mock('@/utils/authCrypto', () => {
  const crypto = require('crypto'); const sign = (text: string) => crypto.createHmac('sha256', 'synthetic-readiness-key').update(text).digest('hex');
  return { signSession: (value: any) => { const text = Buffer.from(JSON.stringify({ ...value, createdAt: Date.now() })).toString('base64url'); return text + '.' + sign(text); },
    verifySession: (token: string) => { const [text, signature] = token.split('.'); return signature === sign(text) ? JSON.parse(Buffer.from(text, 'base64url').toString()) : null; } };
});
jest.mock('@/services/pandillasR4HumanApprovalBatch', () => {
  const { createCanvas } = require('@napi-rs/canvas'); const { createHash } = require('crypto');
  const targets = require('@/services/pandillasR4CertifiedTargets').pandillasR4CertifiedTargets;
  const hash = (bytes: any) => createHash('sha256').update(bytes).digest('hex');
  const buffers: Buffer[] = [];
  const rows = targets.map((target: any, i: number) => {
    const canvas = createCanvas(4, 3); const context = canvas.getContext('2d'); context.fillStyle = `rgb(${i + 1},10,20)`; context.fillRect(0, 0, 4, 3);
    const bytes = canvas.toBuffer('image/png'); buffers.push(bytes);
    return Object.freeze({ ...target, memberIdentityRequired: true, sourceDocumentId: 'synthetic-source', sourceDocumentName: 'synthetic.pdf',
      sourceDocumentSha256: hash('synthetic-source'), sourcePage: i + 1, sourceImageId: 'IMG-' + i,
      originalFileName: 'original-' + i + '.png', derivedFileName: 'derived-' + i + '.png', originalSha256: hash(bytes), derivedSha256: hash(bytes),
      mimeType: 'image/png', derivedMimeType: 'image/png', recipeVersion: 'recipe-v1', selectionType: 'PRIMARY', associationLevel: 'EXACT',
      originalSize: bytes.length, derivedSize: bytes.length, originalWidth: 4, originalHeight: 3, derivedWidth: 4, derivedHeight: 3,
      decision: i < 59 ? 'APPROVE_PRIMARY' : 'SELECT_PRIMARY', reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-10-06T00:00:00Z' });
  });
  return { r4HumanApprovals: Object.freeze(rows), R4_APPROVAL_VERSION: 'synthetic-79-v1', R4_APPROVAL_DIGEST: hash(JSON.stringify(rows)), __buffers: buffers };
});

import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/pandillas/r4/image-injection/route';
import { verifyR4HumanApproval, validateR4ReadinessBytes, r4LivePreconditionFingerprint, assertR4LivePrecondition,
  createR4ReadinessReceipt, verifyR4ReadinessReceipt, verifyR4ReadinessBatch, parseR4ReadinessMultipart, prepareCertifiedR4ReviewRequest } from '../src/services/pandillasR4LiveReadiness';
import { r4HumanApprovals } from '../src/services/pandillasR4HumanApprovalBatch';
import { parseR4InjectionBody, buildR4InjectionPlan, R4_INJECTION_PROJECT_ID, type R4PlanSnapshot } from '../src/services/pandillasR4ImageInjectionPlan';
import { resolveInstitutionalSessionIdentity } from '../src/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '../src/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '../src/lib/firebaseAdmin';
import { registerInstitutionalPandillasPhotoAsset, verifyPandillasStoredPhotoFile } from '../src/services/institutionalPandillasPhotoAssetService';
import { mutateInstitutionalPandillasPhoto } from '../src/services/institutionalPandillasPhotoBoundary';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import { photoStoragePath } from '../src/modules/pandillas/photo-evidence/storagePaths';
import { ProjectAccessError } from '../src/types/institutionalProjectAccess';
const pid = R4_INJECTION_PROJECT_ID, actor = { institutionalUserId: 'admin-1', username: 'admin', role: 'ADMIN' };
const buffers: Buffer[] = (jest.requireMock('@/services/pandillasR4HumanApprovalBatch') as any).__buffers;
const metadataKeys = ['gangName', 'memberName', 'memberIdentityRequired', 'sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256',
  'sourcePage', 'sourceImageId', 'originalFileName', 'derivedFileName', 'originalSha256', 'derivedSha256', 'mimeType', 'derivedMimeType', 'recipeVersion', 'selectionType', 'associationLevel'];
const it = (i = 0): any => Object.fromEntries(metadataKeys.map(key => [key, (r4HumanApprovals[i] as any)[key]]));
const body = (items = [it()]) => parseR4InjectionBody({ mode: 'DRY_RUN', projectId: pid, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', items });
let snapshot: R4PlanSnapshot;
const bucketMetadata = jest.fn(), writes = jest.fn(), txGet = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); const groups = new Map<string, any[]>();
  for (const row of r4HumanApprovals) groups.set(row.gangName, [...(groups.get(row.gangName) || []), { nombre: row.memberName }]);
  groups.get('Los Chicali')!.push({ nombre: 'Yordi Alejandro Amezcuita de la Cruz' });
  const gangs = [...groups].map(([nombre, integrantes], i) => ({ id: 'g' + i, nombre, integrantes, projectId: pid }));
  while (gangs.length < 25) gangs.push({ id: 'g' + gangs.length, nombre: 'Empty ' + gangs.length, integrantes: [], projectId: pid });
  snapshot = { project: {}, gangs, identities: [], documents: [], associations: [], selections: [] };
  (resolveInstitutionalSessionIdentity as jest.Mock).mockResolvedValue(actor);
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: true, actor });
  (readInstitutionalCollection as jest.Mock).mockImplementation(async name => name === 'projects' ? [{ id: pid }] : gangs);
  bucketMetadata.mockResolvedValue([{}]); (getInstitutionalAdminBucket as jest.Mock).mockReturnValue({ getMetadata: bucketMetadata });
  const map: Record<string, keyof R4PlanSnapshot> = { pandillas: 'gangs', pandillasMemberIdentities: 'identities', documents: 'documents',
    pandillasPhotoAssociations: 'associations', pandillasPrimarySelections: 'selections' };
  function ref(path: string, max = 10001): any { return { path, max, doc: (id: string) => ref(path + '/' + id),
    collection: (name: string) => ref(path + '/' + name), where: () => ref(path), limit: (n: number) => ref(path, n) }; }
  txGet.mockImplementation(async reference => reference.path === 'projects/' + pid ? { data: () => snapshot.project } : {
    size: (snapshot[map[reference.path.split('/').at(-1)]] as any[]).length,
    docs: (snapshot[map[reference.path.split('/').at(-1)]] as any[]).map(row => ({ id: row.id, data: () => row })) });
  (getInstitutionalAdminDb as jest.Mock).mockReturnValue({ collection: (name: string) => ref(name), runTransaction: async (fn: any, options: any) => {
    expect(options).toEqual({ readOnly: true }); return fn({ get: txGet, create: writes, set: writes, update: writes, delete: writes }); } });
});
afterEach(() => { jest.restoreAllMocks(); expect(writes).not.toHaveBeenCalled(); expect(registerInstitutionalPandillasPhotoAsset).not.toHaveBeenCalled(); expect(mutateInstitutionalPandillasPhoto).not.toHaveBeenCalled(); });
function multipart(metadata: any = { ...body(), mode: 'READINESS' }, original = buffers[0], derived = buffers[0]) {
  const form = new FormData(); form.append('metadata', JSON.stringify(metadata));
  form.append('original', new Blob([new Uint8Array(original)], { type: 'image/png' }), it().originalFileName);
  form.append('derived', new Blob([new Uint8Array(derived)], { type: 'image/png' }), it().derivedFileName);
  return new NextRequest('https://example.invalid/api/pandillas/r4/image-injection', { method: 'POST', body: form });
}
test('correct physical original and derived validate MIME, full decode, hashes and existing approval', async () => {
  expect(await validateR4ReadinessBytes(it(), buffers[0], buffers[0])).toMatchObject({ realBytesReady: true, hashValidationReady: true,
    mimeDecodeValidationReady: true, humanApprovalVerified: true });
  expect(getInstitutionalAdminDb).not.toHaveBeenCalled(); expect(getInstitutionalAdminBucket).not.toHaveBeenCalled();
});
test.each(['original', 'derived'])('%s physical hash mismatch', async file => {
  await expect(validateR4ReadinessBytes(it(), file === 'original' ? buffers[1] : buffers[0], file === 'derived' ? buffers[1] : buffers[0])).rejects.toThrow('R4_HASH_MISMATCH');
});
test('MIME declaration changed is not approved', () => { expect(() => verifyR4HumanApproval({ ...it(), mimeType: 'image/jpeg' })).toThrow('R4_HUMAN_APPROVAL_BINDING_MISMATCH'); });
test('wrong magic bytes rejected', async () => { await expect(validateR4ReadinessBytes(it(), Buffer.from('not an image'), buffers[0])).rejects.toThrow('R4_MIME_MISMATCH'); });
test('encoded image with invalid native decode rejected', async () => {
  const invalid = Buffer.from(buffers[0]); invalid.fill(0, 40, invalid.length - 12);
  await expect(validateR4ReadinessBytes(it(), invalid, buffers[0])).rejects.toThrow(/R4_IMAGE_DECODE_FAILED|R4_IMAGE_INVALID/);
});
test.each([{ sourceImageId: 'OTHER' }, { originalSha256: 'a'.repeat(64) }, { derivedSha256: 'b'.repeat(64) }])('asset binding mismatch %j', patch => {
  expect(() => verifyR4HumanApproval({ ...it(), ...patch })).toThrow('R4_HUMAN_APPROVAL_BINDING_MISMATCH');
});
test('member with no certified approval rejected', () => { expect(() => verifyR4HumanApproval({ ...it(), memberName: 'Not approved' })).toThrow('R4_HUMAN_APPROVAL_MISSING'); });
test('fingerprint remains stable for object key and collection ordering, without project revision', () => {
  const fingerprint = r4LivePreconditionFingerprint(snapshot); snapshot.gangs.reverse(); snapshot.project = {};
  expect(r4LivePreconditionFingerprint(snapshot)).toBe(fingerprint); expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
});
test.each(['gangs', 'identities', 'documents', 'associations', 'selections'])('%s change aborts old precondition', key => {
  const fingerprint = r4LivePreconditionFingerprint(snapshot); (snapshot as any)[key].push({ id: 'new' });
  expect(() => assertR4LivePrecondition(fingerprint, snapshot)).toThrow('R4_LIVE_PRECONDITION_CHANGED');
});
test('member fields and Firestore updateTime change invalidate fingerprint', () => {
  const fingerprint = r4LivePreconditionFingerprint(snapshot); snapshot.gangs[0].integrantes[0].edad = 27;
  expect(() => assertR4LivePrecondition(fingerprint, snapshot)).toThrow();
  const next = r4LivePreconditionFingerprint(snapshot); snapshot.gangs[0]._r4ReadVersion = [10, 7];
  expect(() => assertR4LivePrecondition(next, snapshot)).toThrow();
});
test('signed receipt binds actor, approval, hashes and snapshot; forged receipt rejected', () => {
  const token = createR4ReadinessReceipt(it(), actor.institutionalUserId, snapshot);
  expect(verifyR4ReadinessReceipt(token, actor.institutionalUserId, snapshot).documentaryId).toBe(r4HumanApprovals[0].documentaryId);
  expect(() => verifyR4ReadinessReceipt(token + 'x', actor.institutionalUserId, snapshot)).toThrow();
  expect(() => verifyR4ReadinessReceipt(token, 'different-actor', snapshot)).toThrow();
  snapshot.identities.push({ id: 'new' }); expect(() => verifyR4ReadinessReceipt(token, actor.institutionalUserId, snapshot)).toThrow('R4_LIVE_PRECONDITION_CHANGED');
});
test('expired receipt rejected', () => {
  const token = createR4ReadinessReceipt(it(), actor.institutionalUserId, snapshot); const now = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60000); expect(() => verifyR4ReadinessReceipt(token, actor.institutionalUserId, snapshot)).toThrow('R4_READINESS_RECEIPT_INVALID');
});
test('79 unique valid receipts needed for complete batch readiness', () => {
  const receipts = r4HumanApprovals.map((_, i) => createR4ReadinessReceipt(it(i), actor.institutionalUserId, snapshot));
  expect(verifyR4ReadinessBatch(receipts, actor.institutionalUserId, snapshot).bytesValidated).toBe(79);
  expect(() => verifyR4ReadinessBatch(receipts.slice(1), actor.institutionalUserId, snapshot)).toThrow('R4_READINESS_BATCH_INCOMPLETE');
  receipts[1] = receipts[0]; expect(() => verifyR4ReadinessBatch(receipts, actor.institutionalUserId, snapshot)).toThrow('R4_READINESS_BATCH_DUPLICATE');
});
test('multipart transport verifies filenames, fields and bytes before issuing a receipt; no storage write', async () => {
  const response = await POST(multipart()); const result = await response.json(); expect(response.status).toBe(200);
  expect(result).toMatchObject({ itemReadinessForLive: true, readinessForLive: false, batchComplete: false, bytesValidated: 1,
    humanApprovalVerified: true, storageReadbackReady: true, storageReadbackPerformed: false, executable: false, writesPerformed: 0 });
  expect(result.items[0].requiresHumanApproval).toBe(false); expect(result.readinessReceipt).toBeTruthy();
});
test('multipart LIVE requires an actor-bound readiness receipt', async () => { const response = await POST(multipart({ ...body(), mode: 'LIVE' })); expect((await response.json()).error).toBe('R4_READINESS_RECEIPT_INVALID'); });
test('multipart scope rejects extra fields and payload sizes beyond envelope', async () => {
  const metadata = { ...body(), mode: 'READINESS', extra: true }; await expect(parseR4ReadinessMultipart(multipart(metadata))).rejects.toThrow('R4_INVALID_BODY');
  await expect(parseR4ReadinessMultipart(multipart(undefined, Buffer.alloc(4 * 1024 * 1024)))).rejects.toThrow('R4_MULTIPART_TOO_LARGE');
});
test('permission required before receiving physical bytes', async () => {
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_DENIED' });
  expect((await POST(multipart())).status).toBe(403); expect(getInstitutionalAdminDb).not.toHaveBeenCalled();
});
test('unauthenticated transport refused', async () => {
  (resolveInstitutionalSessionIdentity as jest.Mock).mockRejectedValue(new ProjectAccessError('PROJECT_ACCESS_UNAUTHENTICATED'));
  expect((await POST(multipart())).status).toBe(401);
});
test('full batch READINESS validates all signed receipts against current snapshot', async () => {
  // Endpoint snapshot records its read versions, so attest against that exact representation.
  const state = { ...snapshot, project: { ...snapshot.project, _r4ReadVersion: null },
    gangs: snapshot.gangs.map(g => ({ ...g, _r4ReadVersion: null })) };
  const receipts = r4HumanApprovals.map((_, i) => createR4ReadinessReceipt(it(i), actor.institutionalUserId, state));
  const response = await POST(new NextRequest('https://example.invalid/api/pandillas/r4/image-injection', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'READINESS', projectId: pid, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', receipts }) }));
  const result = await response.json(); expect(response.status).toBe(200); expect(result.readinessForLive).toBe(true);
  expect(result.bytesValidated).toBe(79); expect(result.liveExecutionEnabled).toBe(true);
});
test('readiness reattempt stable and idempotent; pending review asset uses certificate but never changes persisted review', async () => {
  const item = it(), gang = snapshot.gangs.find(g => g.nombre === item.gangName);
  snapshot.identities.push({ id: 'identity-1', projectId: pid, gangId: gang.id, legacyMemberName: item.memberName,
    legacyMemberFingerprint: await legacyMemberFingerprint(gang.integrantes.find((m: any) => m.nombre === item.memberName)), status: 'ACTIVE', version: 1 });
  const file = (derived: boolean) => ({ storagePath: photoStoragePath({ projectId: pid, assetId: 'asset-1', sha256: item.originalSha256,
    ext: 'png', ...(derived ? { recipeVersion: item.recipeVersion } : {}) }), sha256: item.originalSha256, mimeType: 'image/png',
    size: buffers[0].length, width: 4, height: 3, ...(derived ? { recipeVersion: item.recipeVersion } : {}) });
  snapshot.documents.push({ id: 'asset-1', projectId: pid, expedienteId: pid,
    photoAsset: { id: 'asset-1', projectId: pid, ...Object.fromEntries(['sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256', 'sourcePage', 'sourceImageId'].map(k => [k, item[k]])),
      status: 'ACTIVE', version: 1, original: file(false), derived: file(true) },
    multimodalEvidence: { documentId: 'asset-1', expedienteId: pid, humanValidationStatus: 'PENDING_REVIEW', forensicIntegrity: { rawSha256: item.originalSha256, hashStatus: 'REAL_FILE_HASH' } } });
  const before = JSON.stringify(snapshot); const options = { humanApprovalVerified: (value: any) => !!verifyR4HumanApproval(value) };
  const photoActor = { institutionalUserId: actor.institutionalUserId, username: actor.username };
  const first = await buildR4InjectionPlan(body(), snapshot, photoActor, options); const second = await buildR4InjectionPlan(body(), snapshot, photoActor, options);
  expect(first.response).toEqual(second.response); expect(first.response.items[0].actions).toEqual(['REUSE_IDENTITY', 'REUSE_ASSET', 'CREATE_ASSOCIATION', 'CREATE_PRIMARY']);
  expect(JSON.stringify(snapshot)).toBe(before);
  const prepared = prepareCertifiedR4ReviewRequest(item, snapshot.documents[0]);
  expect(prepared).toMatchObject({ source: 'DOCUMENT_PHOTO', action: 'APPROVE', id: 'asset-1' });
  expect(prepared?.comment).toContain('synthetic-79-v1'); expect(JSON.stringify(snapshot)).toBe(before);
  snapshot.documents[0].multimodalEvidence.humanValidationStatus = 'REJECTED';
  expect(() => prepareCertifiedR4ReviewRequest(item, snapshot.documents[0])).toThrow('R4_REVIEW_STATE_CONFLICT');
});
test.each([false, true])('stored file readback mismatch=%s is verified before registration', async mismatch => {
  const input = it(); const stored = { generation: '1', contentType: 'image/png', size: buffers[0].length };
  const file = { getMetadata: jest.fn().mockResolvedValue([stored]), download: jest.fn().mockResolvedValue([mismatch ? buffers[1] : buffers[0]]), save: writes };
  const bucket: any = { file: () => file };
  const verification = verifyPandillasStoredPhotoFile(bucket, { storagePath: 'synthetic', sha256: input.originalSha256, mimeType: 'image/png', size: buffers[0].length, width: 4, height: 3 });
  if (mismatch) await expect(verification).rejects.toThrow('R4_ASSET_CONFLICT'); else await verification;
});
test('resume from member 37 preserves 36 complete members and reuses partial identity/asset', async () => {
  for (let i = 0; i < 37; i++) {
    const item = it(i), gang = snapshot.gangs.find(g => g.nombre === item.gangName), member = gang.integrantes.find((m: any) => m.nombre === item.memberName);
    const identityId = 'identity-' + i, assetId = 'asset-' + i, associationId = 'association-' + i;
    snapshot.identities.push({ id: identityId, projectId: pid, gangId: gang.id, legacyMemberName: item.memberName,
      legacyMemberFingerprint: await legacyMemberFingerprint(member), status: 'ACTIVE', version: 1 });
    const file = (derived: boolean) => ({ storagePath: photoStoragePath({ projectId: pid, assetId, sha256: item.originalSha256,
      ext: 'png', ...(derived ? { recipeVersion: item.recipeVersion } : {}) }), sha256: item.originalSha256, mimeType: 'image/png',
      size: buffers[i].length, width: 4, height: 3, ...(derived ? { recipeVersion: item.recipeVersion } : {}) });
    snapshot.documents.push({ id: assetId, projectId: pid, expedienteId: pid, photoAsset: { id: assetId, projectId: pid,
      ...Object.fromEntries(['sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256', 'sourcePage', 'sourceImageId'].map(k => [k, item[k]])),
      status: 'ACTIVE', version: 1, original: file(false), derived: file(true) }, multimodalEvidence: { documentId: assetId, expedienteId: pid,
      humanValidationStatus: i === 36 ? 'PENDING_REVIEW' : 'APPROVED', forensicIntegrity: { rawSha256: item.originalSha256, hashStatus: 'REAL_FILE_HASH' } } });
    if (i < 36) {
      snapshot.associations.push({ id: associationId, projectId: pid, gangId: gang.id, memberIdentityId: identityId, documentId: assetId,
        sourcePage: item.sourcePage, sourceImageId: item.sourceImageId, status: 'ACTIVE', associationLevel: 'EXACT', imageType: 'MEMBER_PRIMARY_PHOTO',
        reviewedBy: { institutionalUserId: actor.institutionalUserId }, reviewedAt: 1, version: 1 });
      snapshot.selections.push({ id: gang.id + '~' + identityId, projectId: pid, gangId: gang.id, memberIdentityId: identityId, associationId, status: 'PRIMARY', version: 1 });
    }
  }
  const before = JSON.stringify(snapshot);
  const plan = await buildR4InjectionPlan(body(r4HumanApprovals.map((_, i) => it(i))), snapshot,
    { institutionalUserId: actor.institutionalUserId, username: actor.username }, { humanApprovalVerified: item => !!verifyR4HumanApproval(item) });
  expect(plan.response.ok).toBe(true); expect(plan.response.planSummary).toMatchObject({ reuseIdentities: 37, reuseAssets: 37,
    reuseAssociations: 36, reusePrimarySelections: 36, createIdentities: 42, createAssets: 42, createAssociations: 43, createPrimarySelections: 43 });
  expect(JSON.stringify(snapshot)).toBe(before);
});
