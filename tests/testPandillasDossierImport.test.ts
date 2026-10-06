import type { GangEntity, GangMember } from '../src/modules/pandillas/pandillas.mapper';
import { buildDossierImportResult as build, previewDossierImport as preview,
  normalizePandillasImportText, parseAndValidateDossierImportPayload as parse, reviewDossierImport as review,
  canApplyDossierImport as canApply, dossierImportFingerprint, verifyDossierImportWrite,
  type DossierImportMemberInput } from '../src/modules/pandillas/pandillasDossierImport';

const member = (nombre = 'Persona Ejemplo'): GangMember => ({ nombre, alias: 'Ejemplo', rol: '', tatuajes: 'Marca X', telefono: 'Ejemplo', escuela: 'Escuela A' });
const gang = (): GangEntity => ({ id: 'gang-example', projectId: 'project-example', nombre: 'Grupo Ejemplo', zonaInfluencia: '', integrantes: [member()] });
test('T1 ADD supplies required empty strings without inventing status', () => {
  const input = [{ nombre: 'Persona Nueva' }];
  expect(preview(gang(), input).summary.ADD).toBe(1);
  expect(build(gang(), input).integrantes[1]).toEqual({ nombre: 'Persona Nueva', alias: '', rol: '' });
});
test('T2 UPDATE preserves omitted member fields and original input', () => {
  const existing = gang(); const before = structuredClone(existing);
  const result = build(existing, [{ nombre: 'Persona Ejemplo', domicilioConocido: 'Domicilio ejemplo' }]);
  expect(preview(existing, [{ nombre: 'Persona Ejemplo', domicilioConocido: 'Domicilio ejemplo' }]).summary.UPDATE).toBe(1);
  expect(result.integrantes[0]).toEqual({ ...before.integrantes[0], domicilioConocido: 'Domicilio ejemplo' });
  expect(existing).toEqual(before);
});
test('T3 NO_CHANGE after repeated application', () => {
  const input = [{ nombre: 'Persona Ejemplo', edad: '18' }]; const result = build(gang(), input);
  expect(preview(result, input).summary.NO_CHANGE).toBe(1);
  expect(build(result, input)).toEqual(result);
});
test('T4 duplicate incoming normalized names block build', () => {
  const input = [{ nombre: 'Persona Nueva' }, { nombre: ' pérsona   nueva ' }];
  expect(preview(gang(), input).conflicts.join()).toContain('CONFLICT_DUPLICATE_INCOMING_MEMBER');
  expect(() => build(gang(), input)).toThrow('CONFLICT_DUPLICATE_INCOMING_MEMBER');
});
test('T5 duplicate existing names block even an empty batch', () => {
  const existing = gang(); existing.integrantes.push(member(' Pérsona  Ejemplo '));
  expect(preview(existing, []).conflicts.join()).toContain('CONFLICT_DUPLICATE_EXISTING_MEMBER');
  expect(() => build(existing, [])).toThrow('CONFLICT_DUPLICATE_EXISTING_MEMBER');
});
test('T6 unrelated member preserved, with no shared mutable references', () => {
  const existing = gang(); existing.integrantes.push(member('Persona Ajena'));
  const result = build(existing, [{ nombre: 'Persona Ejemplo', edad: 18 }]);
  expect(result.integrantes[1]).toEqual(existing.integrantes[1]);
  expect(result.integrantes[1]).not.toBe(existing.integrantes[1]);
});
test('T7 all top-level properties including unknown historical data preserved', () => {
  const existing = { ...gang(), createdAt: 0, createdBy: '', geoReportId: 'example', relaciones: [],
    geometrias: [], cronologiaEventos: [], imagenesGrafiti: [], archivosAnexos: [], extra: { history: ['example'] } };
  const result = build(existing, []);
  expect(result).toEqual(existing);
  expect((result as typeof existing).extra).not.toBe(existing.extra);
});
test('T8 undefined cannot erase an existing field; explicit empty string can update', () => {
  expect(build(gang(), [{ nombre: 'Persona Ejemplo', tatuajes: undefined }]).integrantes[0].tatuajes).toBe('Marca X');
  expect(build(gang(), [{ nombre: 'Persona Ejemplo', tatuajes: '' }]).integrantes[0].tatuajes).toBe('');
});
test.each(['peligrosidadCalculada', 'georreferencia', 'nivelViolencia', 'riesgoCriminogeno', 'sexo'])(
  'T9–T13 does not create %s and rejects its injection at runtime', field => {
    const result = build(gang(), [{ nombre: 'Persona Nueva' }]);
    expect(result.integrantes.every(m => !Object.prototype.hasOwnProperty.call(m, field))).toBe(true);
    expect(() => build(gang(), [{ nombre: 'Persona Nueva', [field]: 'forbidden' } as DossierImportMemberInput])).toThrow('CONFLICT_INVALID_INCOMING_MEMBER');
  });
