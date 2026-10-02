"use server";
import { cookies } from 'next/headers';
import { executeInstitutionalSweep } from '@/services/geoint/institutionalSweepBoundary';
export async function persistInstitutionalSweep(projectId:string,operation:'REGISTER'|'UPDATE',proposal:any){return executeInstitutionalSweep(cookies().get('ceipol_session')?.value,projectId,operation,proposal);}
