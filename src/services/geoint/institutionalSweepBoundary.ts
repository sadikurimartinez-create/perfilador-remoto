import 'server-only';
import type { DocumentReference } from 'firebase-admin/firestore';
import { canonicalSemanticValue } from '@/utils/institutionalDocumentSemanticIntegrity';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from '../institutionalProjectAccessService';
import { validAuthorizationId } from '../institutionalAuthorizationProjectionService';
import { createHumanTriggeredRunningSweepLifecycle,transitionGeointSweepLifecycle,markGeointSweepReadyForHumanReview,certifyGeointSweepWithHumanApproval,rejectGeointSweepWithHumanDecision } from '@/utils/geointSweepLifecycle';
import { buildSweepLifecycleOutboxPayload } from './geointSweepLifecycleEventService';
import { GeointEventOutboxService } from './geointEventOutboxService';
export async function executeInstitutionalSweep(session:unknown,projectId:string,operation:'REGISTER'|'UPDATE',proposal:any,overrides:{authorize?:typeof authorizeInstitutionalProjectAccess;database?:typeof getInstitutionalAdminDb}={}){
 if(!validAuthorizationId(projectId)||!validAuthorizationId(proposal?.id)||!['REGISTER','UPDATE'].includes(operation)||JSON.stringify(proposal).length>1000000)throw new Error('SWEEP_INPUT_INVALID');
 const access=await (overrides.authorize||authorizeInstitutionalProjectAccess)({sessionToken:session,projectId,action:'WRITE'});if(!access.allowed)throw new Error('SWEEP_ACCESS_DENIED');
 const db=(overrides.database||getInstitutionalAdminDb)();const actor=`user:${access.actor.institutionalUserId}`;
 return db.runTransaction(async raw=>{
  const ref=db.doc(`projects/${projectId}`);const snapshot=await raw.get(ref);const data=snapshot.data();
  if(!data||data.deleted===true||data.estado==='ARCHIVADO'||data.status==='ARCHIVADO')throw new Error('SWEEP_PROJECT_INACCESSIBLE');
  const sweeps=Array.isArray(data.sweeps)?data.sweeps:[];const prior=sweeps.find((item:any)=>item.id===proposal.id);const now=new Date().toISOString();
  if(operation==='REGISTER'&&prior)throw new Error('SWEEP_ALREADY_EXISTS');if(operation==='UPDATE'&&!prior)throw new Error('SWEEP_NOT_FOUND');
  if(prior && prior.lifecycle?.expedienteId!==projectId)throw new Error('SWEEP_CROSS_PROJECT');
  if(prior && (proposal.expectedVersion??proposal.lifecycleVersion)!==prior.lifecycle.version)throw new Error('SWEEP_VERSION_CONFLICT');
  let lifecycle=prior?.lifecycle || createHumanTriggeredRunningSweepLifecycle({sweepId:proposal.id,expedienteId:projectId,now,traceabilityId:proposal.traceabilityId||null,correlationId:proposal.correlationId||null,outputEvidenceIds:proposal.outputEvidenceIds||[],outputFindingIds:proposal.outputFindingIds||[],lineage:proposal.lineage||[],lineageStatus:proposal.lineageStatus});
  const validator={uid:actor,id:access.actor.institutionalUserId,name:access.actor.username,role:access.actor.role};
  if(operation==='UPDATE'&&proposal.status==='Integrado'&&lifecycle.status!=='CERTIFIED'){
   if(lifecycle.status==='RUNNING')lifecycle=transitionGeointSweepLifecycle(lifecycle,'COLLECTING',{expectedVersion:lifecycle.version,now,reason:'SWEEP_OUTPUTS_AVAILABLE_FOR_REVIEW'});
   if(lifecycle.status==='COLLECTING')lifecycle=transitionGeointSweepLifecycle(lifecycle,'ANALYZING',{expectedVersion:lifecycle.version,now,reason:'SWEEP_OUTPUTS_COLLECTED'});
   if(lifecycle.status==='ANALYZING')lifecycle=markGeointSweepReadyForHumanReview(lifecycle,{aiQualityScore:Number.isFinite(proposal.aiQualityScore)?proposal.aiQualityScore:0,expectedVersion:lifecycle.version,now});
   lifecycle=certifyGeointSweepWithHumanApproval(lifecycle,{validatedAt:now,validatedBy:validator,expectedVersion:lifecycle.version});
  } else if(operation==='UPDATE'&&proposal.status==='Rechazado'&&lifecycle.status!=='FAILED')lifecycle=rejectGeointSweepWithHumanDecision(lifecycle,{reason:proposal.justification||'HUMAN_REJECTED_SWEEP',validatedAt:now,validatedBy:validator,expectedVersion:lifecycle.version});
  const clean={...prior,...proposal};for(const key of ['expectedVersion','validatedBy','validatedAt','humanValidationStatus','validationSource','createdBy','updatedBy'])delete clean[key];
  const updated={...clean,status:operation==='REGISTER'?(proposal.type==='Directa'?'Integrado':'Pendiente'):proposal.status||prior.status,lifecycle,lifecycleStatus:lifecycle.status,lifecycleVersion:lifecycle.version,analysisStatus:lifecycle.analysisStatus,humanValidationStatus:lifecycle.humanValidationStatus,validationSource:lifecycle.validationSource,validatedBy:lifecycle.validatedBy,validatedAt:lifecycle.validatedAt,createdBy:prior?.createdBy||actor,updatedBy:actor};
  if(prior?.lifecycle.status==='CERTIFIED' && canonicalSemanticValue(updated)!==canonicalSemanticValue(prior))throw new Error('SWEEP_CERTIFIED_IMMUTABLE');
  const writes:Array<()=>void>=[];const transaction={get:async(r:any)=>{const s=await raw.get(r as DocumentReference);return{exists:()=>s.exists,data:()=>s.data()};},set:(r:any,value:any,options?:any)=>{writes.push(()=>options?raw.set(r,value,options):raw.set(r,value));}};
  for(const transition of lifecycle.transitionHistory){const payload=buildSweepLifecycleOutboxPayload({record:lifecycle,transition,actor,source:'INSTITUTIONAL_SERVER_SWEEP'});if(!payload)continue;
   const prepared=await GeointEventOutboxService.prepareEventInTransaction(transaction,db,payload,(database,...segments)=>database.doc(segments.join('/')));
   const auditRef=db.doc(`audit_logs/${createHash('sha256').update('sweep:'+prepared.fingerprint).digest('hex')}`);const audit=await transaction.get(auditRef);
   if(prepared.exists&&!audit.exists())throw new Error('SWEEP_LEGACY_RECONCILIATION_REQUIRED');
   GeointEventOutboxService.commitPreparedEventInTransaction(transaction,prepared,()=>FieldValue.serverTimestamp());
   if(!audit.exists())transaction.set(auditRef,{projectId,action:payload.eventType,actorInstitutionalUserId:access.actor.institutionalUserId,user:access.actor.username,timestamp:now,eventId:prepared.entry.eventId,source:'SERVER'});
  }
  if(operation==='UPDATE' && canonicalSemanticValue(updated)!==canonicalSemanticValue(prior)) {
   const revision=createHash('sha256').update(canonicalSemanticValue(updated)).digest('hex');
   const payload={eventType:'GEOINT_SWEEP_UPDATED',expedienteId:projectId,traceabilityId:`${lifecycle.traceabilityId||proposal.id}:revision:${revision}`,actor,source:'INSTITUTIONAL_SERVER_SWEEP',status:lifecycle.status,entityType:'GEOINT_SWEEP',entityId:proposal.id,metadata:{recordFingerprint:revision,sourceTraceabilityId:lifecycle.traceabilityId||null}};
   const prepared=await GeointEventOutboxService.prepareEventInTransaction(transaction,db,payload,(database,...segments)=>database.doc(segments.join('/')));
   const auditRef=db.doc(`audit_logs/${createHash('sha256').update('sweep:'+prepared.fingerprint).digest('hex')}`);const audit=await transaction.get(auditRef);
   if(prepared.exists&&!audit.exists())throw new Error('SWEEP_LEGACY_RECONCILIATION_REQUIRED');
   GeointEventOutboxService.commitPreparedEventInTransaction(transaction,prepared,()=>FieldValue.serverTimestamp());
   if(!audit.exists())transaction.set(auditRef,{projectId,action:payload.eventType,actorInstitutionalUserId:access.actor.institutionalUserId,user:access.actor.username,timestamp:now,eventId:prepared.entry.eventId,source:'SERVER'});
  }
  const result=operation==='REGISTER'?[...sweeps,updated]:sweeps.map((item:any)=>item.id===updated.id?updated:item);
  raw.update(ref,{sweeps:result});for(const write of writes)write();return result;
 });
}
