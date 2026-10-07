jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
import { webcrypto, createHash } from 'crypto';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { exportMemberDossierToWord } from '../src/lib/exportToWord';
import { buildMemberDossierView, isDossierExportCurrent, resolveDossierWordTarget, prepareAuthorizedDossierWordView, dossierWordErrorMessage, logDossierWordStage, DossierWordError } from '../src/modules/pandillas/memberDossierView';
import { legacyMemberFingerprint } from '../src/modules/pandillas/photo-evidence/identity';
import type { DossierPhoto } from '../src/modules/pandillas/photo-evidence/dossierPhotoDisplay';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const hash = createHash('sha256').update(png).digest('hex');
const member = { nombre: 'Integrante documental', alias: '', rol: '', fotografiaUrl: 'legacy-unchanged' };
const context = { projectId: 'P', gangId: 'G', actor: 'synthetic-user' };
const photo: DossierPhoto = { assetId: 'asset', associationId: 'association', derivedSha256: hash, derivedUrl: 'https://storage.googleapis.com/synthetic/primary.png?signature=SYNTHETIC_PRIVATE', documentVersion: 1, associationVersion: 1, selectionVersion: 1, mimeType: 'image/png', width: 1, height: 1 };
const view = () => buildMemberDossierView(member, 'Pandilla', { primary: photo, additional: [] });
let fetchMock: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, 'createImageBitmap', { value: jest.fn(async () => ({ width: 1, height: 1, close: jest.fn() })), configurable: true });
  fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(png, { headers: { 'content-type': 'image/png' } }));
});
afterEach(() => { fetchMock.mockRestore(); delete (globalThis as any).createImageBitmap; });

test('autonomous dossier completes eight runtime stages without an active Project, geometry or import target', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await exportMemberDossierToWord(view(), { ...context, memberId: 'opaque-fingerprint' }, () => true);
    const events = log.mock.calls.filter(([prefix]) => prefix === '[DOSSIER_WORD]').map(([, data]) => JSON.parse(data));
    for (let n = 1; n <= 8; n++) expect(events.some(event => event.stage.startsWith(`DOSSIER_WORD_STAGE_${n}_`) && event.status === 'PASS')).toBe(true);
    expect(events.every(event => !event.hasActiveProject && !event.projectDependencyDetected && event.memberId === 'opaque-fingerprint')).toBe(true);
    expect(events.find(event => event.stage === 'DOSSIER_WORD_STAGE_8_DOWNLOAD' && event.status === 'PASS')).toMatchObject({ primaryMime: 'image/png', primaryBytes: png.length, docxBuildStarted: true, docxBuildCompleted: true });
    const zip = await JSZip.loadAsync(await (saveAs as jest.Mock).mock.calls[0][0].arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('FICHA INSTITUCIONAL'); expect(xml).not.toMatch(/EXP:|geometría|hipótesis|dummy/i);
  } finally { log.mockRestore(); }
});
test('nested causes and diagnostic identifiers cannot disclose signed URLs, cookies or tokens', () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const error = new Error('https://private.example/path?token=PRIVATE_TOKEN');
    (error as Error & { cause?: unknown }).cause = new Error('Cookie=PRIVATE_COOKIE /private/storage/path');
    logDossierWordStage('DOSSIER_WORD_STAGE_6_PACKER', 'FAIL', {
      memberId: 'https://private.example?token=PRIVATE_TOKEN', hasPrimaryPhoto: true,
      additionalPhotoCount: 0, hasActiveProject: false, projectDependencyDetected: false,
      primaryMime: 'Cookie=PRIVATE_COOKIE', directPandillasEntry: true,
    }, error);
    const event = JSON.parse(log.mock.calls[0][1]);
    expect(event.errorCause).toEqual({ errorName: 'Error', errorMessage: 'UNCLASSIFIED_RUNTIME_FAILURE' });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE_TOKEN|PRIVATE_COOKIE|https:|\/private\/storage/);
    (error as Error & { cause?: unknown }).cause = new ReferenceError('Buffer is not defined');
    logDossierWordStage('DOSSIER_WORD_STAGE_6_PACKER', 'FAIL', { hasPrimaryPhoto: true, additionalPhotoCount: 0, hasActiveProject: false, projectDependencyDetected: false }, error);
    expect(JSON.parse(log.mock.calls.at(-1)![1]).errorCause.errorMessage).toBe('Buffer is not defined');
  } finally { log.mockRestore(); }
});
test('runtime failure identifies the first failed stage without logging private exceptions', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await expect(exportMemberDossierToWord({ ...view(), name: '' }, context, () => true)).rejects.toMatchObject({ code: 'BUILD_FAILED' });
    const events = log.mock.calls.map(([, data]) => JSON.parse(data));
    expect(events.filter(event => event.status === 'FAIL')).toEqual([expect.objectContaining({ stage: 'DOSSIER_WORD_STAGE_4_RENDERER', errorName: 'Error', errorMessage: 'DOSSIER_INCOMPLETE' })]);
    expect(events.some(event => event.stage === 'DOSSIER_WORD_STAGE_6_PACKER')).toBe(false);
    logDossierWordStage('DOSSIER_WORD_STAGE_6_PACKER', 'FAIL', { hasPrimaryPhoto: true, additionalPhotoCount: 0, hasActiveProject: false, projectDependencyDetected: false }, new Error('https://private/path?token=SECRET Cookie=PRIVATE'));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/SECRET|Cookie|https:|signature/);
    logDossierWordStage('DOSSIER_WORD_STAGE_4_RENDERER', 'FAIL', { hasPrimaryPhoto: true, additionalPhotoCount: 0, hasActiveProject: false, projectDependencyDetected: false }, new TypeError("Cannot read properties of undefined (reading 'map')"));
    expect(JSON.parse(log.mock.calls.at(-1)![1]).errorMessage).toContain("reading 'map'");
  } finally { log.mockRestore(); }
});
test('absent PRIMARY is an explicit error before packaging or download', async () => {
  await expect(exportMemberDossierToWord({ ...view(), photos: [] }, context, () => true)).rejects.toMatchObject({ code: 'PRIMARY_UNAVAILABLE', stage: 'PHOTO' });
  expect(fetchMock).not.toHaveBeenCalled(); expect(saveAs).not.toHaveBeenCalled();
});

