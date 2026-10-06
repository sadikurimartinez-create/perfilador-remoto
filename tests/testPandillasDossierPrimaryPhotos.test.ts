jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'synthetic-session' }) }) }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pandillas/primary-photos/route';
import { resolveGangPrimaryPhotoUrls } from '../src/services/institutionalPandillasPhotoBoundary';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '../src/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import { photoStoragePath, primarySelectionId } from '../src/modules/pandillas/photo-evidence/storagePaths';
import { bindDossierPhotoUrls, dossierPhotoSource } from '../src/modules/pandillas/photo-evidence/dossierPhotoDisplay';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const pid = 'UIwlMmZotIAOsAWmNEH2', gid = 'logan-32';
const names = ['Máximo Guzmán Macías', 'Christian Abraham Álvarez Casillas', 'Víctor Alexis Ramírez Hernández', 'Cristian García Galindo García'];
const actor = { institutionalUserId: 'reader-1', username: 'reader', role: 'USER' };
const reviewer = { institutionalUserId: 'reviewer', username: 'reviewer' };
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
let records: Map<string, any>, members: any[], tx: any, db: any;
const forbidden = jest.fn(() => { throw new Error('WRITE_FORBIDDEN'); });
const sign = jest.fn(), metadata = jest.fn();
function ref(path: string): any { return { path, doc: (id: string) => ref(`${path}/${id}`), collection: (name: string) => ref(`${path}/${name}`), where: jest.fn(() => ref(path)), limit: (n: number) => { expect(n).toBe(201); return ref(path); } }; }
const root = (kind: string, id: string) => `projects/${pid}/${kind}/${id}`;
beforeEach(async () => {
  jest.clearAllMocks(); records = new Map();
  members = names.map(nombre => ({ nombre, fotografiaUrl: 'legacy-unchanged', curp: 'PRIVATE_NOT_RETURNED' }));
  records.set(`projects/${pid}`, {}); records.set(`pandillas/${gid}`, { projectId: pid, nombre: 'LOGAN 32', integrantes: members });
  for (let i = 0; i < names.length; i++) {
    const id = `identity-${i}`, associationId = `association-${i}`, documentId = `asset-${i}`;
    const originalSha = sha(`original-${i}`), derivedSha = sha(`derived-${i}`);
    records.set(root('pandillasMemberIdentities', id), { id, projectId: pid, gangId: gid, legacyMemberName: names[i], legacyMemberFingerprint: await legacyMemberFingerprint(members[i]), status: 'ACTIVE', version: 1 });
    records.set(root('pandillasPrimarySelections', primarySelectionId(gid, id)), { id: primarySelectionId(gid, id), projectId: pid, gangId: gid, memberIdentityId: id, associationId, status: 'PRIMARY', version: 1 });
    records.set(root('pandillasPhotoAssociations', associationId), { id: associationId, projectId: pid, gangId: gid, memberIdentityId: id, documentId, sourcePage: i + 1, sourceImageId: `IMG-${i}`, status: 'ACTIVE', imageType: 'MEMBER_PRIMARY_PHOTO', associationLevel: 'EXACT', reviewedBy: reviewer, reviewedAt: 1, version: 1 });
    records.set(root('documents', documentId), { id: documentId, projectId: pid, expedienteId: pid,
      photoAsset: { id: documentId, projectId: pid, sourceDocumentId: 'source-document', sourceDocumentName: 'source.pdf', sourceDocumentSha256: sha('source'), sourcePage: i + 1, sourceImageId: `IMG-${i}`, status: 'ACTIVE', createdBy: reviewer, createdAt: 1, version: 1,
        original: { storagePath: photoStoragePath({ projectId: pid, assetId: documentId, sha256: originalSha, ext: 'jpg' }), sha256: originalSha, mimeType: 'image/jpeg', size: 100, width: 10, height: 10 },
        derived: { storagePath: photoStoragePath({ projectId: pid, assetId: documentId, sha256: derivedSha, ext: 'jpg', recipeVersion: 'recipe-v1' }), sha256: derivedSha, mimeType: 'image/jpeg', size: Buffer.byteLength(`derived-${i}`), width: 10, height: 10, recipeVersion: 'recipe-v1' } },
      multimodalEvidence: { documentId, expedienteId: pid, humanValidationStatus: 'APPROVED', forensicIntegrity: { rawSha256: originalSha, hashStatus: 'REAL_FILE_HASH' } } });
  }
  const snap = (reference: any) => ({ id: reference.path.split('/').at(-1), exists: records.has(reference.path), data: () => records.get(reference.path) });
  tx = { get: jest.fn(async reference => {
    if (reference.path.split('/').length % 2 === 0) return snap(reference);
    const matches = [...records].filter(([path]) => path.startsWith(reference.path + '/'));
    return { size: matches.length, docs: matches.map(([path]) => snap(ref(path))) };
  }), getAll: jest.fn(async (...refs) => refs.map(snap)), create: forbidden, set: forbidden, update: forbidden, delete: forbidden };
  db = { doc: (path: string) => ref(path), collection: (name: string) => ref(name), runTransaction: jest.fn(async (fn, options) => {
    expect(options).toEqual({ readOnly: true }); return fn(tx);
  }) };
  sign.mockImplementation(async (options: any) => { expect(options).toMatchObject({ version: 'v4', action: 'read', queryParams: { generation: '123' } });
    expect(options.expires - Date.now()).toBeLessThanOrEqual(120000); return ['https://storage.googleapis.com/private-bucket/derived.jpg?X-Goog-Signature=synthetic']; });
  metadata.mockResolvedValue([{ contentType: 'image/jpeg', generation: '123', size: 9 }]);
  (getInstitutionalAdminDb as jest.Mock).mockReturnValue(db);
  (getInstitutionalAdminBucket as jest.Mock).mockReturnValue({ file: (path: string) => ({ getMetadata: metadata, getSignedUrl: sign,
    download: async () => [Buffer.from(`derived-${names.findIndex((_, i) => path.includes(sha(`derived-${i}`)))}`)], save: forbidden, delete: forbidden }) });
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: true, actor });
});
afterEach(() => expect(forbidden).not.toHaveBeenCalled());
const resolve = () => resolveGangPrimaryPhotoUrls('synthetic-session', { projectId: pid, gangId: gid });
test('LOGAN 32: 4/4 reviewed identities resolve PRIMARY assets in one read-only batch', async () => {
  const result = await resolve(); expect(result.items).toHaveLength(4);
  expect(result.items.every(item => item.hasPrimaryPhoto && item.derivedUrl && item.assetId)).toBe(true);
  expect(db.runTransaction).toHaveBeenCalledTimes(1); expect(tx.get).toHaveBeenCalledTimes(3); expect(tx.getAll).toHaveBeenCalledTimes(3);
  expect(sign).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(result)).not.toMatch(/storagePath|PRIVATE_NOT_RETURNED|legacy-unchanged|originalSha256|reviewedBy/);
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({ sessionToken: 'synthetic-session', projectId: pid, action: 'READ' });
});
test('member without identity/primary gets a controlled fallback', async () => {
  records.delete(root('pandillasMemberIdentities', 'identity-0')); records.delete(root('pandillasPrimarySelections', primarySelectionId(gid, 'identity-1')));
  const result = await resolve(); expect(result.items[0].hasPrimaryPhoto).toBe(false); expect(result.items[1].hasPrimaryPhoto).toBe(false);
  expect(result.items[2].hasPrimaryPhoto).toBe(true);
});
test('Yordi is excluded even if a persisted chain happens to exist', async () => {
  members[0].nombre = 'Yordi Alejandro Amezcuita de la Cruz';
  const identity = records.get(root('pandillasMemberIdentities', 'identity-0'));
  identity.legacyMemberName = members[0].nombre; identity.legacyMemberFingerprint = await legacyMemberFingerprint(members[0]);
  expect((await resolve()).items[0]).toMatchObject({ hasPrimaryPhoto: false, derivedUrl: null });
});
test.each(['missing', 'deleted', 'unapproved', 'hash'])('asset %s returns fallback without signing that member', async mode => {
  const path = root('documents', 'asset-0'), document = records.get(path);
  if (mode === 'missing') records.delete(path);
  if (mode === 'deleted') document.deleted = true;
  if (mode === 'unapproved') document.multimodalEvidence.humanValidationStatus = 'PENDING_REVIEW';
  if (mode === 'hash') document.multimodalEvidence.forensicIntegrity.rawSha256 = sha('wrong');
  expect((await resolve()).items[0].hasPrimaryPhoto).toBe(false); expect(sign).toHaveBeenCalledTimes(3);
});
test.each(['member', 'project', 'provenance', 'ambiguous'])('association %s cannot show an incorrect image', async mode => {
  const row = records.get(root('pandillasPhotoAssociations', 'association-0'));
  if (mode === 'member') row.memberIdentityId = 'identity-1';
  if (mode === 'project') row.projectId = 'OTHER';
  if (mode === 'provenance') row.sourceImageId = 'OTHER';
  if (mode === 'ambiguous') row.associationLevel = 'AMBIGUOUS';
  expect((await resolve()).items[0].hasPrimaryPhoto).toBe(false);
});
test('primary belonging to another member is rejected by the reused R4 resolver', async () => {
  records.get(root('pandillasPrimarySelections', primarySelectionId(gid, 'identity-0'))).memberIdentityId = 'identity-1';
  expect((await resolve()).items[0].hasPrimaryPhoto).toBe(false);
});
test('changed member fingerprint cannot silently rebind an existing identity', async () => {
  members[0].edad = 22; expect((await resolve()).items[0].hasPrimaryPhoto).toBe(false);
});
test('missing Storage object or signing failure preserves fallbacks', async () => {
  metadata.mockRejectedValue(new Error('Object unavailable')); const result = await resolve();
  expect(result.items.every(row => !row.hasPrimaryPhoto)).toBe(true); expect(sign).not.toHaveBeenCalled();
});
test('Storage bytes differing from the certified derived SHA never receive a URL', async () => {
  (getInstitutionalAdminBucket as jest.Mock).mockReturnValue({ file: () => ({ getMetadata: metadata, getSignedUrl: sign,
    download: async () => [Buffer.from('tampered!')], save: forbidden }) });
  expect((await resolve()).items.every(row => !row.hasPrimaryPhoto)).toBe(true); expect(sign).not.toHaveBeenCalled();
});
test.each(['PROJECT_ACCESS_DENIED', 'PROJECT_ACCESS_REVOKED', 'PROJECT_ACCESS_UNAUTHENTICATED'])('%s rejects before any database or bucket read', async code => {
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: false, code });
  await expect(resolve()).rejects.toThrow(code); expect(db.runTransaction).not.toHaveBeenCalled(); expect(getInstitutionalAdminBucket).not.toHaveBeenCalled();
});
test('permission revoked during resolution returns no signed URL response', async () => {
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValueOnce({ allowed: true, actor }).mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_REVOKED' });
  await expect(resolve()).rejects.toThrow('PROJECT_ACCESS_REVOKED'); expect(sign).not.toHaveBeenCalled();
});
test('API enforces scope, session, no-store and sanitized errors', async () => {
  const request = (query: string) => new NextRequest(`https://example.invalid/api/pandillas/primary-photos?${query}`);
  const response = await GET(request(`projectId=${pid}&gangId=${gid}`)); expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store'); expect(response.headers.get('Vary')).toBe('Cookie');
  expect((await GET(request(`projectId=${pid}&gangId=${gid}&token=secret`))).status).toBe(400);
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_DENIED' });
  expect((await GET(request(`projectId=${pid}&gangId=${gid}`))).status).toBe(403);
  (authorizeInstitutionalProjectAccess as jest.Mock).mockRejectedValue(new Error('PRIVATE_INTERNAL_DETAIL'));
  const error = await GET(request(`projectId=${pid}&gangId=${gid}`)); expect(error.status).toBe(503); expect(JSON.stringify(await error.json())).not.toContain('PRIVATE_INTERNAL_DETAIL');
});
test('UI binding uses current scope and full member fingerprint, not list positions or guessed names', async () => {
  const result = await resolve(); const fingerprints = await Promise.all(members.map(member => legacyMemberFingerprint(member)));
  expect(bindDossierPhotoUrls(pid, gid, fingerprints.reverse(), result).filter(Boolean)).toHaveLength(4);
  expect(bindDossierPhotoUrls(pid, 'OTHER', fingerprints, result)).toEqual([]);
  expect(bindDossierPhotoUrls(pid, gid, [sha('changed-member')], result)).toEqual([undefined]);
  result.items[0].derivedUrl = 'data:image/jpeg;base64,FORBIDDEN';
  expect(bindDossierPhotoUrls(pid, gid, [result.items[0].memberFingerprint], result)).toEqual([undefined]);
});
test('PRIMARY precedes existing legacy fallback; image errors return stable fallback without editing fotografiaUrl', () => {
  const member = { fotografiaUrl: 'legacy-unchanged' }; const before = { ...member };
  expect(dossierPhotoSource('primary', member.fotografiaUrl)).toBe('primary');
  expect(dossierPhotoSource(undefined, member.fotografiaUrl)).toBe('legacy-unchanged');
  expect(dossierPhotoSource('primary', member.fotografiaUrl, ['primary', member.fotografiaUrl])).toBeUndefined();
  expect(member).toEqual(before);
  const ui = readFileSync('src/modules/pandillas/components/DossierPrimaryPhoto.tsx', 'utf8');
  expect(ui).not.toMatch(/fotografiaUrl\s*=|setIntegrantes|saveGang|getDb|firebase\/storage|firebase\/firestore/);
  expect(ui).toContain('onError'); expect(ui).toContain('state.members === members');
});
