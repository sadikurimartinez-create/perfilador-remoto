import { validatePhotoAsset } from '@/modules/pandillas/photo-evidence/association';
import { evaluateHumanValidation } from './humanValidationPolicy';

/** Structural R4 contract, not a comment substring or a second persisted review state. */
export function isCertifiedR4PhotoEvidence(item: any): boolean {
  try {
    const asset = item?.photoAsset, evidence = item?.multimodalEvidence;
    const projectId = item?.projectId, id = item?.sourceDocumentId || item?.id;
    if (!projectId || item.expedienteId !== projectId || item.deleted || item.lifecycleDeletionPending) return false;
    validatePhotoAsset(asset, projectId, id);
    return Boolean(asset.derived && asset.createdBy?.institutionalUserId && asset.createdBy?.username
      && evidence?.documentId === id && evidence.expedienteId === projectId
      && evidence.mimeType === asset.original.mimeType && evidence.storageReference === asset.original.storagePath
      && evidence.forensicIntegrity?.hashStatus === 'REAL_FILE_HASH'
      && evidence.forensicIntegrity.rawSha256 === asset.original.sha256);
  } catch { return false; }
}

export function isCertifiedR4FinalReview(item: any): boolean {
  if (!isCertifiedR4PhotoEvidence(item)) return false;
  const nested = item.multimodalEvidence;
  const record = { ...nested, ...item, humanValidationStatus: item.humanValidationStatus ?? nested.humanValidationStatus };
  const review = evaluateHumanValidation(record);
  return review.isInstitutionalApproval && nested.humanValidationStatus === 'APPROVED'
    && record.validationSource === 'ADR_020_24_HUMAN_ACTION'
    && Boolean(review.validatedBy?.id || review.validatedBy?.username)
    && typeof review.validatedAt === 'string' && Number.isFinite(Date.parse(review.validatedAt))
    && typeof record.validationComment === 'string' && Boolean(record.validationComment.trim());
}

export async function resolveCertifiedR4PpcImage(projectId: string, documentId: string, request: typeof fetch = fetch): Promise<string> {
  const response = await request(`/api/pandillas/ppc-photo?${new URLSearchParams({ projectId, documentId })}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('R4_PPC_IMAGE_UNAVAILABLE');
  const data = await response.json();
  if (typeof data.url !== 'string' || !data.url.startsWith('https://') || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error('R4_PPC_IMAGE_UNAVAILABLE');
  return data.url;
}
