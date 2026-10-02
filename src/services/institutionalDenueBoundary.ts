import 'server-only';
import type { DocumentReference } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { validAuthorizationId } from './institutionalAuthorizationProjectionService';
import { FirestoreDenueAnalyticalWorkflowRepository, type DenueWorkflowPersistencePort } from './denueAnalyticalWorkflowRepository';
import { buildDenueAnalyticalReviewEvent } from '@/utils/denueAnalyticalReviewLedger';
export async function executeInstitutionalDenue(session:unknown,projectId:string,operation:'SAVE'|'REVIEW',input:any,overrides:{authorize?:typeof authorizeInstitutionalProjectAccess;database?:typeof getInstitutionalAdminDb}={}){
 if(!validAuthorizationId(projectId)||!['SAVE','REVIEW'].includes(operation)||JSON.stringify(input).length>1000000)throw new Error('DENUE_BOUNDARY_INPUT_INVALID');
 const access=await (overrides.authorize||authorizeInstitutionalProjectAccess)({sessionToken:session,projectId,action:'WRITE'});if(!access.allowed)throw new Error('DENUE_BOUNDARY_ACCESS_DENIED');
 const db=(overrides.database||getInstitutionalAdminDb)();
 const port:DenueWorkflowPersistencePort={document:(database,...segments)=>database.doc(segments.join('/')),read:(database,...segments)=>database.collection(segments.join('/')).get(),transaction:async(_database,work)=>{
  await db.runTransaction(async raw=>{const parent=await raw.get(db.doc(`projects/${projectId}`));const data=parent.data();if(!data||data.deleted===true||data.estado==='ARCHIVADO'||data.status==='ARCHIVADO')throw new Error('DENUE_BOUNDARY_PROJECT_INACCESSIBLE');
   const auditRef=db.doc(`audit_logs/${randomUUID()}`);const writes:Array<()=>void>=[];
   await work({get:async(ref:any)=>{const snapshot=await raw.get(ref as DocumentReference);return{exists:()=>snapshot.exists,data:()=>snapshot.data()};},set:(ref:any,data:any)=>writes.push(()=>raw.set(ref,data)),update:(ref:any,data:any)=>writes.push(()=>raw.update(ref,data))});
   for(const write of writes)write();if(writes.length)raw.create(auditRef,{projectId,action:`DENUE_${operation}`,actorInstitutionalUserId:access.actor.institutionalUserId,user:access.actor.username,timestamp:new Date().toISOString(),source:'SERVER'});
  });
 }};
 const repository=new FirestoreDenueAnalyticalWorkflowRepository(db as any,port);
 if(operation==='SAVE')return repository.saveRelations(projectId,input);
 if(input.expedienteId!==projectId || !validAuthorizationId(input.relationId))throw new Error('DENUE_BOUNDARY_CROSS_PROJECT');
 const workflow=await repository.load(projectId);const relation=workflow.relations.find(item=>item.relationId===input.relationId);if(!relation || relation.humanValidation.status!==input.previousStatus)throw new Error('DENUE_BOUNDARY_STALE_REVIEW');
 const event=buildDenueAnalyticalReviewEvent(relation,{nextStatus:input.nextStatus,reviewedBy:`user:${access.actor.institutionalUserId}`,reviewedAt:new Date().toISOString(),rationale:input.rationale});
 return repository.appendReviewEvent(projectId,event);
}
