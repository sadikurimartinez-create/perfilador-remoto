import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveInstitutionalSessionIdentity } from '@/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '@/services/institutionalProjectAccessService';
import { R4_INJECTION_PROJECT_ID } from '@/services/pandillasR4ImageInjectionPlan';
import R4ImageInjectionRunner from './runner';

export const dynamic = 'force-dynamic';
export default async function R4ImageInjectionPage() {
  const sessionToken = cookies().get('ceipol_session')?.value;
  try {
    const actor = await resolveInstitutionalSessionIdentity(sessionToken);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return <main>Acceso restringido.</main>;
    for (const action of ['READ', 'WRITE'] as const) {
      const grant = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: R4_INJECTION_PROJECT_ID, action });
      if (!grant.allowed || grant.actor.institutionalUserId !== actor.institutionalUserId) return <main>Acceso restringido.</main>;
    }
  } catch { redirect('/login'); }
  return <R4ImageInjectionRunner />;
}
