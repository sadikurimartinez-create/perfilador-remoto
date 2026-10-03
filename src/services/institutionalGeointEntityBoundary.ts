import 'server-only';
import type { DocumentReference } from 'firebase-admin/firestore';
import { createHash,randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { validAuthorizationId } from './institutionalAuthorizationProjectionService';
import { normalizeStreetViewFindingForPersistence,recoverHistoricalStreetViewFindingForApproval } from './streetViewFindingService';
import { GeointGovernanceStatus,normalizeGeointGovernanceStatus } from '@/types/geointGovernance';
import { GeointEventOutboxService } from './geoint/geointEventOutboxService';
import { makeFirestoreSafe } from '@/utils/firestoreSafe';
import { canonicalSemanticValue } from '@/utils/institutionalDocumentSemanticIntegrity';
import { commitInstitutionalEvidenceReview } from './institutionalEvidenceReviewBoundary';
import { applyHumanValidationAction } from '@/utils/humanValidationPolicy';
export async function executeInstitutionalGeointEntity(session:unknown,input:{projectId:string;kind:'GEOGRAPHIC'|'STREETVIEW'|'PHOTO';operation:'SAVE'|'UPDATE'|'DELETE'|'LIST'|'REVIEW';id?:string;data?:any},overrides:{authorize?:typeof authorizeInstitutionalProjectAccess;database?:typeof getInstitutionalAdminDb}={}){
 if(!validAuthorizationId(input.projectId)||!['GEOGRAPHIC','STREETVIEW','PHOTO'].includes(input.kind)||!['SAVE','UPDATE','DELETE','LIST','REVIEW'].includes(input.operation)||input.kind==='PHOTO'&&input.operation!=='REVIEW'||input.id!==undefined&&!validAuthorizationId(input.id)||JSON.stringify(input.data||{}).length>1000000)throw new Error('GEOINT_ENTITY_INPUT_INVALID');
 if(input.operation==='REVIEW' && (input.kind==='GEOGRAPHIC'||!input.id||!['PHOTO','DOCUMENT_PHOTO','TACTICAL_STREET_VIEW','STREETVIEW_FINDING'].includes(input.data?.source)||input.data?.id!==input.id||input.data?.projectId!==input.projectId||!['APPROVE','REJECT','RETURN_FOR_REANALYSIS'].includes(input.data?.action)||typeof input.data?.comment!=='string'||!input.data.comment.trim()||input.data.comment.length>4000||typeof input.data?.expectedReview!=='string'||input.data.expectedReview.length>5000))throw new Error('EVIDENCE_REVIEW_INPUT_INVALID');
 const access=await (overrides.authorize||authorizeInstitutionalProjectAccess)({sessionToken:session,projectId:input.projectId,action:input.operation==='LIST'?'READ':'WRITE'});if(!access.allowed)throw new Error('GEOINT_ENTITY_ACCESS_DENIED');
 const db=(overrides.database||getInstitutionalAdminDb)();const projectId=access.projectId;
 if(input.operation==='REVIEW')return commitInstitutionalEvidenceReview(db,access.actor,{...input.data,projectId});
 const child=input.kind==='GEOGRAPHIC'?'geographicEntities':'streetview_findings';
 if(input.operation==='LIST'){const children=await db.collection(`projects/${projectId}/${child}`).get();const records=new Map(children.docs.map(doc=>[doc.id,{...doc.data(),id:doc.id}]));if(input.kind==='STREETVIEW')for(const doc of (await db.collection(child).where('expedienteId','==',projectId).get()).docs)if(!records.has(doc.id))records.set(doc.id,{...doc.data(),id:doc.id});for(const record of records.values())if((record as any)[input.kind==='GEOGRAPHIC'?'projectId':'expedienteId']!==projectId)throw new Error('GEOINT_ENTITY_CROSS_PROJECT');return [...records.values()];}
 const id=input.id||input.data?.id||randomUUID();if(!validAuthorizationId(id))throw new Error('GEOINT_ENTITY_INPUT_INVALID');const actor=`user:${access.actor.institutionalUserId}`;
 return db.runTransaction(async raw=>{
  const parent=await raw.get(db.doc(`projects/${projectId}`));const metadata=parent.data();if(!metadata||metadata.deleted===true||metadata.estado==='ARCHIVADO'||metadata.status==='ARCHIVADO')throw new Error('GEOINT_ENTITY_PROJECT_INACCESSIBLE');
  const ref=db.doc(`projects/${projectId}/${child}/${id}`);const existing=await raw.get(ref);const root=input.kind==='STREETVIEW'?db.doc(`${child}/${id}`):null;const legacy=root?await raw.get(root):null;const prior=existing.data()||legacy?.data();
  if(prior && prior[input.kind==='GEOGRAPHIC'?'projectId':'expedienteId']!==projectId || legacy?.exists&&legacy.data()?.expedienteId!==projectId)throw new Error('GEOINT_ENTITY_CROSS_PROJECT');
  if(input.operation!=='SAVE'&&!prior)throw new Error('GEOINT_ENTITY_NOT_FOUND');
  const now=new Date().toISOString();let data:any;
  if(input.kind==='GEOGRAPHIC'){
   data=input.operation==='UPDATE'?{...prior,metadata:input.data?.metadata}:input.operation==='DELETE'?prior:{...input.data,id,projectId,createdBy:prior?.createdBy??actor,createdAt:prior?.createdAt??Date.now()};
   if(data.projectId!==projectId||!Number.isFinite(data.lat)||!Number.isFinite(data.lng)||Math.abs(data.lat)>90||Math.abs(data.lng)>180||!['POI','VERTEX','EVIDENCE_LOCATION'].includes(data.type))throw new Error('GEOINT_ENTITY_GEOGRAPHY_INVALID');
  }else{
   if(input.operation==='DELETE')data=prior;
   else if(input.operation==='SAVE'){if(normalizeGeointGovernanceStatus(input.data?.estado)===GeointGovernanceStatus.APPROVED_EVIDENCE)normalizeStreetViewFindingForPersistence({...input.data,id,expedienteId:projectId});data=normalizeStreetViewFindingForPersistence({...input.data,id,expedienteId:projectId,estado:GeointGovernanceStatus.PENDING_REVIEW,createdBy:prior?.createdBy||access.actor.username,fechaCreacion:prior?.fechaCreacion||now,usuarioRevision:access.actor.username,validatedBy:null,humanValidationStatus:'UNREVIEWED',validationDate:undefined,validationSource:undefined});if(prior && canonicalSemanticValue(prior)!==canonicalSemanticValue(data))throw new Error('GEOINT_ENTITY_EXISTING_RECORD_IMMUTABLE');}
   else{
    const estado=normalizeGeointGovernanceStatus(input.data?.estado||prior!.estado);const patch={...prior,...input.data,id,expedienteId:projectId,createdBy:prior!.createdBy,estado,usuarioRevision:access.actor.username,validatedBy:{id:access.actor.institutionalUserId,uid:actor,name:access.actor.username,role:access.actor.role},validationDate:now,updatedAt:now};
    if(estado!==GeointGovernanceStatus.PENDING_REVIEW)Object.assign(patch,applyHumanValidationAction({action:estado===GeointGovernanceStatus.APPROVED_EVIDENCE?'APPROVE':estado===GeointGovernanceStatus.REJECTED_FINDING?'REJECT':'RETURN_FOR_REANALYSIS',validatorIdentity:patch.validatedBy,validatedAt:now}));
    try{data=normalizeStreetViewFindingForPersistence(estado===GeointGovernanceStatus.APPROVED_EVIDENCE?recoverHistoricalStreetViewFindingForApproval(patch):patch);}catch(error:any){throw new Error(`STREET_VIEW_FINDING_PROMOTION_BLOCKED: ${error.message}`);}
   }
  }
  data=makeFirestoreSafe(data);
  const eventType=input.kind==='GEOGRAPHIC'?`GEOGRAPHIC_ENTITY_${input.operation}`:input.operation==='UPDATE'&&data.estado===GeointGovernanceStatus.APPROVED_EVIDENCE?'HUMAN_APPROVED':input.operation==='UPDATE'&&data.estado===GeointGovernanceStatus.REJECTED_FINDING?'HUMAN_REJECTED':`STREET_VIEW_FINDING_${input.operation}`;
  const digest=createHash('sha256').update(canonicalSemanticValue(data)).digest('hex');const payload={eventType,expedienteId:projectId,traceabilityId:`${data.traceabilityId||`geography:${projectId}:${id}`}:revision:${digest}`,actor,source:'INSTITUTIONAL_SERVER_ENTITY',status:input.operation==='DELETE'?'DELETED':data.estado||'PERSISTED',entityType:child,entityId:id,metadata:{recordFingerprint:digest,sourceTraceabilityId:data.traceabilityId||`geography:${projectId}:${id}`}};
  const writes:Array<()=>void>=[];const transaction={get:async(r:any)=>{const snapshot=await raw.get(r as DocumentReference);return{exists:()=>snapshot.exists,data:()=>snapshot.data()};},set:(r:any,data:any,options?:any)=>writes.push(()=>options?raw.set(r,data,options):raw.set(r,data))};
  const prepared=await GeointEventOutboxService.prepareEventInTransaction(transaction,db,payload,(database,...segments)=>database.doc(segments.join('/')));const auditRef=db.doc(`audit_logs/${createHash('sha256').update('entity:'+prepared.fingerprint).digest('hex')}`);const audit=await transaction.get(auditRef);if(prepared.exists&&!audit.exists())throw new Error('GEOINT_ENTITY_LEGACY_RECONCILIATION_REQUIRED');
  GeointEventOutboxService.commitPreparedEventInTransaction(transaction,prepared,()=>FieldValue.serverTimestamp());
  if(input.operation==='DELETE'){raw.delete(ref);if(root)raw.delete(root);}else{raw.set(ref,data);if(root)raw.set(root,data);}
  if(!prepared.exists)raw.update(db.doc(`projects/${projectId}`),{institutionalSourceRevision:Number.isSafeInteger(metadata.institutionalSourceRevision)?metadata.institutionalSourceRevision+1:1});
  for(const write of writes)write();if(!audit.exists())raw.create(auditRef,{projectId,entityId:id,action:eventType,actorInstitutionalUserId:access.actor.institutionalUserId,user:access.actor.username,timestamp:now,source:'SERVER',eventId:prepared.eventId});
  return input.operation==='DELETE'?{deleted:true,id}:data;
 });
}
