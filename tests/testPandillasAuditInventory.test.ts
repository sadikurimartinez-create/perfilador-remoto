jest.mock('@/lib/institutionalCollectionActions', () => ({
  readInstitutionalCollection: jest.fn(), canWriteInstitutionalProject: jest.fn(),
}));
jest.mock('@/lib/institutionalGangActions', () => ({ saveInstitutionalGang: jest.fn(), deleteInstitutionalGang: jest.fn() }));
jest.mock('@/services/institutionalGangBoundary', () => ({ mutateInstitutionalGang: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ getInstitutionalAdminDb: jest.fn(() => { throw new Error('REAL_DATABASE_FORBIDDEN'); }) }));
jest.mock('@/lib/db', () => ({ getPool: jest.fn(() => { throw new Error('REAL_DATABASE_FORBIDDEN'); }) }));

import { NextRequest } from 'next/server';
import { GET, runtime, dynamic, revalidate } from '../src/app/api/pandillas/audit-inventory/route';
import { readInstitutionalCollection, canWriteInstitutionalProject } from '../src/lib/institutionalCollectionActions';
import { saveInstitutionalGang, deleteInstitutionalGang } from '../src/lib/institutionalGangActions';
import { mutateInstitutionalGang } from '../src/services/institutionalGangBoundary';
import { getInstitutionalAdminDb } from '../src/lib/firebaseAdmin';
import { getPool } from '../src/lib/db';
import { ProjectAccessError } from '../src/types/institutionalProjectAccess';

const reader = readInstitutionalCollection as jest.Mock;
const request = (query = '') => new NextRequest('https://example.invalid/api/pandillas/audit-inventory' + query);
const gang = () => ({ id: 'b', projectId: 'project-example', nombre: ' Grupo Ejémplo ', integrantes: [
  { nombre: ' Persona Ejémplo ', curp: 'PRIVATE', domicilioConocido: 'PRIVATE', telefono: 'PRIVATE',
    antecedentes: 'PRIVATE', fotografiaUrl: 'PRIVATE', georreferencia: { lat: 1, lng: 2 }, edad: 20, alias: 'PRIVATE' },
  { nombre: ' Persona Ejémplo ' }, { nombre: 'Persona Otra' }],
  aliasConocidos: 'PRIVATE', createdBy: 'PRIVATE', coordenadas: { lat: 1, lng: 2 }, audit: 'PRIVATE' });
beforeEach(() => { jest.clearAllMocks(); reader.mockResolvedValue([gang()]); });
afterEach(() => {
  for (const operation of [canWriteInstitutionalProject, saveInstitutionalGang, deleteInstitutionalGang,
    mutateInstitutionalGang, getInstitutionalAdminDb, getPool]) expect(operation).not.toHaveBeenCalled();
});
function checkHeaders(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  expect(response.headers.get('Vary')).toBe('Cookie');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
}
test('exact institutional read, minimal projection, duplicates, order and names preserved', async () => {
  const response = await GET(request());
  expect(reader).toHaveBeenCalledTimes(1); expect(reader).toHaveBeenCalledWith('pandillas');
  expect(response.status).toBe(200); checkHeaders(response);
  const result = await response.json();
  expect(result).toEqual([{ id: 'b', projectId: 'project-example', nombre: ' Grupo Ejémplo ', integrantes: [
    { nombre: ' Persona Ejémplo ' }, { nombre: ' Persona Ejémplo ' }, { nombre: 'Persona Otra' }] }]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  for (const field of ['curp', 'domicilioConocido', 'telefono', 'antecedentes', 'fotografiaUrl', 'georreferencia', 'edad', 'alias']) {
    expect(result[0].integrantes[0]).not.toHaveProperty(field);
  }
});
test('only gangs sorted by ID; source untouched', async () => {
  const source = [gang(), { ...gang(), id: 'a' }]; const before = structuredClone(source); reader.mockResolvedValue(source);
  expect((await (await GET(request())).json()).map((g: any) => g.id)).toEqual(['a', 'b']);
  expect(source).toEqual(before);
});
test('empty permitted inventory returns 200 []', async () => {
  reader.mockResolvedValue([]); const response = await GET(request());
  expect(response.status).toBe(200); expect(await response.json()).toEqual([]); checkHeaders(response);
});
test.each(['?projectId=example', '?x=value', '?x=', '?collection=pandillas', '?x=1&x=2'])('query %s rejected before read', async query => {
  const response = await GET(request(query)); expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'AUDIT_INVENTORY_QUERY_NOT_ALLOWED' });
  expect(reader).not.toHaveBeenCalled(); checkHeaders(response);
});
test.each([
  [new ProjectAccessError('PROJECT_ACCESS_UNAUTHENTICATED'), 401, 'UNAUTHENTICATED'],
  [new ProjectAccessError('PROJECT_ACCESS_IDENTITY_NOT_FOUND'), 401, 'UNAUTHENTICATED'],
  [new ProjectAccessError('PROJECT_ACCESS_ROLE_UNSUPPORTED'), 403, 'FORBIDDEN'],
  [new ProjectAccessError('PROJECT_ACCESS_UNAVAILABLE'), 503, 'INVENTORY_UNAVAILABLE'],
  [new Error('INSTITUTIONAL_COLLECTION_CAPACITY_EXCEEDED'), 503, 'INVENTORY_CAPACITY_EXCEEDED'],
  [new Error('AUTHORIZATION_SNAPSHOT_INVALID'), 503, 'INVENTORY_UNAVAILABLE'],
  [new Error('AUTHORIZATION_RELATION_INVALID'), 503, 'INVENTORY_UNAVAILABLE'],
  [new Error('AUTHORIZATION_REVOCATION_INVALID'), 503, 'INVENTORY_UNAVAILABLE'],
  [new Error('PRIVATE stack query cookie credentials'), 500, 'INVENTORY_INTERNAL_ERROR'],
  [new Error('PROJECT_ACCESS_UNAUTHENTICATED'), 500, 'INVENTORY_INTERNAL_ERROR'],
])('sanitized mapping for %s', async (error, status, code) => {
  reader.mockRejectedValue(error); const response = await GET(request());
  expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: code }); checkHeaders(response);
});
test.each([null, {}, { ...gang(), id: '' }, { ...gang(), projectId: ' ' }, { ...gang(), nombre: 7 },
  { ...gang(), integrantes: undefined }, { ...gang(), integrantes: {} },
  { ...gang(), integrantes: [null] }, { ...gang(), integrantes: [{ nombre: '' }] },
  { ...gang(), integrantes: [{ nombre: ' ' }] }, { ...gang(), integrantes: [{ nombre: 12 }] }])(
  'malformed source record %j aborts full inventory', async invalid => {
    reader.mockResolvedValue([gang(), invalid]); const response = await GET(request());
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'INVENTORY_DATA_INVALID' }); checkHeaders(response);
  });
test('non-array collection rejected', async () => {
  reader.mockResolvedValue({}); const response = await GET(request());
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'INVENTORY_DATA_INVALID' }); checkHeaders(response);
});
test('empty member array remains valid', async () => {
  reader.mockResolvedValue([{ ...gang(), integrantes: [] }]); const response = await GET(request());
  expect(response.status).toBe(200); expect((await response.json())[0].integrantes).toEqual([]); checkHeaders(response);
});
test('Node dynamic route with caching disabled', () => {
  expect(runtime).toBe('nodejs'); expect(dynamic).toBe('force-dynamic'); expect(revalidate).toBe(0);
});
