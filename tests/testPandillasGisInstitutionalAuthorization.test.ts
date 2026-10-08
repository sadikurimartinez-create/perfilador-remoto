import { createHash } from 'crypto';
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: mockToken }) }) }));
const mockAuthorize = jest.fn();
const mockList = jest.fn();
const mockAnalyze = jest.fn();
const mockProcess = jest.fn();
let mockToken: string | undefined = 'valid';
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: (...args: any[]) => mockAuthorize(...args) }));
jest.mock('@/services/institutionalPandillasRepository', () => ({ InstitutionalPandillasRepository: jest.fn().mockImplementation(() => ({ listMasterGangs: mockList })) }));
jest.mock('@/lib/providers/gangGISAnalysisLayer', () => ({ GangGISAnalysisLayer: { processGISData: (...args: any[]) => mockProcess(...args) } }));
jest.mock('@/lib/geoint/geoIntAnalyticsEngine', () => ({ GeoIntAnalyticsEngine: { analyze: (...args: any[]) => mockAnalyze(...args) } }));
jest.mock('@/lib/criminal/correlation/criminalCorrelationEngine', () => ({ CriminalIntelligenceCorrelationEngine: { correlate: jest.fn(() => ({})) } }));
import { POST } from '@/app/api/pandillas/analyze-gis/route';

const shape = { id: 'shape-a', tipo: 'poligono', nombre: 'Polígono ficticio', puntos: [{ lat: 21.88, lng: -102.29 }, { lat: 21.89, lng: -102.29 }, { lat: 21.89, lng: -102.28 }], fechaActualizacion: '2026-01-01' };
const a = { id: 'gang-a', nombre: 'Grupo ficticio A', integrantes: [], geometrias: [shape], updatedAt: 1, projectId: 'custody-a' };
const b = { id: 'gang-b', nombre: 'Grupo ficticio B', integrantes: [], geometrias: [], updatedAt: 2, projectId: 'custody-b' };
const master = (gang: any) => { const { projectId, ...data } = gang; return { ...data, scope: { kind: 'MASTER' }, custody: { custodyProjectId: projectId } }; };
function canonical(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const hash = (gangs: any[]) => '"' + createHash('sha256').update(canonical([...gangs].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))).digest('hex') + '"';
const payload = () => ({ projectId: 'context-case', selectedGangIds: ['gang-a'], activeLayers: ['domiciles'], geometryRefs: [{ gangId: 'gang-a', geometryId: 'shape-a' }] });
const request = (body: any = payload(), match: string | null = hash([a]), origin = 'http://localhost') => new Request('http://localhost/api/pandillas/analyze-gis', { method: 'POST', headers: { origin, ...(match ? { 'if-match': match } : {}) }, body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks(); mockToken = 'valid';
  mockAuthorize.mockImplementation(async ({ sessionToken, projectId }: any) => sessionToken !== 'valid' ? { allowed: false, code: 'PROJECT_ACCESS_UNAUTHENTICATED' } : { allowed: true, projectId, actor: { institutionalUserId: 'fixture-user' } });
  mockList.mockResolvedValue([master(a), master(b)]);
  mockProcess.mockReturnValue({ nodes: [{ member_id: 'synthetic', alias: 'Fixture', gang: a.nombre, location: { lat: 21.88, lng: -102.29 }, confidence: 1, source: 'registry' }], zones: [] });
  mockAnalyze.mockResolvedValue({ report: 'Informe ficticio', structuredOutput: {}, isAiGenerated: true });
});
beforeAll(() => jest.spyOn(console, 'info').mockImplementation(() => undefined));
afterAll(() => jest.restoreAllMocks());

test('authorized invocation reconstructs sources and preserves response; no client inventory', async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ report: 'Informe ficticio', structuredOutput: { cice_report: {} }, isAiGenerated: true });
  expect(mockAuthorize).toHaveBeenCalledWith({ sessionToken: 'valid', projectId: 'context-case', action: 'WRITE' });
  expect(mockAuthorize).toHaveBeenCalledWith({ sessionToken: 'valid', projectId: 'custody-a', action: 'READ' });
  expect(mockProcess).toHaveBeenCalledWith([a]);
  expect(mockAnalyze.mock.calls[0][0].allGangs).toEqual([a]);
  expect(mockAnalyze.mock.calls[0][0].manualDrawings[0].coordinates).toEqual(shape.puntos);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
