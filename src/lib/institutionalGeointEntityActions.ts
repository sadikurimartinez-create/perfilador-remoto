"use server";
import { cookies } from 'next/headers';
import { executeInstitutionalGeointEntity } from '@/services/institutionalGeointEntityBoundary';
import type { EvidenceReviewRequest } from '@/utils/institutionalEvidenceReview';
export async function persistInstitutionalGeointEntity(input:Parameters<typeof executeInstitutionalGeointEntity>[1]){return executeInstitutionalGeointEntity(cookies().get('ceipol_session')?.value,input);}
export async function reviewInstitutionalEvidence(input: EvidenceReviewRequest) {
 return executeInstitutionalGeointEntity(cookies().get('ceipol_session')?.value,
  {projectId:input.projectId,kind:(input.source==='PHOTO'||input.source==='DOCUMENT_PHOTO')?'PHOTO':'STREETVIEW',operation:'REVIEW',id:input.id,data:input});
}
