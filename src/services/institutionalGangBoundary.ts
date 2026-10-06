import 'server-only';
import { randomUUID } from 'crypto';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { validAuthorizationId } from './institutionalAuthorizationProjectionService';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
export interface InstitutionalGangMutationOptions {
 requireExisting?: boolean;
 checkVersion?: boolean;
 expectedUpdatedAt?: number | null;
}
export async function mutateInstitutionalGang(session:unknown,input:{operation:'SAVE'|'DELETE';projectId:string;id?:string;data?:Record<string,any>;options?:InstitutionalGangMutationOptions},overrides:{authorize?:typeof authorizeInstitutionalProjectAccess;database?:typeof getInstitutionalAdminDb}={}) {
 if(!validAuthorizationId(input.projectId) || input.id!==undefined && !validAuthorizationId(input.id) || !['SAVE','DELETE'].includes(input.operation) || input.id?.startsWith('static-gang-'))throw new Error('GANG_INPUT_INVALID');
 if(input.operation==='SAVE' && (!input.data || input.data.projectId!==input.projectId || JSON.stringify(input.data).length>1000000))throw new Error('GANG_SOURCE_PROJECT_REQUIRED');
 const options=input.options;
 if(options && (options.requireExisting!==undefined && typeof options.requireExisting!=='boolean'
  || options.checkVersion!==undefined && typeof options.checkVersion!=='boolean'))throw new Error('PANDILLAS_OPTIONS_INVALID');
 if(input.operation==='SAVE' && (options?.requireExisting===true || options?.checkVersion===true) && !input.id)throw new Error('PANDILLAS_TARGET_ID_REQUIRED');
 if(options?.checkVersion===true && (!Object.prototype.hasOwnProperty.call(options,'expectedUpdatedAt')
  || options.expectedUpdatedAt!==null && (typeof options.expectedUpdatedAt!=='number' || !Number.isFinite(options.expectedUpdatedAt))))throw new Error('PANDILLAS_EXPECTED_VERSION_REQUIRED');
 const access=await (overrides.authorize||authorizeInstitutionalProjectAccess)({sessionToken:session,projectId:input.projectId,action:'WRITE'});
 if(!access.allowed)throw new Error('GANG_ACCESS_DENIED');
 const db=(overrides.database||getInstitutionalAdminDb)();const id=input.id||randomUUID();const operationId=randomUUID();
 await db.runTransaction(async tx=>{
  const parent=db.doc(`projects/${input.projectId}`),ref=db.doc(`pandillas/${id}`);const project=await tx.get(parent);const old=await tx.get(ref);
  if(!project.exists || project.data()?.deleted===true || project.data()?.estado==='ARCHIVADO' || project.data()?.status==='ARCHIVADO')throw new Error('GANG_PROJECT_UNAVAILABLE');
  if(old.exists && old.data()?.projectId!==input.projectId)throw new Error('GANG_CROSS_PROJECT');
  if(input.operation==='DELETE' && !old.exists)throw new Error('GANG_NOT_FOUND');
  const oldData=old.exists?old.data()!:{};
  if(input.operation==='SAVE') {
   if(options?.requireExisting===true && !old.exists)throw new Error('PANDILLAS_TARGET_NOT_FOUND');
   if(options?.checkVersion===true) {
    const actualUpdatedAt=Object.prototype.hasOwnProperty.call(oldData,'updatedAt')?oldData.updatedAt:null;
    if(actualUpdatedAt!==options.expectedUpdatedAt)throw new Error('PANDILLAS_VERSION_CONFLICT');
   }
  }
  const now=Date.now();
  if(input.operation==='SAVE') {
   const {id:ignored,createdBy:clientCreator,createdAt:clientTime,updatedBy:clientUpdater,...data}=input.data!;
   tx.set(ref,{...data,projectId:input.projectId,
    createdBy:Object.prototype.hasOwnProperty.call(oldData,'createdBy')?oldData.createdBy:access.actor.username,
    createdAt:Object.prototype.hasOwnProperty.call(oldData,'createdAt')?oldData.createdAt:now,
    updatedBy:access.actor.username,updatedAt:now});
  }else tx.delete(ref);
  tx.create(db.doc(`audit_logs/${operationId}`),{projectId:input.projectId,entityId:id,action:`GANG_${input.operation}`,actorInstitutionalUserId:access.actor.institutionalUserId,user:access.actor.username,timestamp:now,source:'SERVER'});
 });return id;
}