test('identical parent rerender during Word download is allowed; actual scope/member/tab changes block', async () => {
  const expected = { scope: 'P/G/user', selected: member, members: [member], enabled: true };
  let current = expected;
  fetchMock.mockImplementation(async () => { current = { ...expected }; return new Response(png, { headers: { 'content-type': 'image/png' } }); });
  await exportMemberDossierToWord(view(), context, () => isDossierExportCurrent(current, expected));
  expect(saveAs).toHaveBeenCalledTimes(1);
  for (const changed of [{ ...expected, scope: 'OTHER' }, { ...expected, selected: null }, { ...expected, members: [] }, { ...expected, enabled: false }]) expect(isDossierExportCurrent(changed, expected)).toBe(false);
});
test('PRIMARY plus additional produces actual DOCX Blob and starts one .docx download, without data mutation', async () => {
  const snapshot = JSON.stringify(member);
  const documentView = view(); documentView.photos.push({ label: 'Otra fotografía asociada', url: 'https://storage.googleapis.com/synthetic/extra.png' });
  await exportMemberDossierToWord(documentView, context, () => true);
  const [blob, filename] = (saveAs as jest.Mock).mock.calls[0];
  expect(blob).toBeInstanceOf(Blob); expect(filename).toMatch(/\.docx$/);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  expect((await zip.file('word/document.xml')!.async('string')).match(/<w:drawing>/g)).toHaveLength(2);
  expect(fetchMock.mock.calls.every(([, options]) => options?.credentials === 'omit')).toBe(true);
  expect(JSON.stringify(member)).toBe(snapshot);
});
test('fresh authorized resolution uses same-origin session, renewed URL and no auth/me or login dependency', async () => {
  const currentView = view(), renewed = { ...photo, derivedUrl: photo.derivedUrl + '-renewed' };
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ projectId: 'P', gangId: 'G', expiresAt: Date.now() + 120000,
    items: [{ memberFingerprint: await legacyMemberFingerprint(member), memberId: 'identity', hasPrimaryPhoto: true, assetId: 'asset', derivedUrl: renewed.derivedUrl, primaryPhoto: renewed, additionalPhotos: [] }] })));
  const fresh = await prepareAuthorizedDossierWordView(currentView, member, 'P', 'G');
  expect(fresh.photos[0].url).toBe(renewed.derivedUrl);
  expect(fetchMock).toHaveBeenCalledWith('/api/pandillas/primary-photos?projectId=P&gangId=G', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
});
test.each([401, 403, 503])('authorization HTTP %i produces a controlled failure before any image/download', async status => {
  fetchMock.mockResolvedValue(new Response('{}', { status }));
  await expect(prepareAuthorizedDossierWordView(view(), member, 'P', 'G')).rejects.toMatchObject({ code: status === 401 ? 'SESSION_EXPIRED' : status === 403 ? 'ACCESS_DENIED' : 'READ_UNAVAILABLE', httpStatus: status });
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(saveAs).not.toHaveBeenCalled();
});
test('missing PRIMARY fails explicitly, preserves authorization and never downloads a incomplete Word', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 403 }));
  await expect(exportMemberDossierToWord(view(), context, () => true)).rejects.toMatchObject({ code: 'PRIMARY_UNAVAILABLE', stage: 'PHOTO', httpStatus: 403 });
  expect(saveAs).not.toHaveBeenCalled();
});
test('unavailable additional renders governed fallback and keeps association provenance without blocking PRIMARY', async () => {
  const documentView = view(); documentView.photos.push({ label: 'Otra fotografía asociada', url: 'https://storage.googleapis.com/synthetic/extra.png', evidence: { ...photo, assetId: 'extra', associationId: 'extra-association', selectionVersion: undefined } });
  fetchMock.mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } })).mockResolvedValueOnce(new Response('', { status: 404 }));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await exportMemberDossierToWord(documentView, context, () => true);
    const zip = await JSZip.loadAsync(await (saveAs as jest.Mock).mock.calls[0][0].arrayBuffer());
    expect(await zip.file('word/document.xml')!.async('string')).toContain('Fuente visual no disponible');
    expect(await zip.file('docProps/custom.xml')!.async('string')).toContain('IMAGE_UNAVAILABLE');
    expect(JSON.stringify(warning.mock.calls)).not.toContain('signature');
  } finally { warning.mockRestore(); }
});
test('context changing after packing prevents download', async () => {
  let checks = 0;
  await expect(exportMemberDossierToWord(view(), context, () => ++checks === 1)).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
  expect(saveAs).not.toHaveBeenCalled();
});
test('download and unknown technical errors are differentiated without URLs, cookies or private messages', async () => {
  (saveAs as jest.Mock).mockImplementationOnce(() => { throw new Error('PRIVATE_SECRET'); });
  await expect(exportMemberDossierToWord(view(), context, () => true)).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(dossierWordErrorMessage(new DossierWordError('SESSION_EXPIRED', 'AUTHORIZATION', 401))).toContain('Sesión expirada');
    expect(dossierWordErrorMessage(new Error(photo.derivedUrl))).toBe('Error al construir el documento Word.');
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/signature|PRIVATE_SECRET|https:/);
  } finally { warning.mockRestore(); }
});

