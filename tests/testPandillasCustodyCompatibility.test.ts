jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/institutionalCollectionActions', () => ({ readInstitutionalCollection: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoBoundary', () => ({ resolveGangPrimaryPhotoUrls: jest.fn() }));
import { cookies } from 'next/headers';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { resolveGangPrimaryPhotoUrls } from '@/services/institutionalPandillasPhotoBoundary';
import { resolvePandillasCustodyScope } from '@/services/pandillasCustodyResolver';
import { InstitutionalPandillasRepository } from '@/services/institutionalPandillasRepository';
import { readFileSync } from 'fs';
const read = readInstitutionalCollection as jest.Mock;
const photos = resolveGangPrimaryPhotoUrls as jest.Mock;
const fixture = { id: 'gang-fixture', projectId: 'custody-fixture', nombre: 'Sintético', integrantes: [], updatedAt: 12 };
const primary = { assetId: 'asset-fixture', associationId: 'association-fixture', derivedSha256: 'a'.repeat(64),
  documentVersion: 2, associationVersion: 3, selectionVersion: 4, derivedUrl: 'https://example.invalid/signed' };
beforeEach(() => {
  jest.clearAllMocks(); read.mockResolvedValue([{ ...fixture }]);
  (cookies as jest.Mock).mockReturnValue({ get: () => ({ value: 'fixture-session' }) });
  photos.mockResolvedValue({ projectId: fixture.projectId, gangId: fixture.id, expiresAt: 999,
    items: [{ memberId: 'member-fixture', primaryPhoto: primary, additionalPhotos: [{ ...primary, assetId: 'additional-fixture' }] }] });
});
test('master ID resolves persisted custody with source/version, never ownership', async () => {
  const result = await resolvePandillasCustodyScope(fixture.id);
  expect(result).toMatchObject({ custodyProjectId: fixture.projectId, masterVersion: { updatedAt: 12 }, source: 'pandillas.projectId' });
  expect(result).not.toHaveProperty('ownerProjectId'); expect(read).toHaveBeenCalledWith('pandillas');
});
test('primary read uses session and legacy custody without active project', async () => {
  const result = await new InstitutionalPandillasRepository().resolveMasterMemberPrimaryPhoto(fixture.id, 'member-fixture');
  expect(photos).toHaveBeenCalledWith('fixture-session', { projectId: fixture.projectId, gangId: fixture.id });
  expect(result?.primaryPhoto).toEqual(primary); expect(result?.scope.version?.updatedAt).toBe(12);
});
test('additional evidence preserves hashes, IDs and versions from existing boundary', async () => {
  const result = await new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'member-fixture');
  expect(result?.evidence.additionalPhotos).toEqual([{ ...primary, assetId: 'additional-fixture' }]);
  expect(read).toHaveBeenCalledTimes(1); expect(photos).toHaveBeenCalledTimes(1);
});
test('missing legacy project fails closed without photo resolution', async () => {
  read.mockResolvedValue([{ ...fixture, projectId: undefined }]);
  await expect(new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'member-fixture')).rejects.toThrow('SCOPE_INVALID');
  expect(photos).not.toHaveBeenCalled();
});
test.each(['archived', 'deleted', 'grant revoked'])('%s remains filtered by institutional policy', async () => {
  read.mockResolvedValue([]);
  expect(await new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'member-fixture')).toBeNull();
  expect(photos).not.toHaveBeenCalled();
});
test('revocation at R4 boundary propagates without fallback', async () => {
  photos.mockRejectedValue(new Error('PROJECT_ACCESS_DENIED'));
  await expect(new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'member-fixture')).rejects.toThrow('PROJECT_ACCESS_DENIED');
});
test('cross-scope boundary result is rejected', async () => {
  photos.mockResolvedValue({ projectId: 'other', gangId: fixture.id, items: [] });
  await expect(new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'member-fixture')).rejects.toThrow('SCOPE_MISMATCH');
});
test('missing identity never falls back to another member', async () => {
  expect(await new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'missing')).toBeNull();
});
test('duplicate identity result is rejected', async () => {
  photos.mockResolvedValue({ projectId: fixture.projectId, gangId: fixture.id,
    items: [{ memberId: 'duplicate' }, { memberId: 'duplicate' }] });
  await expect(new InstitutionalPandillasRepository().resolveMasterMemberEvidence(fixture.id, 'duplicate')).rejects.toThrow('RECONCILIATION');
});
test('compatibility contains only institutional reads, no SDK, writes or new paths', () => {
  const source = ['src/services/pandillasCustodyResolver.ts', 'src/services/institutionalPandillasRepository.ts']
    .map(path => readFileSync(path, 'utf8')).join('\n');
  expect(source).not.toMatch(/firebase|\.set\(|\.update\(|\.delete\(|upload|mutateInstitutional|readInstitutionalR4PpcPhoto/);
  expect(source).not.toMatch(/currentProject|ownerProjectId/);
});
