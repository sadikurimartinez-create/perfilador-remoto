import 'server-only';
import { createHash } from 'crypto';
import { getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { canonicalSemanticValue } from '@/utils/institutionalDocumentSemanticIntegrity';
const retained=new Set(['reportPackages','reportCertifications','reportPublications','reportPackageInputs','reportPackageSystem','reportVisualAuthority']);
export interface ProjectPurgePlan { documents:Array<{path:string;fingerprint:string}>;objects:string[]; }
const fingerprint=(data:unknown)=>createHash('sha256').update(canonicalSemanticValue(data)).digest('hex');
export async function collectProjectPurgePlan(db:any,projectId:string):Promise<ProjectPurgePlan>{
 const documents:ProjectPurgePlan['documents']=[];const seen=new Set<string>();
 const append=(path:string,data:any)=>{if(!seen.has(path)){seen.add(path);documents.push({path,fingerprint:fingerprint(data)});if(documents.length>350)throw new Error('PROJECT_PURGE_CAPACITY_EXCEEDED');}};
 async function walk(ref:any,depth:number){if(depth>5)throw new Error('PROJECT_PURGE_DEPTH_EXCEEDED');for(const collection of await ref.listCollections()){if(ref.path===`projects/${projectId}` && retained.has(collection.id))continue;for(const doc of (await collection.limit(351).get()).docs){append(doc.ref.path,doc.data());await walk(doc.ref,depth+1);}}}
 await walk(db.doc(`projects/${projectId}`),0);
 for(const root of ['analyses','dossiers','pandillas','trash','geoint_temporal_comparisons','streetview_findings'])for(const field of ['projectId','expedienteId'])for(const doc of (await db.collection(root).where(field,'==',projectId).limit(351).get()).docs){append(`${root}/${doc.id}`,doc.data());await walk(doc.ref,1);}
 const [files]=await getInstitutionalAdminBucket().getFiles({prefix:`projects/${projectId}/`,autoPaginate:false,maxResults:501});
 if(files.length>500)throw new Error('PROJECT_PURGE_STORAGE_CAPACITY_EXCEEDED');
 const objects=files.map(file=>file.name).filter(path=>!path.startsWith(`projects/${projectId}/reports/`));
 return {documents:documents.sort((a,b)=>a.path.localeCompare(b.path)),objects:objects.sort()};
}
export async function executeProjectPurge(input:any,actor:any,db:any,digest:string,receiptId:string,deps:{now:()=>number;plan:()=>Promise<ProjectPurgePlan>;deleteObject:(path:string)=>Promise<void>;reauthorize:()=>Promise<void>}){
 const receipt=db.doc(`institutionalLifecycleOperations/${receiptId}`);const old=await receipt.get();if(old.exists){if(old.data().digest!==digest)throw new Error('LIFECYCLE_RETRY_CONFLICT');return old.data().result;}
 const intentRef=db.doc(`institutionalDeletionIntents/${receiptId}`);const previous=await intentRef.get();
 const plan:ProjectPurgePlan=previous.exists?previous.data().plan:await deps.plan();
 if(plan.documents.length>350 || plan.objects.length>500 || plan.documents.some(item=>(!item.path.startsWith(`projects/${input.projectId}/`) && !/^(analyses|dossiers|pandillas|trash|geoint_temporal_comparisons|streetview_findings)\/[^/]+$/.test(item.path)) || item.path.startsWith('audit_logs/') || [...retained].some(name=>item.path.startsWith(`projects/${input.projectId}/${name}/`)) || item.path.includes('/reports/') || /\\|(?:^|\/)\.\.(?:\/|$)/.test(item.path)) || plan.objects.some(path=>!path.startsWith(`projects/${input.projectId}/`) || path.startsWith(`projects/${input.projectId}/reports/`) || path.split('/').some(s=>!s||s==='.'||s==='..') || path.includes('\\')))throw new Error('PROJECT_PURGE_PLAN_INVALID');
 await db.runTransaction(async(tx:any)=>{
  const parent=db.doc(`projects/${input.projectId}`);const project=await tx.get(parent);const intent=await tx.get(intentRef);
  if(!project.exists)throw new Error('LIFECYCLE_PROJECT_NOT_FOUND');
  if(input.trashId){const trash=await tx.get(db.doc(`trash/${input.trashId}`));const data=trash.data();if(!data||data.projectId!==input.projectId||data.originalPath!==parent.path||data.originalId!==input.projectId||!Number.isSafeInteger(data.expiresAt)||deps.now()<data.expiresAt)throw new Error('LIFECYCLE_RETENTION_GATE');}
  else if(project.data().estado!=='ARCHIVADO'||!Number.isSafeInteger(project.data().archivedAt)||deps.now()<project.data().archivedAt+7*86400000)throw new Error('LIFECYCLE_RETENTION_GATE');
  if(intent.exists){if(intent.data().digest!==digest || fingerprint(intent.data().plan)!==fingerprint(plan))throw new Error('LIFECYCLE_RETRY_CONFLICT');return;}
  tx.create(intentRef,{digest,plan,projectId:input.projectId,status:'PENDING',actorInstitutionalUserId:actor.institutionalUserId,timestamp:deps.now()});
  tx.update(parent,{deleted:true,lifecycleDeletionPending:receiptId});
  tx.create(db.doc(`audit_logs/intent-${receiptId}`),{projectId:input.projectId,action:'PROJECT_PURGE_INTENT',actorInstitutionalUserId:actor.institutionalUserId,user:actor.username,timestamp:deps.now(),source:'SERVER'});
 });
 for(const path of plan.objects)await deps.deleteObject(path);
 await deps.reauthorize();
 const current=await deps.plan();if(fingerprint(current.documents)!==fingerprint(plan.documents)||current.objects.some(path=>!plan.objects.includes(path)))throw new Error('PROJECT_PURGE_SOURCE_CHANGED');
 return db.runTransaction(async(tx:any)=>{
  const prior=await tx.get(receipt);if(prior.exists){if(prior.data().digest!==digest)throw new Error('LIFECYCLE_RETRY_CONFLICT');return prior.data().result;}
  const refs=plan.documents.map(item=>db.doc(item.path));for(let i=0;i<refs.length;i++){const snapshot=await tx.get(refs[i]);if(!snapshot.exists||fingerprint(snapshot.data())!==plan.documents[i].fingerprint)throw new Error('PROJECT_PURGE_SOURCE_CHANGED');if(!refs[i].path.startsWith(`projects/${input.projectId}/`) && snapshot.data()?.projectId!==input.projectId && snapshot.data()?.expedienteId!==input.projectId)throw new Error('PROJECT_PURGE_CROSS_PROJECT');}
  const parent=db.doc(`projects/${input.projectId}`);const snapshot=await tx.get(parent);if(snapshot.data()?.lifecycleDeletionPending!==receiptId)throw new Error('PROJECT_PURGE_SOURCE_CHANGED');
  const intent=await tx.get(intentRef);if(intent.data()?.digest!==digest)throw new Error('LIFECYCLE_RETRY_CONFLICT');
  const result={projectId:input.projectId,entityId:input.projectId,kind:'PROJECT',operation:'PURGE',operationId:input.operationId,status:'COMPLETED',retainedImmutableHistory:true};
  for(const ref of refs)tx.delete(ref);
  // Retain only the inaccessible institutional tombstone and immutable report history.
  tx.set(parent,{deleted:true,estado:'PURGED',purgedAt:deps.now(),purgedByInstitutionalUserId:actor.institutionalUserId,numeroExpediente:snapshot.data()?.numeroExpediente||null,ceipolId:snapshot.data()?.ceipolId||null});
  tx.create(db.doc(`audit_logs/${receiptId}`),{projectId:input.projectId,action:'PROJECT_PURGED',actorInstitutionalUserId:actor.institutionalUserId,user:actor.username,timestamp:deps.now(),source:'SERVER',deletedDocumentCount:refs.length,deletedObjectCount:plan.objects.length,retainedImmutableHistory:true});
  tx.update(intentRef,{status:'COMPLETED',completedAt:deps.now()});tx.create(receipt,{digest,request:input,projectId:input.projectId,actorInstitutionalUserId:actor.institutionalUserId,result});return result;
 });
}
