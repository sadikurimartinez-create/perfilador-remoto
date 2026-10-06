/** R4 metadata only. No binary, URL, legacy mutation or Storage upload. */
export type PhotoActor = { institutionalUserId: string; username: string };
export type PhotoAssetStatus = 'ACTIVE' | 'RETIRED' | 'DELETED_PENDING' | 'DELETED';
export type PhotoAssociationLevel = 'EXACT' | 'PROBABLE_DOCUMENTARY' | 'AMBIGUOUS' | 'NONE';
export type PhotoImageType = 'MEMBER_PRIMARY_PHOTO' | 'MEMBER_EVIDENCE_ATTACHMENT' | 'GANG_ALBUM' | 'GRAFFITI' | 'DOCUMENT_ATTACHMENT';
export interface PhotoFile {
  storagePath: string; sha256: string; mimeType: 'image/jpeg' | 'image/png';
  size: number; width: number; height: number;
}
export interface PhotoDerivedFile extends PhotoFile {
  recipeVersion: string;
  crop?: { x: number; y: number; width: number; height: number; units: 'ORIGINAL_PIXELS' };
}
/** Stored exclusively in ProjectDocument.photoAsset, not a fourth collection. */
export interface PhotoAsset {
  id: string; projectId: string; sourceDocumentId: string; sourceDocumentName: string;
  sourceDocumentSha256: string; sourcePage: number; sourceImageId: string;
  original: PhotoFile; derived?: PhotoDerivedFile; status: PhotoAssetStatus;
  createdAt: number; createdBy: PhotoActor; version: number;
}
export interface MemberPhotoIdentity {
  id: string; projectId: string; gangId: string; legacyMemberName: string;
  legacyMemberFingerprint: string; gangVersionAtReview: number | null;
  status: 'ACTIVE' | 'RETIRED'; reviewedBy: PhotoActor; reviewedAt: number;
  createdBy: PhotoActor; createdAt: number; updatedAt: number; version: number;
}
export interface PhotoAssociation {
  id: string; projectId: string; gangId: string; memberIdentityId?: string;
  documentId: string; sourcePage: number; sourceImageId: string; imageType: PhotoImageType;
  associationLevel: PhotoAssociationLevel; associationBasis: string; status: 'ACTIVE' | 'RETIRED';
  reviewedBy: PhotoActor; reviewedAt: number; createdBy: PhotoActor;
  createdAt: number; updatedAt: number; version: number;
}
export interface MemberPrimaryPhotoSelection {
  id: string; projectId: string; gangId: string; memberIdentityId: string; associationId: string;
  status: 'PRIMARY' | 'REPLACED'; selectedBy: PhotoActor; selectedAt: number; reason: string; version: number;
}
export type PhotoAuditEventType = 'PHOTO_IDENTITY_CREATED' | 'PHOTO_IMPORTED' | 'PHOTO_ASSOCIATED' |
  'PHOTO_PRIMARY_SELECTED' | 'PHOTO_PRIMARY_REPLACED' | 'PHOTO_ASSOCIATION_RETIRED' | 'PHOTO_DELETED';
export interface PhotoAuditValue {
  id: string; version: number; status: string; associationId?: string; documentId?: string; sha256?: string;
}
export interface PhotoAuditEvent {
  event: PhotoAuditEventType; actor: PhotoActor; timestamp: number; projectId: string; gangId: string;
  memberIdentityId: string | null; assetId: string | null; oldValue: PhotoAuditValue | null;
  newValue: PhotoAuditValue | null; reason: string;
}
export interface ResolvedMemberPrimaryPhoto {
  documentId: string; associationId: string; storagePathDerived: string; derivedSha256: string;
  mimeType: string; width: number; height: number; documentVersion: number;
  associationVersion: number; selectionVersion: number;
}
