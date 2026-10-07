jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: () => { throw new Error('LIVE_FORBIDDEN'); } }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/services/institutionalPandillasPhotoBoundary', () => ({ resolveGangPrimaryPhotoUrls: jest.fn() }));
import { readInstitutionalR4PpcPhoto } from '../src/services/institutionalR4PpcPhotoRead';
import { certifiedR4PhotoFixture } from './helpers/certifiedR4PhotoFixture';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';

function fixture() {
  const f = adminFixture({ 'projects/A/documents/asset': certifiedR4PhotoFixture(),
    'projects/A/pandillasPhotoAssociations/association': { projectId: 'A', documentId: 'asset', gangId: 'gang', status: 'ACTIVE', associationLevel: 'EXACT', imageType: 'MEMBER_PRIMARY_PHOTO' },
    'projects/A/pandillasPrimarySelections/selection': { preserved: true } });
  const authorize = jest.fn(async (): Promise<any> => ({ allowed: true, projectId: 'A' }));
  const resolve = jest.fn(async () => ({ expiresAt: Date.now() + 100000, items: [{ primaryPhoto: { assetId: 'asset', derivedUrl: 'https://fixture.test/temporary' } }] }));
  const database = jest.fn(() => f.db);
  return { f, deps: { authorize, database, resolve } as any, authorize, database, resolve };
}
test('READ authorized document resolves through R4, with no writes to URLs or associations', async () => {
  const { f, deps, authorize, resolve } = fixture(); const before = JSON.stringify(f.entries());
  const result = await readInstitutionalR4PpcPhoto('existing-session', 'A', 'asset', deps);
  expect(result.url).toBe('https://fixture.test/temporary');
  expect(authorize).toHaveBeenCalledWith({ sessionToken: 'existing-session', projectId: 'A', action: 'READ' });
  expect(resolve).toHaveBeenCalledWith('existing-session', { projectId: 'A', gangId: 'gang' });
  expect(JSON.stringify(f.entries())).toBe(before);
});
test('denial stops before database reads or signed URL resolution', async () => {
  const { deps, authorize, database, resolve } = fixture(); authorize.mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_DENIED' });
  await expect(readInstitutionalR4PpcPhoto(undefined, 'A', 'asset', deps)).rejects.toThrow('PROJECT_ACCESS_DENIED');
  expect(database).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled();
});
test('cross-project document, retired association and unselected asset fail closed', async () => {
  const first = fixture(); first.f.seed('projects/A/documents/asset', { ...certifiedR4PhotoFixture(), projectId: 'other' });
  await expect(readInstitutionalR4PpcPhoto('session', 'A', 'asset', first.deps)).rejects.toThrow('R4_PPC_UNAVAILABLE');
  expect(first.resolve).not.toHaveBeenCalled();
  const second = fixture(); second.f.seed('projects/A/pandillasPhotoAssociations/association', { projectId: 'A', documentId: 'asset', gangId: 'gang', status: 'RETIRED' });
  await expect(readInstitutionalR4PpcPhoto('session', 'A', 'asset', second.deps)).rejects.toThrow('R4_PPC_UNAVAILABLE');
  const third = fixture(); third.resolve.mockResolvedValue({ expiresAt: Date.now() + 100000, items: [] });
  await expect(readInstitutionalR4PpcPhoto('session', 'A', 'asset', third.deps)).rejects.toThrow('R4_PPC_UNAVAILABLE');
});
