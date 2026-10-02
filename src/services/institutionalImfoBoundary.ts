import 'server-only';
import { randomUUID } from 'crypto';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { resolveInstitutionalSessionIdentity } from './institutionalSessionIdentityService';
import { validAuthorizationId } from './institutionalAuthorizationProjectionService';
// IMFO is a global institutional source catalogue, never project/evidence authority.
export async function executeInstitutionalImfo(session:unknown,operation:'READ'|'UPDATE'|'AUTHORIZE'|'DELETE'|'DISCOVER'|'LEARNING',input:any={},overrides:{identity?:typeof resolveInstitutionalSessionIdentity;database?:typeof getInstitutionalAdminDb}={}){
 const actor=await (overrides.identity||resolveInstitutionalSessionIdentity)(session);
 if(!['READ','UPDATE','AUTHORIZE','DELETE','DISCOVER','LEARNING'].includes(operation))throw new Error('IMFO_OPERATION_INVALID');
 if(['UPDATE','DELETE'].includes(operation)&&!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw new Error('IMFO_ADMIN_REQUIRED');
 if(operation==='AUTHORIZE'&&actor.role!=='SUPER_ADMIN')throw new Error('IMFO_SUPER_ADMIN_REQUIRED');
 if(operation!=='READ'&&(!validAuthorizationId(input.id)||JSON.stringify(input).length>100000))throw new Error('IMFO_INPUT_INVALID');
 const db=(overrides.database||getInstitutionalAdminDb)();
 if(operation==='READ'){const snapshot=await db.collection('imfo_sources').limit(500).get();return snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));}
 return db.runTransaction(async tx=>{
  const ref=db.doc(`imfo_sources/${input.id}`);const current=await tx.get(ref);const old=current.data();const now=new Date().toISOString();
  if(operation==='DISCOVER'&&current.exists)return;
  if(!['DISCOVER','UPDATE'].includes(operation)&&!current.exists)throw new Error('IMFO_SOURCE_NOT_FOUND');
  if(operation==='DELETE')tx.delete(ref);
  else if(operation==='AUTHORIZE')tx.update(ref,{operationalStatus:'Activa',lastValidationDate:now.slice(0,10),authorizedBy:actor.institutionalUserId});
  else if(operation==='LEARNING'){
   if(!Number.isFinite(input.responseTimeMs)||input.responseTimeMs<0||!Number.isSafeInteger(input.resultCount)||input.resultCount<0||typeof input.success!=='boolean')throw new Error('IMFO_LEARNING_INVALID');
   const useCount=Number(old!.useCount||0)+1,currentAvgTime=Number(old!.avgResponseTimeMs||0),newAvgTime=Math.round((currentAvgTime*(useCount-1)+input.responseTimeMs)/useCount);
   const precisionScore=Number(old!.precisionScore||80),countBonus=Math.min(25,input.resultCount*2);
   const newPrecision=input.success?Math.min(100,Math.round((precisionScore*4+precisionScore+countBonus)/5)):Math.max(20,precisionScore-15);
   const utilityIndex=Math.min(99,Math.round((input.success?40:0)+(newPrecision*0.4)+(Math.max(0,100-(newAvgTime/150))*0.2)));
   if(![useCount,newAvgTime,newPrecision,utilityIndex].every(Number.isFinite))throw new Error('IMFO_METRICS_INVALID');
   tx.create(db.doc(`learning_logs/${randomUUID()}`),{sourceId:input.id,sourceName:old!.name||'',timestamp:now,responseTimeMs:input.responseTimeMs,success:input.success,resultCount:input.resultCount,feedback:['Util','No Util','Neutro'].includes(input.feedback)?input.feedback:'Neutro',actorInstitutionalUserId:actor.institutionalUserId,source:'CLIENT_REPORTED_OBSERVATION'});
   tx.update(ref,{useCount,avgResponseTimeMs:newAvgTime,precisionScore:newPrecision,utilityIndex});
  }else{
   const data={...input.data,id:input.id};delete data.authorizedBy;delete data.updatedBy;
   if(operation==='DISCOVER')data.operationalStatus='Pendiente Autorización';
   if(operation==='UPDATE'&&data.operationalStatus==='Activa'&&old?.operationalStatus!=='Activa')throw new Error('IMFO_EXPLICIT_AUTHORIZATION_REQUIRED');
   tx.set(ref,{...old,...data,updatedBy:actor.institutionalUserId,updatedAt:now});
  }
  tx.create(db.doc(`audit_logs/${randomUUID()}`),{action:`IMFO_${operation}`,entityId:input.id,actorInstitutionalUserId:actor.institutionalUserId,user:actor.username,timestamp:now,source:'SERVER'});
 });
}
