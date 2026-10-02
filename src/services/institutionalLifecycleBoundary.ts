import "server-only";
import { executeProjectPurge, collectProjectPurgePlan, type ProjectPurgePlan } from "./institutionalProjectPurgeBoundary";
import { createHash } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from "@/lib/firebaseAdmin";
import { resolveInstitutionalSessionIdentity } from "./institutionalSessionIdentityService";
import { institutionalProjectAccessRepository } from "./institutionalProjectAccessRepository";
import { validateAuthorizationSnapshot, AUTHORIZATION_POLICY, validAuthorizationId } from "./institutionalAuthorizationProjectionService";
import { ImageDeletionGovernanceService } from "@/utils/imageDeletionGovernanceService";
import type { InstitutionalActor, ProjectAccessRelation } from "@/types/institutionalProjectAccess";
export type LifecycleOperation = 'SOFT_DELETE' | 'RESTORE' | 'PURGE' | 'ARCHIVE' | 'REACTIVATE' | 'DELETE' | 'REVIEW_CLOSE' | 'REVIEW_RETURN';
export type LifecycleKind = 'PROJECT' | 'PHOTO' | 'DOCUMENT' | 'ANALYSIS' | 'DOSSIER';
export interface LifecycleRequest { projectId: string; operation: LifecycleOperation; kind: LifecycleKind; entityId: string; reason: string; operationId: string; trashId?: string; returnDeadlineHours?: number; }
interface Dependencies {
 identity: (session: unknown) => Promise<InstitutionalActor>;
 grant: (projectId: string,userId: string) => Promise<ProjectAccessRelation|null>;
 database: () => Firestore;
 now: () => number;
 deleteObject: (path:string) => Promise<void>;
 purgePlan: (db:Firestore,projectId:string) => Promise<ProjectPurgePlan>;
}
function targetPath(input: LifecycleRequest) {
 if (input.kind === 'PROJECT') { if (input.entityId !== input.projectId) throw new Error('LIFECYCLE_CROSS_PROJECT'); return `projects/${input.projectId}`; }
 if (input.kind === 'PHOTO' || input.kind === 'DOCUMENT') return `projects/${input.projectId}/${input.kind === 'PHOTO' ? 'photos' : 'documents'}/${input.entityId}`;
 return `${input.kind === 'ANALYSIS' ? 'analyses' : 'dossiers'}/${input.entityId}`;
}
export async function executeInstitutionalLifecycle(session: unknown, input: LifecycleRequest, overrides: Partial<Dependencies> = {}) {
 const deps = { identity: resolveInstitutionalSessionIdentity, grant: institutionalProjectAccessRepository.findRelation, database: getInstitutionalAdminDb, now: Date.now, purgePlan: collectProjectPurgePlan, deleteObject: async (path:string) => {try {const file=getInstitutionalAdminBucket().file(path);const [metadata]=await file.getMetadata();if(!metadata.generation)throw new Error('LIFECYCLE_STORAGE_GENERATION_REQUIRED');await file.delete({ifGenerationMatch:metadata.generation});}catch(error:any){if(error.code!==404)throw error;}}, ...overrides };
 const actor = await deps.identity(session);
 if (![input.projectId,input.entityId,input.operationId].every(value => validAuthorizationId(value)) || input.trashId !== undefined && !validAuthorizationId(input.trashId) ||
   !['PROJECT','PHOTO','DOCUMENT','ANALYSIS','DOSSIER'].includes(input.kind) || !['SOFT_DELETE','RESTORE','PURGE','ARCHIVE','REACTIVATE','DELETE','REVIEW_CLOSE','REVIEW_RETURN'].includes(input.operation) || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 5000) throw new Error('LIFECYCLE_INVALID_REQUEST');
 const relation = await deps.grant(input.projectId,actor.institutionalUserId);
 if (!relation) throw new Error('LIFECYCLE_EXPLICIT_GRANT_REQUIRED');
 const [grant] = validateAuthorizationSnapshot({ actor, relations: [relation], source: 'POSTGRESQL', policyVersion: AUTHORIZATION_POLICY },deps.now());
 if (grant.projectId !== input.projectId || grant.revoked || !grant.allowedActions.includes('WRITE')) throw new Error('LIFECYCLE_ACCESS_DENIED');
 if (['PURGE','ARCHIVE','REACTIVATE','REVIEW_CLOSE','REVIEW_RETURN'].includes(input.operation) && !['ADMIN','SUPER_ADMIN'].includes(actor.role)) throw new Error('LIFECYCLE_ADMIN_REQUIRED');
 if (['ARCHIVE','REACTIVATE','REVIEW_CLOSE','REVIEW_RETURN'].includes(input.operation) && input.kind !== 'PROJECT') throw new Error('LIFECYCLE_INVALID_REQUEST');
 if (input.operation === 'DELETE' && input.kind === 'PROJECT') throw new Error('PROJECT_PURGE_PROCEDURE_REQUIRED');
 if(input.operation==='REVIEW_RETURN' && (!Number.isInteger(input.returnDeadlineHours) || input.returnDeadlineHours!<1 || input.returnDeadlineHours!>168))throw new Error('LIFECYCLE_RETURN_DEADLINE_INVALID');
 const path = targetPath(input); const db = deps.database(); const now = deps.now();
 const digest = createHash('sha256').update(JSON.stringify({ ...input, actor: actor.institutionalUserId })).digest('hex');
 const receiptId = createHash('sha256').update(actor.institutionalUserId+':'+input.operationId).digest('hex');
 if(input.kind==='PROJECT' && input.operation==='PURGE')return executeProjectPurge(input,actor,db,digest,receiptId,{now:deps.now,plan:()=>deps.purgePlan(db,input.projectId),deleteObject:deps.deleteObject,reauthorize:async()=>{
  const fresh=await deps.identity(session);if(fresh.institutionalUserId!==actor.institutionalUserId||fresh.role!==actor.role)throw new Error('LIFECYCLE_ACTOR_CHANGED');
  const relation=await deps.grant(input.projectId,actor.institutionalUserId);if(!relation)throw new Error('LIFECYCLE_EXPLICIT_GRANT_REQUIRED');const [grant]=validateAuthorizationSnapshot({actor,relations:[relation],source:'POSTGRESQL',policyVersion:AUTHORIZATION_POLICY},deps.now());if(grant.projectId!==input.projectId||grant.revoked||!grant.allowedActions.includes('WRITE'))throw new Error('LIFECYCLE_ACCESS_DENIED');
 }});
 // Firestore and Storage cannot share a transaction. Record an immutable intent first;
 // failures remain pending and never produce a successful deletion receipt.
 if (['DELETE','PURGE'].includes(input.operation) && input.kind !== 'PROJECT') {
  const target = db.doc(path); const snapshot = await target.get(); const stored = snapshot.data();
  const storagePath = stored?.storagePath;
  if (storagePath) {
   if (typeof storagePath !== 'string' || !storagePath.startsWith(`projects/${input.projectId}/`) || storagePath.split('/').some(segment=>!segment || segment==='.' || segment==='..') || storagePath.includes('\\')) throw new Error('LIFECYCLE_STORAGE_CROSS_PROJECT');
   await db.runTransaction(async tx=>{
    const ref=db.doc(`institutionalDeletionIntents/${receiptId}`);const old=await tx.get(ref);const entity=await tx.get(target);const parent=await tx.get(db.doc(`projects/${input.projectId}`));
    if(!parent.exists || !entity.exists || entity.data()?.storagePath!==storagePath)throw new Error('LIFECYCLE_SOURCE_CHANGED');
    if(input.operation==='DELETE' && (parent.data()?.deleted===true || parent.data()?.estado==='ARCHIVADO' || parent.data()?.status==='ARCHIVADO'))throw new Error('LIFECYCLE_PROJECT_INACCESSIBLE');
    if(input.operation==='PURGE') {
     if(!input.trashId)throw new Error('LIFECYCLE_TRASH_REQUIRED');const trash=await tx.get(db.doc(`trash/${input.trashId}`));const data=trash.data();
     if(!data || data.projectId!==input.projectId || data.originalPath!==path || data.originalId!==input.entityId || !Number.isSafeInteger(data.expiresAt) || now<data.expiresAt)throw new Error('LIFECYCLE_RETENTION_GATE');
    }
    if(old.exists){if(old.data()?.digest!==digest || old.data()?.storagePath!==storagePath)throw new Error('LIFECYCLE_RETRY_CONFLICT');return;}
    tx.create(ref,{digest,projectId:input.projectId,entityId:input.entityId,storagePath,actorInstitutionalUserId:actor.institutionalUserId,status:'PENDING',timestamp:now});
    tx.update(target,{lifecycleDeletionPending:receiptId,deleted:true});
    tx.create(db.doc(`audit_logs/intent-${receiptId}`),{projectId:input.projectId,action:'DELETION_INTENT',entityId:input.entityId,actorInstitutionalUserId:actor.institutionalUserId,user:actor.username,timestamp:now,source:'SERVER'});
   });
   await deps.deleteObject(storagePath);
   const freshActor=await deps.identity(session);if(freshActor.institutionalUserId!==actor.institutionalUserId || freshActor.role!==actor.role)throw new Error('LIFECYCLE_ACTOR_CHANGED');
   const renewed = await deps.grant(input.projectId,actor.institutionalUserId);
   if(!renewed)throw new Error('LIFECYCLE_EXPLICIT_GRANT_REQUIRED');
   const [active]=validateAuthorizationSnapshot({actor,relations:[renewed],source:'POSTGRESQL',policyVersion:AUTHORIZATION_POLICY},deps.now());
   if(active.projectId!==input.projectId || active.revoked || !active.allowedActions.includes('WRITE'))throw new Error('LIFECYCLE_ACCESS_DENIED');
  }
 }
 return db.runTransaction(async transaction => {
  const receipt = db.collection('institutionalLifecycleOperations').doc(receiptId);
  const previous = await transaction.get(receipt);
  if (previous.exists) { if (previous.data()?.digest !== digest) throw new Error('LIFECYCLE_RETRY_CONFLICT'); return previous.data()!.result; }
  const projectRef = db.collection('projects').doc(input.projectId); const project = await transaction.get(projectRef);
  if (!project.exists) throw new Error('LIFECYCLE_PROJECT_NOT_FOUND');
  const metadata = project.data()!; const archived = metadata.estado === 'ARCHIVADO' || metadata.status === 'ARCHIVADO';
  if ((metadata.deleted !== undefined && metadata.deleted !== false || archived) && !['RESTORE','PURGE','REACTIVATE'].includes(input.operation)) throw new Error('LIFECYCLE_PROJECT_INACCESSIBLE');
  const target = db.doc(path); const stored = await transaction.get(target);
  let data = stored.data();
  if (data && ['ANALYSIS','DOSSIER'].includes(input.kind) && data.projectId !== input.projectId) throw new Error('LIFECYCLE_CROSS_PROJECT');
  let trashRef: any = null; let trash: any = null;
  if (['RESTORE','PURGE'].includes(input.operation)) {
   if (input.operation === 'RESTORE' || !archived) {
    if (!input.trashId) throw new Error('LIFECYCLE_TRASH_REQUIRED');
    trashRef = db.collection('trash').doc(input.trashId); trash = (await transaction.get(trashRef as any) as any).data();
    if (!trash || trash.projectId !== input.projectId || trash.originalPath !== path || trash.originalId !== input.entityId) throw new Error('LIFECYCLE_CROSS_PROJECT');
    if (!Number.isSafeInteger(trash.expiresAt) || input.operation === 'PURGE' && now < trash.expiresAt || input.operation === 'RESTORE' && now >= trash.expiresAt) throw new Error('LIFECYCLE_RETENTION_GATE');
    data ??= trash.originalData;
   }
  }
  if (!data) throw new Error('LIFECYCLE_TARGET_NOT_FOUND');
  if (input.kind !== 'PROJECT' && input.operation === 'RESTORE' && (metadata.deleted === true || archived)) throw new Error('LIFECYCLE_PARENT_INACCESSIBLE');
  if (input.kind === 'PHOTO' && !Number.isSafeInteger(metadata.photoCount ?? 0)) throw new Error('LIFECYCLE_PHOTO_COUNT_INVALID');
  const intentRef=db.doc(`institutionalDeletionIntents/${receiptId}`);const intent=await transaction.get(intentRef);
  if(intent.exists && intent.data()?.digest!==digest)throw new Error('LIFECYCLE_RETRY_CONFLICT');
  const auditRef = db.collection('audit_logs').doc(receiptId); if ((await transaction.get(auditRef)).exists) throw new Error('LIFECYCLE_AUDIT_CONFLICT');
  const imageAuditRef = input.kind === 'PHOTO' && ['DELETE','PURGE'].includes(input.operation) ? db.collection('image_deletion_logs').doc(receiptId) : null;
  if (imageAuditRef && (await transaction.get(imageAuditRef)).exists) throw new Error('LIFECYCLE_AUDIT_CONFLICT');
  const result = { projectId: input.projectId, entityId: input.entityId, kind: input.kind, operation: input.operation, operationId: input.operationId, status: 'COMPLETED',
    ...(input.operation === 'RESTORE' ? { restoredData: { ...data, deleted: false, deletedBy: null, deletedAt: null, deletionReason: null, expiresAt: null } } : {}) };
  if (input.operation === 'SOFT_DELETE') {
   if (data.deleted === true) throw new Error('LIFECYCLE_ALREADY_DELETED');
   const trashId = receiptId;
   transaction.create(db.collection('trash').doc(trashId), { originalId: input.entityId, originalPath: path, type: input.kind, name: data.name || data.tipo || input.kind,
     projectId: input.projectId, projectCeipolId: metadata.ceipolId || '', originalData: data, deletedBy: actor.username, deletedAt: now, expiresAt: now+7*24*60*60*1000, deletionReason: input.reason });
   transaction.update(target,{ deleted: true, deletedBy: actor.username, deletedAt: now, expiresAt: now+7*24*60*60*1000, deletionReason: input.reason });
  } else if (input.operation === 'RESTORE') {
   if (!data.deleted && stored.exists) throw new Error('LIFECYCLE_NOT_DELETED');
   transaction.set(target,result.restoredData!); transaction.delete(trashRef);
  } else if (input.operation === 'REVIEW_CLOSE' || input.operation === 'REVIEW_RETURN') {
   // Preserve the existing administrative workflow; these are project review states,
   // never report certification or publication. Identity and audit are server-bound.
   if(metadata.estado==='CERRADO' || metadata.estado==='VALIDADO')throw new Error('LIFECYCLE_REVIEW_ALREADY_CLOSED');
   transaction.update(projectRef,input.operation==='REVIEW_CLOSE'
    ? {estado:'CERRADO',evaluadoPor:actor.username,fechaEvaluacion:now}
    : {estado:'DEVUELTO',comentariosAuditoria:input.reason,comentariosSupervisor:input.reason,fechaDevolucion:now,deadlineAt:now+input.returnDeadlineHours!*3600000,devueltoPor:actor.username,fechaEvaluacion:now});
  } else if (input.operation === 'ARCHIVE') {
   transaction.update(projectRef,{ estado: 'ARCHIVADO', archiveReason: input.reason, archivedAt: now, archivedBy: actor.username });
  } else if (input.operation === 'REACTIVATE') {
   if (!archived || metadata.deleted === true) throw new Error('LIFECYCLE_REACTIVATION_GATE');
   transaction.update(projectRef,{ estado: 'ABIERTO', status: 'ABIERTO', reactivateReason: input.reason, reactivatedAt: now, reactivatedBy: actor.username });
  } else {
   // Project contents and immutable reports require a separate governed retention
   // purge, never erase only the parent and leave live orphaned evidence.
   if (input.kind === 'PROJECT') throw new Error('PROJECT_RECURSIVE_PURGE_REQUIRED');
   transaction.delete(target); if (trashRef) transaction.delete(trashRef);
   if (['PHOTO','DOCUMENT'].includes(input.kind)) {
    const ids=new Set([input.entityId,data.id,data.sourceEvidenceId,data.evidenceId].filter(value=>typeof value==='string' && value));
    const referencesDeleted=(item:any)=>item && ([item.id,item.photoId,item.sourceEvidenceId,item.evidenceId].some(id=>ids.has(id)) || ['evidenceIds','supportingEvidenceIds','sourceEvidenceIds','linkedEvidenceIds'].some(key=>Array.isArray(item[key]) && item[key].some((id:string)=>ids.has(id))));
    const patch:Record<string,any>={institutionalSourceRevision:Number.isSafeInteger(metadata.institutionalSourceRevision)?metadata.institutionalSourceRevision+1:1,
      deletedEvidenceIds:[...new Set([...(Array.isArray(metadata.deletedEvidenceIds)?metadata.deletedEvidenceIds:[]),...ids])]};
    for(const key of ['album','photoEvidence','evidence','streetViewEvidence','streetViewAnalysis','findings','approvedFindings','analysisOutputs','geographicEntities'])if(Array.isArray(metadata[key]))patch[key]=metadata[key].filter((item:any)=>!referencesDeleted(item));
    if(input.kind==='PHOTO')patch.photoCount=Math.max(0,Number(metadata.photoCount||0)-1);
    transaction.update(projectRef,patch);
   }
  }
  transaction.create(auditRef,{ projectId: input.projectId, action: input.operation, entityId: input.entityId, kind: input.kind, user: actor.username,
    actorInstitutionalUserId: actor.institutionalUserId, timestamp: now, reason: input.reason, source: 'SERVER', policyVersion: AUTHORIZATION_POLICY });
  if (imageAuditRef) transaction.create(imageAuditRef, ImageDeletionGovernanceService.deleteImage({ ...data, id: input.entityId },input.projectId,actor.username,[],metadata.geometryType).auditLog);
  if(intent.exists)transaction.update(intentRef,{status:'COMPLETED',completedAt:now});
  transaction.create(receipt,{ digest, request: input, projectId: input.projectId, actorInstitutionalUserId: actor.institutionalUserId, result, timestamp: now });
  return result;
 });
}
