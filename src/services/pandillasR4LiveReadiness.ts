import 'server-only';
import { createHash } from 'crypto';
import { signSession, verifySession } from '@/utils/authCrypto';
import { reviewVersion, type EvidenceReviewRequest } from '@/utils/institutionalEvidenceReview';
import { validatePhotoAsset } from '@/modules/pandillas/photo-evidence/association';
import { validatePandillasPhotoBytes } from './institutionalPandillasPhotoAssetService';
import { R4_APPROVAL_DIGEST, R4_APPROVAL_VERSION, r4HumanApprovals } from './pandillasR4HumanApprovalBatch';
import { R4InjectionError, R4_INJECTION_PROJECT_ID, parseR4InjectionBody, type R4InjectionItem, type R4PlanSnapshot } from './pandillasR4ImageInjectionPlan';

function fail(code: string, status = 409): never { throw new R4InjectionError(code, status); }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const metadataKeys = ['gangName', 'memberName', 'memberIdentityRequired', 'sourceDocumentId', 'sourceDocumentName', 'sourceDocumentSha256',
  'sourcePage', 'sourceImageId', 'originalFileName', 'derivedFileName', 'originalSha256', 'derivedSha256', 'mimeType', 'derivedMimeType',
  'recipeVersion', 'selectionType', 'associationLevel'] as const;
export function verifyR4HumanApproval(item: R4InjectionItem) {
  if (r4HumanApprovals.length !== 79 || digest(JSON.stringify(r4HumanApprovals)) !== R4_APPROVAL_DIGEST) fail('R4_APPROVAL_BATCH_INTEGRITY');
  const matches = r4HumanApprovals.filter(row => row.gangName === item.gangName && row.memberName === item.memberName);
  if (matches.length !== 1) fail('R4_HUMAN_APPROVAL_MISSING');
  const approval = matches[0];
  if (metadataKeys.some(key => approval[key] !== item[key]) || !approval.reviewedBy || !approval.reviewedAt
    || !['APPROVE_PRIMARY', 'SELECT_PRIMARY'].includes(approval.decision)) fail('R4_HUMAN_APPROVAL_BINDING_MISMATCH');
  return approval;
}
function canonical(value: any): any {
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return { r4Number: String(value), negativeZero: Object.is(value, -0) };
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.path === 'string' && value.firestore) return { r4DocumentReference: value.path };
  if (typeof value.toJSON === 'function') return canonical(value.toJSON());
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
}
export function r4LivePreconditionFingerprint(snapshot: R4PlanSnapshot) {
  const records = (rows: any[]) => rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).map(canonical);
  return digest(JSON.stringify({ domain: 'R4_LIVE_PRECONDITION_V1', projectId: R4_INJECTION_PROJECT_ID, approvalDigest: R4_APPROVAL_DIGEST,
    project: canonical(snapshot.project), gangs: records(snapshot.gangs), identities: records(snapshot.identities),
    documents: records(snapshot.documents), associations: records(snapshot.associations), selections: records(snapshot.selections) }));
}
export function assertR4LivePrecondition(expected: string, snapshot: R4PlanSnapshot) {
  if (!/^[a-f0-9]{64}$/.test(expected) || expected !== r4LivePreconditionFingerprint(snapshot)) fail('R4_LIVE_PRECONDITION_CHANGED');
}
type Receipt = { purpose: 'R4_READINESS_V1'; actorId: string; projectId: string; approvalDigest: string; approvalVersion: string;
  documentaryId: string; originalSha256: string; derivedSha256: string; fingerprint: string; createdAt: number };
