jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'mock-session' }) }) }));
jest.mock('@/services/institutionalSessionIdentityService', () => ({ resolveInstitutionalSessionIdentity: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoBoundary', () => ({ resolveMemberPrimaryPhoto: jest.fn(), mutateInstitutionalPandillasPhoto: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoAssetService', () => ({ registerInstitutionalPandillasPhotoAsset: jest.fn() }));
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/pandillas/r4/image-injection/route';
import { resolveInstitutionalSessionIdentity } from '../src/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '../src/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '../src/lib/firebaseAdmin';
import { resolveMemberPrimaryPhoto, mutateInstitutionalPandillasPhoto } from '../src/services/institutionalPandillasPhotoBoundary';
import { registerInstitutionalPandillasPhotoAsset } from '../src/services/institutionalPandillasPhotoAssetService';
import { pandillasR4CertifiedTargets } from '../src/services/pandillasR4CertifiedTargets';
import { R4_INJECTION_PROJECT_ID, type R4PlanSnapshot } from '../src/services/pandillasR4ImageInjectionPlan';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import { photoStoragePath, primarySelectionId } from '../src/modules/pandillas/photo-evidence/storagePaths';
import { ProjectAccessError } from '../src/types/institutionalProjectAccess';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const pid = R4_INJECTION_PROJECT_ID;
const actor = { institutionalUserId: 'admin-1', username: 'admin', role: 'ADMIN' };
const reviewer = { institutionalUserId: actor.institutionalUserId, username: actor.username };
const identity = resolveInstitutionalSessionIdentity as jest.Mock, authorize = authorizeInstitutionalProjectAccess as jest.Mock;
const reader = readInstitutionalCollection as jest.Mock, database = getInstitutionalAdminDb as jest.Mock;
const transaction = jest.fn(); const writes = jest.fn(() => { throw Error('WRITE_FORBIDDEN'); });
let snapshot: R4PlanSnapshot, projects: any[], accessibleGangs: any[];
const hash = (label: string) => createHash('sha256').update(label).digest('hex');
function item(index = 0): any {
  const target = pandillasR4CertifiedTargets[index];
  return { gangName: target.gangName, memberName: target.memberName, memberIdentityRequired: true,
    sourceDocumentId: 'certified-source', sourceDocumentName: 'Certified source.pdf', sourceDocumentSha256: hash('synthetic-document'),
    sourcePage: index + 1, sourceImageId: 'IMG-' + index, originalFileName: 'original-' + index + '.jpg',
    derivedFileName: 'derived-' + index + '.jpg', originalSha256: hash('original-' + index), derivedSha256: hash('derived-' + index),
    mimeType: 'image/jpeg', recipeVersion: 'recipe-v1', selectionType: 'PRIMARY', associationLevel: 'EXACT' };
}
function body(items = [item()]): any { return { mode: 'DRY_RUN', projectId: pid, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', items }; }
function inventory() {
  const groups = new Map<string, any[]>();
  for (const target of pandillasR4CertifiedTargets) groups.set(target.gangName,
    [...(groups.get(target.gangName) || []), { nombre: target.memberName, fotografiaUrl: 'legacy-unchanged', curp: 'PRIVATE' }]);
  groups.get('Los Chicali')!.push({ nombre: 'Yordi Alejandro Amezcuita de la Cruz' });
  const gangs = [...groups].map(([nombre, integrantes], i) => ({ id: 'g' + i, projectId: pid, nombre, integrantes, updatedAt: 7 }));
  while (gangs.length < 25) gangs.push({ id: 'g' + gangs.length, projectId: pid, nombre: 'Empty ' + gangs.length, integrantes: [], updatedAt: 7 });
  return gangs;
}
beforeEach(() => {
  jest.resetAllMocks(); snapshot = { project: { institutionalSourceRevision: 9 }, gangs: inventory(),
    identities: [], documents: [], associations: [], selections: [] };
  projects = [{ id: pid }]; accessibleGangs = snapshot.gangs;
  identity.mockResolvedValue(actor); authorize.mockResolvedValue({ allowed: true, actor });
  reader.mockImplementation(async name => name === 'projects' ? projects : accessibleGangs);
  function ref(path: string, maximum?: number): any { return { path, maximum, collection: (name: string) => ref(path + '/' + name),
    doc: (id: string) => ref(path + '/' + id), where: (field: string, op: string, value: string) => {
      expect([field, op, value]).toEqual(['projectId', '==', pid]); return ref(path); }, limit: (max: number) => ref(path, max),
    set: writes, create: writes, update: writes, delete: writes }; }
  const collections: Record<string, keyof R4PlanSnapshot> = { pandillas: 'gangs',
    pandillasMemberIdentities: 'identities', documents: 'documents', pandillasPhotoAssociations: 'associations', pandillasPrimarySelections: 'selections' };
  transaction.mockImplementation(async (fn, options) => {
    expect(options).toEqual({ readOnly: true });
    return fn({ get: async (reference: any) => {
      if (reference.path === 'projects/' + pid) return { data: () => snapshot.project };
      const name = reference.path.split('/').at(-1); const rows: any[] = snapshot[collections[name]] as any[];
      const limited = rows.slice(0, reference.maximum); return { size: limited.length,
        docs: limited.map((row, i) => ({ id: row.id ?? 'doc-' + i, data: () => row })) };
    }, set: writes, update: writes, create: writes, delete: writes });
  });
  database.mockReturnValue({ collection: (name: string) => ref(name), runTransaction: transaction, batch: writes });
});
afterEach(() => {
  expect(writes).not.toHaveBeenCalled(); expect(mutateInstitutionalPandillasPhoto).not.toHaveBeenCalled();
  expect(registerInstitutionalPandillasPhotoAsset).not.toHaveBeenCalled(); expect(getInstitutionalAdminBucket).not.toHaveBeenCalled();
});
function request(value: any = body(), query = '', origin?: string, contentType = 'application/json') {
  return new NextRequest('https://example.invalid/api/pandillas/r4/image-injection' + query,
    { method: 'POST', headers: { 'Content-Type': contentType, ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(value) });
}
async function run(value = body()) { const response = await POST(request(value)); return { response, result: await response.json() }; }
test('valid synthetic metadata dry-run plans four creates without writes or approval', async () => {
  const before = structuredClone(snapshot); const { response, result } = await run();
  expect(response.status).toBe(200); expect(result).toMatchObject({ ok: true, mode: 'DRY_RUN', itemsReceived: 1,
    itemsValidated: 1, blockedItems: 0, duplicateItems: 0, writesPerformed: 0, executable: false, liveExecutionEnabled: false,
    planSummary: { createIdentities: 1, createAssets: 1, createAssociations: 1, createPrimarySelections: 1 } });
  expect(result.items[0]).toMatchObject({ status: 'READY', requiresHumanApproval: true,
    actions: ['CREATE_IDENTITY', 'CREATE_ASSET', 'CREATE_ASSOCIATION', 'CREATE_PRIMARY'],
    expectedVersions: { expectedVersion: 0, expectedGangUpdatedAt: 7, asset: 0, association: 0, primary: 0 } });
  expect(snapshot).toEqual(before); expect(result.deferredValidations).toContain('REAL_BYTES_SHA256_MIME_DECODE');
  for (const action of ['READ', 'WRITE']) expect(authorize).toHaveBeenCalledWith({ sessionToken: 'mock-session', projectId: pid, action });
  expect(response.headers.get('Cache-Control')).toContain('no-store'); expect(response.headers.get('Vary')).toBe('Cookie');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  for (const secret of ['mock-session', 'PRIVATE', 'legacy-unchanged', 'storagePath', 'url', 'bytes']) expect(JSON.stringify(result)).not.toContain(secret);
});
test('complete 79-item synthetic batch plans full universe without Yordi', async () => {
  const { result } = await run(body(pandillasR4CertifiedTargets.map((_, i) => item(i))));
  expect(result.ok).toBe(true); expect(result.itemsValidated).toBe(79); expect(result.planSummary.createPrimarySelections).toBe(79);
  expect(JSON.stringify(result.items)).not.toContain('Yordi');
});
test.each(['?projectId=anything', '?token=secret', '?x='])('query rejected %s', async query => {
  expect((await POST(request(body(), query))).status).toBe(400); expect(identity).not.toHaveBeenCalled();
});
test('no session rejected before read', async () => {
  identity.mockRejectedValue(new ProjectAccessError('PROJECT_ACCESS_UNAUTHENTICATED')); expect((await run()).response.status).toBe(401);
  expect(database).not.toHaveBeenCalled();
});
test('USER role denied', async () => { identity.mockResolvedValue({ ...actor, role: 'USER' }); expect((await run()).response.status).toBe(403); });
test.each(['WRITE', 'READ'])('missing %s grant denied', async action => {
  authorize.mockImplementation(async input => input.action === action ? { allowed: false, code: 'PROJECT_ACCESS_DENIED' } : { allowed: true, actor });
  expect((await run()).response.status).toBe(403); expect(reader).not.toHaveBeenCalled();
});
test('SUPER_ADMIN still needs explicit grants', async () => {
  identity.mockResolvedValue({ ...actor, role: 'SUPER_ADMIN' }); authorize.mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_REVOKED' });
  expect((await run()).response.status).toBe(403);
});
test('wrong project rejected before admin', async () => {
  expect((await run({ ...body(), projectId: 'different' })).response.status).toBe(400); expect(database).not.toHaveBeenCalled();
});
test.each(['Yordi Alejandro Amézquita de la Cruz', 'Yordi Alejandro Amezcuita de la Cruz', 'Ángel Ricardo González Sánchez'])('excluded %s', async memberName => {
  const { result } = await run(body([{ ...item(), memberName }])); expect(result.error).toBe('R4_MEMBER_EXCLUDED');
});
test.each(['member', 'original', 'derived'])('duplicate %s rejected', async field => {
  const second = item(1); if (field === 'member') { second.gangName = item().gangName; second.memberName = item().memberName; }
  if (field === 'original') second.originalSha256 = item().originalSha256;
  if (field === 'derived') second.derivedSha256 = item().derivedSha256;
  expect((await run(body([item(), second]))).result.error).toBe('R4_DUPLICATE_ITEM');
});
test.each(['PROBABLE_DOCUMENTARY', 'AMBIGUOUS', 'NONE'])('non-EXACT %s denied', async associationLevel => {
  expect((await run(body([{ ...item(), associationLevel }]))).response.status).toBe(400);
});
test('non-PRIMARY denied', async () => { expect((await run(body([{ ...item(), selectionType: 'ALBUM' }]))).response.status).toBe(400); });
test('LIVE JSON blocked without physical files, snapshot, upload or mutator', async () => {
  const { response, result } = await run({ ...body(), mode: 'LIVE' }); expect(response.status).toBe(400);
  expect(result.error).toBe('R4_LIVE_SINGLE_MULTIPART_REQUIRED'); expect(reader).not.toHaveBeenCalled(); expect(database).not.toHaveBeenCalled();
});
test.each([[[]], [Array.from({ length: 80 }, (_, i) => item(i % 79))]])('invalid item count', async items => {
  expect((await run(body(items))).result.error).toBe('R4_INVALID_BATCH_SIZE');
});
test.each([{ bytes: 'PRIVATE' }, { unexpected: 1 }, { fotografiaUrl: 'https://secret.invalid' }])('unknown item fields rejected %j', async extra => {
  expect((await run(body([{ ...item(), ...extra }]))).response.status).toBe(400);
});
test('unknown top-level field rejected', async () => { expect((await run({ ...body(), enableLive: true })).response.status).toBe(400); });
test.each([{ originalSha256: 'bad' }, { sourcePage: 0 }, { recipeVersion: '../bad' }, { originalFileName: '../private.jpg' },
  { mimeType: 'image/png' }, { memberIdentityRequired: false }, { memberName: 'Not certified' }, { sourceDocumentId: 'https://secret' }])('invalid metadata %j', async extra => {
  expect((await run(body([{ ...item(), ...extra }]))).response.status).toBe(400);
});
test('JSON syntax, Content-Type and size guarded', async () => {
  expect((await POST(new NextRequest('https://example.invalid/api/pandillas/r4/image-injection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status).toBe(400);
  expect((await POST(request(body(), '', undefined, 'text/plain'))).status).toBe(415);
  expect((await run({ ...body(), batchLabel: 'x'.repeat(140000) })).response.status).toBe(413);
});
test('foreign Origin rejected', async () => { expect((await POST(request(body(), '', 'https://other.invalid'))).status).toBe(403); });
test('ambiguous accessible inventory cannot select historical ID arbitrarily', async () => {
  projects.push({ id: 'other' }); accessibleGangs = [...snapshot.gangs, ...snapshot.gangs.map(g => ({ ...g, projectId: 'other' }))];
  expect((await run()).result.error).toBe('R4_PROJECT_RESOLUTION_CONFLICT'); expect(database).not.toHaveBeenCalled();
});
test('live member missing or project archived conflicts', async () => {
  snapshot.gangs[0].integrantes[0].nombre = 'Different'; expect((await run()).response.status).toBe(409);
  snapshot.gangs = inventory(); snapshot.project.status = 'ARCHIVADO'; expect((await run()).response.status).toBe(409);
});
test('permission revoked during dry-run suppresses response', async () => {
  authorize.mockResolvedValueOnce({ allowed: true, actor }).mockResolvedValueOnce({ allowed: true, actor })
    .mockResolvedValueOnce({ allowed: false, code: 'PROJECT_ACCESS_REVOKED' });
  const { response, result } = await run(); expect(response.status).toBe(403); expect(result.items).toBeUndefined();
});
test('backend error sanitized', async () => {
  database.mockImplementation(() => { throw Error('PRIVATE_KEY_COOKIE'); }); const { response, result } = await run();
  expect(response.status).toBe(503); expect(JSON.stringify(result)).not.toContain('PRIVATE_KEY_COOKIE');
});
async function existingChain() {
  const it = item(), gang = snapshot.gangs.find(g => g.nombre === it.gangName);
  const ident = { id: 'identity-1', projectId: pid, gangId: gang.id, legacyMemberName: it.memberName,
    legacyMemberFingerprint: await legacyMemberFingerprint(gang.integrantes.find((m: any) => m.nombre === it.memberName)), status: 'ACTIVE', version: 1 };
  const file = (derived: boolean) => ({ storagePath: photoStoragePath({ projectId: pid, assetId: 'asset-1', sha256: derived ? it.derivedSha256 : it.originalSha256,
    ext: 'jpg', ...(derived ? { recipeVersion: it.recipeVersion } : {}) }), sha256: derived ? it.derivedSha256 : it.originalSha256,
    mimeType: 'image/jpeg', size: 100, width: 3, height: 2, ...(derived ? { recipeVersion: it.recipeVersion } : {}) });
  const document = { id: 'asset-1', projectId: pid, expedienteId: pid, photoAsset: { id: 'asset-1', projectId: pid,
    sourceDocumentId: it.sourceDocumentId, sourceDocumentName: it.sourceDocumentName, sourceDocumentSha256: it.sourceDocumentSha256,
    sourcePage: it.sourcePage, sourceImageId: it.sourceImageId, status: 'ACTIVE', version: 1, original: file(false), derived: file(true) },
    multimodalEvidence: { documentId: 'asset-1', expedienteId: pid, humanValidationStatus: 'APPROVED', forensicIntegrity: { rawSha256: it.originalSha256, hashStatus: 'REAL_FILE_HASH' } } };
  const association = { id: 'association-1', projectId: pid, gangId: gang.id, memberIdentityId: ident.id, documentId: document.id,
    sourcePage: it.sourcePage, sourceImageId: it.sourceImageId, status: 'ACTIVE', associationLevel: 'EXACT', imageType: 'MEMBER_PRIMARY_PHOTO', reviewedBy: reviewer, reviewedAt: 1, version: 1 };
  const selection = { id: primarySelectionId(gang.id, ident.id), projectId: pid, gangId: gang.id, memberIdentityId: ident.id,
    associationId: association.id, status: 'PRIMARY', version: 1 };
  snapshot.identities = [ident]; snapshot.documents = [document]; snapshot.associations = [association]; snapshot.selections = [selection];
  (resolveMemberPrimaryPhoto as jest.Mock).mockResolvedValue({ documentId: document.id, derivedSha256: it.derivedSha256 });
  return { ident, document, association, selection };
}
test('full compatible persisted chain reuses all four and rereads existing primary via boundary', async () => {
  await existingChain(); const { result } = await run(); expect(result.ok).toBe(true);
  expect(result.items[0].actions).toEqual(['REUSE_IDENTITY', 'REUSE_ASSET', 'REUSE_ASSOCIATION', 'REUSE_PRIMARY']);
  expect(result.planSummary.reusePrimarySelections).toBe(1); expect(resolveMemberPrimaryPhoto).toHaveBeenCalledTimes(1);
});
test('partial recovery reuses identity and asset, plans missing association and primary', async () => {
  await existingChain(); snapshot.associations = []; snapshot.selections = [];
  const { result } = await run(); expect(result.items[0].actions).toEqual(['REUSE_IDENTITY', 'REUSE_ASSET', 'CREATE_ASSOCIATION', 'CREATE_PRIMARY']);
});
test('existing reviewed association with no primary uses pure selection contract', async () => {
  await existingChain(); snapshot.selections = []; const { result } = await run(); expect(result.ok).toBe(true);
  expect(result.planSummary.createPrimarySelections).toBe(1);
});
test.each(['fingerprint', 'provenance', 'review', 'primary', 'version'])('persisted conflict %s blocks without writes', async field => {
  const chain = await existingChain();
  if (field === 'fingerprint') chain.ident.legacyMemberFingerprint = hash('changed');
  if (field === 'provenance') chain.document.photoAsset.sourcePage++;
  if (field === 'review') chain.document.multimodalEvidence.humanValidationStatus = 'PENDING_REVIEW';
  if (field === 'primary') chain.selection.associationId = 'different';
  if (field === 'version') chain.ident.version = 0;
  const { response, result } = await run(); expect(response.status).toBe(409); expect(result.blockedItems).toBe(1);
  expect(result.items[0].actions).toEqual([]); expect(Object.values(result.planSummary).every(n => n === 0)).toBe(true);
});
test('duplicate existing identity is a conflict', async () => {
  const { ident } = await existingChain(); snapshot.identities.push({ ...ident, id: 'identity-2' }); expect((await run()).result.blockedItems).toBe(1);
});
test('primary reread changed: no reusable result returned', async () => {
  await existingChain(); (resolveMemberPrimaryPhoto as jest.Mock).mockResolvedValue(null);
  expect((await run()).result.error).toBe('R4_PRIMARY_REREAD_CONFLICT');
});
test('bounded collection scan enforced', async () => {
  snapshot.identities = Array.from({ length: 1001 }, (_, i) => ({ id: 'id-' + i }));
  expect((await run()).result.error).toBe('R4_PREFLIGHT_CAPACITY_EXCEEDED');
});
test('runtime source contains no live mutation, upload, legacy URL or environment enabling', () => {
  for (const path of ['src/app/api/pandillas/r4/image-injection/route.ts', 'src/services/pandillasR4ImageInjectionPlan.ts']) {
    const source = readFileSync(join(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/mutateInstitutionalPandillasPhoto\(|registerInstitutionalPandillasPhotoAsset\(|\.save\(|\.upload\(|\.set\(|\.create\(|\.update\(|\.delete\(|createWriteStream|fotografiaUrl|process\.env/);
  }
});
