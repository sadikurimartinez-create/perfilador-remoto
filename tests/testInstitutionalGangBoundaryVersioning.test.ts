jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'fixture-session' }) }) }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn() }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));

import { mutateInstitutionalGang, type InstitutionalGangMutationOptions } from '../src/services/institutionalGangBoundary';
import * as boundary from '../src/services/institutionalGangBoundary';
import * as actions from '../src/lib/institutionalGangActions';
import { PandillasService } from '../src/modules/pandillas/pandillas.service';
import { getInstitutionalAdminDb } from '../src/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from '../src/services/institutionalProjectAccessService';
import type { GangEntity } from '../src/modules/pandillas/pandillas.mapper';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';

const actor = { institutionalUserId: 'fixture-operator', username: 'fixture-operator', role: 'USER' };
const gang = (): GangEntity => ({ id: 'example-gang', projectId: 'example-project', nombre: 'Grupo Ejemplo', zonaInfluencia: '', integrantes: [] });
const strict = (expectedUpdatedAt: number | null): InstitutionalGangMutationOptions => ({ requireExisting: true, checkVersion: true, expectedUpdatedAt });
let fixture: ReturnType<typeof adminFixture>;
let set: jest.Mock;
let create: jest.Mock;
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks();
  fixture = adminFixture({ 'projects/example-project': { deleted: false, estado: 'ABIERTO' },
    'pandillas/example-gang': { ...gang(), createdAt: 10, createdBy: 'historical-example', updatedAt: 20 } });
  const transaction = fixture.db.runTransaction;
  set = jest.fn(); create = jest.fn();
  fixture.db.runTransaction = jest.fn((work: any) => transaction((tx: any) => work({ ...tx,
    set: (...args: any[]) => { set(...args); return tx.set(...args); },
    create: (...args: any[]) => { create(...args); return tx.create(...args); } })));
  (getInstitutionalAdminDb as jest.Mock).mockReturnValue(fixture.db);
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: true, actor });
});
const save = (options?: InstitutionalGangMutationOptions, id = 'example-gang') => mutateInstitutionalGang('fixture-session', {
  operation: 'SAVE', projectId: 'example-project', id, data: { ...gang(), id }, options });
const unchanged = async (operation: Promise<unknown>, error: string) => {
  const before = fixture.entries();
  await expect(operation).rejects.toThrow(error);
  expect(fixture.entries()).toEqual(before); expect(set).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
};
test('T1 missing target cannot be recreated and produces no successful audit', async () => {
  await unchanged(save(strict(20), 'missing-example'), 'PANDILLAS_TARGET_NOT_FOUND');
});
test('T2 matching version permits save', async () => { await expect(save(strict(20))).resolves.toBe('example-gang'); });
test('T3 different version prevents every write', async () => { await unchanged(save(strict(19)), 'PANDILLAS_VERSION_CONFLICT'); });
test('T4 absent updatedAt matches explicit null', async () => {
  const old = fixture.get('pandillas/example-gang'); delete old.updatedAt; fixture.seed('pandillas/example-gang', old);
  await expect(save(strict(null))).resolves.toBe('example-gang');
});
test('T5 change after preview is observed inside transaction', async () => {
  const expected = fixture.get('pandillas/example-gang').updatedAt;
  fixture.seed('pandillas/example-gang', { ...fixture.get('pandillas/example-gang'), updatedAt: 21 });
  await unchanged(save(strict(expected)), 'PANDILLAS_VERSION_CONFLICT');
});
test.each([[0, 'historical-example'], [10, ''], [123, 'historical-example'], [10, 'original-example']])(
  'T6–T9 literal historical values preserved: %j, %j', async (createdAt, createdBy) => {
    fixture.seed('pandillas/example-gang', { ...fixture.get('pandillas/example-gang'), createdAt, createdBy });
    await save(strict(20)); expect(fixture.get('pandillas/example-gang')).toMatchObject({ createdAt, createdBy });
  });