test('different authorized custodians remain independent from context case', async () => {
  const body = payload(); body.selectedGangIds.push('gang-b');
  expect((await POST(request(body, hash([a,b])))).status).toBe(200);
  expect(mockAuthorize).toHaveBeenCalledWith({ sessionToken: 'valid', projectId: 'custody-b', action: 'READ' });
});
test.each([undefined, 'expired', 'invalid'])('missing/expired/invalid session %s never invokes AI', async token => {
  mockToken = token; expect((await POST(request())).status).toBe(401); expect(mockAnalyze).not.toHaveBeenCalled();
});
test.each(['PROJECT_ACCESS_DENIED', 'PROJECT_ACCESS_REVOKED', 'PROJECT_ACCESS_PROJECT_DELETED', 'PROJECT_ACCESS_PROJECT_INACCESSIBLE', 'PROJECT_ACCESS_PROJECT_NOT_FOUND', 'PROJECT_ACCESS_RECONCILIATION_REQUIRED'])('context denial %s prevents AI even with READ', async code => {
  mockAuthorize.mockResolvedValue({ allowed: false, code });
  expect((await POST(request())).status).toBe(403); expect(mockAnalyze).not.toHaveBeenCalled();
});
test.each(['PROJECT_ACCESS_DENIED', 'PROJECT_ACCESS_REVOKED', 'PROJECT_ACCESS_PROJECT_DELETED', 'PROJECT_ACCESS_PROJECT_INACCESSIBLE'])('custody READ denial %s prevents AI', async code => {
  mockAuthorize.mockImplementation(async ({ projectId, action }: any) => action === 'READ' ? { allowed: false, code } : { allowed: true, projectId, actor: { institutionalUserId: 'fixture-user' } });
  expect((await POST(request())).status).toBe(403); expect(mockAnalyze).not.toHaveBeenCalled();
});
test.each(['allGangs','domiciles','influenceZones','manualDrawings','providerTelemetry','selectedGangs','relations'])('legacy/artificial field %s is rejected', async field => {
  expect((await POST(request({ ...payload(), [field]: [] }))).status).toBe(400); expect(mockAnalyze).not.toHaveBeenCalled();
});
test.each([
  { selectedGangIds: ['missing'] }, { selectedGangIds: ['gang-a','gang-a'] }, { selectedGangIds: ['../gang'] },
  { activeLayers: ['osint'] }, { activeLayers: ['domiciles','domiciles'] },
  { geometryRefs: [{ gangId: 'gang-b', geometryId: 'shape-a' }] },
  { geometryRefs: [{ gangId: 'gang-a', geometryId: 'unsaved-draft' }] },
  { geometryRefs: [{ gangId: 'gang-a', geometryId: 'shape-a', points: [] }] },
  { projectId: '' }, { selectedGangIds: [] }, { selectedGangIds: 'gang-a' }
])('invalid/unavailable reference %j cannot invoke AI', async patch => {
  expect((await POST(request({ ...payload(), ...patch }))).status).toBeGreaterThanOrEqual(400); expect(mockAnalyze).not.toHaveBeenCalled();
});
test.each([null, '"bad"', '"' + '0'.repeat(64) + '"'])('missing/stale snapshot %s prevents AI', async match => {
  expect((await POST(request(payload(), match))).status).toBeGreaterThanOrEqual(400); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('source changes during reconstruction prevent AI', async () => {
  mockList.mockResolvedValueOnce([master(a)]).mockResolvedValueOnce([master({ ...a, updatedAt: 2 })]);
  expect((await POST(request())).status).toBe(409); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('duplicate persisted IDs are denied', async () => {
  mockList.mockResolvedValue([master(a),master(a)]);
  expect((await POST(request())).status).toBe(403); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('identical gang names never merge', async () => {
  const other = { ...b, nombre: a.nombre }; mockList.mockResolvedValue([master(a),master(other)]);
  const body = payload(); body.selectedGangIds.push('gang-b');
  expect((await POST(request(body, hash([a,other])))).status).toBe(409); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('cross-origin blocked before model', async () => {
  expect((await POST(request(payload(), hash([a]), 'https://other.invalid'))).status).toBe(403); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('unavailable repository fails closed without leaking exception', async () => {
  mockList.mockRejectedValue(new Error('private-database-detail'));
  const response = await POST(request()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('private-database-detail'); expect(mockAnalyze).not.toHaveBeenCalled();
});

test('revocation in final pre-model authorization prevents AI', async () => {
  let writes = 0;
  mockAuthorize.mockImplementation(async ({ projectId, action }: any) => action === 'WRITE' && ++writes === 2 ? { allowed: false, code: 'PROJECT_ACCESS_REVOKED' } : { allowed: true, projectId, actor: { institutionalUserId: 'fixture-user' } });
  expect((await POST(request())).status).toBe(403); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('snapshot detects source content change even without updatedAt change', async () => {
  mockList.mockResolvedValue([master({ ...a, integrantes: [{ nombre: 'Otra ficha ficticia' }] })]);
  expect((await POST(request())).status).toBe(409); expect(mockAnalyze).not.toHaveBeenCalled();
});
test('size and malformed JSON rejected before AI', async () => {
  for (const raw of ['{bad', ' '.repeat(65537)]) {
    const response = await POST(new Request('http://localhost/api/pandillas/analyze-gis', { method: 'POST', headers: { origin: 'http://localhost' }, body: raw }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  expect(mockAnalyze).not.toHaveBeenCalled();
});
test('no source provider availability is invented', async () => {
  const { CriminalIntelligenceCorrelationEngine } = await import('@/lib/criminal/correlation/criminalCorrelationEngine');
  expect((await POST(request())).status).toBe(200);
  expect(CriminalIntelligenceCorrelationEngine.correlate).toHaveBeenCalledWith(expect.objectContaining({ incidentsCount: 0, rssCount: 0, hasGoogleMaps: false, hasScince: false, hasDenue: false }));
});

// Execute the actual UI handler in isolation, with synthetic state and no network.
async function runUi(overrides: Record<string, any> = {}) {
  const fs = require('fs'); const ts = require('typescript');
  const source = fs.readFileSync('src/modules/pandillas/pandillas.ui.tsx', 'utf8');
  const start = source.indexOf('  const handleGisAnalysis = async');
  const end = source.indexOf('  // --- GRANULAR GEOSPATIAL SWEEPS', start);
  const send = jest.fn(async () => ({ ok: true, json: async () => ({ report: 'fixture', structuredOutput: {} }) }));
  const alert = jest.fn();
  const state = { caseEnabled: true, PANDILLAS_CASE_MESSAGE: 'context required', selectedGangsForGis: [a.nombre],
    setIsGisAnalyzing: jest.fn(), setGisAnalysisReport: jest.fn(), setGisStructuredOutput: jest.fn(),
    activeGisLayers: { domiciles: true }, uiScope: { caseProjectId: 'context-case' }, projectId: 'context-case',
    gisContextGuard: { current: { caseProjectId: 'context-case', propProjectId: 'context-case', activeProjectId: 'context-case' } }, activeProject: { id: 'context-case' }, storedGangs: [a], selectedGangId: a.id, geometrias: a.geometrias,
    crypto: require('crypto').webcrypto, fetch: send, alert, console: { error: jest.fn() }, TextEncoder, ...overrides };
  const compiled = ts.transpileModule(source.slice(start,end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  await new Function('state', 'const {' + Object.keys(state).join(',') + '} = state; ' + compiled + '; return handleGisAnalysis();')(state);
  return { send, alert };
}
test('UI sends references and matching concurrency digest only', async () => {
  const { send } = await runUi(); expect(send).toHaveBeenCalledTimes(1);
  const request = send.mock.calls[0] as any;
  expect(JSON.parse(request[1].body)).toEqual(payload());
  expect(request[1].headers['If-Match']).toBe(hash([a]));
});
test.each([
  { caseEnabled: false }, { uiScope: {} }, { activeProject: { id: 'other-case' } },
  { geometrias: [{ ...shape, nombre: 'Borrador no persistido' }] },
  { geometrias: [{ ...shape, id: 'unsaved' }] },
  { storedGangs: [a, { ...a, id: 'other-id' }] }
])('UI blocks missing/mismatched context and draft/ambiguous sources %j', async overrides => {
  const { send, alert } = await runUi(overrides); expect(send).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalled();
});

test('UI context change while hashing prevents request', async () => {
  const guard = { current: { caseProjectId: 'context-case', propProjectId: 'context-case', activeProjectId: 'context-case' } };
  const { send, alert } = await runUi({ gisContextGuard: guard, crypto: { subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => {
    guard.current.caseProjectId = 'other-case';
    return require('crypto').webcrypto.subtle.digest('SHA-256', bytes);
  } } } });
  expect(send).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalled();
});
