"use server";
import { cookies } from "next/headers";
import { executeInstitutionalLifecycle, type LifecycleRequest } from "@/services/institutionalLifecycleBoundary";
export async function mutateInstitutionalLifecycle(input: LifecycleRequest) {
 return executeInstitutionalLifecycle(cookies().get('ceipol_session')?.value,input);
}

export async function restoreInstitutionalTrash(trashId: string, operationId: string) {
 return lifecycleFromTrash('RESTORE',trashId,operationId);
}
export async function purgeInstitutionalTrash(trashId: string, operationId: string) {
 return lifecycleFromTrash('PURGE',trashId,operationId);
}
async function lifecycleFromTrash(operation: 'RESTORE' | 'PURGE',trashId: string,operationId: string) {
 const { validAuthorizationId } = await import('@/services/institutionalAuthorizationProjectionService');
 const { resolveInstitutionalSessionIdentity } = await import('@/services/institutionalSessionIdentityService');
 const { getInstitutionalAdminDb } = await import('@/lib/firebaseAdmin');
 const { createHash } = await import('crypto');
 if (!validAuthorizationId(trashId) || !validAuthorizationId(operationId)) throw new Error('LIFECYCLE_INVALID_REQUEST');
 const session = cookies().get('ceipol_session')?.value;
 const actor = await resolveInstitutionalSessionIdentity(session);
 const db = getInstitutionalAdminDb();
 const trash = (await db.collection('trash').doc(trashId).get()).data();
 if (!trash) {
  const id = createHash('sha256').update(actor.institutionalUserId+':'+operationId).digest('hex');
  const prior = (await db.collection('institutionalLifecycleOperations').doc(id).get()).data();
  if (!prior?.request || prior.request.trashId !== trashId || prior.request.operation !== operation) throw new Error('LIFECYCLE_TRASH_NOT_FOUND');
  return executeInstitutionalLifecycle(session,prior.request);
 }
 const path = String(trash.originalPath || '');
 const kind = path === `projects/${trash.projectId}` ? 'PROJECT' : path.startsWith(`projects/${trash.projectId}/photos/`) ? 'PHOTO' : path.startsWith(`projects/${trash.projectId}/documents/`) ? 'DOCUMENT' : path.startsWith('analyses/') ? 'ANALYSIS' : path.startsWith('dossiers/') ? 'DOSSIER' : null;
 if (!kind) throw new Error('LIFECYCLE_UNSUPPORTED_TRASH');
 return executeInstitutionalLifecycle(session,{ projectId: trash.projectId, entityId: trash.originalId, kind, operation, operationId, trashId, reason: operation === 'RESTORE' ? 'Restauración institucional explícita' : 'Purga institucional tras vigencia de resguardo' });
}
