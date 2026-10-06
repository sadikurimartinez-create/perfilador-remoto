import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import type { Query } from 'firebase-admin/firestore';
import { resolveInstitutionalSessionIdentity } from '@/services/institutionalSessionIdentityService';
import { authorizeInstitutionalProjectAccess } from '@/services/institutionalProjectAccessService';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { resolveMemberPrimaryPhoto } from '@/services/institutionalPandillasPhotoBoundary';
import { verifyPandillasStoredPhotoFile } from '@/services/institutionalPandillasPhotoAssetService';
import { executeR4Live, verifyR4LiveFinal, R4LiveExecutionError } from '@/services/pandillasR4LiveExecutor';
import { ProjectAccessError, type InstitutionalActor } from '@/types/institutionalProjectAccess';
import { parseR4InjectionBody, buildR4InjectionPlan, R4InjectionError, R4_INJECTION_PROJECT_ID, type R4PlanSnapshot } from '@/services/pandillasR4ImageInjectionPlan';
import { parseR4ReadinessMultipart, parseR4ReadinessBatchRequest, verifyR4HumanApproval, validateR4ReadinessBytes,
  r4LivePreconditionFingerprint, createR4ReadinessReceipt, verifyR4ReadinessReceipt, verifyR4ReadinessBatch,
  type R4ReadinessRequest } from '@/services/pandillasR4LiveReadiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;
