jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'SERVER_TIME' } }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: () => { throw new Error('LIVE_FORBIDDEN'); } }));
jest.mock('@/lib/firebase', () => ({ getDb: () => { throw new Error('LIVE_FORBIDDEN'); } }));
jest.mock('@/lib/firebaseServer', () => ({ getFirebaseServerDb: () => { throw new Error('LIVE_FORBIDDEN'); } }));
import { bindPhotoToTerritorialNode, geographicEvidenceCoordinates, geographicEvidenceRole,
  geographicEvidenceTrace, photoResourceCollection, sortGeographicEvidence } from '../src/utils/geographicEvidencePresentation';
import { canonicalizeConfirmedDraftGeography, createDraftProjectGeography, updateDraftProjectGeography, confirmDraftProjectGeography } from '../src/utils/canonicalProjectGeography';
import { adaptDocumentToAdditionalPhotoEvidence, mergeAdditionalPhotoEvidence } from '../src/utils/institutionalProductsUi';
import { executeInstitutionalGeointEntity } from '../src/services/institutionalGeointEntityBoundary';
import { reviewVersion } from '../src/utils/institutionalEvidenceReview';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';

const points = [{ lat: 21, lng: -102 }, { lat: 22, lng: -102 }, { lat: 23, lng: -103 }, { lat: 24, lng: -104 }];
function draft(type: string) { return confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography(type), type === 'individual' ? points.slice(0, 1) : points)); }
const reopened = (value: any) => JSON.parse(JSON.stringify(value));

test.each([[0, 'START'], [1, 'INTERMEDIATE'], [2, 'INTERMEDIATE'], [3, 'END'], [null, 'NONE']] as const)(
  'linear assignment %s survives serialization/reopening as %s', (index, role) => {
    const photo = reopened({ id: `photo-${index}`, ...bindPhotoToTerritorialNode(draft('lineal'), index) });
    expect(geographicEvidenceRole(photo)).toBe(role);
    expect(photo.territorialRef?.order ?? null).toBe(index === null ? null : index + 1);
  });
test('shuffled reopened corridor preserves intermediate sequence and puts additional last', () => {
  const items = [3, 2, null, 0, 1].map(index => ({ id: String(index), ...bindPhotoToTerritorialNode(draft('lineal'), index) }));
  expect(sortGeographicEvidence(reopened(items)).map(item => item.id)).toEqual(['0', '1', '2', '3', 'null']);
});
test.each(['individual', 'lineal', 'poligono'])('%s additional has its own pin without changing canonical geometry', type => {
  const geography = canonicalizeConfirmedDraftGeography({ projectId: 'A', draft: draft(type), now: 10 });
  const before = reopened(geography);
  const main = { id: 'main', ...bindPhotoToTerritorialNode(draft(type), 0), ...points[0] };
  const additional = { id: 'additional', projectId: 'A', evidenceType: 'ADDITIONAL_PHOTO', ...bindPhotoToTerritorialNode(draft(type), null), lat: 25, lng: -105 };
  const ordered = sortGeographicEvidence([additional, main], geography);
  expect(ordered.map(item => item.id)).toEqual(['main', 'additional']);
  expect(geographicEvidenceTrace(additional, geography)).toMatchObject({ label: 'EA', participatesInGeometry: false, order: null, coordinates: { lat: 25, lng: -105 } });
  expect(geography).toEqual(before);
});
test('polygon retains vertex sequence instead of image ID order', () => {
  const items = [3, 1, 0, 2].map(index => ({ id: `z${4-index}`, ...bindPhotoToTerritorialNode(draft('poligono'), index) }));
  expect(sortGeographicEvidence(reopened(items)).map(item => item.territorialRef?.order)).toEqual([1, 2, 3, 4]);
});
test.each([['Nodo Inicial','START','NI'], ['Corredor','INTERMEDIATE','NM'], ['Nodo Intermedio','INTERMEDIATE','NM'],
  ['Nodo Final','END','NF'], ['Perímetro','VERTEX','V'], ['Nodo Principal','POINT','P'], ['Interior','LEGACY_UNCLASSIFIED','SC']])(
  'legacy %s recovers only a persisted role, label %s/%s', (tipo, role, label) => {
    expect(geographicEvidenceTrace({ id: 'a', tipo })).toMatchObject({ role, label, order: null, participatesInGeometry: false });
  });
test('unknown historical photos load deterministically without fabricated geographic order', () => {
  const photos = [{ id: 'b', lat: 21, lng: -102 }, { id: 'a', lat: 22, lng: -103 }];
  expect(sortGeographicEvidence(photos).map(item => item.id)).toEqual(['a', 'b']);
  expect(photos.map(geographicEvidenceRole)).toEqual(['LEGACY_UNCLASSIFIED','LEGACY_UNCLASSIFIED']);
  expect(photos.map(item => geographicEvidenceTrace(item).order)).toEqual([null,null]);
});
test('canonical source reference order takes priority over stale evidence presentation order', () => {
  const geography = canonicalizeConfirmedDraftGeography({ projectId: 'A', draft: draft('poligono') });
  geography.sourceRefs = [{ id: 'v1', type: 'TERRITORIAL_VERTEX', order: 2 }];
  expect(geographicEvidenceTrace({ id: 'photo', territorialRef: { nodeId: 'v1', order: 9, role: 'VERTEX' } }, geography).order).toBe(2);
});
test.each([{}, { lat: null, lng: null }, { lat: '', lng: false }, { lat: 91, lng: -102 }, { lat: Infinity, lng: 1 }])(
  'invalid/absent coordinate %j never fabricates a pin', item => { expect(geographicEvidenceCoordinates(item)).toBeNull(); });
