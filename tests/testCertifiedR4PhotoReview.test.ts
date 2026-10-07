jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'MOCK' } }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: () => { throw new Error('LIVE_FORBIDDEN'); } }));
import { isCertifiedR4PhotoEvidence, isCertifiedR4FinalReview, resolveCertifiedR4PpcImage } from '../src/utils/certifiedR4PhotoReview';
import { commitInstitutionalEvidenceReview } from '../src/services/institutionalEvidenceReviewBoundary';
import { reviewVersion } from '../src/utils/institutionalEvidenceReview';
import { certifiedR4PhotoFixture } from './helpers/certifiedR4PhotoFixture';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';

test('R4 contract and approval metadata, not comment labels, distinguish final review', () => {
  const photo = certifiedR4PhotoFixture();
  expect(isCertifiedR4PhotoEvidence(photo)).toBe(true); expect(isCertifiedR4FinalReview(photo)).toBe(true);
  expect(isCertifiedR4FinalReview({ ...photo, photoAsset: undefined, validationComment: 'Import certified decision R4.5C.4-PRIMARY-79-v1' })).toBe(false);
  expect(isCertifiedR4FinalReview({ ...photo, validatedBy: null })).toBe(false);
  expect(isCertifiedR4PhotoEvidence({ ...photo, projectId: 'other' })).toBe(false);
  expect(isCertifiedR4PhotoEvidence({ ...photo, photoAsset: { ...photo.photoAsset, original: { ...photo.photoAsset.original, storagePath: 'other' } } })).toBe(false);
  expect(isCertifiedR4FinalReview({ ...photo, humanValidationStatus: 'PENDING_REVIEW' })).toBe(false);
});
test.each(['APPROVE', 'REJECT', 'RETURN_FOR_REANALYSIS'] as const)('server blocks %s before any write, audit or metadata overwrite', async action => {
  const photo = certifiedR4PhotoFixture();
  const f = adminFixture({ 'projects/A': { id: 'A' }, 'projects/A/documents/asset': photo,
    'projects/A/pandillasPrimarySelections/s': { preserved: true }, 'projects/A/pandillasPhotoAssociations/a': { preserved: true } });
  const before = JSON.stringify(f.entries());
  await expect(commitInstitutionalEvidenceReview(f.db, { institutionalUserId: '1' }, { projectId: 'A', source: 'DOCUMENT_PHOTO', id: 'asset', action, comment: 'new', expectedReview: reviewVersion(photo) })).rejects.toThrow('CERTIFIED_R4_REVIEW_FINAL');
  expect(JSON.stringify(f.entries())).toBe(before);
});
test('authorized image resolution with empty document URL is ephemeral and requires unexpired response', async () => {
  const request = jest.fn(async () => new Response(JSON.stringify({ url: 'https://fixture.test/signed', expiresAt: Date.now() + 10000 })));
  expect(await resolveCertifiedR4PpcImage('A', 'asset', request as typeof fetch)).toBe('https://fixture.test/signed');
  expect(request).toHaveBeenCalledWith('/api/pandillas/ppc-photo?projectId=A&documentId=asset', { credentials: 'same-origin', cache: 'no-store' });
  await expect(resolveCertifiedR4PpcImage('A', 'asset', jest.fn(async () => new Response('{}', { status: 403 })) as typeof fetch)).rejects.toThrow('R4_PPC_IMAGE_UNAVAILABLE');
  await expect(resolveCertifiedR4PpcImage('A', 'asset', jest.fn(async () => new Response(JSON.stringify({ url: 'https://fixture.test/expired', expiresAt: 1 }))) as typeof fetch)).rejects.toThrow('R4_PPC_IMAGE_UNAVAILABLE');
});
