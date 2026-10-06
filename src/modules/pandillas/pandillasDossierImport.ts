import type { GangEntity, GangMember } from './pandillas.mapper';

const fields = ['nombre', 'alias', 'rol', 'edad', 'antecedentes', 'tatuajes',
  'domicilioConocido', 'detencionesPrevias', 'ingresosCentrosInternamiento',
  'consumoDrogas', 'cicatrices', 'marcasDistintivas', 'lugarTrabajo',
  'actividadEconomica', 'escuela', 'curp', 'fotografiaUrl', 'estatusPandilla'] as const;
export type DossierImportMemberInput = Pick<GangMember, 'nombre'> &
  Partial<Pick<GangMember, Exclude<typeof fields[number], 'nombre'>>>;
const statuses: NonNullable<GangMember['estatusPandilla']>[] = ['Líder', 'Segundo al mando',
  'Reclutador', 'Distribuidor', 'Vigilante', 'Operador', 'Integrante', 'Exintegrante', 'Colaborador externo'];
export type DossierImportAction = 'ADD' | 'UPDATE' | 'NO_CHANGE' | 'CONFLICT';
export interface DossierImportPreview {
  targetGang: string;
  existingMemberCount: number;
  entries: { nombre: string; action: DossierImportAction; changedFields: string[] }[];
  conflicts: string[];
  summary: Record<DossierImportAction, number>;
}
export function normalizePandillasImportText(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}
function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // structuredClone may return plain objects from another JavaScript realm.
  return prototype === null || (Object.getPrototypeOf(prototype) === null && prototype.constructor?.name === 'Object');
}
function validName(value: unknown): value is string {
  return typeof value === 'string' && normalizePandillasImportText(value).length > 0;
}
function duplicates(members: { nombre: string }[]): string[] {
  const counts = new Map<string, number>();
  members.forEach(m => { const name = normalizePandillasImportText(m.nombre); counts.set(name, (counts.get(name) || 0) + 1); });
  return [...counts].filter(([, count]) => count > 1).map(([name]) => name).sort();
}
export function previewDossierImport(existingGang: GangEntity, incomingMembers: DossierImportMemberInput[]): DossierImportPreview {
  const conflicts: string[] = [];
  const existing = record(existingGang) && Array.isArray(existingGang.integrantes) ? existingGang.integrantes : [];
  const incoming = Array.isArray(incomingMembers) ? incomingMembers : [];
  if (!record(existingGang) || !validName(existingGang.id) || existingGang.id !== existingGang.id.trim()
    || /[\/\\\x00-\x1f]/.test(existingGang.id)) conflicts.push('CONFLICT_INVALID_GANG_ID');
  if (typeof existingGang?.id === 'string' && existingGang.id.trim().startsWith('static-gang-')) conflicts.push('CONFLICT_STATIC_GANG');
  if (!record(existingGang) || !validName(existingGang.nombre) || typeof existingGang.zonaInfluencia !== 'string'
    || !Array.isArray(existingGang.integrantes)) conflicts.push('CONFLICT_INVALID_GANG');
  const existingValid = existing.every(m => record(m) && validName(m.nombre) && typeof m.alias === 'string' && typeof m.rol === 'string');
  if (!existingValid) conflicts.push('CONFLICT_INVALID_EXISTING_MEMBERS');
  if (!Array.isArray(incomingMembers)) conflicts.push('CONFLICT_INVALID_INCOMING_MEMBERS');
  incoming.forEach((member, index) => {
    if (!record(member) || !validName(member.nombre) || Reflect.ownKeys(member).some(key =>
      typeof key !== 'string' || !fields.includes(key as typeof fields[number]))) {
      conflicts.push(`CONFLICT_INVALID_INCOMING_MEMBER:${index}`); return;
    }
    for (const key of fields) {
      if (!Object.prototype.hasOwnProperty.call(member, key) || member[key] === undefined) continue;
      const value = member[key];
      const valid = key === 'edad' ? (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value) && value >= 0))
        : key === 'estatusPandilla' ? statuses.includes(value as NonNullable<GangMember['estatusPandilla']>) : typeof value === 'string';
      if (!valid) conflicts.push(`CONFLICT_INVALID_FIELD:${index}:${key}`);
    }
  });
  if (existingValid) duplicates(existing).forEach(name => conflicts.push(`CONFLICT_DUPLICATE_EXISTING_MEMBER:${name}`));
  if (incoming.every(m => record(m) && validName(m.nombre))) duplicates(incoming).forEach(name => conflicts.push(`CONFLICT_DUPLICATE_INCOMING_MEMBER:${name}`));
  const entries: DossierImportPreview['entries'] = incoming.map(member => {
    const nombre = typeof member?.nombre === 'string' ? member.nombre : '';
    if (conflicts.length) return { nombre, action: 'CONFLICT', changedFields: [] };
    const old = existing.find(m => normalizePandillasImportText(m.nombre) === normalizePandillasImportText(nombre));
    const changedFields = fields.filter(key => Object.prototype.hasOwnProperty.call(member, key)
      && member[key] !== undefined && (!old || old[key] !== member[key]));
    return { nombre, action: !old ? 'ADD' : changedFields.length ? 'UPDATE' : 'NO_CHANGE', changedFields };
  });
  const summary = { ADD: 0, UPDATE: 0, NO_CHANGE: 0, CONFLICT: 0 };
  entries.forEach(entry => summary[entry.action]++);
  if (conflicts.length && !entries.length) summary.CONFLICT = conflicts.length;
  return { targetGang: typeof existingGang?.nombre === 'string' ? existingGang.nombre : '', existingMemberCount: existing.length, entries, conflicts, summary };
}
export function buildDossierImportResult(existingGang: GangEntity, incomingMembers: DossierImportMemberInput[]): GangEntity {
  const preview = previewDossierImport(existingGang, incomingMembers);
  if (preview.conflicts.length) throw new Error(preview.conflicts.join(';'));
  // Clone the complete document, including unknown historical properties.
  const result = structuredClone(existingGang);
  for (const member of incomingMembers) {
    const old = result.integrantes.find(m => normalizePandillasImportText(m.nombre) === normalizePandillasImportText(member.nombre));
    const patch = Object.fromEntries(fields.filter(key => Object.prototype.hasOwnProperty.call(member, key) && member[key] !== undefined).map(key => [key, member[key]]));
    if (old) Object.assign(old, patch);
    else result.integrantes.push({ alias: '', rol: '', ...patch } as GangMember);
  }
  return result;
}

