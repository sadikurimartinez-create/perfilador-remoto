import 'server-only';
import { randomUUID } from 'crypto';
import { loadImage } from '@napi-rs/canvas';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { computeSha256FromBytes, detectMimeFromMagicBytes } from '@/utils/forensicFileIntegrity';
import { createStoredRawMultimodalEvidence } from '@/utils/multimodalEvidenceContract';
import { photoId, photoHash, photoStoragePath } from '@/modules/pandillas/photo-evidence/storagePaths';
import { validatePhotoAsset } from '@/modules/pandillas/photo-evidence/association';
import { assertPhotoAuditSafe } from '@/modules/pandillas/photo-evidence/audit';
import type { PhotoAsset, PhotoDerivedFile, PhotoActor } from '@/modules/pandillas/photo-evidence/contracts';
import type { ProjectDocument } from '@/context/ProjectContext';

type FileInput = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png'; sha256: string };
export type PandillasPhotoAssetInput = {
  projectId: string; gangId: string; sourceDocumentId: string; sourceDocumentName: string;
  sourceDocumentSha256: string; sourcePage: number; sourceImageId: string; reason: string;
  original: FileInput; derived: FileInput & { recipeVersion: string; crop?: PhotoDerivedFile['crop'] };
};
export type PhotoAssetDependencies = {
  authorize: typeof authorizeInstitutionalProjectAccess;
  database: typeof getInstitutionalAdminDb; bucket: typeof getInstitutionalAdminBucket;
  now: () => number; uuid: () => string;
};
const defaults: PhotoAssetDependencies = { authorize: authorizeInstitutionalProjectAccess, database: getInstitutionalAdminDb, bucket: getInstitutionalAdminBucket, now: Date.now, uuid: randomUUID };
const conflict = () => new Error('R4_ASSET_CONFLICT');
const safeText = (value: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000 || /https?:|data:|gs:|base64|[?&]token=/i.test(value)) throw new Error('R4_INVALID_TEXT');
};

/** Read encoded dimensions before native decode to reject decompression bombs. */
function encodedDimensions(b: Buffer, mime: string): { width: number; height: number } {
  if (mime === 'image/png') {
    if (b.length < 45 || !b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || b.toString('ascii', 12, 16) !== 'IHDR' || b.readUInt32BE(8) !== 13 || b.toString('ascii', b.length - 8, b.length - 4) !== 'IEND') throw new Error('R4_IMAGE_INVALID');
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length < 4 || b[b.length - 2] !== 255 || b[b.length - 1] !== 217) throw new Error('R4_IMAGE_INVALID');
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p++] !== 255) throw new Error('R4_IMAGE_INVALID');
    while (b[p] === 255) p++;
    const marker = b[p++];
    if (marker === 218 || marker === 217) break;
    if (marker === 1 || marker >= 208 && marker <= 215) continue;
    if (p + 2 > b.length) break;
    const length = b.readUInt16BE(p);
    if (length < 2 || p + length > b.length) break;
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (length < 8) break;
      return { height: b.readUInt16BE(p + 3), width: b.readUInt16BE(p + 5) };
    }
    p += length;
  }
  throw new Error('R4_IMAGE_INVALID');
}

async function validateBytes(input: FileInput, derived: boolean) {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0 || input.bytes.length > (derived ? 2 : 20) * 1024 * 1024) throw new Error('R4_FILE_LIMIT');
  photoHash(input.sha256);
  if (!['image/png', 'image/jpeg'].includes(input.mimeType) || detectMimeFromMagicBytes(input.bytes) !== input.mimeType) throw new Error('R4_MIME_MISMATCH');
  const bytes = Buffer.from(input.bytes); // Isolate caller buffers across awaits; never recompress.
  const dimensions = encodedDimensions(bytes, input.mimeType);
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 40000000 || derived && Math.max(dimensions.width, dimensions.height) > 2048) throw new Error('R4_FILE_LIMIT');
  try {
    const decoded = await loadImage(bytes);
    if (decoded.width !== dimensions.width || decoded.height !== dimensions.height) throw new Error('decode');
  } catch { throw new Error('R4_IMAGE_DECODE_FAILED'); }
  const sha256 = await computeSha256FromBytes(bytes);
  if (sha256 !== input.sha256) throw new Error('R4_HASH_MISMATCH');
  return { bytes, mimeType: input.mimeType, sha256, size: bytes.length, ...dimensions };
}

