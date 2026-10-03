jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/db', () => ({ getPool: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminAuth: jest.fn() }));
jest.mock('@/utils/authCrypto', () => ({ verifySession: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'offline-session' }) }) }));
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, options: any = {}) => ({ body, status: options.status ?? 200 }) } }));

import { getPool } from '../src/lib/db';
import { getInstitutionalAdminDb, getInstitutionalAdminAuth } from '../src/lib/firebaseAdmin';
import { verifySession } from '../src/utils/authCrypto';
import { POST } from '../src/app/api/auth/firebase-token/route';
import { readInstitutionalCollection, canWriteInstitutionalProject } from '../src/lib/institutionalCollectionActions';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';

const projectId = 'Kzp218N27O1F9aNS9M98';
const now = Date.now();
const user = { id: 1, username: 'offline-fixture', role: 'SUPER_ADMIN' };
const grant = { project_id: projectId, institutional_user_id: '1', relation: 'ASSIGNED', allowed_actions: ['READ'], revoked_at: null };
let rows: any[];
let fixture: ReturnType<typeof adminFixture>;
let mint: jest.Mock;
const request = () => new Request('https://offline.test/api/auth/firebase-token', { method: 'POST', headers: { origin: 'https://offline.test' } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  rows = [{ ...grant }];
  fixture = adminFixture({ [`projects/${projectId}`]: { name: 'Prueba "La Lomita"', numeroExpediente: '28092026-0057-DPU' }, 'projects/unassigned': { name: 'Excluded' } });
  const run = fixture.db.runTransaction;
  fixture.db.runTransaction = (work: any) => run((transaction: any) => work({ ...transaction,
    getAll: (...refs: any[]) => Promise.all(refs.map(ref => transaction.get(ref))) }));
  jest.mocked(getInstitutionalAdminDb).mockReturnValue(fixture.db);
  jest.mocked(verifySession).mockReturnValue({ ...user, createdAt: now - 1000 });
  jest.mocked(getPool).mockReturnValue({ query: jest.fn(async (sql: string, params: any[]) => {
    expect(sql.trim()).toMatch(/^SELECT /);
    if (sql.includes('LEFT JOIN')) {
      expect(params).toEqual(['1']);
      return { rows: rows.length ? rows.map(row => ({ ...user, ...row })) : [{ ...user, project_id: null }] };
    }
    if (sql.includes('institutional_project_access')) {
      expect(params).toEqual(sql.includes('project_id = $1') ? [projectId, '1'] : ['1']);
      return { rows };
    }
    expect(params).toEqual([user.username]);
    return { rows: [user] };
  }) } as any);
  mint = jest.fn(async () => {
    // Inspect committed state at mint time, not just after the endpoint resolves.
    expect(fixture.get('authorizationUsers/1')).toBeDefined();
    return 'offline-placeholder';
  });
  jest.mocked(getInstitutionalAdminAuth).mockReturnValue({ createCustomToken: mint } as any);
});
afterEach(() => jest.restoreAllMocks());

test('A: real route/services/adapter commit READ before mint and list exactly the assigned historical project', async () => {
  expect((await POST(request()) as any).status).toBe(200);
  expect(fixture.get('authorizationUsers/1').projectIds).toEqual([projectId]);
  expect(fixture.get(`projectAccess/${projectId}/members/1`)).toMatchObject({ institutionalUserId: '1', allowedActions: ['READ'], revoked: false });
  expect(fixture.get('authorizationUsers/user:1')).toBeUndefined();
  expect(mint).toHaveBeenCalledWith('user:1', { institutionalUserId: '1', role: 'SUPER_ADMIN' });
  expect(await readInstitutionalCollection('projects')).toEqual([{ id: projectId, name: 'Prueba "La Lomita"', numeroExpediente: '28092026-0057-DPU' }]);
});
test('B: SUPER_ADMIN without grants gets an empty index and list', async () => {
  rows = [];
  expect((await POST(request()) as any).status).toBe(200);
  expect(fixture.get('authorizationUsers/1').projectIds).toEqual([]);
  expect(await readInstitutionalCollection('projects')).toEqual([]);
});
test('C: READ grants do not authorize WRITE, ANALYZE_SCINCE or GENERATE_REPORT', async () => {
  expect((await authorizeInstitutionalProjectAccess({ sessionToken: 'offline-session', projectId, action: 'READ' })).allowed).toBe(true);
  expect(await canWriteInstitutionalProject(projectId)).toBe(false);
  for (const action of ['ANALYZE_SCINCE', 'GENERATE_REPORT']) {
    expect((await authorizeInstitutionalProjectAccess({ sessionToken: 'offline-session', projectId, action })).allowed).toBe(false);
  }
});
test('D: revoked grant is projected revoked and excluded from listing', async () => {
  rows[0].revoked_at = new Date(now - 1000);
  expect((await POST(request()) as any).status).toBe(200);
  expect(fixture.get(`projectAccess/${projectId}/members/1`).revoked).toBe(true);
  expect(await readInstitutionalCollection('projects')).toEqual([]);
});
test.each(['member', 'commit'])('E: %s persistence failure returns 503, rolls back and never mints', async mode => {
  if (mode === 'member') fixture.failWrite('projectAccess/');
  else fixture.failCommit(true);
  const result: any = await POST(request());
  expect(result.status).toBe(503);
  expect(result.body).toEqual({ error: 'FIREBASE_BRIDGE_UNAVAILABLE' });
  expect(mint).not.toHaveBeenCalled();
  expect(fixture.get('authorizationUsers/1')).toBeUndefined();
  expect(fixture.get(`projectAccess/${projectId}/members/1`)).toBeUndefined();
});
test('listing is a separate PG/Admin path: missing mirrors alone do not yield zero projects', async () => {
  expect(fixture.get('authorizationUsers/1')).toBeUndefined();
  expect((await readInstitutionalCollection('projects')).map(record => record.id)).toEqual([projectId]);
  expect(mint).not.toHaveBeenCalled();
});
test('an explicitly deleted project is excluded even with READ', async () => {
  fixture.seed(`projects/${projectId}`, { name: 'Fixture', deleted: true });
  expect(await readInstitutionalCollection('projects')).toEqual([]);
});
test('replay with an existing audit receipt restores missing mirrors before mint without duplicating audit', async () => {
  expect((await POST(request()) as any).status).toBe(200);
  const auditBefore = fixture.entries().filter(([path]) => path.startsWith('authorizationAudit/'));
  await fixture.db.doc('authorizationUsers/1').delete();
  await fixture.db.doc(`projectAccess/${projectId}/members/1`).delete();
  mint.mockImplementation(async () => 'offline-placeholder');
  expect((await POST(request()) as any).status).toBe(200);
  expect(fixture.get('authorizationUsers/1').projectIds).toEqual([projectId]);
  expect(fixture.get(`projectAccess/${projectId}/members/1`)).toMatchObject({ allowedActions: ['READ'], revoked: false });
  expect(fixture.entries().filter(([path]) => path.startsWith('authorizationAudit/'))).toEqual(auditBefore);
});
test('existing audit receipt cannot bypass a failed mirror repair', async () => {
  expect((await POST(request()) as any).status).toBe(200);
  await fixture.db.doc('authorizationUsers/1').delete();
  await fixture.db.doc(`projectAccess/${projectId}/members/1`).delete();
  mint.mockClear();
  fixture.failCommit(true);
  expect((await POST(request()) as any).status).toBe(503);
  expect(mint).not.toHaveBeenCalled();
});
