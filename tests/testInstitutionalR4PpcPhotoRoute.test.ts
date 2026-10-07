jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'existing-session' }) }) }));
jest.mock('@/services/institutionalR4PpcPhotoRead', () => ({ readInstitutionalR4PpcPhoto: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pandillas/ppc-photo/route';
import { readInstitutionalR4PpcPhoto } from '../src/services/institutionalR4PpcPhotoRead';
import { ProjectAccessError } from '../src/types/institutionalProjectAccess';
const read = jest.mocked(readInstitutionalR4PpcPhoto);
beforeEach(() => jest.resetAllMocks());
test('session is reused, signed URL is private/no-store and only read response is returned', async () => {
  read.mockResolvedValue({ url: 'https://fixture.test/temporary', expiresAt: 123 });
  const response = await GET(new NextRequest('https://fixture.test/api/pandillas/ppc-photo?projectId=A&documentId=asset'));
  expect(read).toHaveBeenCalledWith('existing-session', 'A', 'asset');
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('vary')).toBe('Cookie'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.json()).toEqual({ url: 'https://fixture.test/temporary', expiresAt: 123 });
});
test.each(['', '?projectId=A', '?projectId=A&documentId=asset&extra=1', '?projectId=A&projectId=B&documentId=asset', '?projectId=A&documentId=../bad'])('invalid scope fails before institutional access: %s', async query => {
  expect((await GET(new NextRequest('https://fixture.test/api/pandillas/ppc-photo' + query))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
test('unauthenticated and internal failures are sanitized', async () => {
  read.mockRejectedValue(new ProjectAccessError('PROJECT_ACCESS_UNAUTHENTICATED'));
  expect((await GET(new NextRequest('https://fixture.test/?projectId=A&documentId=asset'))).status).toBe(401);
  read.mockRejectedValue(new Error('private token and path'));
  const response = await GET(new NextRequest('https://fixture.test/?projectId=A&documentId=asset'));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'PHOTO_UNAVAILABLE' });
});
