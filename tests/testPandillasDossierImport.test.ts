import type { GangEntity, GangMember } from '../src/modules/pandillas/pandillas.mapper';
import { parseAndValidateR3Payload, previewR3Update, buildR3UpdateResult, reviewR3Update, canApplyR3Update } from '../src/modules/pandillas/pandillasDossierImport';
import { buildDossierImportResult as build, previewDossierImport as preview,
  normalizePandillasImportText, parseAndValidateDossierImportPayload as parse, reviewDossierImport as review,
  canApplyDossierImport as canApply, dossierImportFingerprint, verifyDossierImportWrite,
  type DossierImportMemberInput } from '../src/modules/pandillas/pandillasDossierImport';

const member = (nombre = 'Persona Ejemplo'): GangMember => ({ nombre, alias: 'Ejemplo', rol: '', tatuajes: 'Marca X', telefono: 'Ejemplo', escuela: 'Escuela A' });
const gang = (): GangEntity => ({ id: 'gang-example', projectId: 'project-example', nombre: 'Grupo Ejemplo', zonaInfluencia: '', integrantes: [member()] });

describe('R3 UPDATE_ONLY (fixtures ficticias, sin persistencia)', () => {
  const input = (extra: Record<string, unknown> = {}) => ({ schemaVersion: '3.0', module: 'pandillas', operation: 'UPDATE_ONLY', targetGangName: 'Grupo Ejemplo', membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { complexion: 'Dato documental' } }], ...extra });
  const parseR3 = (extra: Record<string, unknown> = {}) => parseAndValidateR3Payload(JSON.stringify(input(extra)));
  test('schema separado y campos documentales aceptados', () => {
    expect(parseR3({ gangUpdate: { aliasConocidos: 'Alias documental' } }).schemaVersion).toBe('3.0');
    expect(buildR3UpdateResult(gang(), parseR3()).integrantes[0].complexion).toBe('Dato documental');
  });
  test.each(['ADD', 'DELETE', 'UPDATE', null])('rechaza operación %s', operation => expect(() => parseR3({ operation })).toThrow('R3_UPDATE_ONLY_REQUIRED'));
  test.each(['nombre', 'id', 'projectId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'geoReportId', 'peligrosidad', 'nivelRiesgo', 'resumenInteligencia', 'geometrias', 'relaciones', 'cronologiaEventos', 'imagenesGrafiti', 'grafitiInfo', 'archivosAnexos', 'desconocido'])('rechaza campo pandilla %s', field => {
    expect(() => parseR3({ gangUpdate: { [field]: null } })).toThrow('R3_UNKNOWN_FIELD');
  });
  test.each(['nombre', 'id', 'fotografiaUrl', 'nivelViolencia', 'riesgoCriminogeno', 'peligrosidadCalculada', 'georreferencia', 'fechaNacimiento', 'nacionalidad', 'padre', 'madre', 'desconocido'])('rechaza campo integrante %s', field => {
    expect(() => parseR3({ membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { [field]: null } }] })).toThrow('R3_UNKNOWN_FIELD');
  });
  test.each([null, '', '   '])('ausencia %s no destruye', value => {
    const existing = gang();
    const payload = parseR3({ membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { alias: value } }] });
    expect(buildR3UpdateResult(existing, payload)).toEqual(existing);
    expect(previewR3Update(existing, payload).fields).toEqual([]);
  });
  test('arrays vacíos omiten; no vacíos tienen antes/después explícitos', () => {
    const existing = { ...gang(), coloniasAsociadas: ['Anterior'] };
    expect(buildR3UpdateResult(existing, parseR3({ gangUpdate: { coloniasAsociadas: [] } })).coloniasAsociadas).toEqual(['Anterior']);
    const payload = parseR3({ gangUpdate: { coloniasAsociadas: ['Documentada'] }, membersUpdate: [] });
    expect(previewR3Update(existing, payload).fields).toEqual([{ scope: 'GANG', field: 'coloniasAsociadas', currentValue: ['Anterior'], proposedValue: ['Documentada'], classification: 'UPDATE' }]);
  });
  test.each(['Persona Nueva', 'persona ejemplo', 'Persona Ejemplo '])('nombre no exacto %s no crea', nombre => {
    const payload = parseR3({ membersUpdate: [{ nombre, changes: { alias: 'X' } }] });
    expect(previewR3Update(gang(), payload).conflicts).toContain(`R3_MEMBER_NOT_FOUND:${nombre}`);
    expect(() => buildR3UpdateResult(gang(), payload)).toThrow();
  });
  test('duplicados existentes y entrantes bloquean', () => {
    expect(previewR3Update({ ...gang(), integrantes: [member(), member()] }, parseR3()).conflicts).toContain('R3_AMBIGUOUS_MEMBER:Persona Ejemplo');
    expect(previewR3Update(gang(), parseR3({ membersUpdate: [input().membersUpdate[0], input().membersUpdate[0]] })).conflicts).toContain('R3_DUPLICATE_INCOMING_MEMBER:Persona Ejemplo');
  });
  test('pandilla distinta y nombres globales no seleccionan objetivo', () => {
    expect(previewR3Update(gang(), parseR3({ targetGangName: 'grupo ejemplo' })).conflicts).toContain('TARGET_GANG_MISMATCH');
    expect(() => buildR3UpdateResult(gang(), parseR3({ targetGangName: 'Otra' }))).toThrow();
  });
  test('preview por campo y NO_CHANGE; resumen cuenta solo updates', () => {
    const payload = parseR3({ gangUpdate: { zonaInfluencia: 'Zona' }, membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { alias: 'Ejemplo', complexion: 'Dato' } }] });
    const preview = previewR3Update(gang(), payload);
    expect(preview.summary).toEqual({ UPDATE_FIELDS: 2, NO_CHANGE_FIELDS: 1, CONFLICTS: 0, MEMBERS_TOUCHED: 1, GANG_FIELDS_TOUCHED: 1 });
    expect(preview.fields.find(field => field.field === 'alias')).toMatchObject({ currentValue: 'Ejemplo', proposedValue: 'Ejemplo', classification: 'NO_CHANGE' });
    expect(preview.fields.every(field => ['UPDATE', 'NO_CHANGE', 'CONFLICT'].includes(field.classification))).toBe(true);
  });
  test('preserva propiedades ajenas, orden, longitud, versión y fuente sin mutaciones', () => {
    const existing: GangEntity = { ...gang(), updatedAt: 42, createdAt: 1, nivelRiesgo: 'Alto', integrantes: [{ ...member(), nivelViolencia: 'Alto', peligrosidadCalculada: 50 }, member('Otra Persona')] };
    const before = structuredClone(existing); const payload = parseR3(); const original = structuredClone(payload);
    const result = buildR3UpdateResult(existing, payload);
    expect(result).toEqual({ ...before, integrantes: [{ ...before.integrantes[0], complexion: 'Dato documental' }, before.integrantes[1]] });
    expect(existing).toEqual(before); expect(payload).toEqual(original);
    expect(result.integrantes.map(m => m.nombre)).toEqual(before.integrantes.map(m => m.nombre));
    expect(result).not.toHaveProperty('source');
  });
  test.each([0, 42, null])('versión %s capturada del registro', updatedAt => {
    const existing = updatedAt === null ? gang() : { ...gang(), updatedAt };
    const payload = parseR3(); const reviewed = reviewR3Update(existing, payload);
    expect(reviewed.expectedUpdatedAt).toBe(updatedAt);
    expect(canApplyR3Update(existing, payload, reviewed)).toBe(true);
    expect(canApplyR3Update({ ...existing, updatedAt: 99 }, payload, reviewed)).toBe(false);
    expect(canApplyR3Update(existing, parseR3({ gangUpdate: { aliasConocidos: 'Cambio' } }), reviewed)).toBe(false);
    expect(canApplyR3Update({ ...existing, zonaInfluencia: 'Cambio' }, payload, reviewed)).toBe(false);
  });
  test('conflicto y preview ausente impiden aplicar', () => {
    const payload = parseR3({ targetGangName: 'Otra' });
    expect(canApplyR3Update(gang(), payload, reviewR3Update(gang(), payload))).toBe(false);
    expect(canApplyR3Update(gang(), parseR3(), null)).toBe(false);
  });
  test('contrato final GANG/MEMBER sin propiedades legacy', () => {
    const payload = parseR3({ gangUpdate: { zonaInfluencia: 'Zona documental' }, membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { alias: 'Ejemplo', complexion: 'Dato' } }] });
    const fields = previewR3Update(gang(), payload).fields;
    expect(fields.find(row => row.scope === 'GANG')).toEqual({ scope: 'GANG', field: 'zonaInfluencia', currentValue: '', proposedValue: 'Zona documental', classification: 'UPDATE' });
    expect(fields.find(row => row.field === 'complexion')).toEqual({ scope: 'MEMBER', memberName: 'Persona Ejemplo', field: 'complexion', currentValue: undefined, proposedValue: 'Dato', classification: 'UPDATE' });
    expect(fields.find(row => row.field === 'alias')).toEqual({ scope: 'MEMBER', memberName: 'Persona Ejemplo', field: 'alias', currentValue: 'Ejemplo', proposedValue: 'Ejemplo', classification: 'NO_CHANGE' });
    for (const row of fields) {
      for (const legacy of ['nombre', 'current', 'proposed', 'action']) expect(row).not.toHaveProperty(legacy);
      if (row.scope === 'GANG') expect(row).not.toHaveProperty('memberName');
      else expect(row.memberName).toBe('Persona Ejemplo');
    }
  });
  test('contrato CONFLICT y contadores bloquean aplicación', () => {
    const payload = parseR3({ membersUpdate: [{ nombre: 'Persona Ausente', changes: { alias: 'Dato' } }] });
    const reviewed = reviewR3Update(gang(), payload);
    expect(reviewed.preview.fields).toEqual([{ scope: 'MEMBER', memberName: 'Persona Ausente', field: '(registro)', currentValue: undefined, proposedValue: undefined, classification: 'CONFLICT' }]);
    expect(reviewed.preview.summary).toEqual({ UPDATE_FIELDS: 0, NO_CHANGE_FIELDS: 0, CONFLICTS: 1, MEMBERS_TOUCHED: 0, GANG_FIELDS_TOUCHED: 0 });
    for (const legacy of ['nombre', 'current', 'proposed', 'action']) expect(reviewed.preview.fields[0]).not.toHaveProperty(legacy);
    expect(canApplyR3Update(gang(), payload, reviewed)).toBe(false);
  });
  test('sexo documental enum; valores incompatibles no se infieren', () => {
    expect(parseR3({ membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { sexo: 'Femenino' } }] }).membersUpdate[0].changes.sexo).toBe('Femenino');
    expect(() => parseR3({ membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { sexo: 'F' } }] })).toThrow('R3_INVALID_FIELD_VALUE');
  });
  test.each([{ projectId: 'otro' }, { expectedUpdatedAt: 3 }, { gangUpdate: { estatus: 'Desconocido' } }, { gangUpdate: { coloniasAsociadas: 'Texto' } }, { membersUpdate: [{ nombre: 'Persona Ejemplo', changes: { edad: -1 } }] }])('contrato rechaza campos y tipos inválidos %j', extra => expect(() => parseR3(extra)).toThrow());
});
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
