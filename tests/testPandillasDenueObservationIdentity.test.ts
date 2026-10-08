jest.mock('@/lib/osintActions', () => ({ getScinceData: jest.fn(), getDenueData: jest.fn(), getTelegramOsintData: jest.fn() }));
jest.mock('@/modules/pandillas/pandillas.service', () => ({ PandillasService: { analyzeGang: jest.fn() } }));
import { getScinceData, getDenueData, getTelegramOsintData } from '@/lib/osintActions';
import { PandillasService } from '@/modules/pandillas/pandillas.service';
import { PandillasEngine } from '@/modules/pandillas/pandillas.engine';
import { prepareDenueAcquisitionPois } from '@/utils/denueCanonicalPoi';
const query = '21.88,-102.29,350';
const raw = (id: string = '123456') => ({ Id: id, Nombre: 'Negocio ficticio válido', Clase_actividad: 'Comercio', Latitud: 21.88, Longitud: -102.29 });
const prepare = (records: any[]) => prepareDenueAcquisitionPois(records, { query, acquiredAt: '2026-01-01T00:00:00Z' });
const gang = { projectId: 'context-fixture', nombre: 'Grupo ficticio', coordenadas: { lat: 21.88, lng: -102.29 } };
const response = (pois: any[]) => ({ exito: true, total: pois.length, pois, resumen: 'UNTRUSTED_AGGREGATE', epistemicIntegrity: {
  sourceId: 'inegi-denue-api', providerId: 'INEGI_DENUE', sourceType: 'DENUE', acquisitionMode: 'OBSERVED', acquisitionStatus: 'ACQUIRED',
} });
const run = () => PandillasEngine.executeFullSweep(gang as any, 'Contexto ficticio');
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getScinceData).mockResolvedValue({ exito: false, epistemicIntegrity: {} } as any);
  jest.mocked(getTelegramOsintData).mockResolvedValue({ success: false, epistemicIntegrity: {} } as any);
  jest.mocked(getDenueData).mockResolvedValue(response(prepare([raw()])) as any);
  jest.mocked(PandillasService.analyzeGang).mockResolvedValue({ exito: true } as any);
});
test('canonical identity and acquired provenance reach orchestration unchanged', async () => {
  const result = await run(); const poi = result.denueInfo.pois[0];
  expect(poi.sourceEvidenceId).toBe('denue:123456');
  expect(result.sourceOrchestrationItems![0].itemId).toContain('denue%3A123456');
  expect(result.sourceOrchestrationItems![0].source.rawSourceReference).toBe(poi.rawSourceReference);
  expect(poi.epistemicIntegrity.acquiredAt).toBe('2026-01-01T00:00:00Z');
  expect(result.denueObservationDiagnostics).toEqual([]);
  expect(PandillasService.analyzeGang).toHaveBeenCalledWith(gang, expect.stringContaining('Negocio ficticio válido'));
  expect(jest.mocked(PandillasService.analyzeGang).mock.calls[0][1]).not.toContain('UNTRUSTED_AGGREGATE');
});
test.each(['missing', 'malformed', 'derived', 'mismatched', 'provenance', 'date', 'provider', 'query', 'coordinates', 'traceability', 'sanitized-official-id'])('%s observation excluded from IA, retained as diagnostic', async kind => {
  const poi: any = prepare([raw()])[0]; poi.Nombre = 'INVALID_RECORD_SENTINEL';
  if (kind === 'missing') delete poi.sourceEvidenceId;
  if (kind === 'malformed') poi.sourceEvidenceId = 'denue:bad id';
  if (kind === 'derived') poi.sourceEvidenceId = 'denue:derived:abc';
  if (kind === 'mismatched') poi.sourceEvidenceId = 'denue:other';
  if (kind === 'provenance') delete poi.epistemicIntegrity.rawSourceReference;
  if (kind === 'date') poi.epistemicIntegrity.acquiredAt = 'invalid';
  if (kind === 'provider') poi.epistemicIntegrity.providerId = 'OTHER';
  if (kind === 'query') poi.epistemicIntegrity.query = 'other-territory';
  if (kind === 'coordinates') poi.lat = 999;
  if (kind === 'traceability') delete poi.traceabilityId;
  if (kind === 'sanitized-official-id') { poi.Id = 'bad id'; poi.sourceEvidenceId = 'denue:bad-id'; }
  jest.mocked(getDenueData).mockResolvedValue(response([poi]) as any);
  const result = await run(); expect(result.denueInfo.pois).toEqual([]);
  expect(result.sourceOrchestrationItems).toEqual([]); expect(result.denueObservationDiagnostics).toHaveLength(1);
  expect(jest.mocked(PandillasService.analyzeGang).mock.calls[0][1]).not.toContain('INVALID_RECORD_SENTINEL');
});
test('missing official identity is never rescued by provider derived hash', async () => {
  const { Id, ...withoutId } = raw();
  jest.mocked(getDenueData).mockResolvedValue(response(prepare([withoutId])) as any);
  expect((await run()).denueInfo.pois).toEqual([]);
});
test('all duplicate identities excluded, unique observations still propagate', async () => {
  jest.mocked(getDenueData).mockResolvedValue(response(prepare([raw('1'), raw('1'), raw('2')])) as any);
  const result = await run(); expect(result.denueInfo.pois.map((p: any) => p.sourceEvidenceId)).toEqual(['denue:2']);
  expect(result.denueObservationDiagnostics!.map(d => d.reason)).toEqual(['DENUE_DUPLICATE_OBSERVATION_IDENTITY', 'DENUE_DUPLICATE_OBSERVATION_IDENTITY']);
});
test('aggregate acquired response without records is diagnostic, never an observation', async () => {
  jest.mocked(getDenueData).mockResolvedValue(response([]) as any);
  const result = await run(); expect(result.sourceOrchestrationItems).toEqual([]);
  expect(result.denueObservationDiagnostics![0].reason).toBe('DENUE_OBSERVATIONS_UNAVAILABLE');
});