export interface DossierImportPayload {
  schemaVersion: '1.0';
  module: 'pandillas';
  targetGangName: string;
  source?: { type: 'institutional-document'; description?: string };
  members: DossierImportMemberInput[];
}
export function parseAndValidateDossierImportPayload(text: string): DossierImportPayload {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('INVALID_JSON'); }
  if (!record(value)) throw new Error('INVALID_PAYLOAD');
  if (Object.keys(value).some(key => !['schemaVersion', 'module', 'targetGangName', 'source', 'members'].includes(key))) throw new Error('UNKNOWN_PAYLOAD_FIELD');
  if (value.schemaVersion !== '1.0') throw new Error('INVALID_SCHEMA_VERSION');
  if (value.module !== 'pandillas') throw new Error('INVALID_MODULE');
  if (!validName(value.targetGangName)) throw new Error('INVALID_TARGET_GANG');
  if (Object.prototype.hasOwnProperty.call(value, 'source') && (!record(value.source)
    || value.source.type !== 'institutional-document'
    || Object.keys(value.source).some(key => !['type', 'description'].includes(key))
    || ('description' in value.source && typeof value.source.description !== 'string'))) throw new Error('INVALID_SOURCE');
  if (!Array.isArray(value.members) || !value.members.length) throw new Error('INVALID_MEMBERS');
  for (const member of value.members) {
    if (!record(member)) throw new Error('INVALID_MEMBER_RECORD');
    if (Object.prototype.hasOwnProperty.call(member, 'fotografiaUrl')) throw new Error('FOTOGRAFIA_URL_NOT_ALLOWED_IN_R2');
    if (Object.keys(member).some(key => !fields.includes(key as typeof fields[number]))) throw new Error('UNKNOWN_MEMBER_FIELD');
    if (!validName(member.nombre)) throw new Error('INVALID_MEMBER_RECORD');
    const validation = previewDossierImport({ id: 'validation', nombre: 'Validation', zonaInfluencia: '', integrantes: [] }, [member as DossierImportMemberInput]);
    if (validation.conflicts.length) throw new Error('INVALID_MEMBER_RECORD');
  }
  return value as unknown as DossierImportPayload;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'undefined';
}
export function dossierImportFingerprint(payload: DossierImportPayload): string { return canonical(payload); }
export interface DossierImportReview {
  gangId: string;
  projectId: string;
  fingerprint: string;
  gangFingerprint: string;
  expectedUpdatedAt: number | null;
  preview: DossierImportPreview;
}
export function reviewDossierImport(gang: GangEntity, payload: DossierImportPayload): DossierImportReview {
  // Revalidate at the review boundary as well as on file selection.
  parseAndValidateDossierImportPayload(JSON.stringify(payload));
  if (!validName(gang.projectId)) throw new Error('PANDILLAS_PROJECT_REQUIRED');
  if (normalizePandillasImportText(payload.targetGangName) !== normalizePandillasImportText(gang.nombre)) throw new Error('TARGET_GANG_MISMATCH');
  const expectedUpdatedAt = Object.prototype.hasOwnProperty.call(gang, 'updatedAt') ? gang.updatedAt : null;
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'number' || !Number.isFinite(expectedUpdatedAt))) throw new Error('INVALID_EXPECTED_VERSION');
  const preview = previewDossierImport(gang, payload.members);
  return { gangId: gang.id || '', projectId: gang.projectId, fingerprint: dossierImportFingerprint(payload),
    gangFingerprint: canonical(gang), expectedUpdatedAt, preview };
}
export function canApplyDossierImport(gang: GangEntity, payload: DossierImportPayload, review: DossierImportReview | null): boolean {
  if (!review || review.preview.conflicts.length || !Object.prototype.hasOwnProperty.call(review, 'expectedUpdatedAt')) return false;
  try {
    const current = reviewDossierImport(gang, payload);
    return !current.preview.conflicts.length && current.gangId === review.gangId && current.projectId === review.projectId
      && current.fingerprint === review.fingerprint && current.gangFingerprint === review.gangFingerprint
      && current.expectedUpdatedAt === review.expectedUpdatedAt;
  } catch { return false; }
}
export function verifyDossierImportWrite(expected: GangEntity, actual: GangEntity | undefined, expectedVersion: number | null): boolean {
  if (!actual || actual.id !== expected.id || actual.projectId !== expected.projectId || actual.nombre !== expected.nombre
    || typeof actual.updatedAt !== 'number' || !Number.isFinite(actual.updatedAt) || actual.updatedAt === expectedVersion) return false;
  const omitted = ['updatedAt', 'updatedBy'];
  const keys = Object.keys(expected).filter(key => !omitted.includes(key));
  const expectedRecord = expected as unknown as Record<string, unknown>;
  const actualRecord = actual as unknown as Record<string, unknown>;
  return keys.every(key => Object.prototype.hasOwnProperty.call(actualRecord, key) && canonical(expectedRecord[key]) === canonical(actualRecord[key]))
    && Object.keys(actual).every(key => keys.includes(key) || omitted.includes(key) || ['createdAt', 'createdBy'].includes(key));
}

