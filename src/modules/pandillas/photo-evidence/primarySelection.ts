import type { MemberPrimaryPhotoSelection, PhotoActor, PhotoAssociation } from './contracts';
import { assertPrimaryAssociation } from './association';
import { expectedPhotoVersion, primarySelectionId } from './storagePaths';
export function selectPrimaryPhoto(prior: MemberPrimaryPhotoSelection | null, association: PhotoAssociation, expectedVersion: number, actor: PhotoActor, now: number, reason: string): { selection: MemberPrimaryPhotoSelection; replaced: MemberPrimaryPhotoSelection | null } {
  assertPrimaryAssociation(association);
  expectedPhotoVersion(prior?.version ?? 0, expectedVersion);
  const id = primarySelectionId(association.gangId, association.memberIdentityId!);
  if (prior && (prior.id !== id || prior.projectId !== association.projectId || prior.gangId !== association.gangId || prior.memberIdentityId !== association.memberIdentityId || prior.status !== 'PRIMARY')) throw new Error('R4_SELECTION_CROSS_PROJECT');
  if (prior?.associationId === association.id) throw new Error('R4_ALREADY_PRIMARY');
  return { replaced: prior ? { ...prior, status: 'REPLACED' } : null,
    selection: { id, projectId: association.projectId, gangId: association.gangId, memberIdentityId: association.memberIdentityId!, associationId: association.id, status: 'PRIMARY', selectedBy: actor, selectedAt: now, reason, version: (prior?.version ?? 0) + 1 } };
}
