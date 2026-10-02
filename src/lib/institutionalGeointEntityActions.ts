"use server";
import { cookies } from 'next/headers';
import { executeInstitutionalGeointEntity } from '@/services/institutionalGeointEntityBoundary';
export async function persistInstitutionalGeointEntity(input:Parameters<typeof executeInstitutionalGeointEntity>[1]){return executeInstitutionalGeointEntity(cookies().get('ceipol_session')?.value,input);}
