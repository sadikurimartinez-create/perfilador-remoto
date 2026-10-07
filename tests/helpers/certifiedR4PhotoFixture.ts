import { photoStoragePath } from '../../src/modules/pandillas/photo-evidence/storagePaths';
export function certifiedR4PhotoFixture() {
  const projectId = 'A', id = 'asset';
  const file = (sha256: string, recipeVersion?: string) => ({ sha256, mimeType: 'image/png' as const, size: 100, width: 10, height: 10,
    storagePath: photoStoragePath({ projectId, assetId: id, sha256, ext: 'png', recipeVersion }) });
  const original = file('a'.repeat(64));
  const review = { humanValidationStatus: 'APPROVED', validatedBy: { id: '1', username: 'institutional-reviewer' }, validatedAt: '2026-10-06T12:00:00Z',
    validationDate: '2026-10-06T12:00:00Z', validationSource: 'ADR_020_24_HUMAN_ACTION', validationComment: 'Certified decision and retained original digest' };
  return { id, projectId, expedienteId: projectId, type: 'image/png', url: '', ...review,
    photoAsset: { id, projectId, sourceDocumentId: 'source', sourceDocumentName: 'source.pdf', sourceDocumentSha256: 'c'.repeat(64), sourcePage: 1, sourceImageId: 'image',
      original, derived: { ...file('b'.repeat(64), 'recipe'), recipeVersion: 'recipe' }, status: 'ACTIVE', version: 1, createdAt: 1, createdBy: { institutionalUserId: '1', username: 'reviewer' } },
    multimodalEvidence: { ...review, documentId: id, expedienteId: projectId, mimeType: 'image/png', storageReference: original.storagePath,
      forensicIntegrity: { rawSha256: original.sha256, hashStatus: 'REAL_FILE_HASH' } },
  };
}
