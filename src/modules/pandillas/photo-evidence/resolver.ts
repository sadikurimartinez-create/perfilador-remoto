import type { MemberPhotoIdentity, MemberPrimaryPhotoSelection, PhotoAssociation, PhotoAsset, ResolvedMemberPrimaryPhoto } from './contracts';
import { assertPrimaryAssociation, validatePhotoAsset } from './association';
import { primarySelectionId } from './storagePaths';
/** Called by server boundary only AFTER READ authorization and current legacy binding verification. */
export function resolvePrimaryPhotoMetadata(projectId: string, gangId: string, memberIdentityId: string, identity: MemberPhotoIdentity, selection: MemberPrimaryPhotoSelection | null, association: PhotoAssociation | null, document: { id: string; projectId?: string; expedienteId?: string; deleted?: boolean; lifecycleDeletionPending?: unknown; photoAsset?: PhotoAsset } | null): ResolvedMemberPrimaryPhoto | null {
  if (identity.projectId !== projectId || identity.gangId !== gangId || identity.id !== memberIdentityId || identity.status !== 'ACTIVE') throw new Error('R4_IDENTITY_INACTIVE_OR_CROSS_PROJECT');
  if (!selection) return null;
  if (selection.status !== 'PRIMARY' || selection.id !== primarySelectionId(gangId, memberIdentityId) || selection.projectId !== projectId || selection.gangId !== gangId || selection.memberIdentityId !== memberIdentityId) throw new Error('R4_SELECTION_CROSS_PROJECT');
  if (!association || association.id !== selection.associationId || association.projectId !== projectId || association.gangId !== gangId || association.memberIdentityId !== memberIdentityId) throw new Error('R4_ASSOCIATION_CROSS_PROJECT');
  assertPrimaryAssociation(association);
  if (!document || document.id !== association.documentId || document.projectId !== projectId || document.expedienteId && document.expedienteId !== projectId || document.deleted || document.lifecycleDeletionPending || !document.photoAsset) throw new Error('R4_DOCUMENT_UNAVAILABLE');
  validatePhotoAsset(document.photoAsset, projectId, document.id);
  const asset = document.photoAsset;
  if (association.sourcePage !== asset.sourcePage || association.sourceImageId !== asset.sourceImageId) throw new Error('R4_PROVENANCE_MISMATCH');
  if (!asset.derived) throw new Error('R4_DERIVED_UNAVAILABLE');
  return { documentId: document.id, associationId: association.id, storagePathDerived: asset.derived.storagePath, derivedSha256: asset.derived.sha256, mimeType: asset.derived.mimeType, width: asset.derived.width, height: asset.derived.height, documentVersion: asset.version, associationVersion: association.version, selectionVersion: selection.version };
}

/** Additional photographs require their own reviewed EXACT documentary association. */
export function resolveAdditionalPhotoMetadata(projectId: string, gangId: string, identity: MemberPhotoIdentity, association: PhotoAssociation, document: Parameters<typeof resolvePrimaryPhotoMetadata>[6]): Omit<ResolvedMemberPrimaryPhoto, 'selectionVersion'> {
  if (identity.status !== 'ACTIVE' || identity.projectId !== projectId || identity.gangId !== gangId
    || association.projectId !== projectId || association.gangId !== gangId || association.memberIdentityId !== identity.id
    || association.status !== 'ACTIVE' || association.associationLevel !== 'EXACT'
    || !['MEMBER_PRIMARY_PHOTO', 'MEMBER_EVIDENCE_ATTACHMENT'].includes(association.imageType)
    || !association.reviewedBy?.institutionalUserId || !Number.isSafeInteger(association.reviewedAt)
    || !Number.isSafeInteger(association.version) || association.version < 1) throw new Error('R4_ADDITIONAL_NOT_ELIGIBLE');
  if (!document || document.id !== association.documentId || document.projectId !== projectId
    || document.expedienteId && document.expedienteId !== projectId || document.deleted || document.lifecycleDeletionPending || !document.photoAsset) throw new Error('R4_DOCUMENT_UNAVAILABLE');
  validatePhotoAsset(document.photoAsset, projectId, document.id);
  const asset = document.photoAsset;
  if (association.sourcePage !== asset.sourcePage || association.sourceImageId !== asset.sourceImageId || !asset.derived) throw new Error('R4_PROVENANCE_MISMATCH');
  return { documentId: document.id, associationId: association.id, storagePathDerived: asset.derived.storagePath,
    derivedSha256: asset.derived.sha256, mimeType: asset.derived.mimeType, width: asset.derived.width, height: asset.derived.height,
    documentVersion: asset.version, associationVersion: association.version };
}
