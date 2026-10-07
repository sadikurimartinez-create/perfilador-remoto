jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
import { webcrypto } from 'crypto';
import { readFileSync } from 'fs';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { InstitutionalPandillasRepository } from '@/services/institutionalPandillasRepository';
import { createPandillasCaseReference, createPandillasCaseSnapshot, validatePandillasCaseReference,
  validatePandillasCaseSnapshot, resolvePandillasMasterVersion, resolveLegacyPandillasCustody } from '@/modules/pandillas/pandillasMasterContracts';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const reader = readInstitutionalCollection as jest.Mock;
const gang = () => ({ id: 'gang-fixture', projectId: 'custody-fixture', nombre: 'Grupo sintético',
  updatedAt: 123, integrantes: [{ nombre: 'Integrante sintético', alias: '', rol: '' }] });
const reference = () => ({ caseProjectId: 'case-fixture', masterGangId: 'gang-fixture',
  masterVersion: resolvePandillasMasterVersion({ updatedAt: 123 }), createdAt: 200,
  provenance: { sourceScope: 'MASTER' as const, actor: { institutionalUserId: 'actor-fixture', username: 'Fixture' }, operationId: 'operation-fixture' } });
const snapshot = () => ({ ...reference(), snapshotAt: 201, minimalPayload: { nombre: 'Grupo sintético' } });
beforeEach(() => { jest.clearAllMocks(); reader.mockImplementation(async () => [gang()]); });
test('master reads require no currentProject and delegate exactly to institutional collection', async () => {
  const records = await new InstitutionalPandillasRepository().listMasterGangs();
  expect(reader).toHaveBeenCalledWith('pandillas'); expect(reader).toHaveBeenCalledTimes(1);
  expect(records[0].id).toBe('gang-fixture'); expect(records[0]).not.toHaveProperty('projectId');
  expect(records[0]).not.toHaveProperty('ownerProjectId');
  expect(records[0].custody.custodyProjectId).toBe('custody-fixture');
});
test('unauthorized and archived filtering results are not widened', async () => {
  reader.mockResolvedValue([]);
  expect(await new InstitutionalPandillasRepository().getMasterGang('gang-fixture')).toBeNull();
});
test('authorization errors propagate without role fallback', async () => {
  reader.mockRejectedValue(new Error('ACCESS_DENIED'));
  await expect(new InstitutionalPandillasRepository().listMasterGangs()).rejects.toThrow('ACCESS_DENIED');
});
test('no cache or new source of truth', async () => {
  const repository = new InstitutionalPandillasRepository();
  await repository.getMasterGang('gang-fixture'); reader.mockResolvedValue([]);
  expect(await repository.getMasterGang('gang-fixture')).toBeNull(); expect(reader).toHaveBeenCalledTimes(2);
});
test('duplicate gang IDs are rejected', async () => {
  reader.mockResolvedValue([gang(), gang()]);
  await expect(new InstitutionalPandillasRepository().getMasterGang('gang-fixture')).rejects.toThrow('AMBIGUOUS');
});
test('member lookup does not fabricate identity IDs and rejects ambiguous literal matches', async () => {
  const repository = new InstitutionalPandillasRepository();
  expect((await repository.getMasterMember('gang-fixture', { legacyMemberName: 'Integrante sintético' }))?.nombre).toBe('Integrante sintético');
  const data = gang(); data.integrantes.push(data.integrantes[0]); reader.mockResolvedValue([data]);
  await expect(repository.getMasterMember(data.id, { legacyMemberName: data.integrantes[0].nombre })).rejects.toThrow('RECONCILIATION');
});
test('custody refers to unchanged R4 paths without moving data', async () => {
  const scope = await new InstitutionalPandillasRepository().resolveCustodyScope('gang-fixture');
  expect(scope).toMatchObject({ memberIdentitiesPath: 'projects/custody-fixture/pandillasMemberIdentities',
    associationsPath: 'projects/custody-fixture/pandillasPhotoAssociations',
    primarySelectionsPath: 'projects/custody-fixture/pandillasPrimarySelections',
    documentsPath: 'projects/custody-fixture/documents', authorizationPolicy: 'EXISTING_PROJECT_GRANTS' });
  expect(Object.isFrozen(scope)).toBe(true);
});
test('custody cannot be fabricated from a missing or path-injected project', () => {
  expect(() => resolveLegacyPandillasCustody({ id: 'gang-fixture' })).toThrow();
  expect(() => resolveLegacyPandillasCustody({ id: 'gang-fixture', projectId: '../other' })).toThrow();
});
test('persisted version does not depend on wall clock', async () => {
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => { throw new Error('CLOCK_FORBIDDEN'); });
  try { expect(await new InstitutionalPandillasRepository().getMasterVersion('gang-fixture')).toEqual({ strategy: 'LEGACY_UPDATED_AT', updatedAt: 123 });
    expect(resolvePandillasMasterVersion({})).toEqual({ strategy: 'LEGACY_UPDATED_AT', updatedAt: null });
  } finally { clock.mockRestore(); }
});
test.each([NaN, Infinity, -1])('invalid persisted version %s fails closed', updatedAt => {
  expect(() => resolvePandillasMasterVersion({ updatedAt })).toThrow('VERSION_INVALID');
});
test('reference cannot contain full gang or photographs', () => {
  expect(() => validatePandillasCaseReference({ ...reference(), integrantes: gang().integrantes } as any)).toThrow('FIELDS_INVALID');
  const result = createPandillasCaseReference(reference());
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.provenance.actor)).toBe(true);
});
test('snapshot is deeply immutable and its digest verifies independently of input order', async () => {
  const input = snapshot(); const result = await createPandillasCaseSnapshot(input);
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.minimalPayload)).toBe(true);
  expect(Object.isFrozen(result.masterVersion)).toBe(true);
  await expect(validatePandillasCaseSnapshot(result)).resolves.toBeUndefined();
  input.minimalPayload.nombre = 'Alterado'; expect(result.minimalPayload.nombre).toBe('Grupo sintético');
  const reordered = await createPandillasCaseSnapshot({ minimalPayload: snapshot().minimalPayload, snapshotAt: 201, ...reference() });
  expect(reordered.digest).toEqual(result.digest);
});
test('snapshot rejects extra payload fields, historical tampering and invalid chronology', async () => {
  await expect(createPandillasCaseSnapshot({ ...snapshot(), minimalPayload: { nombre: 'Fixture', integrantes: [] } } as any)).rejects.toThrow();
  await expect(createPandillasCaseSnapshot({ ...snapshot(), snapshotAt: 100 })).rejects.toThrow();
  const result = await createPandillasCaseSnapshot(snapshot());
  await expect(validatePandillasCaseSnapshot({ ...result, minimalPayload: { nombre: 'Alterado' } })).rejects.toThrow('DIGEST_INVALID');
});
test('facade has no executable mutations, direct database/storage or UI dependencies', () => {
  const source = readFileSync('src/services/institutionalPandillasRepository.ts', 'utf8');
  expect(source).toContain("import 'server-only'");
  expect(source).not.toMatch(/firebase|Firestore|Storage|ProjectContext|from ['"]react|saveInstitutional|mutateInstitutional/);
  expect(Object.getOwnPropertyNames(InstitutionalPandillasRepository.prototype)).not.toEqual(expect.arrayContaining(['saveGang']));
});
