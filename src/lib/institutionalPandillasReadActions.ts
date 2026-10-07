'use server';
import { InstitutionalPandillasRepository } from '@/services/institutionalPandillasRepository';
import type { GangEntity } from '@/modules/pandillas/pandillas.mapper';

export async function listInstitutionalMasterGangs() {
  return new InstitutionalPandillasRepository().listMasterGangs();
}
/** Compatibility projection only: existing UI/write contracts still require legacy projectId.
 * Its value is custody, never currentProject or master ownership. No new persistence. */
export async function listInstitutionalPandillasLegacyView(): Promise<GangEntity[]> {
  return (await listInstitutionalMasterGangs()).map(({ scope, custody, ...gang }) => ({
    ...gang, projectId: custody.custodyProjectId,
  }));
}
export async function readInstitutionalMasterMember(gangId: string, legacyMemberName: string) {
  return new InstitutionalPandillasRepository().getMasterMember(gangId, { legacyMemberName });
}
export async function readInstitutionalMasterVersion(gangId: string) {
  return new InstitutionalPandillasRepository().getMasterVersion(gangId);
}
export async function readInstitutionalMasterMemberPrimaryPhoto(gangId: string, memberIdentityId: string) {
  return new InstitutionalPandillasRepository().resolveMasterMemberPrimaryPhoto(gangId, memberIdentityId);
}
export async function readInstitutionalMasterMemberEvidence(gangId: string, memberIdentityId: string) {
  return new InstitutionalPandillasRepository().resolveMasterMemberEvidence(gangId, memberIdentityId);
}
export async function readInstitutionalMasterGangPhotos(gangId: string) {
  return (await new InstitutionalPandillasRepository().resolveMasterGangEvidence(gangId))?.result ?? null;
}