test('T14 static records blocked', () => {
  const existing = { ...gang(), id: 'static-gang-example' };
  expect(preview(existing, []).conflicts).toContain('CONFLICT_STATIC_GANG');
  expect(() => build(existing, [])).toThrow('CONFLICT_STATIC_GANG');
});
test('normalization only changes comparison keys', () => {
  expect(normalizePandillasImportText('  PÉRSONA   Ejemplo  ')).toBe('persona ejemplo');
  const result = build(gang(), [{ nombre: ' Pérsona   Ejemplo ' }]);
  expect(result.integrantes).toHaveLength(1);
  expect(result.integrantes[0].nombre).toBe(' Pérsona   Ejemplo ');
});
test.each([{}, { nombre: '' }, { nombre: 'Persona Nueva', edad: NaN }, { nombre: 'Persona Nueva', escuela: null },
  { nombre: 'Persona Nueva', coordenadas: {} }, { nombre: 'Persona Nueva', estatusPandilla: 'invalid' }])(
  'malformed input fails closed: %j', input => {
    expect(() => build(gang(), [input as DossierImportMemberInput])).toThrow('CONFLICT');
  });
test('missing ID and malformed existing members blocked', () => {
  expect(() => build({ ...gang(), id: undefined }, [])).toThrow('CONFLICT_INVALID_GANG_ID');
  expect(() => build({ ...gang(), integrantes: [null] } as unknown as GangEntity, [])).toThrow('CONFLICT_INVALID_EXISTING_MEMBERS');
});
test('pre-existing analytical fields preserved without recalculation', () => {
  const existing = gang(); Object.assign(existing.integrantes[0], { peligrosidadCalculada: 7, georreferencia: { lat: 1, lng: 2 }, sexo: 'Otro', nivelViolencia: 'Bajo', riesgoCriminogeno: 'Medio' });
  expect(build(existing, [{ nombre: 'Persona Ejemplo', edad: 18 }]).integrantes[0]).toEqual({ ...existing.integrantes[0], edad: 18 });
});

const payload = () => ({ schemaVersion: '1.0', module: 'pandillas', targetGangName: 'Grupo Ejemplo',
  source: { type: 'institutional-document', description: 'Fuente ficticia' }, members: [{ nombre: 'Persona Nueva', edad: '25' }] });
const parsed = () => parse(JSON.stringify(payload()));
test('T24 valid local JSON parsed', () => { expect(parsed()).toEqual(payload()); });
test.each([
  ['T25', 'schemaVersion', '2.0', 'INVALID_SCHEMA_VERSION'],
  ['T26', 'module', 'other', 'INVALID_MODULE'],
  ['T27', 'targetGangName', '  ', 'INVALID_TARGET_GANG'],
  ['T28', 'members', [], 'INVALID_MEMBERS'],
])('%s rejects invalid %s', (_case, key, value, error) => {
  expect(() => parse(JSON.stringify({ ...payload(), [key as string]: value }))).toThrow(error as string);
});
test.each(['unknown', 'sexo', 'nivelViolencia', 'riesgoCriminogeno', 'peligrosidadCalculada', 'georreferencia'])(
  'T29–T34 rejects member field %s', field => {
    expect(() => parse(JSON.stringify({ ...payload(), members: [{ nombre: 'Persona Nueva', [field]: 'forbidden' }] }))).toThrow('UNKNOWN_MEMBER_FIELD');
  });
