jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../src/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn() }));
jest.mock('../src/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
import { webcrypto } from 'crypto';
import { photoStoragePath, primarySelectionId } from '../src/modules/pandillas/photo-evidence/storagePaths';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import { assertPhotoAuditSafe } from '../src/modules/pandillas/photo-evidence/audit';
import { mutateInstitutionalPandillasPhoto as mutate, resolveMemberPrimaryPhoto as resolve } from '../src/services/institutionalPandillasPhotoBoundary';
import type { PandillasPhotoMutation } from '../src/services/institutionalPandillasPhotoBoundary';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const hash = 'a'.repeat(64);
const scope = { projectId: 'project-fixture', gangId: 'gang-fixture' };
const member = { nombre: 'Persona Sintetica', alias: 'Fixture', rol: '', fotografiaUrl: 'legacy-fixture' };
const actor = { institutionalUserId: 'actor-fixture', username: 'Analista Fixture' };

/** Serializable in-memory transactions; queued writes commit only on successful callback. */
async function fixture(identityOnly = false, memberName = member.nombre) {
  const rows = new Map<string, any>(); let counter = 0; let queue = Promise.resolve(); let failAudit = false;
  const snap = (data: any) => ({ exists: data !== undefined, data: () => data });
  const db: any = {
    doc: (path: string) => ({ path }),
    collection: (path: string) => ({ where: (field: string, op: string, value: string) => ({ path, field, value, query: true }) }),
    runTransaction: (callback: any) => {
      const run = queue.then(async () => {
        const writes: Array<() => void> = []; let writing = false;
        const tx = {
          get: async (ref: any) => {
            if (writing) throw new Error('READ_AFTER_WRITE');
            if (ref.query) return { docs: [...rows].filter(([path, data]) => path.startsWith(ref.path + '/') && data[ref.field] === ref.value).map(([, data]) => snap(data)) };
            return snap(rows.get(ref.path));
          },
          create: (ref: any, data: any) => { writing = true; if (rows.has(ref.path)) throw new Error('EXISTS'); if (failAudit && ref.path.startsWith('audit_logs/')) throw new Error('AUDIT_FAILURE'); writes.push(() => rows.set(ref.path, structuredClone(data))); },
          set: (ref: any, data: any) => { writing = true; writes.push(() => rows.set(ref.path, structuredClone(data))); },
          update: (ref: any, data: any) => { writing = true; writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(data) })); },
        };
        const result = await callback(tx); writes.forEach(write => write()); return result;
      });
      queue = run.then(() => undefined, () => undefined); return run;
    },
  };
  rows.set(`projects/${scope.projectId}`, { deleted: false });
  rows.set(`pandillas/${scope.gangId}`, { ...scope, updatedAt: 5, integrantes: [identityOnly ? { nombre: memberName } : { ...structuredClone(member), nombre: memberName }] });
  const asset: any = { id: 'document-fixture', projectId: scope.projectId, sourceDocumentId: 'pdf-fixture', sourceDocumentName: 'Fuente Sintetica', sourceDocumentSha256: hash, sourcePage: 1, sourceImageId: 'image-fixture', status: 'ACTIVE', createdAt: 10, createdBy: actor, version: 1,
    original: { storagePath: photoStoragePath({ projectId: scope.projectId, assetId: 'document-fixture', sha256: hash, ext: 'png' }), sha256: hash, mimeType: 'image/png', size: 100, width: 200, height: 300 },
    derived: { storagePath: photoStoragePath({ projectId: scope.projectId, assetId: 'document-fixture', sha256: hash, ext: 'jpg', recipeVersion: 'v1' }), sha256: hash, mimeType: 'image/jpeg', size: 80, width: 100, height: 150, recipeVersion: 'v1' } };
  if (!identityOnly) rows.set(`projects/${scope.projectId}/documents/document-fixture`, { id: 'document-fixture', projectId: scope.projectId, photoAsset: asset, multimodalEvidence: { expedienteId: scope.projectId, documentId: 'document-fixture', humanValidationStatus: 'APPROVED', forensicIntegrity: { rawSha256: hash, hashStatus: 'REAL_FILE_HASH' } } });
  const deps: any = { database: () => db, now: () => 100, uuid: () => `opaque-${++counter}`, authorize: jest.fn(async () => ({ allowed: true, actor })) };
  const identity = await mutate('fixture-session', { ...scope, operation: 'CREATE_IDENTITY', expectedVersion: 0, expectedGangUpdatedAt: 5, legacyMemberName: memberName, reason: 'Revision documental sintetica' }, deps);
  const associate = (extra: any = {}) => mutate('fixture-session', { ...scope, operation: 'ASSOCIATE', expectedVersion: 0, expectedDocumentVersion: 1, reason: 'Asociacion documental', memberIdentityId: identity.id, documentId: 'document-fixture', imageType: 'MEMBER_PRIMARY_PHOTO', associationLevel: 'EXACT', associationBasis: 'Ficha nominal sintetica', sourcePage: 1, sourceImageId: 'image-fixture', ...extra }, deps);
  const association = identityOnly ? null : await associate();
  const select = (extra: any = {}) => mutate('fixture-session', { ...scope, operation: 'SELECT_PRIMARY', memberIdentityId: identity.id, associationId: association!.id, expectedVersion: 0, expectedAssociationVersion: 1, expectedDocumentVersion: 1, reason: 'Eleccion humana sintetica', ...extra }, deps);
  return { rows, deps, identity, association: association!, associate, select, asset, failAudit: () => { failAudit = true; }, resolve: () => resolve('fixture-session', { ...scope, memberIdentityId: identity.id }, deps), associationPath: `projects/${scope.projectId}/pandillasPhotoAssociations/${association?.id}`, identityPath: `projects/${scope.projectId}/pandillasMemberIdentities/${identity.id}`, documentPath: `projects/${scope.projectId}/documents/document-fixture` };
}
test('rutas deterministas, separadas, sin nombres humanos', () => {
  const input = { projectId: 'p', assetId: 'opaque', sha256: hash, ext: 'png' as const };
  expect(photoStoragePath(input)).toBe(`projects/p/pandillas/evidence/assets/opaque/original/${hash}.png`);
  expect(photoStoragePath({ ...input, recipeVersion: 'v1' })).toContain('/derived/v1/');
});
test.each(['../p', 'p/q', 'p\\q', '.', '', 'p%2fq', 'Nombre Humano'])('traversal/ID inválido %s', projectId => expect(() => photoStoragePath({ projectId, assetId: 'a', sha256: hash, ext: 'jpg' })).toThrow());
test.each(['bad', 'a'.repeat(63), 'G'.repeat(64), 'A'.repeat(64)])('SHA inválido %s', sha256 => expect(() => photoStoragePath({ projectId: 'p', assetId: 'a', sha256, ext: 'jpg' })).toThrow('SHA256'));
test('identidad opaca y nombre fuera de la clave', async () => { const f = await fixture(); expect(f.identity.id).toMatch(/^opaque-/); expect(primarySelectionId(scope.gangId, f.identity.id)).not.toContain(member.nombre); });
test('SHA snapshot reutiliza integridad real y canonicaliza claves', async () => { expect(await legacyMemberFingerprint({ b: 2, a: 1 })).toBe(await legacyMemberFingerprint({ a: 1, b: 2 })); expect(await legacyMemberFingerprint(member)).toMatch(/^[a-f0-9]{64}$/); });
test('EXACT, resolver autorizado y sin URL', async () => { const f = await fixture(); await f.select(); const r = await f.resolve(); expect(r?.documentVersion).toBe(1); expect(r?.associationVersion).toBe(1); expect(r?.storagePathDerived).toContain('/derived/v1/'); expect(JSON.stringify(r)).not.toMatch(/https?:|base64/); expect(f.deps.authorize).toHaveBeenLastCalledWith({ sessionToken: 'fixture-session', projectId: scope.projectId, action: 'READ' }); });
test.each(['PROBABLE_DOCUMENTARY', 'AMBIGUOUS', 'NONE'])('%s no es primaria', async level => { const f = await fixture(); f.rows.get(f.associationPath).associationLevel = level; await expect(f.select()).rejects.toThrow('NOT_PRIMARY_ELIGIBLE'); });
test.each(['RETIRED', 'DELETED_PENDING', 'DELETED'])('activo %s bloqueado', async status => { const f = await fixture(); f.rows.get(f.documentPath).photoAsset.status = status; await expect(f.select()).rejects.toThrow('ASSET_INACTIVE'); });
test('asociacion retirada no es primaria', async () => { const f = await fixture(); f.rows.get(f.associationPath).status = 'RETIRED'; await expect(f.select()).rejects.toThrow('RETIRED'); });
test('identidad inactiva no es primaria', async () => { const f = await fixture(); f.rows.get(f.identityPath).status = 'RETIRED'; await expect(f.select()).rejects.toThrow('IDENTITY_INACTIVE'); });
test('una primaria, reemplazo preserva activo/asociaciones e historial REPLACED', async () => { const f = await fixture(); await f.select(); const second = await f.associate(); await f.select({ associationId: second.id, expectedVersion: 1 }); const selections = [...f.rows].filter(([path]) => path.includes('/pandillasPrimarySelections/')); expect(selections).toHaveLength(1); expect(selections[0][1].version).toBe(2); expect(f.rows.get(f.associationPath).status).toBe('ACTIVE'); expect(f.rows.get(f.documentPath).photoAsset.status).toBe('ACTIVE'); const audit = [...f.rows.values()].find(r => r.event === 'PHOTO_PRIMARY_REPLACED'); expect(audit.oldValue.status).toBe('REPLACED'); expect(audit.oldValue.associationId).toBe(f.association.id); });
test('version obsoleta no sobrescribe', async () => { const f = await fixture(); await f.select(); const next = await f.associate(); await expect(f.select({ associationId: next.id })).rejects.toThrow('VERSION_CONFLICT'); });
test('concurrencia simulada: solo un commit PRIMARY', async () => { const f = await fixture(); const next = await f.associate(); const result = await Promise.allSettled([f.select(), f.select({ associationId: next.id })]); expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(result.filter(r => r.status === 'rejected')).toHaveLength(1); });
test('proyecto/pandilla cruzados no escriben', async () => { const f = await fixture(); f.rows.get(`pandillas/${scope.gangId}`).projectId = 'other'; const size = f.rows.size; await expect(f.select()).rejects.toThrow('GANG_CROSS_PROJECT'); expect(f.rows.size).toBe(size); });
test.each(['identity', 'association', 'selection', 'document'])('resolver rechaza proyecto cruzado %s', async kind => { const f = await fixture(); await f.select(); const path = kind === 'identity' ? f.identityPath : kind === 'association' ? f.associationPath : kind === 'document' ? f.documentPath : `projects/${scope.projectId}/pandillasPrimarySelections/${primarySelectionId(scope.gangId, f.identity.id)}`; f.rows.get(path).projectId = 'other'; await expect(f.resolve()).rejects.toThrow(); });
test('resolver rechaza no EXACT', async () => { const f = await fixture(); await f.select(); f.rows.get(f.associationPath).associationLevel = 'AMBIGUOUS'; await expect(f.resolve()).rejects.toThrow('NOT_PRIMARY_ELIGIBLE'); });
test('resolver rechaza documento ausente', async () => { const f = await fixture(); await f.select(); f.rows.delete(f.documentPath); await expect(f.resolve()).rejects.toThrow('DOCUMENT_UNAVAILABLE'); });
test('legacy permanece intacto', async () => { const f = await fixture(); const before = structuredClone(f.rows.get(`pandillas/${scope.gangId}`)); await f.select(); expect(f.rows.get(`pandillas/${scope.gangId}`)).toEqual(before); expect(before.integrantes[0].fotografiaUrl).toBe('legacy-fixture'); });
test('cambio de nombre legacy no remapea identidad', async () => { const f = await fixture(); f.rows.get(`pandillas/${scope.gangId}`).integrantes[0].nombre = 'Otro Sintetico'; await expect(f.select()).rejects.toThrow('RECONCILIATION_REQUIRED'); });
test('identidad verifica versión de pandilla y registro duplicado', async () => { const f = await fixture(); const request: PandillasPhotoMutation = { ...scope, operation: 'CREATE_IDENTITY', expectedVersion: 0, expectedGangUpdatedAt: 4, legacyMemberName: member.nombre, reason: 'Revision' }; await expect(mutate('s', request, f.deps)).rejects.toThrow('GANG_VERSION_CONFLICT'); await expect(mutate('s', { ...request, expectedGangUpdatedAt: 5 }, f.deps)).rejects.toThrow('ALREADY_REGISTERED'); });
test('Yordi canónico crea identidad sin foto, asociación ni primaria', async () => {
  const f = await fixture(true, 'Yordi Alejandro Amézquita de la Cruz');
  expect(f.rows.get(f.identityPath)).toMatchObject({ legacyMemberName: 'Yordi Alejandro Amézquita de la Cruz', status: 'ACTIVE', version: 1 });
  expect([...f.rows.keys()].filter(path => /\/documents\/|\/pandillasPhotoAssociations\/|\/pandillasPrimarySelections\//.test(path))).toHaveLength(0);
  expect(await f.resolve()).toBeNull();
});
test('Ángel Ricardo sigue excluido incluso si el snapshot lo contiene', async () => {
  await expect(fixture(true, 'Ángel Ricardo González Sánchez')).rejects.toThrow('DOCUMENTARY_IDENTITY_BLOCKED');
});
test('primaria exige revisión humana de la asociación EXACT', async () => {
  const f = await fixture();
  f.rows.get(f.associationPath).reviewedBy = { institutionalUserId: '', username: '' };
  await expect(f.select()).rejects.toThrow('NOT_PRIMARY_ELIGIBLE');
});
test('sin grant no obtiene DB ni muta', async () => { const f = await fixture(); f.deps.authorize.mockResolvedValue({ allowed: false }); const database = jest.fn(); await expect(resolve('s', { ...scope, memberIdentityId: f.identity.id }, { ...f.deps, database })).rejects.toThrow('ACCESS_DENIED'); expect(database).not.toHaveBeenCalled(); await expect(f.select()).rejects.toThrow('ACCESS_DENIED'); });
test('proyecto archivado bloquea', async () => { const f = await fixture(); f.rows.get(`projects/${scope.projectId}`).estado = 'ARCHIVADO'; await expect(f.select()).rejects.toThrow('PROJECT_UNAVAILABLE'); });
test('retirar es versionado, irreversible y no borra activo', async () => { const f = await fixture(); const input: PandillasPhotoMutation = { ...scope, operation: 'RETIRE_ASSOCIATION', associationId: f.association.id, expectedVersion: 1, reason: 'Retiro documental' }; await mutate('s', input, f.deps); expect(f.rows.get(f.associationPath).version).toBe(2); expect(f.rows.has(f.documentPath)).toBe(true); await expect(mutate('s', { ...input, expectedVersion: 2 }, f.deps)).rejects.toThrow('RETIRED'); });
test('no se retira primaria activa', async () => { const f = await fixture(); await f.select(); await expect(mutate('s', { ...scope, operation: 'RETIRE_ASSOCIATION', associationId: f.association.id, expectedVersion: 1, reason: 'Retiro' }, f.deps)).rejects.toThrow('PRIMARY_REPLACEMENT_REQUIRED'); });
test('falla auditoría revierte selección', async () => { const f = await fixture(); const before = [...f.rows]; f.failAudit(); await expect(f.select()).rejects.toThrow('AUDIT_FAILURE'); expect([...f.rows]).toEqual(before); });
test.each([{ binary: new Uint8Array([1]) }, { url: 'https://example.invalid' }, { reason: 'data:image/png;base64,AA' }, { token: 'secret' }])('auditoría rechaza contenido inseguro %p', payload => expect(() => assertPhotoAuditSafe(payload as any)).toThrow('UNSAFE_AUDIT'));
test('auditoría real del mock contiene actor servidor, IDs/versiones/hashes', async () => { const f = await fixture(); await f.select(); const records = [...f.rows.values()].filter(r => r.event); expect(records).toHaveLength(3); records.forEach(assertPhotoAuditSafe); expect(records.every(r => r.actor.institutionalUserId === actor.institutionalUserId && r.timestamp === 100)).toBe(true); });
test('documento pendiente/derivado ausente/integridad falsa bloquean', async () => { for (const mode of ['pending', 'derived', 'hash', 'review']) { const f = await fixture(); const doc = f.rows.get(f.documentPath); if (mode === 'pending') doc.lifecycleDeletionPending = 'intent'; if (mode === 'derived') delete doc.photoAsset.derived; if (mode === 'hash') doc.multimodalEvidence.forensicIntegrity.rawSha256 = 'b'.repeat(64); if (mode === 'review') doc.multimodalEvidence.humanValidationStatus = 'PENDING_REVIEW'; await expect(f.select()).rejects.toThrow(); } });
test.each(['association', 'document'])('versión esperada %s obsoleta bloquea', async kind => { const f = await fixture(); await expect(f.select(kind === 'association' ? { expectedAssociationVersion: 0 } : { expectedDocumentVersion: 0 })).rejects.toThrow('VERSION_CONFLICT'); });
test('resolver sin selección retorna null', async () => { const f = await fixture(); expect(await f.resolve()).toBeNull(); });
test('asociación exige versión de documento', async () => { const f = await fixture(); await expect(f.associate({ expectedDocumentVersion: 0 })).rejects.toThrow('VERSION_CONFLICT'); });
test('procedencia de otra región no se asocia', async () => { const f = await fixture(); await expect(f.associate({ sourcePage: 2 })).rejects.toThrow('PROVENANCE_MISMATCH'); });
test('MIME, ruta y hash del activo validados', async () => { for (const mode of ['mime', 'path', 'sha', 'crop']) { const f = await fixture(); const asset = f.rows.get(f.documentPath).photoAsset; if (mode === 'mime') asset.derived.mimeType = 'text/html'; if (mode === 'path') asset.derived.storagePath = 'projects/other/f.jpg'; if (mode === 'sha') asset.sourceDocumentSha256 = 'invalid'; if (mode === 'crop') asset.derived.crop = { x: 500, y: 0, width: 10, height: 10, units: 'ORIGINAL_PIXELS' }; await expect(f.select()).rejects.toThrow(); } });
