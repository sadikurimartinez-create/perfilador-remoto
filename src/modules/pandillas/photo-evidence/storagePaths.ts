import { isValidSha256Hex } from '@/utils/forensicFileIntegrity';
export function photoId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('R4_INVALID_ID');
}
export function photoHash(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !isValidSha256Hex(value) || value !== value.toLowerCase()) throw new Error('R4_INVALID_SHA256');
}
export function photoStoragePath(input: { projectId: string; assetId: string; sha256: string; ext: 'jpg' | 'png'; recipeVersion?: string }): string {
  photoId(input.projectId); photoId(input.assetId); photoHash(input.sha256);
  if (!['jpg', 'png'].includes(input.ext)) throw new Error('R4_INVALID_EXTENSION');
  if (input.recipeVersion !== undefined) photoId(input.recipeVersion);
  const scope = input.recipeVersion === undefined ? 'original' : `derived/${input.recipeVersion}`;
  return `projects/${input.projectId}/pandillas/evidence/assets/${input.assetId}/${scope}/${input.sha256}.${input.ext}`;
}
export function primarySelectionId(gangId: string, memberIdentityId: string): string {
  photoId(gangId); photoId(memberIdentityId);
  return `${gangId}~${memberIdentityId}`;
}
export function expectedPhotoVersion(actual: number, expected: unknown): void {
  if (!Number.isSafeInteger(expected) || Number(expected) < 0 || actual !== expected) throw new Error('R4_VERSION_CONFLICT');
}
