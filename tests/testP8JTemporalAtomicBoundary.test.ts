jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(() => { throw new Error('REAL_ADAPTER_NOT_ALLOWED'); }) }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'offline-server-timestamp' } }));
import { executeInstitutionalTemporal } from '../src/services/geoint/institutionalTemporalBoundary';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';
const record: any = { id: 'cmp', expedienteId: 'A', traceabilityId: 'trace-A', sourceEvidenceId: 'source-A', evidenceA: { id: 'ev-A' }, evidenceB: { id: 'ev-B' }, spatialValidation: { compatible: true, distanceMeters: 0 }, temporalValidation: { valid: true, status: 'VALID' }, analystValidation: { status: 'APPROVED_EVIDENCE', reviewerId: 'forged' }, createdAt: '2026-01-01' };
function fixture() {
 const db = adminFixture({ 'projects/A': { deleted: false, estado: 'ABIERTO' } });
 const authorize = jest.fn(async (input: any) => ({ allowed: true, projectId: 'A', actor: { institutionalUserId: '1', username: 'fixture', role: 'USER' }, policyVersion: 'EXPLICIT_ACTION_GRANT_V1' }));
 return { ...db, authorize, dependencies: { authorize: authorize as any, database: () => db.db } };
}
const request: any = { session: 'offline', projectId: 'A', operation: 'SAVE', record };
test('entity, root, fingerprint, outbox and audit commit together with server actor', async () => {
 const f = fixture(); const result: any = await executeInstitutionalTemporal(request,f.dependencies);
 expect(result.analystValidation).toEqual({ status: 'PENDING_REVIEW', reviewerId: 'user:1' });
 expect(f.get('projects/A/geoint_temporal_comparisons/cmp').expedienteId).toBe('A');
 expect(f.get('geoint_temporal_comparisons/cmp').expedienteId).toBe('A');
 expect(f.entries().filter(([key]) => key.startsWith('geoint_event_outbox/'))).toHaveLength(1);
 expect(f.entries().filter(([key]) => key.startsWith('audit_logs/'))).toHaveLength(1);
});
test.each(['audit_logs/', 'geoint_event_outbox/', 'projects/A/geoint_temporal_comparisons/', 'geoint_event_fingerprints/'])('write failure at %s leaves no partial state', async path => { const f = fixture(); f.failWrite(path); await expect(executeInstitutionalTemporal(request,f.dependencies)).rejects.toThrow(); expect(f.entries()).toEqual([['projects/A',{ deleted: false, estado: 'ABIERTO' }]]); });
test('commit failure cannot acknowledge success', async () => { const f = fixture(); f.failCommit(true); await expect(executeInstitutionalTemporal(request,f.dependencies)).rejects.toThrow(); expect(f.entries()).toHaveLength(1); });
test.each(['MISSING_GRANT','REVOKED','INVALID_ACTOR','INFRA_FAILURE'])('denied %s never initializes database', async reason => { const database = jest.fn(); await expect(executeInstitutionalTemporal(request,{ authorize: jest.fn(async () => ({ allowed: false, code: reason })) as any, database })).rejects.toThrow('ACCESS_DENIED'); expect(database).not.toHaveBeenCalled(); });
test('cross-project client record is denied', async () => { const f = fixture(); await expect(executeInstitutionalTemporal({ ...request, record: { ...record, expedienteId: 'B' } },f.dependencies)).rejects.toThrow('PAYLOAD_INVALID'); expect(f.entries()).toHaveLength(1); });
test('legacy root collision in another project cannot be overwritten', async () => { const f = fixture(); f.seed('geoint_temporal_comparisons/cmp',{ ...record, expedienteId: 'B' }); await expect(executeInstitutionalTemporal(request,f.dependencies)).rejects.toThrow('CROSS_PROJECT'); expect(f.entries()).toHaveLength(2); });
test('same creation retry is idempotent', async () => { const f = fixture(); await executeInstitutionalTemporal(request,f.dependencies); const count = f.entries().length; await executeInstitutionalTemporal(request,f.dependencies); expect(f.entries()).toHaveLength(count); });
test('changed creation retry is rejected without rewriting evidence', async () => { const f = fixture(); await executeInstitutionalTemporal(request,f.dependencies); const before = f.entries(); await expect(executeInstitutionalTemporal({ ...request, record: { ...record, sourceEvidenceId: 'forged' } },f.dependencies)).rejects.toThrow('IMMUTABLE'); expect(f.entries()).toEqual(before); });
test('review uses institutional actor and emits atomic human event', async () => { const f = fixture(); await executeInstitutionalTemporal(request,f.dependencies); const result: any = await executeInstitutionalTemporal({ session: 'offline', projectId: 'A', operation: 'REVIEW', comparisonId: 'cmp', status: 'APPROVED_EVIDENCE', comments: 'Human review' },f.dependencies); expect(result.analystValidation.reviewerId).toBe('user:1'); expect(result.analystValidation.status).toBe('APPROVED_EVIDENCE'); expect(f.entries().filter(([key]) => key.startsWith('audit_logs/'))).toHaveLength(2); });