test('T10 ordinary SAVE still creates', async () => {
  await save(undefined, 'new-example'); expect(fixture.get('pandillas/new-example').createdBy).toBe(actor.username);
});
test('T11 action without options retains original request shape', async () => {
  const spy = jest.spyOn(boundary, 'mutateInstitutionalGang'); const data = gang();
  await actions.saveInstitutionalGang(data);
  expect(spy).toHaveBeenCalledWith('fixture-session', { operation: 'SAVE', projectId: data.projectId, id: data.id, data });
});
test('T12 action propagates controls separately from data', async () => {
  const spy = jest.spyOn(boundary, 'mutateInstitutionalGang'); const data = gang(); const before = structuredClone(data);
  await actions.saveInstitutionalGang(data, strict(20));
  expect(spy).toHaveBeenCalledWith('fixture-session', { operation: 'SAVE', projectId: data.projectId, id: data.id, data, options: strict(20) });
  expect(data).toEqual(before);
});
test('T13 saveGang keeps its original call and creation ability', async () => {
  const spy = jest.spyOn(actions, 'saveInstitutionalGang'); const data = { ...gang(), id: undefined };
  await PandillasService.saveGang(data, 'ignored-client-example'); expect(spy).toHaveBeenCalledWith(data);
  expect(set).toHaveBeenCalledTimes(1);
});
test('T14 strict service requires ID', async () => {
  await unchanged(PandillasService.saveExistingGangWithVersion({ ...gang(), id: undefined }, 20), 'PANDILLAS_TARGET_ID_REQUIRED');
});
test('T15 strict service rejects static ID', async () => {
  await unchanged(PandillasService.saveExistingGangWithVersion({ ...gang(), id: 'static-gang-example' }, 20), 'PANDILLAS_STATIC_TARGET_FORBIDDEN');
});
test.each(['requireExisting', 'checkVersion', 'expectedUpdatedAt'] as const)(
  'T16–T18 strict service forwards %s', async key => {
    const spy = jest.spyOn(actions, 'saveInstitutionalGang'); const data = gang();
    await PandillasService.saveExistingGangWithVersion(data, 20);
    expect(spy.mock.calls[0][1]?.[key]).toBe(strict(20)[key]);
    expect(spy.mock.calls[0][0]).toBe(data);
  });
test('T19 version conflict creates no success audit', async () => {
  await unchanged(save(strict(0)), 'PANDILLAS_VERSION_CONFLICT');
  expect(fixture.entries().filter(([path]) => path.startsWith('audit_logs/'))).toHaveLength(0);
});
test('T20 save and server actor audit share one transaction and roll back on audit failure', async () => {
  const before = fixture.entries(); fixture.failWrite('audit_logs/');
  await expect(save(strict(20))).rejects.toThrow('OFFLINE_WRITE_FAILURE');
  expect(fixture.entries()).toEqual(before);
  fixture.failWrite(null); await save(strict(20));
  expect(fixture.db.runTransaction).toHaveBeenCalledTimes(2);
  expect(fixture.entries().filter(([path]) => path.startsWith('audit_logs/'))[0][1]).toMatchObject({
    action: 'GANG_SAVE', actorInstitutionalUserId: actor.institutionalUserId, user: actor.username });
});
test('T21 options never appear in stored business document', async () => {
  await actions.saveInstitutionalGang(gang(), strict(20)); const stored = fixture.get('pandillas/example-gang');
  for (const key of ['options', 'requireExisting', 'checkVersion', 'expectedUpdatedAt']) expect(stored).not.toHaveProperty(key);
});
test('zero version is distinct from absence', async () => {
  fixture.seed('pandillas/example-gang', { ...fixture.get('pandillas/example-gang'), updatedAt: 0 });
  await unchanged(save(strict(null)), 'PANDILLAS_VERSION_CONFLICT'); await expect(save(strict(0))).resolves.toBe('example-gang');
});
test('null historical attribution is also preserved', async () => {
  fixture.seed('pandillas/example-gang', { ...fixture.get('pandillas/example-gang'), createdAt: null, createdBy: null });
  await save(strict(20)); expect(fixture.get('pandillas/example-gang')).toMatchObject({ createdAt: null, createdBy: null });
});
test('missing historical fields use creation attribution policy', async () => {
  fixture.seed('pandillas/example-gang', { ...gang(), updatedAt: 20 }); await save(strict(20));
  expect(fixture.get('pandillas/example-gang').createdBy).toBe(actor.username);
  expect(typeof fixture.get('pandillas/example-gang').createdAt).toBe('number');
});
test('ordinary manual edit ignores version check unless requested', async () => { await expect(save()).resolves.toBe('example-gang'); });
test('DELETE semantics and audit preserved', async () => {
  await mutateInstitutionalGang('fixture-session', { operation: 'DELETE', projectId: 'example-project', id: 'example-gang' });
  expect(fixture.get('pandillas/example-gang')).toBeUndefined();
  expect(fixture.entries().find(([path]) => path.startsWith('audit_logs/'))![1].action).toBe('GANG_DELETE');
});
test('WRITE denial prevents IO', async () => {
  (authorizeInstitutionalProjectAccess as jest.Mock).mockResolvedValue({ allowed: false });
  await unchanged(save(strict(20)), 'GANG_ACCESS_DENIED'); expect(getInstitutionalAdminDb).not.toHaveBeenCalled();
});
test('project validation and ownership preserved', async () => {
  await unchanged(mutateInstitutionalGang('fixture-session', { operation: 'SAVE', projectId: '', data: gang() }), 'GANG_INPUT_INVALID');
  fixture.seed('pandillas/example-gang', { ...gang(), projectId: 'other-example' });
  await unchanged(save(strict(null)), 'GANG_CROSS_PROJECT');
});
test('missing explicit expected version blocked at service and boundary', async () => {
  await unchanged(PandillasService.saveExistingGangWithVersion(gang(), undefined as unknown as number), 'PANDILLAS_EXPECTED_VERSION_REQUIRED');
  await unchanged(save({ requireExisting: true, checkVersion: true }), 'PANDILLAS_EXPECTED_VERSION_REQUIRED');
});