// LIVE requires certified multipart bytes and a fresh actor-bound readiness receipt.
const LIVE_EXECUTION_ENABLED = true;
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
    await access(sessionToken, actor);
    let readiness: R4ReadinessRequest | undefined;
    let body;
    if (request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      readiness = await parseR4ReadinessMultipart(request, LIVE_EXECUTION_ENABLED); body = readiness.body;
    } else {
      const value = await boundedBody(request);
      if (value?.mode === 'VERIFY') {
        if (Object.keys(value).some(key => !['mode', 'projectId'].includes(key)) || value.projectId !== R4_INJECTION_PROJECT_ID) throw new R4InjectionError('R4_INVALID_BODY');
        const result = await verifyR4LiveFinal(sessionToken, actor);
        await access(sessionToken, actor);
        return response(result);
      }
      if (value?.mode === 'READINESS') { readiness = parseR4ReadinessBatchRequest(value); body = readiness.body; }
      else body = parseR4InjectionBody(value);
    }
    if (body.mode === 'LIVE' && !readiness?.files) throw new R4InjectionError('R4_LIVE_SINGLE_MULTIPART_REQUIRED', 400);
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
    const snapshot: R4PlanSnapshot = await db.runTransaction(async tx => {
      const projectRef = db.collection('projects').doc(body.projectId);
      const projectSnapshot = await tx.get(projectRef);
      const version = (doc: { updateTime?: { seconds: number; nanoseconds: number } }) => doc.updateTime
        ? [doc.updateTime.seconds, doc.updateTime.nanoseconds] : null;
      const project = projectSnapshot.exists === false ? undefined : { ...projectSnapshot.data(), _r4ReadVersion: version(projectSnapshot) };
      const rows = async (query: Query, max: number) => {
        const data = await tx.get(query.limit(max + 1));
        if (data.size > max) throw new R4InjectionError('R4_PREFLIGHT_CAPACITY_EXCEEDED', 503);
        return data.docs.map(doc => {
          const fields = doc.data();
          if (fields.id !== undefined && fields.id !== doc.id) throw new R4InjectionError('R4_PERSISTED_STATE_INVALID', 409);
          return { ...fields, id: doc.id, _r4ReadVersion: version(doc) };
        });
      };
      return { project, gangs: await rows(db.collection('pandillas').where('projectId', '==', body.projectId), 25),
        identities: await rows(projectRef.collection('pandillasMemberIdentities'), 1000),
        documents: await rows(projectRef.collection('documents'), 10000),
        associations: await rows(projectRef.collection('pandillasPhotoAssociations'), 1000),
        selections: await rows(projectRef.collection('pandillasPrimarySelections'), 1000) };
    }, { readOnly: true });
    if (body.mode === 'LIVE') {
      return response(await executeR4Live(sessionToken, actor, body, snapshot, readiness!.files!, readiness!.previousReceipt));
    }
    if (readiness?.previousReceipt) verifyR4ReadinessReceipt(readiness.previousReceipt, actor.institutionalUserId, snapshot);
    const byteProof = readiness?.files ? await validateR4ReadinessBytes(body.items[0], readiness.files.original, readiness.files.derived) : null;
    const batchProof = readiness?.receipts ? verifyR4ReadinessBatch(readiness.receipts, actor.institutionalUserId, snapshot) : null;
    const plan = await buildR4InjectionPlan(body, snapshot, { institutionalUserId: actor.institutionalUserId, username: actor.username },
      readiness ? { humanApprovalVerified: item => !!verifyR4HumanApproval(item) } : undefined);
    for (const check of plan.checks) {
      const current = await resolveMemberPrimaryPhoto(sessionToken, { projectId: body.projectId, gangId: check.gangId, memberIdentityId: check.memberIdentityId });
      if (!current || current.documentId !== check.documentId || current.derivedSha256 !== check.derivedSha256) throw new R4InjectionError('R4_PRIMARY_REREAD_CONFLICT', 409);
    }
    await access(sessionToken, actor);
    if (readiness) {
      let storageAvailable = false;
      let existingAssetsReadBack = 0;
      try {
        const bucket = getInstitutionalAdminBucket(); await bucket.getMetadata();
        for (const planned of plan.response.items.filter(item => item.status === 'READY' && item.actions.includes('REUSE_ASSET'))) {
          const input = body.items.find(item => item.gangName === planned.gangName && item.memberName === planned.memberName)!;
          const asset = snapshot.documents.find(doc => doc.photoAsset?.original.sha256 === input.originalSha256)?.photoAsset;
          if (!asset?.derived) throw new Error('R4_READBACK_UNAVAILABLE');
          await verifyPandillasStoredPhotoFile(bucket, asset.original); await verifyPandillasStoredPhotoFile(bucket, asset.derived);
          existingAssetsReadBack++;
        }
        storageAvailable = true;
      } catch { /* no upload, overwrite, delete or secret details */ }
      await access(sessionToken, actor);
      const ready = plan.response.ok && storageAvailable;
      return response({ ...plan.response, mode: 'READINESS', readinessForLive: ready && !!batchProof,
        itemReadinessForLive: ready && !!byteProof, batchComplete: !!batchProof, bytesValidated: batchProof?.bytesValidated ?? (byteProof ? 1 : 0),
        realBytesReady: !!(byteProof || batchProof), hashValidationReady: !!(byteProof || batchProof),
        mimeDecodeValidationReady: !!(byteProof || batchProof), humanApprovalVerified: true,
        approvalVersion: byteProof?.approvalVersion ?? batchProof?.approvalVersion,
        approvalDigest: byteProof?.approvalDigest ?? batchProof?.approvalDigest,
        livePreconditionReady: true, livePreconditionFingerprint: r4LivePreconditionFingerprint(snapshot),
        storageReadbackReady: storageAvailable, storageReadbackPerformed: existingAssetsReadBack > 0, existingAssetsReadBack,
        idempotentResumeReady: plan.response.ok, executable: false, liveExecutionEnabled: LIVE_EXECUTION_ENABLED, writesPerformed: 0,
        readinessReceipt: ready && byteProof ? createR4ReadinessReceipt(body.items[0], actor.institutionalUserId, snapshot) : null,
        // Readback is enforced by the existing uploader, after each future upload.
        deferredValidations: ['LIVE_AUTHORIZATION_AND_VERSION_RECHECK', 'POST_UPLOAD_STORAGE_READBACK'],
        items: plan.response.items.map(item => ({ ...item, humanApprovalVerified: item.status === 'READY',
          requiresHumanApproval: false, reviewImportRequiredBeforePrimary: item.actions.includes('CREATE_ASSET') || item.actions.includes('CREATE_PRIMARY') })) },
        ready ? 200 : 409);
    }
    return response(plan.response, plan.response.ok ? 200 : 409);
  } catch (error) {
    if (error instanceof R4LiveExecutionError) return response({ ok: false, error: error.code, status: 'FAILED',
      writesPerformed: error.writesPerformed, completedStages: error.completedStages, partialWritesPossible: true, liveExecutionEnabled: true }, error.status);
    if (error instanceof R4InjectionError) return response({ ok: false, error: error.code, writesPerformed: 0, liveExecutionEnabled: false }, error.status);
    const code = error instanceof ProjectAccessError ? error.code : null;
    const status = code === 'PROJECT_ACCESS_UNAUTHENTICATED' || code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND' ? 401
      : code && code !== 'PROJECT_ACCESS_UNAVAILABLE' ? 403 : 503;
    return response({ ok: false, error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'R4_PREFLIGHT_UNAVAILABLE',
      writesPerformed: 0, liveExecutionEnabled: false }, status);
  }
}
