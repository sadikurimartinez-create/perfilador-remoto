import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import type { Query } from 'firebase-admin/firestore';
import { resolveInstitutionalSessionIdentity } from '@/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '@/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { resolveMemberPrimaryPhoto } from '@/services/institutionalPandillasPhotoBoundary';
import { ProjectAccessError, type InstitutionalActor } from '@/types/institutionalProjectAccess';
import { parseR4InjectionBody, buildR4InjectionPlan, R4InjectionError, R4_INJECTION_PROJECT_ID } from '@/services/pandillasR4ImageInjectionPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Deliberately fixed in source: neither the body nor environment can enable LIVE.
const LIVE_EXECUTION_ENABLED = false;
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
const MAX_BODY_BYTES = 128 * 1024;
async function boundedBody(request: NextRequest) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new R4InjectionError('R4_JSON_REQUIRED', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new R4InjectionError('R4_INVALID_BODY');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new R4InjectionError('R4_BODY_TOO_LARGE', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof R4InjectionError) throw error;
    throw new R4InjectionError('R4_INVALID_BODY');
  } finally { reader.releaseLock(); }
}
async function access(sessionToken: unknown, actor: InstitutionalActor) {
  // A WRITE grant never substitutes for the explicit READ grant used by preflight.
  for (const action of ['WRITE', 'READ'] as const) {
    const grant = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: R4_INJECTION_PROJECT_ID, action });
    if (!grant.allowed) throw new ProjectAccessError(grant.code);
    if (grant.actor.institutionalUserId !== actor.institutionalUserId || !['ADMIN', 'SUPER_ADMIN'].includes(grant.actor.role)) throw new ProjectAccessError('PROJECT_ACCESS_DENIED');
  }
}
export async function POST(request: NextRequest) {
  const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  if (request.nextUrl.searchParams.size) return response({ error: 'R4_QUERY_NOT_ALLOWED', writesPerformed: 0 }, 400);
  if (request.headers.has('origin') && request.headers.get('origin') !== request.nextUrl.origin) return response({ error: 'FORBIDDEN', writesPerformed: 0 }, 403);
  try {
    const sessionToken = cookies().get('ceipol_session')?.value;
    const actor = await resolveInstitutionalSessionIdentity(sessionToken);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw new ProjectAccessError('PROJECT_ACCESS_DENIED');
    const body = parseR4InjectionBody(await boundedBody(request));
    await access(sessionToken, actor);
    if (body.mode === 'LIVE' && !LIVE_EXECUTION_ENABLED) throw new R4InjectionError('R4_LIVE_EXECUTION_NOT_ENABLED', 409);
    // No live executor exists in this phase, even beyond the fixed guard.
    if (body.mode !== 'DRY_RUN') throw new R4InjectionError('R4_LIVE_EXECUTION_NOT_ENABLED', 409);
    const projects = await readInstitutionalCollection('projects');
    const gangs = await readInstitutionalCollection('pandillas');
    const matching = projects.filter(project => (project.deleted === undefined || project.deleted === false)
      && project.estado !== 'ARCHIVADO' && project.status !== 'ARCHIVADO' && !project.lifecycleDeletionPending).filter(project => {
      const inventory = gangs.filter(gang => gang.projectId === project.id);
      return inventory.length === 25 && inventory.every(gang => Array.isArray(gang.integrantes))
        && inventory.reduce((sum, gang) => sum + gang.integrantes.length, 0) === 80;
    });
    if (matching.length !== 1 || matching[0].id !== body.projectId) throw new R4InjectionError('R4_PROJECT_RESOLUTION_CONFLICT', 409);
    const db = getInstitutionalAdminDb();
    const snapshot = await db.runTransaction(async tx => {
      const projectRef = db.collection('projects').doc(body.projectId);
      const project = (await tx.get(projectRef)).data();
      const rows = async (query: Query, max: number) => {
        const data = await tx.get(query.limit(max + 1));
        if (data.size > max) throw new R4InjectionError('R4_PREFLIGHT_CAPACITY_EXCEEDED', 503);
        return data.docs.map(doc => {
          const fields = doc.data();
          if (fields.id !== undefined && fields.id !== doc.id) throw new R4InjectionError('R4_PERSISTED_STATE_INVALID', 409);
          return { ...fields, id: doc.id };
        });
      };
      return { project, gangs: await rows(db.collection('pandillas').where('projectId', '==', body.projectId), 25),
        identities: await rows(projectRef.collection('pandillasMemberIdentities'), 1000),
        documents: await rows(projectRef.collection('documents'), 10000),
        associations: await rows(projectRef.collection('pandillasPhotoAssociations'), 1000),
        selections: await rows(projectRef.collection('pandillasPrimarySelections'), 1000) };
    }, { readOnly: true });
    const plan = await buildR4InjectionPlan(body, snapshot, { institutionalUserId: actor.institutionalUserId, username: actor.username });
    for (const check of plan.checks) {
      const current = await resolveMemberPrimaryPhoto(sessionToken, { projectId: body.projectId, gangId: check.gangId, memberIdentityId: check.memberIdentityId });
      if (!current || current.documentId !== check.documentId || current.derivedSha256 !== check.derivedSha256) throw new R4InjectionError('R4_PRIMARY_REREAD_CONFLICT', 409);
    }
    await access(sessionToken, actor);
    return response(plan.response, plan.response.ok ? 200 : 409);
  } catch (error) {
    if (error instanceof R4InjectionError) return response({ ok: false, error: error.code, writesPerformed: 0, liveExecutionEnabled: false }, error.status);
    const code = error instanceof ProjectAccessError ? error.code : null;
    const status = code === 'PROJECT_ACCESS_UNAUTHENTICATED' || code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND' ? 401
      : code && code !== 'PROJECT_ACCESS_UNAVAILABLE' ? 403 : 503;
    return response({ ok: false, error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'R4_PREFLIGHT_UNAVAILABLE',
      writesPerformed: 0, liveExecutionEnabled: false }, status);
  }
}