function sameAsset(actual: PhotoAsset, wanted: PhotoAsset) {
  try { validatePhotoAsset(actual, wanted.projectId, wanted.id); } catch { throw conflict(); }
  const comparable = (a: PhotoAsset) => JSON.stringify([
    a.id, a.projectId, a.sourceDocumentId, a.sourceDocumentName, a.sourceDocumentSha256,
    a.sourcePage, a.sourceImageId, a.status,
    ...[a.original, a.derived].map(f => f && [f.storagePath, f.sha256, f.mimeType, f.size, f.width, f.height]),
    a.derived?.recipeVersion, a.derived?.crop && [a.derived.crop.x,a.derived.crop.y,a.derived.crop.width,a.derived.crop.height,a.derived.crop.units],
  ]);
  if (comparable(actual) !== comparable(wanted)) throw conflict();
}

/** No association/primary or approval is created by importing an asset. */
export async function registerInstitutionalPandillasPhotoAsset(session: unknown, input: PandillasPhotoAssetInput, overrides: Partial<PhotoAssetDependencies> = {}) {
  if (typeof window !== 'undefined') throw new Error('R4_UPLOAD_SERVER_ONLY');
  const deps = { ...defaults, ...overrides };
  photoId(input.projectId); photoId(input.gangId); photoId(input.sourceDocumentId); photoId(input.sourceImageId); photoId(input.derived.recipeVersion);
  photoHash(input.sourceDocumentSha256); safeText(input.sourceDocumentName); safeText(input.reason);
  if (!Number.isSafeInteger(input.sourcePage) || input.sourcePage < 1) throw new Error('R4_PROVENANCE_INVALID');
  const access = await deps.authorize({ sessionToken: session, projectId: input.projectId, action: 'WRITE' });
  if (!access.allowed) throw new Error('R4_ACCESS_DENIED');
  const actor: PhotoActor = { institutionalUserId: access.actor.institutionalUserId, username: access.actor.username };
  const original = await validateBytes(input.original, false);
  const derived = await validateBytes(input.derived, true);
  const key = await computeSha256FromBytes(new TextEncoder().encode(JSON.stringify([input.projectId, original.sha256, derived.sha256, input.derived.recipeVersion])));
  const assetId = `asset-${key}`; // Opaque content-addressed asset, never personal identity.
  const file = (f: typeof original, recipeVersion?: string) => ({ storagePath: photoStoragePath({ projectId: input.projectId, assetId, sha256: f.sha256, ext: f.mimeType === 'image/png' ? 'png' : 'jpg', recipeVersion }), sha256: f.sha256, mimeType: f.mimeType, size: f.size, width: f.width, height: f.height });
  const now = deps.now();
  const asset: PhotoAsset = { id: assetId, projectId: input.projectId, sourceDocumentId: input.sourceDocumentId, sourceDocumentName: input.sourceDocumentName, sourceDocumentSha256: input.sourceDocumentSha256, sourcePage: input.sourcePage, sourceImageId: input.sourceImageId, original: file(original), derived: { ...file(derived, input.derived.recipeVersion), recipeVersion: input.derived.recipeVersion, ...(input.derived.crop ? { crop: { x: input.derived.crop.x, y: input.derived.crop.y, width: input.derived.crop.width, height: input.derived.crop.height, units: input.derived.crop.units } } : {}) }, status: 'ACTIVE', createdAt: now, createdBy: actor, version: 1 };
  validatePhotoAsset(asset, input.projectId, assetId);
  const db = deps.database(); const bucket = deps.bucket();
  const parent = db.doc(`projects/${input.projectId}`);
  const target = db.doc(`projects/${input.projectId}/documents/${assetId}`);
  const context = async (tx: Parameters<Parameters<typeof db.runTransaction>[0]>[0]) => {
    const project = (await tx.get(parent)).data();
    const gang = (await tx.get(db.doc(`pandillas/${input.gangId}`))).data();
    const doc = (await tx.get(target)).data();
    if (!project || project.deleted !== undefined && project.deleted !== false || project.estado === 'ARCHIVADO' || project.status === 'ARCHIVADO' || project.lifecycleDeletionPending) throw new Error('R4_PROJECT_UNAVAILABLE');
    if (!gang || gang.projectId !== input.projectId || gang.deleted) throw new Error('R4_GANG_CROSS_PROJECT');
    if (doc) {
      if (doc.deleted || doc.lifecycleDeletionPending || doc.projectId !== input.projectId || doc.expedienteId !== input.projectId || !doc.photoAsset || doc.multimodalEvidence?.documentId !== assetId || doc.multimodalEvidence?.expedienteId !== input.projectId || doc.multimodalEvidence?.forensicIntegrity?.rawSha256 !== original.sha256 || doc.multimodalEvidence?.forensicIntegrity?.hashStatus !== 'REAL_FILE_HASH') throw conflict();
      sameAsset(doc.photoAsset, asset);
    }
    return { project, doc };
  };
  const prior = await db.runTransaction(context);
  const ensureObject = async (metadata: PhotoAsset['original'], bytes: Buffer, mayCreate: boolean) => {
    const object = bucket.file(metadata.storagePath);
    let stored;
    try { [stored] = await object.getMetadata(); }
    catch (error: any) {
      if (error.code !== 404) throw error;
      if (!mayCreate) throw new Error('R4_REGISTERED_OBJECT_MISSING');
      try { await object.save(bytes, { resumable: false, validation: 'crc32c', preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: metadata.mimeType } }); }
      catch (failure: any) { if (failure.code !== 412) throw failure; }
      [stored] = await object.getMetadata();
    }
    if (!stored.generation || stored.contentType !== metadata.mimeType || Number(stored.size) !== metadata.size) throw conflict();
    const [readback] = await object.download();
    const [after] = await object.getMetadata();
    if (after.generation !== stored.generation || readback.length !== metadata.size || await computeSha256FromBytes(readback) !== metadata.sha256) throw conflict();
  };
  await ensureObject(asset.original, original.bytes, !prior.doc);
  await ensureObject(asset.derived!, derived.bytes, !prior.doc);
  // Authorization may change while Storage is uploading. Recheck before registration.
  const freshAccess = await deps.authorize({ sessionToken: session, projectId: input.projectId, action: 'WRITE' });
  if (!freshAccess.allowed || freshAccess.actor.institutionalUserId !== actor.institutionalUserId) throw new Error('R4_ACCESS_DENIED');
  const fileName = `${assetId}.${original.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  const evidence = createStoredRawMultimodalEvidence({ evidenceId: assetId, expedienteId: input.projectId, documentId: assetId, fileName, mimeType: original.mimeType, size: original.size, storageReference: asset.original.storagePath, ingestionSource: 'USER_UPLOAD', forensicIntegrity: { rawSha256: original.sha256, hashAlgorithm: 'SHA-256', hashStatus: 'REAL_FILE_HASH', hashComputedAt: new Date(now).toISOString(), hashSource: 'COMPUTED_FROM_BYTES', mimeStatus: 'MIME_MATCH', declaredMimeType: original.mimeType, detectedMimeType: original.mimeType } });
  const document: ProjectDocument = { id: assetId, name: fileName, url: '', type: original.mimeType, context: input.reason, createdAt: now, projectId: input.projectId, expedienteId: input.projectId, storagePath: asset.original.storagePath, photoAsset: asset, multimodalEvidence: evidence };
  const auditId = deps.uuid(); photoId(auditId);
  return db.runTransaction(async tx => {
    const { project, doc } = await context(tx);
    if (doc) return { assetId, documentId: assetId, action: 'REUSE_EXISTING_ASSET' as const, photoAsset: doc.photoAsset as PhotoAsset };
    const event = { event: 'PHOTO_IMPORTED' as const, actor, timestamp: now, projectId: input.projectId, gangId: input.gangId, memberIdentityId: null, assetId, oldValue: null, newValue: { id: assetId, version: 1, status: 'ACTIVE', sha256: original.sha256 }, reason: input.reason };
    assertPhotoAuditSafe(event);
    tx.create(target, document);
    tx.create(db.doc(`audit_logs/${auditId}`), { ...event, action: event.event, actorInstitutionalUserId: actor.institutionalUserId, source: 'SERVER' });
    tx.update(parent, { institutionalSourceRevision: Number.isSafeInteger(project.institutionalSourceRevision) ? project.institutionalSourceRevision + 1 : 1 });
    return { assetId, documentId: assetId, action: 'CREATE' as const, photoAsset: asset };
  });
}
