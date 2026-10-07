jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'fixture-session' }) }) }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/lib/institutionalGangActions', () => ({ saveInstitutionalGang: jest.fn(), deleteInstitutionalGang: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoBoundary', () => ({ resolveGangPrimaryPhotoUrls: jest.fn() }));
import { readFileSync } from 'fs';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { saveInstitutionalGang, deleteInstitutionalGang } from '@/lib/institutionalGangActions';
import { resolveGangPrimaryPhotoUrls } from '@/services/institutionalPandillasPhotoBoundary';
import { PandillasService } from '@/modules/pandillas/pandillas.service';
import { listInstitutionalMasterGangs, readInstitutionalMasterMember, readInstitutionalMasterVersion,
  readInstitutionalMasterMemberPrimaryPhoto, readInstitutionalMasterMemberEvidence } from '@/lib/institutionalPandillasReadActions';
const read = readInstitutionalCollection as jest.Mock;
const photos = resolveGangPrimaryPhotoUrls as jest.Mock;
const member = { nombre: 'Integrante sintético', alias: '', rol: '' };
const gang = { id: 'gang-fixture', projectId: 'custody-fixture', nombre: 'Grupo sintético', updatedAt: 12, integrantes: [member] };
beforeEach(() => {
  jest.clearAllMocks(); read.mockImplementation(async () => [{ ...gang, integrantes: [{ ...member }] }]);
  photos.mockResolvedValue({ projectId: gang.projectId, gangId: gang.id, expiresAt: 999,
    items: [{ memberId: 'identity-fixture', primaryPhoto: { assetId: 'asset-fixture' }, additionalPhotos: [{ assetId: 'additional-fixture' }] }] });
});
afterEach(() => { expect(saveInstitutionalGang).not.toHaveBeenCalled(); expect(deleteInstitutionalGang).not.toHaveBeenCalled(); });
test('actual catalog consumer delegates through repository with identical legacy projection', async () => {
  expect(await PandillasService.getAllGangs()).toEqual([gang]);
  expect(read).toHaveBeenCalledWith('pandillas'); expect(read).toHaveBeenCalledTimes(1);
  const source = readFileSync('src/modules/pandillas/pandillas.service.ts', 'utf8');
  expect(source).toContain('return listInstitutionalPandillasLegacyView()');
  expect(source).not.toContain('readInstitutionalCollection');
});
test('master catalog and member actions require no project argument', async () => {
  const master = await listInstitutionalMasterGangs();
  expect(master[0].id).toBe(gang.id); expect(master[0]).not.toHaveProperty('projectId');
  expect(await readInstitutionalMasterMember(gang.id, member.nombre)).toEqual(member);
  expect(await readInstitutionalMasterVersion(gang.id)).toEqual({ strategy: 'LEGACY_UPDATED_AT', updatedAt: 12 });
});
test('primary and additional evidence actions use only resolved custody and existing session', async () => {
  expect((await readInstitutionalMasterMemberPrimaryPhoto(gang.id, 'identity-fixture'))?.primaryPhoto).toEqual({ assetId: 'asset-fixture' });
  expect((await readInstitutionalMasterMemberEvidence(gang.id, 'identity-fixture'))?.evidence.additionalPhotos).toEqual([{ assetId: 'additional-fixture' }]);
  expect(photos).toHaveBeenCalledWith('fixture-session', { projectId: gang.projectId, gangId: gang.id });
});
test('missing custody and access errors propagate without fallback', async () => {
  read.mockResolvedValue([{ ...gang, projectId: undefined }]);
  await expect(PandillasService.getAllGangs()).rejects.toThrow('SCOPE_INVALID');
  await expect(readInstitutionalMasterMemberEvidence(gang.id, 'identity-fixture')).rejects.toThrow('SCOPE_INVALID');
  expect(photos).not.toHaveBeenCalled();
  read.mockRejectedValue(new Error('ACCESS_DENIED'));
  await expect(PandillasService.getAllGangs()).rejects.toThrow('ACCESS_DENIED');
});
test('legacy case selectors retain their explicit project filtering', async () => {
  expect(await PandillasService.getGangByProjectId('other-case')).toBeNull();
  expect(await PandillasService.getGangByProjectId(gang.projectId)).toEqual(gang);
});
test('bridge imports no UI, project context, direct database or mutation service', () => {
  const source = readFileSync('src/lib/institutionalPandillasReadActions.ts', 'utf8');
  expect(source).toContain("'use server'");
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '');
  expect(executable).not.toMatch(/currentProject|activeProject|selectedProject|ProjectContext|firebase|mutateInstitutional|saveInstitutional/);
});