export function createR4ReadinessReceipt(item: R4InjectionItem, actorId: string, snapshot: R4PlanSnapshot) {
  const approval = verifyR4HumanApproval(item);
  // No username/id session claims: this attestation cannot act as a login session.
  return signSession({ purpose: 'R4_READINESS_V1', actorId, projectId: R4_INJECTION_PROJECT_ID, approvalDigest: R4_APPROVAL_DIGEST,
    approvalVersion: R4_APPROVAL_VERSION, documentaryId: approval.documentaryId,
    originalSha256: item.originalSha256, derivedSha256: item.derivedSha256, fingerprint: r4LivePreconditionFingerprint(snapshot) });
}
export function verifyR4ReadinessReceipt(token: unknown, actorId: string, snapshot: R4PlanSnapshot): Receipt {
  if (typeof token !== 'string' || token.length > 4096) fail('R4_READINESS_RECEIPT_INVALID');
  const receipt = verifySession(token as string) as Receipt | null;
  if (!receipt || receipt.purpose !== 'R4_READINESS_V1' || receipt.actorId !== actorId || receipt.projectId !== R4_INJECTION_PROJECT_ID
    || receipt.approvalDigest !== R4_APPROVAL_DIGEST || receipt.approvalVersion !== R4_APPROVAL_VERSION
    || !Number.isFinite(receipt.createdAt) || Date.now() < receipt.createdAt || Date.now() - receipt.createdAt > 15 * 60 * 1000) fail('R4_READINESS_RECEIPT_INVALID');
  const approval = r4HumanApprovals.find(row => row.documentaryId === receipt!.documentaryId);
  if (!approval || approval.originalSha256 !== receipt!.originalSha256 || approval.derivedSha256 !== receipt!.derivedSha256) fail('R4_READINESS_RECEIPT_INVALID');
  assertR4LivePrecondition(receipt!.fingerprint, snapshot); return receipt!;
}
export function verifyR4ReadinessBatch(receipts: unknown, actorId: string, snapshot: R4PlanSnapshot) {
  if (!Array.isArray(receipts) || receipts.length !== 79) fail('R4_READINESS_BATCH_INCOMPLETE');
  const checked = receipts.map(token => verifyR4ReadinessReceipt(token, actorId, snapshot));
  if (new Set(checked.map(receipt => receipt.documentaryId)).size !== 79) fail('R4_READINESS_BATCH_DUPLICATE');
  return { bytesValidated: 79, humanApprovalVerified: true, approvalVersion: R4_APPROVAL_VERSION, approvalDigest: R4_APPROVAL_DIGEST,
    livePreconditionFingerprint: r4LivePreconditionFingerprint(snapshot) };
}
export async function validateR4ReadinessBytes(item: R4InjectionItem, original: Uint8Array, derived: Uint8Array) {
  const approval = verifyR4HumanApproval(item);
  try {
    const o = await validatePandillasPhotoBytes({ bytes: original, mimeType: item.mimeType, sha256: item.originalSha256 }, false);
    const d = await validatePandillasPhotoBytes({ bytes: derived, mimeType: item.derivedMimeType, sha256: item.derivedSha256 }, true);
    if (o.size !== approval.originalSize || o.width !== approval.originalWidth || o.height !== approval.originalHeight
      || d.size !== approval.derivedSize || d.width !== approval.derivedWidth || d.height !== approval.derivedHeight) fail('R4_CERTIFIED_DIMENSIONS_MISMATCH');
    return { realBytesReady: true, hashValidationReady: true, mimeDecodeValidationReady: true, humanApprovalVerified: true,
      documentaryId: approval.documentaryId, approvalVersion: R4_APPROVAL_VERSION, approvalDigest: R4_APPROVAL_DIGEST };
  } catch (error) {
    if (error instanceof R4InjectionError) throw error;
    const allowed = ['R4_FILE_LIMIT', 'R4_MIME_MISMATCH', 'R4_IMAGE_INVALID', 'R4_IMAGE_DECODE_FAILED', 'R4_HASH_MISMATCH'];
    fail(error instanceof Error && allowed.includes(error.message) ? error.message : 'R4_BYTES_INVALID', 400);
  }
}
/** Prepared for the existing institutional review boundary AFTER verified upload.
 * Importing the certified decision is not another selection; this function writes nothing. */
export function prepareCertifiedR4ReviewRequest(item: R4InjectionItem, document: any): EvidenceReviewRequest | null {
  const approval = verifyR4HumanApproval(item);
  if (!document || document.projectId !== R4_INJECTION_PROJECT_ID || document.expedienteId !== R4_INJECTION_PROJECT_ID
    || document.deleted || document.lifecycleDeletionPending) fail('R4_REVIEW_DOCUMENT_INVALID');
  try { validatePhotoAsset(document.photoAsset, R4_INJECTION_PROJECT_ID, document.id); } catch { fail('R4_REVIEW_DOCUMENT_INVALID'); }
  const asset = document.photoAsset;
  if (asset.sourceDocumentId !== item.sourceDocumentId || asset.sourceDocumentName !== item.sourceDocumentName
    || asset.sourceDocumentSha256 !== item.sourceDocumentSha256 || asset.sourcePage !== item.sourcePage || asset.sourceImageId !== item.sourceImageId
    || asset.original.sha256 !== item.originalSha256 || asset.derived?.sha256 !== item.derivedSha256
    || asset.original.mimeType !== item.mimeType || asset.derived?.mimeType !== item.derivedMimeType || asset.derived?.recipeVersion !== item.recipeVersion
    || asset.original.size !== approval.originalSize || asset.derived?.size !== approval.derivedSize
    || asset.original.width !== approval.originalWidth || asset.original.height !== approval.originalHeight
    || asset.derived?.width !== approval.derivedWidth || asset.derived?.height !== approval.derivedHeight
    || document.multimodalEvidence?.documentId !== document.id || document.multimodalEvidence?.expedienteId !== R4_INJECTION_PROJECT_ID
    || document.multimodalEvidence?.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH'
    || document.multimodalEvidence?.forensicIntegrity?.rawSha256 !== item.originalSha256) fail('R4_REVIEW_DOCUMENT_INVALID');
  if (document.multimodalEvidence.humanValidationStatus === 'APPROVED') return null;
  if (document.multimodalEvidence.humanValidationStatus !== 'PENDING_REVIEW') fail('R4_REVIEW_STATE_CONFLICT');
  return { source: 'DOCUMENT_PHOTO', id: document.id, projectId: R4_INJECTION_PROJECT_ID, action: 'APPROVE',
    expectedReview: reviewVersion(document), comment: `Import certified decision ${R4_APPROVAL_VERSION}; digest ${R4_APPROVAL_DIGEST}; ${approval.documentaryId}; original reviewer ${approval.reviewedBy}; original review ${approval.reviewedAt}` };
}
export type R4ReadinessRequest = { body: ReturnType<typeof parseR4InjectionBody>; files?: { original: Uint8Array; derived: Uint8Array };
  receipts?: string[]; previousReceipt?: string };