test('T35 photographs temporarily rejected', () => {
  expect(() => parse(JSON.stringify({ ...payload(), members: [{ nombre: 'Persona Nueva', fotografiaUrl: '' }] }))).toThrow('FOTOGRAFIA_URL_NOT_ALLOWED_IN_R2');
});
test('T36 target comparison normalizes without rewriting original data', () => {
  const input = parse(JSON.stringify({ ...payload(), targetGangName: ' GRÚPO  Ejemplo ' }));
  expect(review(gang(), input).preview.summary.ADD).toBe(1); expect(input.targetGangName).toBe(' GRÚPO  Ejemplo ');
});
test('T37 mismatch never chooses another target', () => {
  expect(() => review(gang(), { ...parsed(), targetGangName: 'Otro Grupo' })).toThrow('TARGET_GANG_MISMATCH');
});
test('T38 equal fingerprints keep review valid, independent of key ordering', () => {
  const original = parsed(); const reordered = { members: original.members, source: original.source, targetGangName: original.targetGangName, module: original.module, schemaVersion: original.schemaVersion };
  expect(dossierImportFingerprint(original)).toBe(dossierImportFingerprint(reordered));
  expect(canApply(gang(), reordered, review(gang(), original))).toBe(true);
});
test('T39 changed batch invalidates review', () => {
  const original = parsed(); const changed = { ...original, members: [{ nombre: 'Persona Diferente' }] };
  expect(canApply(gang(), changed, review(gang(), original))).toBe(false);
});
test('T40 null version captured and accepted; missing capture rejected', () => {
  const input = parsed(); const reviewed = review(gang(), input);
  expect(reviewed.expectedUpdatedAt).toBeNull(); expect(canApply(gang(), input, reviewed)).toBe(true);
  const missing = { ...reviewed }; delete (missing as Partial<typeof missing>).expectedUpdatedAt;
  expect(canApply(gang(), input, missing)).toBe(false);
});
test('T41 static target blocks apply', () => {
  const target = { ...gang(), id: 'static-gang-example' }; const input = parsed();
  expect(canApply(target, input, review(target, input))).toBe(false);
});
test('T42 conflicts block apply', () => {
  const input = { ...parsed(), members: [{ nombre: 'Persona Nueva' }, { nombre: 'Persona Nueva' }] };
  expect(canApply(gang(), input, review(gang(), input))).toBe(false);
});
test('T43 build preserves document ID', () => { expect(build(gang(), parsed().members).id).toBe(gang().id); });
test('T44 build preserves project ID', () => { expect(build(gang(), parsed().members).projectId).toBe(gang().projectId); });
test('T45 unrelated top-level properties preserved', () => {
  const target = { ...gang(), extra: { historical: true }, archivosAnexos: [] };
  expect(build(target, parsed().members)).toMatchObject({ extra: target.extra, archivosAnexos: [] });
});
test('T46 omitted fields and unrelated members remain', () => {
  const result = build(gang(), [{ nombre: 'Persona Ejemplo', edad: '25' }]);
  expect(result.integrantes[0]).toEqual({ ...gang().integrantes[0], edad: '25' });
});
test.each(['updatedAt', 'coordenadas', 'lat', 'lng', 'source'])('hidden member metadata %s rejected', field => {
  expect(() => parse(JSON.stringify({ ...payload(), members: [{ nombre: 'Persona Nueva', [field]: 1 }] }))).toThrow('UNKNOWN_MEMBER_FIELD');
});
test('top-level version and source extensions rejected', () => {
  expect(() => parse(JSON.stringify({ ...payload(), updatedAt: 20 }))).toThrow('UNKNOWN_PAYLOAD_FIELD');
  expect(() => parse(JSON.stringify({ ...payload(), source: { type: 'institutional-document', hidden: true } }))).toThrow('INVALID_SOURCE');
});
test.each([null, 3, { nombre: '' }, { nombre: 'Persona Nueva', edad: null }])('malformed member %j rejected', value => {
  expect(() => parse(JSON.stringify({ ...payload(), members: [value] }))).toThrow('INVALID_MEMBER_RECORD');
});
test('malformed JSON rejected', () => { expect(() => parse('{')).toThrow('INVALID_JSON'); });
test('changed loaded document or selection invalidates reviewed state', () => {
  const input = parsed(); const reviewed = review(gang(), input);
  expect(canApply({ ...gang(), id: 'other-example' }, input, reviewed)).toBe(false);
  expect(canApply({ ...gang(), projectId: 'other-example' }, input, reviewed)).toBe(false);
  expect(canApply({ ...gang(), zonaInfluencia: 'Changed' }, input, reviewed)).toBe(false);
  expect(canApply({ ...gang(), updatedAt: 0 }, input, reviewed)).toBe(false);
});
test('post-write verifies all imported and preserved properties with new audit metadata', () => {
  const expected = build(gang(), parsed().members);
  expect(verifyDossierImportWrite(expected, { ...expected, updatedAt: 1, updatedBy: 'fixture-operator', createdAt: 1, createdBy: 'fixture-operator' }, null)).toBe(true);
});
test.each(['id', 'projectId', 'nombre', 'zonaInfluencia'])('post-write mismatch in %s fails certification', key => {
  const expected = build(gang(), parsed().members);
  expect(verifyDossierImportWrite(expected, { ...expected, updatedAt: 1, [key]: 'Wrong' }, null)).toBe(false);
});
test('missing, incomplete, or unchanged-version re-read cannot declare success', () => {
  const expected = build(gang(), parsed().members);
  expect(verifyDossierImportWrite(expected, undefined, null)).toBe(false);
  expect(verifyDossierImportWrite(expected, { ...expected, integrantes: [], updatedAt: 1 }, null)).toBe(false);
  expect(verifyDossierImportWrite(expected, { ...expected, updatedAt: 1 }, 1)).toBe(false);
});