const r3MemberFields = ['alias', 'rol', 'edad', 'antecedentes', 'señasParticulares', 'tatuajes',
  'complexion', 'estatura', 'vestimentaUsual', 'telefonoRedes', 'vehiculosAsociados', 'curp',
  'domicilioConocido', 'telefono', 'detencionesPrevias', 'ingresosCentrosInternamiento', 'consumoDrogas',
  'cicatrices', 'marcasDistintivas', 'lugarTrabajo', 'actividadEconomica', 'escuela', 'estatusPandilla', 'sexo'] as const;
const r3GangFields = ['aliasConocidos', 'estatus', 'zonaInfluencia', 'coloniasAsociadas',
  'municipiosAsociados', 'ilicitos', 'especificarOtroIlicito', 'drogasConsumidas', 'modusOperandi', 'simbolosIdentificacion'] as const;
type R3MemberChanges = Partial<Pick<GangMember, typeof r3MemberFields[number]>>;
type R3GangChanges = Partial<Pick<GangEntity, typeof r3GangFields[number]>>;
export interface R3DossierPayload {
  schemaVersion: '3.0'; module: 'pandillas'; operation: 'UPDATE_ONLY'; targetGangName: string;
  source?: DossierImportPayload['source'];
  gangUpdate?: R3GangChanges;
  membersUpdate: { nombre: string; changes: R3MemberChanges }[];
}
function r3Patch(value: unknown, scope: 'GANG' | 'MEMBER'): Record<string, unknown> {
  if (!record(value)) throw new Error('R3_INVALID_CHANGES');
  const allowed: readonly string[] = scope === 'GANG' ? r3GangFields : r3MemberFields;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error('R3_UNKNOWN_FIELD');
    const proposed = value[key];
    if (proposed === null || proposed === undefined || typeof proposed === 'string' && !proposed.trim()
      || Array.isArray(proposed) && !proposed.length) continue;
    let valid: boolean;
    if (scope === 'GANG' && ['coloniasAsociadas', 'municipiosAsociados', 'drogasConsumidas', 'ilicitos'].includes(key)) {
      valid = Array.isArray(proposed) && Array.from(proposed).every(validName);
      if (valid && key === 'ilicitos') valid = (proposed as string[]).every(item =>
        ['Narcomenudeo', 'Robo', 'Extorsión', 'Homicidio', 'Lesiones', 'Daño en las cosas', 'Vandalismo', 'Otro'].includes(item));
    } else if (key === 'edad') valid = typeof proposed === 'string' || typeof proposed === 'number' && Number.isFinite(proposed) && proposed >= 0;
    else if (key === 'sexo') valid = ['Masculino', 'Femenino', 'Otro'].includes(proposed as string);
    else if (key === 'estatusPandilla') valid = statuses.includes(proposed as NonNullable<GangMember['estatusPandilla']>);
    else if (key === 'estatus') valid = ['Activa', 'Inactiva', 'En observación', 'Desarticulada', 'Sin determinar'].includes(proposed as string);
    else valid = typeof proposed === 'string';
    if (!valid) throw new Error('R3_INVALID_FIELD_VALUE');
    result[key] = structuredClone(proposed);
  }
  return result;
}
export function parseAndValidateR3Payload(text: string): R3DossierPayload {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('INVALID_JSON'); }
  if (!record(value)) throw new Error('R3_INVALID_PAYLOAD');
  if (Object.keys(value).some(key => !['schemaVersion', 'module', 'operation', 'targetGangName', 'source', 'gangUpdate', 'membersUpdate'].includes(key))) throw new Error('R3_UNKNOWN_PAYLOAD_FIELD');
  if (value.schemaVersion !== '3.0') throw new Error('INVALID_SCHEMA_VERSION');
  if (value.module !== 'pandillas') throw new Error('INVALID_MODULE');
  if (value.operation !== 'UPDATE_ONLY') throw new Error('R3_UPDATE_ONLY_REQUIRED');
  if (!validName(value.targetGangName)) throw new Error('INVALID_TARGET_GANG');
  if ('source' in value && (!record(value.source) || value.source.type !== 'institutional-document'
    || Object.keys(value.source).some(key => !['type', 'description'].includes(key))
    || 'description' in value.source && typeof value.source.description !== 'string')) throw new Error('INVALID_SOURCE');
  if (!Array.isArray(value.membersUpdate)) throw new Error('INVALID_MEMBERS');
  if ('gangUpdate' in value) r3Patch(value.gangUpdate, 'GANG');
  for (const member of value.membersUpdate) {
    if (!record(member) || !validName(member.nombre) || Object.keys(member).some(key => !['nombre', 'changes'].includes(key))) throw new Error('INVALID_MEMBER_RECORD');
    r3Patch(member.changes, 'MEMBER');
  }
  return value as unknown as R3DossierPayload;
}
export interface R3FieldPreview {
  scope: 'GANG' | 'MEMBER'; memberName?: string; field: string;
  currentValue: unknown; proposedValue: unknown; classification: 'UPDATE' | 'NO_CHANGE' | 'CONFLICT';
}
export interface R3Preview {
  fields: R3FieldPreview[]; conflicts: string[];
  summary: { UPDATE_FIELDS: number; NO_CHANGE_FIELDS: number; CONFLICTS: number; MEMBERS_TOUCHED: number; GANG_FIELDS_TOUCHED: number };
}
export function previewR3Update(gang: GangEntity, payload: R3DossierPayload): R3Preview {
  parseAndValidateR3Payload(JSON.stringify(payload));
  const conflicts: string[] = [];
  const rows: R3FieldPreview[] = [];
  if (!validName(gang?.id) || gang.id !== gang.id.trim() || /[\/\\]/.test(gang.id) || gang.id.startsWith('static-gang-')) conflicts.push('R3_INVALID_TARGET_ID');
  if (!validName(gang?.projectId)) conflicts.push('PANDILLAS_PROJECT_REQUIRED');
  if (gang?.nombre !== payload.targetGangName) conflicts.push('TARGET_GANG_MISMATCH');
  if (!Array.isArray(gang?.integrantes) || !Array.from(gang.integrantes).every(m => record(m) && validName(m.nombre))) conflicts.push('R3_INVALID_EXISTING_MEMBERS');
  const existing = Array.isArray(gang?.integrantes) ? gang.integrantes : [];
  const incomingCounts = new Map<string, number>();
  payload.membersUpdate.forEach(m => incomingCounts.set(m.nombre, (incomingCounts.get(m.nombre) || 0) + 1));
  const append = (scope: R3FieldPreview['scope'], memberName: string | undefined, old: Record<string, unknown>, patch: Record<string, unknown>) => {
    for (const field of Object.keys(patch).sort()) rows.push({ scope, ...(scope === 'MEMBER' ? { memberName } : {}), field,
      currentValue: structuredClone(old[field]), proposedValue: structuredClone(patch[field]),
      classification: canonical(old[field]) === canonical(patch[field]) ? 'NO_CHANGE' : 'UPDATE' });
  };
  append('GANG', undefined, (gang ?? {}) as unknown as Record<string, unknown>, r3Patch(payload.gangUpdate ?? {}, 'GANG'));
  for (const member of payload.membersUpdate) {
    const matches = existing.filter(m => m?.nombre === member.nombre);
    const code = incomingCounts.get(member.nombre)! > 1 ? 'R3_DUPLICATE_INCOMING_MEMBER'
      : matches.length === 0 ? 'R3_MEMBER_NOT_FOUND' : matches.length > 1 ? 'R3_AMBIGUOUS_MEMBER' : null;
    if (code) {
      conflicts.push(`${code}:${member.nombre}`);
      rows.push({ scope: 'MEMBER', memberName: member.nombre, field: '(registro)', currentValue: undefined, proposedValue: undefined, classification: 'CONFLICT' });
    } else append('MEMBER', member.nombre, matches[0] as unknown as Record<string, unknown>, r3Patch(member.changes, 'MEMBER'));
  }
  if (conflicts.length) rows.forEach(row => { row.classification = 'CONFLICT'; });
  return { fields: rows, conflicts, summary: {
    UPDATE_FIELDS: rows.filter(row => row.classification === 'UPDATE').length,
    NO_CHANGE_FIELDS: rows.filter(row => row.classification === 'NO_CHANGE').length,
    CONFLICTS: conflicts.length,
    MEMBERS_TOUCHED: new Set(rows.filter(row => row.scope === 'MEMBER' && row.classification === 'UPDATE').map(row => row.memberName)).size,
    GANG_FIELDS_TOUCHED: rows.filter(row => row.scope === 'GANG' && row.classification === 'UPDATE').length,
  } };
}
export function buildR3UpdateResult(gang: GangEntity, payload: R3DossierPayload): GangEntity {
  const preview = previewR3Update(gang, payload);
  if (preview.conflicts.length) throw new Error(preview.conflicts.join(';'));
  const result = structuredClone(gang);
  Object.assign(result, r3Patch(payload.gangUpdate ?? {}, 'GANG'));
  for (const member of payload.membersUpdate) {
    const target = result.integrantes.find(m => m.nombre === member.nombre)!;
    Object.assign(target, r3Patch(member.changes, 'MEMBER'));
  }
  return result;
}
export interface R3Review {
  gangId: string; projectId: string; fingerprint: string; gangFingerprint: string;
  expectedUpdatedAt: number | null; preview: R3Preview;
}
export function reviewR3Update(gang: GangEntity, payload: R3DossierPayload): R3Review {
  const preview = previewR3Update(gang, payload);
  const expectedUpdatedAt = Object.prototype.hasOwnProperty.call(gang, 'updatedAt') ? gang.updatedAt : null;
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'number' || !Number.isFinite(expectedUpdatedAt))) throw new Error('INVALID_EXPECTED_VERSION');
  return { gangId: gang.id || '', projectId: gang.projectId || '', fingerprint: canonical(payload), gangFingerprint: canonical(gang), expectedUpdatedAt, preview };
}
export function canApplyR3Update(gang: GangEntity, payload: R3DossierPayload, review: R3Review | null): boolean {
  if (!review || review.preview.conflicts.length || !Object.prototype.hasOwnProperty.call(review, 'expectedUpdatedAt')) return false;
  try {
    const current = reviewR3Update(gang, payload);
    return !current.preview.conflicts.length && current.gangId === review.gangId && current.projectId === review.projectId
      && current.fingerprint === review.fingerprint && current.gangFingerprint === review.gangFingerprint && current.expectedUpdatedAt === review.expectedUpdatedAt;
  } catch { return false; }
}
