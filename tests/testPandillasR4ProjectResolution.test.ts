jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'mock-session' }) }) }));
jest.mock('@/services/institutionalSessionIdentityService', () => ({ resolveInstitutionalSessionIdentity: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pandillas/r4/project-resolution/route';
import { resolveInstitutionalSessionIdentity } from '../src/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '../src/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '../src/lib/firebaseAdmin';
import { pandillasR4CertifiedTargets } from '../src/services/pandillasR4CertifiedTargets';
import { ProjectAccessError } from '../src/types/institutionalProjectAccess';
import { readFileSync } from 'fs';
import { join } from 'path';

const actor = { institutionalUserId: 'user-1', username: 'admin', role: 'ADMIN' };
const identity = resolveInstitutionalSessionIdentity as jest.Mock;
const authorize = authorizeInstitutionalProjectAccess as jest.Mock;
const reader = readInstitutionalCollection as jest.Mock;
const database = getInstitutionalAdminDb as jest.Mock;
const bucket = getInstitutionalAdminBucket as jest.Mock;
const metadata = jest.fn();
const counts = jest.fn();
const documents = jest.fn();
let projects: any[], gangs: any[];
function inventory(projectId: string, yordi = 'Yordi Alejandro Amezcuita de la Cruz') {
  const groups = new Map<string, any[]>();
  for (const target of pandillasR4CertifiedTargets) {
    groups.set(target.gangName, [...(groups.get(target.gangName) || []), { nombre: target.memberName, curp: 'PRIVATE' }]);
  }
  groups.get('Los Chicali')!.push({ nombre: yordi });
  const result = [...groups].map(([nombre, integrantes], index) => ({ id: String(index), projectId, nombre, integrantes }));
  while (result.length < 25) result.push({ id: String(result.length), projectId, nombre: 'Empty ' + result.length, integrantes: [] });
  return result;
}
beforeEach(() => {
  jest.resetAllMocks();
  projects = [{ id: 'p1', nombre: 'Institutional project' }]; gangs = inventory('p1');
  identity.mockResolvedValue(actor); authorize.mockResolvedValue({ allowed: true, actor });
  reader.mockImplementation(async name => name === 'projects' ? projects : gangs);
  metadata.mockResolvedValue([{}]); bucket.mockReturnValue({ getMetadata: metadata });
  counts.mockImplementation(async name => ({ data: () => ({ count: { pandillasMemberIdentities: 3,
    pandillasPhotoAssociations: 2, pandillasPrimarySelections: 1 }[name as string] }) }));
  documents.mockResolvedValue({ size: 3, docs: [{ data: () => ({ photoAsset: {} }) },
    { data: () => ({}) }, { data: () => ({ photoAsset: null }) }] });
  database.mockReturnValue({ collection: (name: string) => {
    expect(name).toBe('projects'); return { doc: (id: string) => {
      expect(id).toBe('p1'); return { collection: (sub: string) => sub === 'documents'
        ? { select: (field: string) => { expect(field).toBe('photoAsset'); return { limit: (n: number) => {
          expect(n).toBe(10001); return { get: documents }; } }; } }
        : { count: () => ({ get: () => counts(sub) }) } }; } }; } });
});
const request = (query = '') => new NextRequest('https://example.invalid/api/pandillas/r4/project-resolution' + query);
async function run() { const response = await GET(request()); return { response, body: await response.json() }; }
test('unique permitted 25/80 resolves, documentary targets match, counts and storage read only', async () => {
  const { response, body } = await run();
  expect(response.status).toBe(200); expect(body).toMatchObject({ ok: true, readOnly: true, targetProjectResolved: true,
    targetProjectId: 'p1', projectCandidates: 1, matchingProjects: 1, liveGangs: 25, liveMembers: 80,
    targetMembers: 79, matchedTargetMembers: 79, unmatchedTargetMembers: 0, existingIdentities: 3,
    existingAssociations: 2, existingPrimarySelections: 1, existingPhotoAssets: 1,
    firebaseAdminAvailable: true, serverSideFirestoreRead: true, serverSideStorageAvailable: true,
    yordiExcludedFromImageInjection: true, writesPerformed: 0 });
  expect(authorize).toHaveBeenCalledWith({ sessionToken: 'mock-session', projectId: 'p1', action: 'READ' });
  expect(metadata).toHaveBeenCalledTimes(1); expect(counts).toHaveBeenCalledTimes(3);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(response.headers.get('Vary')).toBe('Cookie'); expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  const serialized = JSON.stringify(body);
  for (const secret of ['mock-session', 'PRIVATE', 'memberName', 'privateKey', 'Yordi', pandillasR4CertifiedTargets[0].memberName]) expect(serialized).not.toContain(secret);
});
test.each(['Yordi Alejandro Amézquita de la Cruz', 'Yordi Alejandro Amezcuita de la Cruz'])('Yordi spelling %s does not block', async name => {
  gangs = inventory('p1', name); expect((await run()).body.ok).toBe(true);
});
test.each(['PROJECT_ACCESS_UNAUTHENTICATED', 'PROJECT_ACCESS_IDENTITY_NOT_FOUND'])('unauthenticated %s', async code => {
  identity.mockRejectedValue(new ProjectAccessError(code as any)); expect((await run()).response.status).toBe(401);
  expect(reader).not.toHaveBeenCalled(); expect(database).not.toHaveBeenCalled(); expect(bucket).not.toHaveBeenCalled();
});
test('USER role rejected before inventory', async () => {
  identity.mockResolvedValue({ ...actor, role: 'USER' }); expect((await run()).response.status).toBe(403);
  expect(reader).not.toHaveBeenCalled();
});
test('administrator has no explicit READ grant: denied', async () => {
  authorize.mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_DENIED' }); expect((await run()).response.status).toBe(403);
  expect(database).not.toHaveBeenCalled();
});
test('revoked grant during counts denied without result disclosure', async () => {
  authorize.mockResolvedValueOnce({ allowed: true, actor }).mockResolvedValueOnce({ allowed: false, code: 'PROJECT_ACCESS_REVOKED' });
  const { response, body } = await run(); expect(response.status).toBe(403); expect(body.targetProjectId).toBeUndefined();
});
test('revoked grant on an ambiguous response denies all candidate disclosure', async () => {
  projects.push({ id: 'p2' }); gangs.push(...inventory('p2'));
  authorize.mockResolvedValueOnce({ allowed: true, actor }).mockResolvedValueOnce({ allowed: true, actor })
    .mockResolvedValueOnce({ allowed: false, code: 'PROJECT_ACCESS_REVOKED' });
  const { response, body } = await run(); expect(response.status).toBe(403); expect(body.candidates).toBeUndefined();
});
test('role demotion during read denies administrative response', async () => {
  authorize.mockResolvedValueOnce({ allowed: true, actor }).mockResolvedValueOnce({ allowed: true, actor: { ...actor, role: 'USER' } });
  expect((await run()).response.status).toBe(403);
});
test('deleted, archived and inaccessible project data never become candidates', async () => {
  projects = [{ id: 'p1', deleted: true }, { id: 'p2', status: 'ARCHIVADO' }]; gangs.push(...inventory('p2'), ...inventory('other-project'));
  const { body } = await run(); expect(body.projectCandidates).toBe(0); expect(body.targetProjectResolved).toBe(false);
  expect(counts).not.toHaveBeenCalled();
});
test('certified server-only universe has 79 unique bindings, excludes Yordi and embeds source hash', () => {
  expect(pandillasR4CertifiedTargets).toHaveLength(79);
  expect(new Set(pandillasR4CertifiedTargets.map(t => t.gangName + '|' + t.memberName)).size).toBe(79);
  expect(pandillasR4CertifiedTargets.some(t => /^Yordi Alejandro /i.test(t.memberName))).toBe(false);
  const source = readFileSync(join(process.cwd(), 'src/services/pandillasR4CertifiedTargets.ts'), 'utf8');
  expect(source).toContain("import 'server-only'"); expect(source).toMatch(/Source SHA-256: [a-f0-9]{64}/);
});
test.each([0, 2])('%i matching projects never arbitrarily chooses', async number => {
  projects = number ? [...projects, { id: 'p2' }] : []; gangs = number ? [...gangs, ...inventory('p2')] : [];
  const { body } = await run(); expect(body.targetProjectResolved).toBe(false); expect(body.targetProjectId).toBeNull();
  expect(body.matchingProjects).toBe(number); expect(body.existingIdentities).toBeNull(); expect(counts).not.toHaveBeenCalled();
});
test('project with nonmatching totals remains unresolved', async () => {
  gangs[0].integrantes.pop(); expect((await run()).body.matchingProjects).toBe(0);
});
test('missing target reports documentary ID only, even when totals still 25/80', async () => {
  const target = pandillasR4CertifiedTargets[0]; gangs.find(g => g.nombre === target.gangName).integrantes[0].nombre = 'Different';
  const { body } = await run(); expect(body.ok).toBe(false); expect(body.matchedTargetMembers).toBe(78);
  expect(body.unmatchedTargets).toEqual([{ documentaryId: target.documentaryId, reason: 'MEMBER_MISSING' }]);
});
test('duplicate member is ambiguous, never counted as matched', async () => {
  const gang = gangs.find(g => g.integrantes.length >= 2); gang.integrantes[1].nombre = gang.integrantes[0].nombre;
  expect((await run()).body.unmatchedTargets.some((x: any) => x.reason === 'MEMBER_AMBIGUOUS')).toBe(true);
});
test('Storage metadata denied reports false, no upload alternative', async () => {
  metadata.mockRejectedValue(new Error('PRIVATE_KEY_COOKIE')); const { response, body } = await run();
  expect(response.status).toBe(503); expect(body.serverSideStorageAvailable).toBe(false); expect(body.ok).toBe(false);
  expect(JSON.stringify(body)).not.toContain('PRIVATE_KEY_COOKIE');
});
test('Admin unavailable errors sanitized', async () => {
  database.mockImplementation(() => { throw new Error('PRIVATE_KEY_COOKIE'); }); const { response, body } = await run();
  expect(response.status).toBe(503); expect(JSON.stringify(body)).not.toContain('PRIVATE_KEY_COOKIE'); expect(bucket).not.toHaveBeenCalled();
});
test('malformed inventory fails closed', async () => { gangs[0].integrantes = null; expect((await run()).response.status).toBe(503); });
test('bounded document scan fails closed', async () => {
  documents.mockResolvedValue({ size: 10001, docs: [] }); expect((await run()).response.status).toBe(503);
});
test.each(['?projectId=p1', '?token=secret', '?x='])('reject query %s', async query => {
  expect((await GET(request(query))).status).toBe(400); expect(identity).not.toHaveBeenCalled();
});
test('route exports GET only and has no mutation imports or operations', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/pandillas/r4/project-resolution/route.ts'), 'utf8');
  expect(route).not.toMatch(/export\s+(?:async\s+)?function\s+(POST|PATCH|PUT|DELETE)/);
  expect(route).not.toMatch(/mutateInstitutionalPandillasPhoto|uploadInstitutionalPandillasPhotoAsset|setDoc|addDoc|updateDoc|deleteDoc|\.save\(|\.upload\(|createWriteStream|\.set\(|\.update\(|\.create\(|\.delete\(/);
});
