"use server";
import { cookies } from 'next/headers';
import { executeInstitutionalDenue } from '@/services/institutionalDenueBoundary';
export async function persistInstitutionalDenue(projectId:string,operation:'SAVE'|'REVIEW',input:any){return executeInstitutionalDenue(cookies().get('ceipol_session')?.value,projectId,operation,input);}
