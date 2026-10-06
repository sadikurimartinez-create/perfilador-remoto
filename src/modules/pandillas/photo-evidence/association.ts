import type { PhotoAsset, PhotoAssociation, PhotoFile } from './contracts';
import { photoHash, photoId, photoStoragePath } from './storagePaths';
export function validatePhotoAsset(asset: PhotoAsset, projectId: string, documentId: string): void {
  if (!asset || asset.projectId !== projectId || asset.id !== documentId) throw new Error('R4_ASSET_CROSS_PROJECT');
  photoId(asset.sourceDocumentId); photoId(asset.sourceImageId); photoHash(asset.sourceDocumentSha256);
  if (!Number.isSafeInteger(asset.version) || asset.version < 1 || !Number.isSafeInteger(asset.sourcePage) || asset.sourcePage < 1) throw new Error('R4_ASSET_INVALID');
  if (asset.status !== 'ACTIVE') throw new Error('R4_ASSET_INACTIVE');
  const validateFile = (file: PhotoFile, recipeVersion?: string) => {
    photoHash(file.sha256);
    if (!['image/jpeg', 'image/png'].includes(file.mimeType) || ![file.size, file.width, file.height].every(v => Number.isSafeInteger(v) && v > 0)) throw new Error('R4_FILE_INVALID');
    if (file.size > 20 * 1024 * 1024 || file.width * file.height > 40000000) throw new Error('R4_FILE_LIMIT');
    const path = photoStoragePath({ projectId, assetId: asset.id, sha256: file.sha256, ext: file.mimeType === 'image/png' ? 'png' : 'jpg', recipeVersion });
    if (file.storagePath !== path) throw new Error('R4_STORAGE_PATH_INVALID');
  };
  validateFile(asset.original);
  if (asset.derived) {
    if (!asset.derived.recipeVersion) throw new Error('R4_RECIPE_REQUIRED');
    validateFile(asset.derived, asset.derived.recipeVersion);
    if (asset.derived.size > 2 * 1024 * 1024 || Math.max(asset.derived.width, asset.derived.height) > 2048) throw new Error('R4_DERIVED_LIMIT');
    const c = asset.derived.crop;
    if (c && (c.units !== 'ORIGINAL_PIXELS' || ![c.x, c.y, c.width, c.height].every(Number.isFinite) || c.x < 0 || c.y < 0 || c.width <= 0 || c.height <= 0 || c.x + c.width > asset.original.width || c.y + c.height > asset.original.height)) throw new Error('R4_CROP_INVALID');
  }
}
export function assertPrimaryAssociation(association: PhotoAssociation): void {
  if (association.status !== 'ACTIVE' || association.associationLevel !== 'EXACT' || association.imageType !== 'MEMBER_PRIMARY_PHOTO' || !association.memberIdentityId || !association.reviewedBy?.institutionalUserId || !Number.isSafeInteger(association.reviewedAt)) throw new Error('R4_ASSOCIATION_NOT_PRIMARY_ELIGIBLE');
}
