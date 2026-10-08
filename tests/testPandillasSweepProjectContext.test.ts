import fs from 'node:fs';
import ts from 'typescript';
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'fixture-session' }) }) }));
jest.mock('@/services/institutionalProjectAccessService', () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock('@/lib/institutionalGangActions', () => ({}));
jest.mock('@/lib/institutionalPandillasReadActions', () => ({}));
jest.mock('@/lib/geminiEnv', () => ({ GCP_PROJECT_ID: 'fixture', GEMINI_MODEL: 'fixture', GCP_CLIENT_EMAIL: '', GCP_PRIVATE_KEY: '' }));
jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));
import { GoogleGenAI } from '@google/genai';
import { authorizeInstitutionalProjectAccess } from '@/services/institutionalProjectAccessService';
import { POST } from '@/app/api/pandillas/route';
import { PandillasService } from '@/modules/pandillas/pandillas.service';
import { PandillasSweepError } from '@/modules/pandillas/pandillas.sweepStatus';

const source = fs.readFileSync('src/modules/pandillas/pandillas.ui.tsx', 'utf8');
const start = source.indexOf('  const handleExecuteTargetedSweep = async');
const code = ts.transpileModule(source.slice(start, source.indexOf('  const handleResetForm', start)), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  const state: any = {
    caseEnabled: true, PANDILLAS_CASE_MESSAGE: 'Contexto requerido', uiScope: { caseProjectId: 'case-fixture' },
    projectId: 'case-fixture', activeProject: { id: 'case-fixture', canonicalGeography: {} },
    sweepContextGuard: { current: { caseProjectId: 'case-fixture', propProjectId: 'case-fixture', activeProjectId: 'case-fixture' } },
    canWriteInstitutionalProject: jest.fn().mockResolvedValue(true), nombre: 'Grupo ficticio', barridoTarget: 'all',
    integrantes: [], selectedTargetId: '', zonaInfluencia: 'Zona ficticia', geometrias: [], relaciones: [], cronologiaEventos: [],
    inSituOrchestrationItems: [], album: [], estatus: undefined, peligrosidad: undefined, modusOperandi: '',
    adaptPandillasCanonicalInput: jest.fn(() => ({ representativePoint: { lat: 21.88, lng: -102.29 } })),
    PandillasEngine: { executeFullSweep: jest.fn().mockResolvedValue({ sweepStatus: 'EMPTY' }) }, PandillasSweepError,
    PANDILLAS_SWEEP_MESSAGES: { EMPTY: 'Sin coincidencias' },
    setIsAnalyzing: jest.fn(), setAnalysisResult: jest.fn(), setAnalyzeStep: jest.fn(), registerSweep: jest.fn(), alert: jest.fn(),
    console: { error: jest.fn() }, setTimeout: (callback: () => void) => callback(),
  };
  return state;
}
const run = (state: any) => new Function('state', 'const {' + Object.keys(state).join(',') + '}=state;' + code + ';return handleExecuteTargetedSweep();')(state);
afterEach(() => jest.restoreAllMocks());
test('explicit case ID reaches inputGang and territorial adapter independently of MASTER custody', async () => {
  const s = fixture(); s.integrantes = [{ nombre: 'Persona ficticia', projectId: 'different-master-custody' }];
  await run(s);
  expect(s.canWriteInstitutionalProject).toHaveBeenCalledWith('case-fixture');
  expect(s.adaptPandillasCanonicalInput.mock.calls[0][0].projectId).toBe('case-fixture');
  expect(s.PandillasEngine.executeFullSweep.mock.calls[0][0].projectId).toBe('case-fixture');
  expect(s.integrantes[0].projectId).toBe('different-master-custody');
});
test.each(['absent', 'prop-mismatch', 'active-mismatch', 'missing-active', 'disabled'])('%s blocks before acquisition/AI', async kind => {
  const s = fixture();
  if (kind === 'absent') s.uiScope.caseProjectId = undefined;
  if (kind === 'prop-mismatch') s.projectId = 'other';
  if (kind === 'active-mismatch') s.activeProject.id = 'other';
  if (kind === 'missing-active') s.activeProject = undefined;
  if (kind === 'disabled') s.caseEnabled = false;
  await run(s); expect(s.PandillasEngine.executeFullSweep).not.toHaveBeenCalled(); expect(s.alert).toHaveBeenCalled();
});
test('standalone module uses explicit opted-in contextual project without component prop', async () => {
  const s = fixture(); s.projectId = undefined; s.sweepContextGuard.current.propProjectId = undefined;
  await run(s); expect(s.PandillasEngine.executeFullSweep.mock.calls[0][0].projectId).toBe('case-fixture');
});
test.each(['denied', 'revoked', 'context-changed'])('%s prevents sweep', async kind => {
  const s = fixture();
  if (kind === 'denied') s.canWriteInstitutionalProject.mockResolvedValue(false);
  if (kind === 'revoked') s.canWriteInstitutionalProject.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  if (kind === 'context-changed') s.setAnalyzeStep.mockImplementation(() => { s.sweepContextGuard.current.activeProjectId = 'other'; });
  await run(s); expect(s.PandillasEngine.executeFullSweep).not.toHaveBeenCalled();
});
test('context change while sweep is running prevents registration in another case', async () => {
  const s = fixture(); s.PandillasEngine.executeFullSweep.mockImplementation(async () => {
    s.sweepContextGuard.current.activeProjectId = 'other'; return { sweepStatus: 'EMPTY' };
  }); await run(s); expect(s.registerSweep).not.toHaveBeenCalled();
});
test('service serializes contextual ID and endpoint rejects unauthorized context before AI', async () => {
  const authorize = jest.mocked(authorizeInstitutionalProjectAccess); authorize.mockResolvedValue({ allowed: false, code: 'PROJECT_ACCESS_DENIED' } as any);
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => POST(new Request('http://localhost/api/pandillas', {
    ...init, headers: { 'content-type': 'application/json', origin: 'http://localhost' },
  })));
  const s = fixture(); s.PandillasEngine.executeFullSweep.mockImplementation((gang: any, context: string) => PandillasService.analyzeGang(gang, context));
  await run(s);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).projectId).toBe('case-fixture');
  expect(authorize).toHaveBeenCalledWith({ sessionToken: 'fixture-session', projectId: 'case-fixture', action: 'WRITE' });
  expect(GoogleGenAI).not.toHaveBeenCalled(); expect(s.registerSweep).not.toHaveBeenCalled();
});
