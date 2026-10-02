"use server";
import { cookies } from 'next/headers';
import { resolveInstitutionalSessionIdentity } from '@/services/institutionalSessionIdentityService';
import { renderInstitutionalChartOnServer } from '@/services/institutionalNodeVisualRenderer';
import type { CrimeIncidenceInstitutionalChartSpecification } from '@/utils/crimeIncidenceInstitutionalVisualProducer';
export async function materializeInstitutionalChartsServer(specifications: CrimeIncidenceInstitutionalChartSpecification[]) {
 await resolveInstitutionalSessionIdentity(cookies().get('ceipol_session')?.value);
 if (!Array.isArray(specifications) || specifications.length > 20 || JSON.stringify(specifications).length > 1000000 || specifications.some(spec => !['BAR','LINE'].includes(spec.chartType) || !Array.isArray(spec.data) || spec.data.length > 2000)) throw new Error('CHART_REQUEST_INVALID');
 const result=[];for(const spec of specifications)result.push(await renderInstitutionalChartOnServer(spec));return result;
}
