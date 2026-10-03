import fs from 'fs';
import path from 'path';
import ts from 'typescript';
const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/health-check/route.ts'), 'utf8');
const block = source.slice(source.indexOf('  // PostgreSQL / PostGIS'), source.indexOf('  // Orquestador de Proveedores'));
const emitted = ts.transpileModule(`async function probe(getPool: any) { const services: any[] = []; ${block} return services[0]; }`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const probe: (getPool: any) => Promise<any> = new Function(`${emitted}; return probe;`)();
const capabilities = { isCeipolApp: true, isSuperuser: false, canCreateDb: false, canCreateRole: false, bypassRls: false, canCreatePublic: false, canCreateTablePublic: false, ownsDatabase: false, publicCanCreatePublic: false };
const providerSignals = { awsRdsLike: false, googleCloudSqlLike: false, azurePostgresLike: false, supabaseLike: false, neonLike: false };
function fixture(readiness: any = { authority_table_exists: true, authority_select: true }, role: any = capabilities) {
  const query = jest.fn().mockResolvedValueOnce({ rows: [role === null ? null : { ...providerSignals, ...role }] }).mockResolvedValueOnce({ rows: [readiness] });
  return { query, getPool: jest.fn(() => ({ query })) };
}
test('actual PostgreSQL health block uses only two SELECTs through getPool; no secret/env access', async () => {
  const f = fixture(); await probe(f.getPool);
  expect(f.getPool).toHaveBeenCalledTimes(1); expect(f.query).toHaveBeenCalledTimes(2);
  for (const [sql] of f.query.mock.calls) {
    expect(sql.trim()).toMatch(/^SELECT\b/);
    expect(sql).not.toMatch(/\b(CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE)\s+(TABLE|ROLE|SCHEMA|INTO|ON|FROM|public\.)/i);
  }
  expect(block).not.toMatch(/process\.env|DATABASE_URL|connectionString|console\./);
  expect(f.query.mock.calls[0][0]).not.toContain('institutional_project_access');
  expect(f.query.mock.calls[1][0]).toContain("to_regclass('public.institutional_project_access')");
});
test('healthy contract preserved; exact boolean allowlist discards all incidental identifiers', async () => {
  const injected = { ...capabilities, current_user: 'PRIVATE_ROLE', session_user: 'PRIVATE_SESSION', host: 'PRIVATE_HOST', port: 9999, database: 'PRIVATE_DATABASE', DATABASE_URL: 'PRIVATE_CONNECTION', oid: 987654, password: 'PRIVATE_PASSWORD' };
  const result = await probe(fixture(undefined, injected).getPool);
  expect(result).toMatchObject({ id: 'postgres', name: 'PostgreSQL / PostGIS', status: 'ok', latencyMs: expect.any(Number), runtimeAuthority: capabilities });
  expect(Object.keys(result.runtimeAuthority)).toEqual(Object.keys(capabilities));
  expect(Object.values(result.runtimeAuthority).every(v => typeof v === 'boolean')).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|DATABASE_URL|current_user|session_user|host|port|database|password|987654/);
});
test.each([{ authority_table_exists: false, authority_select: null }, { authority_table_exists: true, authority_select: false }, {}])('readiness fails closed while metadata remains available %#', async readiness => {
  const result = await probe(fixture(readiness).getPool);
  expect(result).toMatchObject({ status: 'error', errorMessage: 'INSTITUTIONAL_AUTHORITY_NOT_READY', runtimeAuthority: capabilities });
});
test('readiness SQL error cannot leak secrets and does not erase already obtained metadata', async () => {
  const f = fixture(); f.query.mockReset().mockResolvedValueOnce({ rows: [{ ...providerSignals, ...capabilities }] }).mockRejectedValueOnce(new Error('PRIVATE_HOST port 5432 database PRIVATE_DB password PRIVATE_PASSWORD DATABASE_URL=PRIVATE_URL'));
  const result = await probe(f.getPool);
  expect(result).toMatchObject({ status: 'error', errorMessage: 'POSTGRES_HEALTH_CHECK_FAILED', runtimeAuthority: capabilities });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|DATABASE_URL|password|5432/);
});
test('getPool/connection failure is sanitized and never fabricates capabilities', async () => {
  const result = await probe(() => { throw new Error('DATABASE_URL=PRIVATE_URL host PRIVATE_HOST'); });
  expect(result).toMatchObject({ status: 'error', errorMessage: 'POSTGRES_HEALTH_CHECK_FAILED' });
  expect(result).not.toHaveProperty('runtimeAuthority'); expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|DATABASE_URL|host/);
});
test.each([null, {}, { ...capabilities, isSuperuser: 'false' }, { ...capabilities, canCreateDb: null }])('unknown/malformed capabilities are omitted and fail closed %#', async role => {
  const f = fixture(undefined, role); const result = await probe(f.getPool);
  expect(result.status).toBe('error'); expect(result).not.toHaveProperty('runtimeAuthority'); expect(f.query).toHaveBeenCalledTimes(1);
});
test('actual privileged values are diagnostic booleans, not an authorization bypass', async () => {
  const elevated = Object.fromEntries(Object.keys(capabilities).map(k => [k, k !== 'isCeipolApp']));
  const result = await probe(fixture({ authority_table_exists: false, authority_select: null }, elevated).getPool);
  expect(result.runtimeAuthority).toEqual(elevated); expect(result.status).toBe('error');
});
test('full GET serializes diagnostic metadata on postgres error without reading connection secrets', async () => {
  const f = fixture({ authority_table_exists: false, authority_select: null });
  const envReads: string[] = [];
  const isolatedProcess = { env: new Proxy({}, { get: (_target, name) => {
    envReads.push(String(name));
    if (name === 'DATABASE_URL') throw new Error('FORBIDDEN_CONNECTION_READ');
    return undefined;
  } }) };
  const modules: Record<string, any> = {
    'next/server': { NextResponse: { json: (body: any, options: any) => ({ body, options }) } },
    '@google/genai': {}, '@/lib/geminiEnv': {},
    '@/lib/googlePlaces': { searchPlacesAround: jest.fn(async () => []) },
    '@/lib/denueInegi': {}, '@/lib/db': { getPool: f.getPool },
    '@/lib/providers/orchestrator': { ApiOrchestrator: class { async runHealthChecks() { return {}; } } },
  };
  const routeExports: any = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ version: 'fixture' }) }));
  new Function('require', 'exports', 'process', 'fetch', compiled)((name: string) => {
    if (!(name in modules)) throw new Error('UNEXPECTED_MODULE');
    return modules[name];
  }, routeExports, isolatedProcess, fetchMock);
  const response = await routeExports.GET();
  expect(response.options.status).toBe(200);
  expect(response.body.services.find((s: any) => s.id === 'postgres')).toMatchObject({
    status: 'error', runtimeAuthority: capabilities, errorMessage: 'INSTITUTIONAL_AUTHORITY_NOT_READY',
  });
  expect(envReads).not.toContain('DATABASE_URL');
  expect(JSON.stringify(response.body)).not.toMatch(/FORBIDDEN_CONNECTION_READ|current_user|session_user|DATABASE_URL/);
});
