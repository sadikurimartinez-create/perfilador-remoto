import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { resolveInstitutionalSessionIdentity } from '@/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '@/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';
import { pandillasR4CertifiedTargets } from '@/services/pandillasR4CertifiedTargets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
const validText = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
function denied(code: ProjectAccessError['code']): never { throw new ProjectAccessError(code); }

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size) return NextResponse.json({ error: 'QUERY_NOT_ALLOWED' }, { status: 400, headers });
  try {
    const sessionToken = cookies().get('ceipol_session')?.value;
    const actor = await resolveInstitutionalSessionIdentity(sessionToken);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) denied('PROJECT_ACCESS_DENIED');
    // Existing collection reader scopes every candidate to explicit active READ grants.
    const projects = await readInstitutionalCollection('projects');
    const gangs = await readInstitutionalCollection('pandillas');
    const candidates = projects.filter(project => project.deleted !== true && project.estado !== 'ARCHIVADO'
      && project.status !== 'ARCHIVADO' && gangs.some(gang => gang.projectId === project.id));
    const summaries = [];
    for (const project of candidates) {
      const grant = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: project.id, action: 'READ' });
      if (!grant.allowed) denied(grant.code);
      if (grant.actor.institutionalUserId !== actor.institutionalUserId || !['ADMIN', 'SUPER_ADMIN'].includes(grant.actor.role)) denied('PROJECT_ACCESS_DENIED');
      const inventory = gangs.filter(gang => gang.projectId === project.id);
      if (!validText(project.id) || inventory.some(gang => !validText(gang.nombre) || !Array.isArray(gang.integrantes)
        || gang.integrantes.some((member: any) => !validText(member?.nombre)))) throw new Error('INVALID_INVENTORY');
      summaries.push({ projectId: project.id as string, projectName: validText(project.nombre) ? project.nombre : null,
        gangCount: inventory.length, memberCount: inventory.reduce((sum, gang) => sum + gang.integrantes.length, 0) });
    }
    const db = getInstitutionalAdminDb();
    let storageAvailable = false;
    try { await getInstitutionalAdminBucket().getMetadata(); storageAvailable = true; } catch { /* sanitized availability only */ }
    const matches = summaries.filter(project => project.gangCount === 25 && project.memberCount === 80);
    const selected = matches.length === 1 ? matches[0] : null;
    const result = { ok: false, readOnly: true, firebaseAdminAvailable: true, serverSideFirestoreRead: projects.length > 0,
      serverSideStorageAvailable: storageAvailable, targetProjectResolved: !!selected, targetProjectId: selected?.projectId ?? null,
      projectCandidates: summaries.length, candidates: summaries, matchingProjects: matches.length,
      resolutionScope: 'AUTHORIZED_READ_PROJECTS',
      liveGangs: selected?.gangCount ?? null, liveMembers: selected?.memberCount ?? null,
      targetMembers: pandillasR4CertifiedTargets.length, matchedTargetMembers: 0,
      unmatchedTargetMembers: selected ? 0 : null, unmatchedTargets: [] as { documentaryId: string; reason: string }[],
      existingIdentities: null as number | null, existingAssociations: null as number | null,
      existingPrimarySelections: null as number | null, existingPhotoAssets: null as number | null,
      yordiExcludedFromImageInjection: true, writesPerformed: 0 };
    if (selected) {
      const inventory = gangs.filter(gang => gang.projectId === selected.projectId);
      for (const target of pandillasR4CertifiedTargets) {
        const matchingGangs = inventory.filter(gang => normalize(gang.nombre) === normalize(target.gangName));
        const members = matchingGangs.length === 1 ? matchingGangs[0].integrantes.filter((member: any) =>
          normalize(member.nombre) === normalize(target.memberName)) : [];
        if (members.length === 1) result.matchedTargetMembers++;
        else result.unmatchedTargets.push({ documentaryId: target.documentaryId, reason: matchingGangs.length !== 1
          ? 'GANG_MISSING_OR_AMBIGUOUS' : members.length ? 'MEMBER_AMBIGUOUS' : 'MEMBER_MISSING' });
      }
      result.unmatchedTargetMembers = result.unmatchedTargets.length;
      const project = db.collection('projects').doc(selected.projectId);
      const counts = await Promise.all(['pandillasMemberIdentities', 'pandillasPhotoAssociations', 'pandillasPrimarySelections']
        .map(async name => (await project.collection(name).count().get()).data().count));
      // Projection avoids reading document bodies; a bound prevents unbounded audit scans.
      const documents = await project.collection('documents').select('photoAsset').limit(10001).get();
      if (documents.size > 10000) throw new Error('CAPACITY_EXCEEDED');
      [result.existingIdentities, result.existingAssociations, result.existingPrimarySelections] = counts;
      result.existingPhotoAssets = documents.docs.filter(doc => doc.data().photoAsset != null).length;
      result.ok = result.unmatchedTargetMembers === 0 && storageAvailable;
    }
    // Recheck every disclosed candidate, including ambiguous/unresolved responses.
    for (const candidate of summaries) {
      const finalGrant = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: candidate.projectId, action: 'READ' });
      if (!finalGrant.allowed) denied(finalGrant.code);
      if (finalGrant.actor.institutionalUserId !== actor.institutionalUserId || !['ADMIN', 'SUPER_ADMIN'].includes(finalGrant.actor.role)) denied('PROJECT_ACCESS_DENIED');
    }
    return NextResponse.json(result, { status: storageAvailable ? 200 : 503, headers });
  } catch (error) {
    const code = error instanceof ProjectAccessError ? error.code : null;
    const status = code === 'PROJECT_ACCESS_UNAUTHENTICATED' || code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND' ? 401
      : code && code !== 'PROJECT_ACCESS_UNAVAILABLE' ? 403 : 503;
    return NextResponse.json({ ok: false, readOnly: true, error: status === 401 ? 'UNAUTHENTICATED'
      : status === 403 ? 'FORBIDDEN' : 'PROJECT_RESOLUTION_UNAVAILABLE', writesPerformed: 0 }, { status, headers });
  }
}