export async function parseR4ReadinessMultipart(request: Request): Promise<R4ReadinessRequest> {
  // Per-member envelope, bounded below common server request limits. No local paths.
  const reader = request.body?.getReader(); if (!reader) fail('R4_MULTIPART_REQUIRED', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
    if (size > 4 * 1024 * 1024) { await reader.cancel(); fail('R4_MULTIPART_TOO_LARGE', 413); } chunks.push(chunk.value); }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Request(request.url, { method: 'POST', headers: request.headers,
    body: new Uint8Array(Buffer.concat(chunks)).buffer }).formData(); } catch { return fail('R4_INVALID_MULTIPART', 400); }
  if (Array.from(form.keys()).some(key => !['metadata', 'original', 'derived'].includes(key))
    || ['metadata', 'original', 'derived'].some(key => form.getAll(key).length !== 1)) fail('R4_INVALID_MULTIPART', 400);
  const metadata = form.get('metadata'); if (typeof metadata !== 'string' || Buffer.byteLength(metadata) > 128 * 1024) fail('R4_INVALID_BODY', 400);
  let value: any; try { value = JSON.parse(metadata as string); } catch { return fail('R4_INVALID_BODY', 400); }
  if (value?.mode === 'LIVE') fail('R4_LIVE_EXECUTION_NOT_ENABLED');
  if (value?.mode !== 'READINESS') fail('R4_INVALID_MODE', 400);
  const previousReceipt = value.previousReceipt; delete value.previousReceipt;
  if (previousReceipt !== undefined && typeof previousReceipt !== 'string') fail('R4_READINESS_RECEIPT_INVALID', 400);
  const body = parseR4InjectionBody({ ...value, mode: 'DRY_RUN' });
  if (body.batchLabel !== 'R4_PRIMARY_IMAGE_INJECTION_V1' || body.items.length !== 1) fail('R4_READINESS_SINGLE_ITEM_REQUIRED', 400);
  const item = body.items[0]; verifyR4HumanApproval(item);
  const original = form.get('original'), derived = form.get('derived');
  if (!original || typeof original === 'string' || !derived || typeof derived === 'string'
    || original.name !== item.originalFileName || derived.name !== item.derivedFileName || original.type !== item.mimeType
    || derived.type !== item.derivedMimeType) fail('R4_MULTIPART_FILE_MISMATCH', 400);
  return { body, previousReceipt, files: { original: new Uint8Array(await (original as File).arrayBuffer()), derived: new Uint8Array(await (derived as File).arrayBuffer()) } };
}
export function parseR4ReadinessBatchRequest(value: any): R4ReadinessRequest {
  if (!value || Object.keys(value).some(key => !['mode', 'projectId', 'batchLabel', 'receipts'].includes(key))
    || value.mode !== 'READINESS' || value.projectId !== R4_INJECTION_PROJECT_ID
    || value.batchLabel !== 'R4_PRIMARY_IMAGE_INJECTION_V1' || !Array.isArray(value.receipts)) fail('R4_INVALID_BODY', 400);
  const body = parseR4InjectionBody({ mode: 'DRY_RUN', projectId: value.projectId, batchLabel: value.batchLabel,
    items: r4HumanApprovals.map(row => Object.fromEntries(metadataKeys.map(key => [key, row[key]]))) });
  return { body, receipts: value.receipts };
}
