jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'synthetic-session' }) }) }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
jest.mock('@/services/institutionalSessionIdentityService', () => ({ resolveInstitutionalSessionIdentity: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/utils/authCrypto', () => {
  const crypto = require('crypto'); const signature = (text: string) => crypto.createHmac('sha256', 'offline-test-only').update(text).digest('hex');
  return { signSession: (value: any) => { const text = Buffer.from(JSON.stringify({ ...value, createdAt: Date.now() })).toString('base64url'); return text + '.' + signature(text); },
    verifySession: (token: string) => { const [text, mac] = token.split('.'); return mac === signature(text) ? JSON.parse(Buffer.from(text, 'base64url').toString()) : null; } };
});
jest.mock('@/services/pandillasR4HumanApprovalBatch', () => {
  const { createCanvas } = require('@napi-rs/canvas'), { createHash } = require('crypto');
  const hash = (bytes: any) => createHash('sha256').update(bytes).digest('hex');
  const targets = require('@/services/pandillasR4CertifiedTargets').pandillasR4CertifiedTargets;
  const buffers: Buffer[] = [];
  const rows = targets.map((target: any, i: number) => {
    const canvas = createCanvas(4, 3); const context = canvas.getContext('2d'); context.fillStyle = `rgb(${i + 1},10,20)`; context.fillRect(0, 0, 4, 3);
    const bytes = canvas.toBuffer('image/png'); buffers.push(bytes);
    return { ...target, memberIdentityRequired: true, sourceDocumentId: 'synthetic-source', sourceDocumentName: 'synthetic.pdf',
      sourceDocumentSha256: hash('synthetic-source'), sourcePage: i + 1, sourceImageId: 'IMG-' + i,
      originalFileName: 'original-' + i + '.png', derivedFileName: 'derived-' + i + '.png', originalSha256: hash(bytes), derivedSha256: hash(bytes),
      mimeType: 'image/png', derivedMimeType: 'image/png', recipeVersion: 'recipe-v1', selectionType: 'PRIMARY', associationLevel: 'EXACT',
      originalSize: bytes.length, derivedSize: bytes.length, originalWidth: 4, originalHeight: 3, derivedWidth: 4, derivedHeight: 3,
      decision: i < 59 ? 'APPROVE_PRIMARY' : 'SELECT_PRIMARY', reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-10-06T00:00:00Z' };
  });
  return { r4HumanApprovals: rows, R4_APPROVAL_VERSION: 'synthetic-79-v1', R4_APPROVAL_DIGEST: hash(JSON.stringify(rows)), __buffers: buffers };
});
// The established review boundary has independent tests. Here only its persistence adapter is mocked.
jest.mock('@/services/institutionalEvidenceReviewBoundary', () => ({ commitInstitutionalEvidenceReview: jest.fn(async (db, actor, input) => db.runTransaction(async (tx: any) => {
  const parent = db.doc(`projects/${input.projectId}`), ref = db.doc(`projects/${input.projectId}/documents/${input.id}`);
  const project = (await tx.get(parent)).data(), document = (await tx.get(ref)).data();
  const result = { ...document, multimodalEvidence: { ...document.multimodalEvidence, humanValidationStatus: 'APPROVED' } };
  tx.set(ref, result); tx.update(parent, { institutionalSourceRevision: (project.institutionalSourceRevision || 0) + 1 });
  tx.create(db.doc(`audit_logs/review-${input.id}`), { action: 'HUMAN_APPROVED', comment: input.comment }); return result;
})) }));

import { executeR4Live, verifyR4LiveFinal, R4LiveExecutionError } from '../src/services/pandillasR4LiveExecutor';
import { readR4LiveState, guardedR4Database } from '../src/services/pandillasR4LiveState';
import { createR4ReadinessReceipt } from '../src/services/pandillasR4LiveReadiness';
import { r4HumanApprovals } from '../src/services/pandillasR4HumanApprovalBatch';
import { parseR4InjectionBody, R4_INJECTION_PROJECT_ID } from '../src/services/pandillasR4ImageInjectionPlan';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '../src/lib/firebaseAdmin';
import { resolveInstitutionalSessionIdentity } from '../src/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { prepareR4RunnerFiles, R4_RUNNER_CONFIRMATION } from '../src/utils/pandillasR4RunnerFiles';
import type { InstitutionalActor } from '../src/types/institutionalProjectAccess';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import { photoStoragePath, primarySelectionId } from '../src/modules/pandillas/photo-evidence/storagePaths';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/pandillas/r4/image-injection/route';
import { readInstitutionalCollection } from '../src/lib/institutionalCollectionActions';

const pid = R4_INJECTION_PROJECT_ID;
const actor: InstitutionalActor = { institutionalUserId: 'admin-1', username: 'admin', role: 'ADMIN' };
const buffers: Buffer[] = jest.requireMock('@/services/pandillasR4HumanApprovalBatch').__buffers;
const keys = ['gangName', 'memberName', 'memberIdentityRequired', 'sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256',
  'sourcePage', 'sourceImageId', 'originalFileName', 'derivedFileName', 'originalSha256', 'derivedSha256', 'mimeType', 'derivedMimeType', 'recipeVersion', 'selectionType', 'associationLevel'];
const item = (i = 0): any => Object.fromEntries(keys.map(key => [key, (r4HumanApprovals[i] as any)[key]]));
const body = (i = 0) => parseR4InjectionBody({ mode: 'LIVE', projectId: pid, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', items: [item(i)] });
const clone = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
let records: Map<string, any>, objects: Map<string, Buffer>, events: string[], db: any, bucket: any;
let failSave: string | undefined, corruptReadback = false;
function ref(path: string, maximum = 10001, conditions: any[] = []): any {
  return { path, maximum, conditions, doc: (id: string) => ref(`${path}/${id}`), collection: (name: string) => ref(`${path}/${name}`),
    where: (field: string, op: string, value: any) => ref(path, maximum, [...conditions, [field, value]]), limit: (n: number) => ref(path, n) };
}
beforeEach(() => {
  jest.clearAllMocks(); records = new Map(); objects = new Map(); events = []; failSave = undefined; corruptReadback = false;
  records.set(`projects/${pid}`, { institutionalSourceRevision: 0 });
  const groups = new Map<string, any[]>();
  for (const row of r4HumanApprovals) groups.set(row.gangName, [...(groups.get(row.gangName) || []), { nombre: row.memberName, fotografiaUrl: 'UNCHANGED' }]);
  groups.get('Los Chicali')!.push({ nombre: 'Yordi Alejandro Amezcuita de la Cruz' });
  let i = 0; for (const [nombre, integrantes] of groups) { records.set(`pandillas/g${i}`, { id: `g${i}`, nombre, integrantes, projectId: pid }); i++; }
  for (; i < 25; i++) records.set(`pandillas/g${i}`, { id: `g${i}`, nombre: `Empty ${i}`, integrantes: [], projectId: pid });
  db = { doc: (path: string) => ref(path), collection: (name: string) => ref(name), runTransaction: async (callback: any) => {
    const pending: Array<() => void> = []; let writing = false;
    const tx: any = { get: async (reference: any) => {
      if (writing) throw new Error('READ_AFTER_WRITE');
      const parts = reference.path.split('/');
      if (parts.length % 2 === 0) return { id: parts.at(-1), exists: records.has(reference.path), data: () => clone(records.get(reference.path)) };
      const found = [...records].filter(([path, data]) => path.startsWith(reference.path + '/') && path.split('/').length === parts.length + 1
        && reference.conditions.every(([field, value]: any) => data[field] === value)).slice(0, reference.maximum);
      return { size: found.length, docs: found.map(([path, data]) => ({ id: path.split('/').at(-1), data: () => clone(data) })) };
    }, create: (reference: any, data: any) => { writing = true; pending.push(() => {
      if (records.has(reference.path)) throw new Error('DUPLICATE_CREATE'); records.set(reference.path, clone(data)); events.push('create:' + reference.path);
    }); return tx; }, set: (reference: any, data: any) => { writing = true; pending.push(() => { records.set(reference.path, clone(data)); events.push('set:' + reference.path); }); return tx; },
    update: (reference: any, patch: any) => { writing = true; pending.push(() => records.set(reference.path, { ...records.get(reference.path), ...clone(patch) })); return tx; } };
    const result = await callback(tx); for (const write of pending) write(); return result;
  } };
  bucket = { getMetadata: async () => [{}], file: (path: string) => ({
    getMetadata: async () => { if (!objects.has(path)) throw Object.assign(new Error('missing'), { code: 404 }); return [{ generation: '1', contentType: 'image/png', size: objects.get(path)!.length }]; },
    save: async (bytes: Buffer, options: any) => {
      expect(options.preconditionOpts.ifGenerationMatch).toBe(0); if (failSave && path.includes(failSave)) throw new Error('STORAGE_FAIL');
      if (objects.has(path)) throw new Error('OVERWRITE_FORBIDDEN'); objects.set(path, Buffer.from(bytes)); events.push('upload:' + path);
    }, download: async () => { events.push('readback:' + path); return [corruptReadback ? Buffer.from('corrupt') : objects.get(path)!]; },
  }) };
  (getInstitutionalAdminDb as jest.Mock).mockReturnValue(db); (getInstitutionalAdminBucket as jest.Mock).mockReturnValue(bucket);
  (resolveInstitutionalSessionIdentity as jest.Mock).mockResolvedValue(actor);
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: true, actor });
  (readInstitutionalCollection as jest.Mock).mockImplementation(async name => name === 'projects' ? [{ id: pid }]
    : [...records].filter(([path]) => path.startsWith('pandillas/')).map(([, data]) => data));
});
async function run(i = 0, original = buffers[i], derived = buffers[i]) {
  const snapshot = await readR4LiveState(db), receipt = createR4ReadinessReceipt(item(i), actor.institutionalUserId, snapshot);
  return executeR4Live('synthetic-session', actor, body(i), snapshot, { original, derived }, receipt);
}
const count = (kind: string) => [...records.keys()].filter(path => path.startsWith(`projects/${pid}/${kind}/`)).length;

test('real institutional mutators and uploader follow the required order and resolve the final primary', async () => {
  const before = [...records].filter(([path]) => path.startsWith('pandillas/'));
  expect(await run()).toMatchObject({ ok: true, status: 'DONE', primaryResolverPass: true, storageOriginalVerified: true, storageDerivedVerified: true });
  expect(count('pandillasMemberIdentities')).toBe(1); expect(count('documents')).toBe(1); expect(count('pandillasPhotoAssociations')).toBe(1); expect(count('pandillasPrimarySelections')).toBe(1);
  const identity = events.findIndex(event => event.includes('/pandillasMemberIdentities/'));
  const original = events.findIndex(event => event.startsWith('upload:') && event.includes('/original/'));
  const derived = events.findIndex(event => event.startsWith('upload:') && event.includes('/derived/'));
  const registered = events.findIndex(event => event.startsWith('create:') && event.includes('/documents/'));
  const associated = events.findIndex(event => event.startsWith('create:') && event.includes('/pandillasPhotoAssociations/'));
  const primary = events.findIndex(event => event.startsWith('set:') && event.includes('/pandillasPrimarySelections/'));
  expect(identity).toBeLessThan(original); expect(original).toBeLessThan(derived); expect(derived).toBeLessThan(registered);
  expect(events.slice(original + 1, derived).some(event => event.startsWith('readback:'))).toBe(true);
  expect(events.slice(derived + 1, registered).some(event => event.startsWith('readback:'))).toBe(true);
  expect(registered).toBeLessThan(associated); expect(associated).toBeLessThan(primary);
  expect([...records].filter(([path]) => path.startsWith('pandillas/'))).toEqual(before);
});
test('repetition reuses all four entities, audits and Storage without overwrite', async () => {
  await run(); const before = clone([...records]); const uploaded = objects.size; events = [];
  expect(await run()).toMatchObject({ writesPerformed: 0, actions: ['REUSE_IDENTITY', 'REUSE_ASSET', 'REUSE_ASSOCIATION', 'REUSE_PRIMARY'] });
  expect(clone([...records])).toEqual(before); expect(objects.size).toBe(uploaded); expect(events.some(event => event.startsWith('upload:'))).toBe(false);
});
test.each(['original', 'derived'])('%s wrong bytes stop before the first write', async file => {
  await expect(run(0, file === 'original' ? buffers[1] : buffers[0], file === 'derived' ? buffers[1] : buffers[0])).rejects.toThrow('R4_HASH_MISMATCH');
  expect(count('pandillasMemberIdentities')).toBe(0); expect(objects.size).toBe(0);
});
test('failed derived upload preserves identity/original and resumes without duplicate or primary before readback', async () => {
  failSave = '/derived/'; await expect(run()).rejects.toBeInstanceOf(R4LiveExecutionError);
  expect(count('pandillasMemberIdentities')).toBe(1); expect(objects.size).toBe(1); expect(count('documents')).toBe(0); expect(count('pandillasPrimarySelections')).toBe(0);
  failSave = undefined; expect((await run()).status).toBe('DONE'); expect(count('pandillasMemberIdentities')).toBe(1); expect(objects.size).toBe(2);
});
test('Storage hash readback failure stops before registration, association and primary', async () => {
  corruptReadback = true; await expect(run()).rejects.toBeInstanceOf(R4LiveExecutionError);
  expect(count('documents')).toBe(0); expect(count('pandillasPhotoAssociations')).toBe(0); expect(count('pandillasPrimarySelections')).toBe(0);
});
test('stale fingerprint prevents every write', async () => {
  const snapshot = await readR4LiveState(db), receipt = createR4ReadinessReceipt(item(), actor.institutionalUserId, snapshot);
  records.get('pandillas/g0').integrantes[0].edad = 25;
  await expect(executeR4Live('s', actor, body(), await readR4LiveState(db), { original: buffers[0], derived: buffers[0] }, receipt)).rejects.toThrow('R4_LIVE_PRECONDITION_CHANGED');
  expect(objects.size).toBe(0); expect(count('pandillasMemberIdentities')).toBe(0);
});
test('receipt for a different approved member cannot authorize this item', async () => {
  const snapshot = await readR4LiveState(db), receipt = createR4ReadinessReceipt(item(1), actor.institutionalUserId, snapshot);
  await expect(executeR4Live('s', actor, body(), snapshot, { original: buffers[0], derived: buffers[0] }, receipt)).rejects.toThrow('R4_READINESS_ITEM_MISMATCH');
  expect(objects.size).toBe(0);
});
test.each(['USER', 'revoked'])('role/grant %s stops before writes', async mode => {
  if (mode === 'USER') (resolveInstitutionalSessionIdentity as jest.Mock).mockResolvedValue({ ...actor, role: 'USER' });
  else (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: false });
  await expect(run()).rejects.toThrow('R4_ACCESS_DENIED'); expect(objects.size).toBe(0); expect(count('pandillasMemberIdentities')).toBe(0);
});
test('conflicting primary is never overwritten', async () => {
  await run(); const path = [...records.keys()].find(path => path.includes('/pandillasPrimarySelections/'))!;
  records.get(path).associationId = 'OTHER'; const before = clone(records.get(path));
  await expect(run()).rejects.toThrow('R4_PERSISTED_STATE_CONFLICT'); expect(records.get(path)).toEqual(before);
});
test('change between readiness and first transaction aborts inside the transaction', async () => {
  const snapshot = await readR4LiveState(db), guard = guardedR4Database(db, snapshot, async () => {});
  records.get('pandillas/g0').integrantes[0].nombre = 'CHANGED';
  const callback = jest.fn(); await expect(guard.database.runTransaction(callback)).rejects.toThrow('R4_LIVE_PRECONDITION_CHANGED'); expect(callback).not.toHaveBeenCalled();
});
test('guard forbids gang writes and deletes', async () => {
  const snapshot = await readR4LiveState(db), guard = guardedR4Database(db, snapshot, async () => {});
  await expect(guard.database.runTransaction(async tx => { tx.set(db.doc('pandillas/g0'), {}); })).rejects.toThrow('R4_GANG_WRITE_FORBIDDEN');
  await expect(guard.database.runTransaction(async tx => { tx.delete(db.doc(`projects/${pid}/documents/no`)); })).rejects.toThrow('R4_DELETE_FORBIDDEN');
});
test('37 completed members resume as REUSE, remaining 42 CREATE; final server resolver 79/79', async () => {
  await run(0);
  const template = await readR4LiveState(db);
  // Seed an interrupted batch from the chain produced by the real services above.
  // The executor must independently validate these existing records and bytes.
  for (let i = 1; i < 37; i++) {
    const input = item(i), gang = template.gangs.find(row => row.nombre === input.gangName)!;
    const identity = { ...clone(template.identities[0]), id: `existing-identity-${i}`, gangId: gang.id, legacyMemberName: input.memberName,
      legacyMemberFingerprint: await legacyMemberFingerprint(gang.integrantes.find((row: any) => row.nombre === input.memberName)) };
    const assetId = 'asset-' + createHash('sha256').update(JSON.stringify([pid, input.originalSha256, input.derivedSha256, input.recipeVersion])).digest('hex');
    const document = clone(template.documents[0]); delete document._r4ReadVersion;
    document.id = assetId; document.name = `${assetId}.png`; document.photoAsset.id = assetId;
    document.photoAsset.original.size = buffers[i].length; document.photoAsset.derived.size = buffers[i].length;
    for (const key of ['sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256', 'sourcePage', 'sourceImageId']) document.photoAsset[key] = input[key];
    document.photoAsset.original.sha256 = input.originalSha256; document.photoAsset.derived.sha256 = input.derivedSha256;
    document.photoAsset.original.storagePath = photoStoragePath({ projectId: pid, assetId, sha256: input.originalSha256, ext: 'png' });
    document.photoAsset.derived.storagePath = photoStoragePath({ projectId: pid, assetId, sha256: input.derivedSha256, ext: 'png', recipeVersion: input.recipeVersion });
    document.storagePath = document.photoAsset.original.storagePath;
    document.multimodalEvidence.documentId = assetId; document.multimodalEvidence.forensicIntegrity.rawSha256 = input.originalSha256;
    const association = { ...clone(template.associations[0]), id: `existing-association-${i}`, gangId: gang.id, memberIdentityId: identity.id,
      documentId: assetId, sourcePage: input.sourcePage, sourceImageId: input.sourceImageId };
    const primary = { ...clone(template.selections[0]), id: primarySelectionId(gang.id, identity.id), gangId: gang.id, memberIdentityId: identity.id, associationId: association.id };
    for (const [group, row] of [['pandillasMemberIdentities', identity], ['documents', document], ['pandillasPhotoAssociations', association], ['pandillasPrimarySelections', primary]] as const) {
      delete row._r4ReadVersion; records.set(`projects/${pid}/${group}/${row.id}`, row);
    }
    objects.set(document.photoAsset.original.storagePath, buffers[i]); objects.set(document.photoAsset.derived.storagePath, buffers[i]);
  }
  for (let i = 0; i < 79; i++) {
    const result = await run(i); expect(result.actions.every(action => action.startsWith(i < 37 ? 'REUSE_' : 'CREATE_'))).toBe(true);
  }
  for (const kind of ['pandillasMemberIdentities', 'documents', 'pandillasPhotoAssociations', 'pandillasPrimarySelections']) expect(count(kind)).toBe(79);
  expect(await verifyR4LiveFinal('s', actor)).toMatchObject({ ok: true, primaryResolverPass: 79, existingPhotoAssets: 79, writesPerformed: 0 });
  const identities = [...records].filter(([path]) => path.includes('/pandillasMemberIdentities/')).map(([, value]) => value.legacyMemberName);
  expect(identities.some(name => /Yordi|Ángel Ricardo/.test(name))).toBe(false);
}, 240000);
test('final readback cannot certify an incomplete run', async () => { await run(); await expect(verifyR4LiveFinal('s', actor)).rejects.toThrow('R4_FINAL_INCOMPLETE'); });
function multipart(mode: string, previousReceipt?: string, origin = 'https://example.invalid') {
  const form = new FormData(); form.append('metadata', JSON.stringify({ ...body(), mode, ...(previousReceipt ? { previousReceipt } : {}) }));
  form.append('original', new Blob([new Uint8Array(buffers[0])], { type: 'image/png' }), item().originalFileName);
  form.append('derived', new Blob([new Uint8Array(buffers[0])], { type: 'image/png' }), item().derivedFileName);
  return new NextRequest('https://example.invalid/api/pandillas/r4/image-injection', { method: 'POST', headers: { Origin: origin }, body: form });
}
test('endpoint READINESS → LIVE with real multipart bytes and bound receipt persists and verifies', async () => {
  const readiness = await POST(multipart('READINESS')); expect(readiness.status).toBe(200);
  const receipt = (await readiness.json()).readinessReceipt;
  expect(count('pandillasMemberIdentities')).toBe(0); expect(objects.size).toBe(0);
  const live = await POST(multipart('LIVE', receipt)); expect(live.status).toBe(200);
  expect(await live.json()).toMatchObject({ status: 'DONE', primaryResolverPass: true, liveExecutionEnabled: true });
});
test('LIVE route rejects foreign Origin before any writes', async () => {
  const response = await POST(multipart('LIVE', 'forged', 'https://foreign.invalid'));
  expect(response.status).toBe(403); expect(count('pandillasMemberIdentities')).toBe(0); expect(objects.size).toBe(0);
});
test('revocation after asset registration prevents review, association and primary', async () => {
  (authorizeInstitutionalProjectAccess as jest.Mock).mockImplementation(async () => count('documents') ? { allowed: false } : { allowed: true, actor });
  await expect(run()).rejects.toMatchObject({ code: 'R4_ACCESS_DENIED' });
  expect(count('documents')).toBe(1); expect(count('pandillasPhotoAssociations')).toBe(0); expect(count('pandillasPrimarySelections')).toBe(0);
});
test('member changed during Storage upload aborts registration and primary', async () => {
  const file = bucket.file;
  bucket.file = (path: string) => { const object = file(path); return { ...object, save: async (...args: any[]) => {
    await object.save(...args); records.get('pandillas/g0').integrantes[0].edad = 50;
  } }; };
  await expect(run()).rejects.toMatchObject({ code: 'R4_LIVE_PRECONDITION_CHANGED' });
  expect(count('documents')).toBe(0); expect(count('pandillasPrimarySelections')).toBe(0);
});
test('local runner requires 79 exact pairs and checks every hash before arming', async () => {
  const payload = { mode: 'DRY_RUN', projectId: pid, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', items: r4HumanApprovals.map((_, i) => item(i)) };
  const files = payload.items.flatMap((row: any, i: number) => ['originalFileName', 'derivedFileName'].map(key => ({ name: row[key], type: 'image/png', size: buffers[i].length, index: i } as unknown as File)));
  const sha = jest.fn(async (file: any) => r4HumanApprovals[file.index].originalSha256);
  expect((await prepareR4RunnerFiles(payload, files, sha)).length).toBe(79); expect(sha).toHaveBeenCalledTimes(158);
  expect(R4_RUNNER_CONFIRMATION).toBe('INYECTAR 79 FOTOGRAFÍAS EN EL PROYECTO UIwlMmZotIAOsAWmNEH2');
  await expect(prepareR4RunnerFiles(payload, files.slice(1), sha)).rejects.toThrow('Falta');
  await expect(prepareR4RunnerFiles(payload, files, async () => '0'.repeat(64))).rejects.toThrow('Integridad');
  await expect(prepareR4RunnerFiles({ ...payload, items: payload.items.slice(1) }, files, sha)).rejects.toThrow('79');
});
