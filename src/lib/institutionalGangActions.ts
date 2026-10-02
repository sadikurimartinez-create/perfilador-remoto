"use server";
import { cookies } from 'next/headers';
import { readInstitutionalCollection } from './institutionalCollectionActions';
import { mutateInstitutionalGang } from '@/services/institutionalGangBoundary';
export async function saveInstitutionalGang(data:Record<string,any>){return mutateInstitutionalGang(cookies().get('ceipol_session')?.value,{operation:'SAVE',projectId:data.projectId,id:data.id,data});}
export async function deleteInstitutionalGang(id:string){const records=await readInstitutionalCollection('pandillas');const record=records.find(item=>item.id===id);if(!record)throw new Error('GANG_READ_ACCESS_REQUIRED');await mutateInstitutionalGang(cookies().get('ceipol_session')?.value,{operation:'DELETE',projectId:record.projectId,id});}
