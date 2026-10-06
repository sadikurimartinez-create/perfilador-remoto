jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../src/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(), getInstitutionalAdminBucket: jest.fn() }));
jest.mock('../src/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
import { webcrypto } from 'crypto';
import { createCanvas } from '@napi-rs/canvas';
import { computeSha256FromBytes } from '../src/utils/forensicFileIntegrity';
import { registerInstitutionalPandillasPhotoAsset as register } from '../src/services/institutionalPandillasPhotoAssetService';
import type { PandillasPhotoAssetInput } from '../src/services/institutionalPandillasPhotoAssetService';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

async function fixture() {
  const canvas = createCanvas(3, 2); canvas.getContext('2d').fillRect(0, 0, 3, 2);
  const png = canvas.toBuffer('image/png'); const jpeg = canvas.toBuffer('image/jpeg');
  const input: PandillasPhotoAssetInput = {
    projectId: 'project-fixture', gangId: 'gang-fixture', sourceDocumentId: 'pdf-fixture', sourceDocumentName: 'Fuente sintética.pdf',
    sourceDocumentSha256: 'a'.repeat(64), sourcePage: 1, sourceImageId: 'image-fixture', reason: 'Carga sintética',
    original: { bytes: png, mimeType: 'image/png', sha256: await computeSha256FromBytes(png) },
    derived: { bytes: jpeg, mimeType: 'image/jpeg', sha256: await computeSha256FromBytes(jpeg), recipeVersion: 'v1' },
  };
  const actor = { institutionalUserId: 'actor-fixture', username: 'Fixture' };
  const documents = new Map<string, any>([['projects/project-fixture', { deleted: false }], ['pandillas/gang-fixture', { projectId: 'project-fixture' }]]);
  const objects = new Map<string, { bytes: Buffer; contentType: string; generation: string }>();
  let next = 0; let failDerived = false; let failCommit = false; let queue = Promise.resolve();
  const save = jest.fn(async (path: string, bytes: Buffer, options: any) => {
    expect(options.preconditionOpts.ifGenerationMatch).toBe(0);
    if (failDerived && path.includes('/derived/')) throw new Error('DERIVED_FAILURE');
    if (objects.has(path)) throw Object.assign(new Error('EXISTS'), { code: 412 });
    objects.set(path, { bytes: Buffer.from(bytes), contentType: options.metadata.contentType, generation: String(++next) });
  });
  const bucket = { file: (path: string) => ({
    getMetadata: async () => { const o = objects.get(path); if (!o) throw Object.assign(new Error('MISSING'), { code: 404 }); return [{ size: o.bytes.length, contentType: o.contentType, generation: o.generation }]; },
    save: (bytes: Buffer, opts: any) => save(path, bytes, opts),
    download: async () => [Buffer.from(objects.get(path)!.bytes)],
  }) };
  const db = { doc: (path: string) => ({ path }), runTransaction: (callback: any) => {
    const run = queue.then(async () => {
      const writes: (() => void)[] = []; let writing = false;
      const tx = {
        get: async (ref: any) => { if (writing) throw new Error('READ_AFTER_WRITE'); return { data: () => documents.get(ref.path) }; },
        create: (ref: any, value: any) => { writing = true; if (documents.has(ref.path)) throw new Error('EXISTS'); writes.push(() => documents.set(ref.path, structuredClone(value))); },
        update: (ref: any, value: any) => { writing = true; writes.push(() => documents.set(ref.path, { ...documents.get(ref.path), ...value })); },
      };
      const result = await callback(tx); if (writes.length && failCommit) throw new Error('COMMIT_FAILURE'); writes.forEach(w => w()); return result;
    }); queue = run.then(() => undefined, () => undefined); return run;
  } };
  const deps: any = { authorize: jest.fn(async () => ({ allowed: true, actor })), database: jest.fn(() => db), bucket: jest.fn(() => bucket), now: () => 1000, uuid: () => `audit-${++next}` };
  return { input, deps, documents, objects, save, run: () => register('synthetic-session', input, deps), failDerived: (value: boolean) => { failDerived = value; }, failCommit: (value: boolean) => { failCommit = value; } };
}

test('sube bytes intactos, hashes reales y ProjectDocument; no aprueba ni asocia', async () => {
  const f = await fixture(); const r = await f.run();
  expect(r.action).toBe('CREATE'); expect(f.objects.size).toBe(2);
  expect(f.objects.get(r.photoAsset.original.storagePath)!.bytes).toEqual(f.input.original.bytes);
  expect(r.photoAsset.original.sha256).toBe(await computeSha256FromBytes(f.input.original.bytes));
  expect(r.photoAsset.derived!.sha256).toBe(await computeSha256FromBytes(f.input.derived.bytes));
  const doc = f.documents.get(`projects/${f.input.projectId}/documents/${r.assetId}`);
  expect(doc.photoAsset).toEqual(r.photoAsset); expect(doc.multimodalEvidence.humanValidationStatus).toBe('PENDING_REVIEW');
  expect(doc.multimodalEvidence.forensicIntegrity.rawSha256).toBe(r.photoAsset.original.sha256);
  expect(doc.url).toBe(''); expect([...f.documents.keys()].some(p => /MemberIdentities|PhotoAssociations|PrimarySelections/.test(p))).toBe(false);
  expect([...f.documents.values()].filter(v => v.event === 'PHOTO_IMPORTED')).toHaveLength(1);
});
test('rutas determinísticas e idempotencia; sin nombres en rutas ni duplicados', async () => {
  const f = await fixture(); const first = await f.run(); const second = await f.run();
  expect(first.assetId).toBe(second.assetId); expect(second.action).toBe('REUSE_EXISTING_ASSET');
  expect(first.photoAsset.original.storagePath).toMatch(/assets\/asset-[a-f0-9]{64}\/original\/[a-f0-9]{64}\.png$/);
  expect(first.photoAsset.derived!.storagePath).toContain('/derived/v1/');
  expect(JSON.stringify([...f.objects.keys()])).not.toMatch(/Fuente|Fixture|image-fixture|pdf-fixture/);
  expect(f.save).toHaveBeenCalledTimes(2);
});
test.each(['original', 'derived'] as const)('rechaza hash incorrecto %s sin escritura', async kind => {
  const f = await fixture(); f.input[kind].sha256 = 'b'.repeat(64); await expect(f.run()).rejects.toThrow('HASH_MISMATCH'); expect(f.save).not.toHaveBeenCalled();
});
test('MIME/firma incorrecta no sube', async () => { const f = await fixture(); f.input.original.mimeType = 'image/jpeg'; await expect(f.run()).rejects.toThrow('MIME_MISMATCH'); expect(f.save).not.toHaveBeenCalled(); });
test('MIME ajeno a PNG/JPEG se rechaza', async () => { const f = await fixture(); (f.input.original as any).mimeType = 'text/plain'; await expect(f.run()).rejects.toThrow('MIME_MISMATCH'); expect(f.save).not.toHaveBeenCalled(); });
test('bytes corruptos durante upload no registran metadata', async () => {
  const f = await fixture(); f.save.mockImplementationOnce(async (path, bytes, options) => {
    const corrupt = Buffer.from(bytes); corrupt[20] ^= 1;
    f.objects.set(path, { bytes: corrupt, contentType: options.metadata.contentType, generation: '1' });
  });
  await expect(f.run()).rejects.toThrow('ASSET_CONFLICT');
  expect([...f.documents.keys()].filter(p => p.includes('/documents/'))).toHaveLength(0);
});
test('archivo truncado no sube', async () => { const f = await fixture(); f.input.original.bytes = f.input.original.bytes.subarray(0, 24); await expect(f.run()).rejects.toThrow('IMAGE_INVALID'); expect(f.save).not.toHaveBeenCalled(); });
test('firma y dimensiones válidas pero contenido no decodificable se rechaza', async () => {
  const f = await fixture(); const bytes = Buffer.from(f.input.original.bytes); bytes.fill(0, 33, bytes.length - 12); f.input.original.bytes = bytes;
  await expect(f.run()).rejects.toThrow('IMAGE_DECODE_FAILED'); expect(f.save).not.toHaveBeenCalled();
});
test('dimensiones excesivas se rechazan antes de decode', async () => { const f = await fixture(); const bytes = Buffer.from(f.input.original.bytes); bytes.writeUInt32BE(50000000, 16); f.input.original.bytes = bytes; await expect(f.run()).rejects.toThrow('FILE_LIMIT'); });
test('crop inválido no produce objetos', async () => { const f = await fixture(); f.input.derived.crop = { x: 10, y: 0, width: 1, height: 1, units: 'ORIGINAL_PIXELS' }; await expect(f.run()).rejects.toThrow('CROP_INVALID'); expect(f.save).not.toHaveBeenCalled(); });
test('proveniencia distinta para misma clave de contenido es conflicto', async () => { const f = await fixture(); await f.run(); f.input.sourcePage = 2; await expect(f.run()).rejects.toThrow('ASSET_CONFLICT'); expect(f.save).toHaveBeenCalledTimes(2); });
test('original subido y derived fallido: reintento preserva/reutiliza original', async () => {
  const f = await fixture(); f.failDerived(true); await expect(f.run()).rejects.toThrow('DERIVED_FAILURE'); expect(f.objects.size).toBe(1);
  expect([...f.documents.keys()].filter(p => p.includes('/documents/'))).toHaveLength(0);
  f.failDerived(false); expect((await f.run()).action).toBe('CREATE'); expect(f.objects.size).toBe(2);
});
test('Firestore fallido: reintento registra sin duplicar objetos', async () => {
  const f = await fixture(); f.failCommit(true); await expect(f.run()).rejects.toThrow('COMMIT_FAILURE'); expect(f.objects.size).toBe(2);
  f.failCommit(false); await f.run(); expect(f.save).toHaveBeenCalledTimes(2);
});
test('documento existente con objeto ausente es conflicto, no reconstrucción silenciosa', async () => {
  const f = await fixture(); const r = await f.run(); f.objects.delete(r.photoAsset.derived!.storagePath);
  await expect(f.run()).rejects.toThrow('REGISTERED_OBJECT_MISSING'); expect(f.save).toHaveBeenCalledTimes(2);
});
test('readback corrupto no se reutiliza ni sobrescribe', async () => {
  const f = await fixture(); const r = await f.run(); const object = f.objects.get(r.photoAsset.original.storagePath)!; object.bytes[20] ^= 1;
  await expect(f.run()).rejects.toThrow('ASSET_CONFLICT'); expect(f.save).toHaveBeenCalledTimes(2);
});
test('sin autorización no accede a DB/Storage', async () => {
  const f = await fixture(); f.deps.authorize.mockResolvedValue({ allowed: false }); await expect(f.run()).rejects.toThrow('ACCESS_DENIED');
  expect(f.deps.database).not.toHaveBeenCalled(); expect(f.deps.bucket).not.toHaveBeenCalled();
});
test('proyecto archivado o pandilla cruzada no sube', async () => {
  for (const mode of ['archive', 'cross']) { const f = await fixture(); if (mode === 'archive') f.documents.get('projects/project-fixture').estado = 'ARCHIVADO'; else f.documents.get('pandillas/gang-fixture').projectId = 'other'; await expect(f.run()).rejects.toThrow(); expect(f.save).not.toHaveBeenCalled(); }
});
test('grant revocado durante upload no registra; objetos quedan recuperables', async () => {
  const f = await fixture(); f.deps.authorize.mockResolvedValueOnce({ allowed: true, actor: { institutionalUserId: 'actor-fixture', username: 'Fixture' } }).mockResolvedValueOnce({ allowed: false });
  await expect(f.run()).rejects.toThrow('ACCESS_DENIED'); expect(f.objects.size).toBe(2); expect([...f.documents.keys()].filter(p => p.includes('/documents/'))).toHaveLength(0);
});
test('dos registros concurrentes producen un documento y una auditoría', async () => {
  const f = await fixture(); const r = await Promise.all([f.run(), f.run()]); expect(new Set(r.map(v => v.assetId)).size).toBe(1);
  expect([...f.documents.keys()].filter(p => p.includes('/documents/'))).toHaveLength(1); expect([...f.documents.values()].filter(v => v.event === 'PHOTO_IMPORTED')).toHaveLength(1);
});
test('runtime cliente no puede usar uploader ni obtener credenciales', async () => {
  const f = await fixture();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  try { await expect(f.run()).rejects.toThrow('UPLOAD_SERVER_ONLY'); expect(f.deps.authorize).not.toHaveBeenCalled(); expect(f.deps.bucket).not.toHaveBeenCalled(); }
  finally { delete (globalThis as any).window; }
});