test('standalone /pandillas Word derives scope from one institutional gang, while explicit project mismatch/static/duplicates remain denied', () => {
  const gang = { id: 'G', projectId: 'P', nombre: 'Pandilla', zonaInfluencia: '', integrantes: [member] };
  expect(resolveDossierWordTarget([gang], 'G')).toBe(gang);
  expect(resolveDossierWordTarget([gang], 'G', 'P')).toBe(gang);
  expect(resolveDossierWordTarget([gang], 'G', 'OTHER')).toBeNull();
  expect(resolveDossierWordTarget([gang, gang], 'G')).toBeNull();
  expect(resolveDossierWordTarget([gang], 'static-gang-G')).toBeNull();
});
test('standalone view without resolved photos can obtain PRIMARY through authorized READ, without changing preview or member', async () => {
  const plainMember = { nombre: 'Integrante', alias: '', rol: '' };
  const plainView = buildMemberDossierView(plainMember, 'Pandilla');
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ projectId: 'P', gangId: 'G', expiresAt: Date.now() + 120000,
    items: [{ memberFingerprint: await legacyMemberFingerprint(plainMember), memberId: 'identity', hasPrimaryPhoto: true, assetId: photo.assetId, derivedUrl: photo.derivedUrl, primaryPhoto: photo, additionalPhotos: [] }] })));
  expect((await prepareAuthorizedDossierWordView(plainView, plainMember, 'P', 'G')).photos).toHaveLength(1);
  expect(plainView.photos).toEqual([]); expect(plainMember).toEqual({ nombre: 'Integrante', alias: '', rol: '' });
});