test('valid zero and coordinate object are preserved without mixing coordinate sources', () => {
  expect(geographicEvidenceCoordinates({ lat: 0, lng: -102 })).toEqual({ lat: 0, lng: -102 });
  expect(geographicEvidenceCoordinates({ lat: 21, gpsLng: -102 })).toBeNull();
  expect(geographicEvidenceCoordinates({ coordinates: { lat: 21, lng: -102 } })).toEqual(points[0]);
});
test('document adaptation preserves provenance, coordinates and storage locator without Street View classification', () => {
  const document = { id: 'doc', type: 'image/jpeg', url: 'https://fixture.test/image', coordinates: points[0], captureId: 'capture-original',
    lineage: [{ id: 'source', type: 'EVIDENCE' }], evidenceId: 'original', humanValidationStatus: 'UNREVIEWED' };
  const photo = adaptDocumentToAdditionalPhotoEvidence(document, { projectId: 'A' });
  expect(photo).toMatchObject({ ...document, sourceDocumentId: 'doc', lat: 21, lng: -102, geometryRole: 'NONE', isGeometry: false });
  expect(photoResourceCollection(photo)).toBe('documents'); expect(photo.isStreetView).toBeUndefined();
  expect(mergeAdditionalPhotoEvidence([photo], [document])).toHaveLength(1);
});
test('document projection preserves existing GPS proof when duplicate representation lacks coordinates', () => {
  const result = mergeAdditionalPhotoEvidence([{ id: 'photo', evidenceId: 'same', evidenceType: 'ADDITIONAL_PHOTO', ...points[0] }], [{ id: 'doc', evidenceId: 'same', type: 'image/jpeg' }]);
  expect(result).toHaveLength(1); expect(geographicEvidenceCoordinates(result[0])).toEqual(points[0]);
});
test.each(['APPROVE', 'REJECT', 'RETURN_FOR_REANALYSIS'])('additional document PPC %s uses original storage and leaves hypothesis/Street View/geography intact', async action => {
  const document = { type: 'image/jpeg', projectId: 'A', geometryRole: 'NONE', coordinates: points[0], multimodalEvidence: { humanValidationStatus: 'PENDING_REVIEW', forensicIntegrity: { sha256: 'preserved' } } };
  const parent = { hipotesis: 'UNTOUCHED', canonicalGeography: canonicalizeConfirmedDraftGeography({ projectId:'A',draft:draft('poligono') }), tacticalStreetViews: [{ captureId: 'sv' }] };
  const f = adminFixture({ 'projects/A': parent, 'projects/A/documents/doc': document });
  const input = { projectId: 'A', id: 'doc', kind: 'PHOTO' as const, operation: 'REVIEW' as const, data: { projectId: 'A', id: 'doc', source: 'DOCUMENT_PHOTO', action, comment: 'Revisión humana', expectedReview: reviewVersion(adaptDocumentToAdditionalPhotoEvidence({ ...document, id: 'doc' })) } };
  const authorize = jest.fn(async () => ({ allowed: true, projectId: 'A', actor: { institutionalUserId: '1', username:'PPC', role:'USER' } } as any));
  const result = await executeInstitutionalGeointEntity('session', input, { authorize, database: () => f.db });
  expect(authorize).toHaveBeenCalledWith({ sessionToken: 'session', projectId: 'A', action: 'WRITE' });
  expect(result.multimodalEvidence.humanValidationStatus).toBe(result.humanValidationStatus);
  expect(f.get('projects/A')).toMatchObject(parent); expect(f.entries().some(([path]) => path.includes('/photos/'))).toBe(false);
  expect(f.get('projects/A/documents/doc').coordinates).toEqual(points[0]);
});
test('READ denial rejects document review before database access', async () => {
  const database = jest.fn();
  await expect(executeInstitutionalGeointEntity('session', { projectId:'A',kind:'PHOTO',operation:'REVIEW',id:'doc',data:{ projectId:'A',id:'doc',source:'DOCUMENT_PHOTO',action:'APPROVE',comment:'review',expectedReview:'[]' } },
    { authorize: async () => ({ allowed:false } as any), database })).rejects.toThrow('GEOINT_ENTITY_ACCESS_DENIED');
  expect(database).not.toHaveBeenCalled();
});
test('non-image document cannot use photographic review or mutate anything', async () => {
  const doc = { type:'application/pdf' }; const f = adminFixture({ 'projects/A':{},'projects/A/documents/doc':doc }); const before = f.entries();
  await expect(executeInstitutionalGeointEntity('session', { projectId:'A',kind:'PHOTO',operation:'REVIEW',id:'doc',data:{ projectId:'A',id:'doc',source:'DOCUMENT_PHOTO',action:'APPROVE',comment:'review',expectedReview:reviewVersion(doc) } },
    { authorize: async () => ({ allowed:true,projectId:'A',actor:{} } as any),database:()=>f.db })).rejects.toThrow('EVIDENCE_REVIEW_NOT_PHOTOGRAPHIC');
  expect(f.entries()).toEqual(before);
});
