import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { spawnSync } from 'child_process';
const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/health-check/route.ts'), 'utf8');
const block = source.slice(source.indexOf('  // PostgreSQL / PostGIS'), source.indexOf('  // Orquestador de Proveedores'));
const emitted = ts.transpileModule(`async function probe(getPool: any) { const services: any[] = []; ${block} return services[0]; }`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const probe: (getPool: any) => Promise<any> = new Function(`${emitted}; return probe;`)();
const authority = { isCeipolApp: true, isSuperuser: false, canCreateDb: false, canCreateRole: false, bypassRls: false, canCreatePublic: false, canCreateTablePublic: false, ownsDatabase: false, publicCanCreatePublic: false };
const signals = { awsRdsLike: false, googleCloudSqlLike: false, azurePostgresLike: false, supabaseLike: false, neonLike: false };
function fixture(provider: any = signals) {
  const query = jest.fn().mockResolvedValueOnce({ rows: [{ ...authority, ...provider }] }).mockResolvedValueOnce({ rows: [{ authority_table_exists: false, authority_select: null }] });
  return { query, getPool: () => ({ query }) };
}
test.each(Object.keys(signals))('synthetic %s is boolean-only and survives missing authority', async key => {
  const f = fixture({ ...signals, [key]: true, hostname: 'PRIVATE_HOST', ip: 'PRIVATE_IP', oid: 98765, roles: ['PRIVATE_ROLE'], extensions: ['PRIVATE_EXTENSION'], DATABASE_URL: 'PRIVATE_SECRET' });
  const result = await probe(f.getPool);
  expect(result).toMatchObject({ status: 'error', errorMessage: 'INSTITUTIONAL_AUTHORITY_NOT_READY', runtimeAuthority: authority,
    postgresProviderFingerprint: { ...signals, [key]: true, unknown: false } });
  expect(Object.values(result.postgresProviderFingerprint).every(v => typeof v === 'boolean')).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|DATABASE_URL|hostname|extensions|98765/);
});
test('unknown is explicit and does not fabricate generic managed hosting', async () => {
  const result = await probe(fixture().getPool);
  expect(result.postgresProviderFingerprint).toEqual({ ...signals, unknown: true });
  expect(result.postgresProviderFingerprint).not.toHaveProperty('genericManagedPostgres');
});
test('multiple compatible signals remain visible without selecting a provider', async () => {
  const result = await probe(fixture({ ...signals, awsRdsLike: true, supabaseLike: true }).getPool);
  expect(result.postgresProviderFingerprint).toEqual({ ...signals, awsRdsLike: true, supabaseLike: true, unknown: false });
});
test.each([{}, { ...signals, neonLike: null }, { ...signals, awsRdsLike: 'true' }])('invalid provider row fails closed without losing valid runtime metadata %#', async provider => {
  const result = await probe(fixture(provider).getPool);
  expect(result.runtimeAuthority).toEqual(authority); expect(result.status).toBe('error');
  expect(result.errorMessage).toBe('POSTGRES_HEALTH_CHECK_FAILED'); expect(result).not.toHaveProperty('postgresProviderFingerprint');
});
test('readiness driver failure keeps both safe diagnostics and sanitizes message', async () => {
  const f = fixture(); f.query.mockReset().mockResolvedValueOnce({ rows: [{ ...authority, ...signals }] }).mockRejectedValueOnce(new Error('PRIVATE_SECRET database PRIVATE_DATABASE host PRIVATE_HOST'));
  const result = await probe(f.getPool);
  expect(result).toMatchObject({ status: 'error', errorMessage: 'POSTGRES_HEALTH_CHECK_FAILED', runtimeAuthority: authority, postgresProviderFingerprint: { ...signals, unknown: true } });
  expect(JSON.stringify(result)).not.toContain('PRIVATE_');
});
test('fingerprint is read-only, exact-role catalog predicates with no setting/host/connection reads', async () => {
  const f = fixture(); await probe(f.getPool); const sql = f.query.mock.calls[0][0];
  expect(sql.trim()).toMatch(/^SELECT/);
  expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|GRANT|REVOKE|set_config|inet_server_addr|inet_server_port)\b/i);
  expect(block).not.toMatch(/process\.env|DATABASE_URL|connectionString|console\./);
  expect(sql).not.toMatch(/rolname\s+LIKE|extname\s+LIKE|SELECT\s+\*/i);
  expect(sql).not.toContain('railway'); expect(sql).not.toContain('render');
});
test('actual SQL predicates evaluated on PostgreSQL WASM with synthetic SELECT-only catalogs', () => {
  const sql = block.match(/const roleHealth = await pool.query\(\s*`([\s\S]*?)`/)![1];
  const projection = sql.slice(sql.indexOf("EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rdsadmin')"), sql.lastIndexOf('FROM pg_roles r JOIN'))
    .replace(/\bpg_roles\b/g, 'fixture_roles').replace(/\bpg_extension\b/g, 'fixture_extensions');
  const groups = [
    { key: 'awsRdsLike', roles: ['rdsadmin', 'rds_superuser'], extensions: [] },
    { key: 'googleCloudSqlLike', roles: ['cloudsqladmin', 'cloudsqlsuperuser'], extensions: [] },
    { key: 'azurePostgresLike', roles: ['azuresu', 'azure_pg_admin'], extensions: [] },
    { key: 'supabaseLike', roles: ['supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin'], extensions: [] },
    { key: 'neonLike', roles: ['neon_superuser'], extensions: ['neon'] },
  ];
  const cases = [...groups, ...groups.map(g => ({ key: '', roles: g.roles.slice(1), extensions: g.extensions })), { key: '', roles: ['postgres','admin','neon_superuser_backup'], extensions: ['postgis','pg_stat_statements'] }, { key: '', roles: ['neon_superuser'], extensions: [] }];
  const script = `const fs=require('fs'); const {PGlite}=require('@electric-sql/pglite');
    (async()=>{ const input=JSON.parse(fs.readFileSync(0,'utf8')); const db=new PGlite();
    try { const rows=[]; for(const c of input.cases) rows.push((await db.query(
    'WITH fixture_roles(rolname) AS (SELECT unnest($1::text[])), fixture_extensions(extname) AS (SELECT unnest($2::text[])) SELECT '+input.projection,
    [c.roles,c.extensions])).rows[0]); process.stdout.write(JSON.stringify(rows)); } finally {await db.close();}
    })().catch(()=>{process.stderr.write('OFFLINE_SQL_VALIDATION_FAILED');process.exitCode=1;});`;
  const child = spawnSync(process.execPath, ['-e', script], { input: JSON.stringify({ projection, cases }), encoding: 'utf8', timeout: 30000 });
  expect(child.status).toBe(0); expect(child.stderr).toBe('');
  const rows = JSON.parse(child.stdout);
  for (let i = 0; i < cases.length; i++) expect(rows[i]).toEqual({ ...signals, ...(cases[i].key ? { [cases[i].key]: true } : {}) });
}, 40000);
