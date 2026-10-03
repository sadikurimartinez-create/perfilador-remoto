// Offline PostgreSQL 17 (WASM) in memory. No pool, env loader or network connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const directory = path.join(__dirname, '../database/migrations/institutional-project-access');
const read = name => fs.readFileSync(path.join(directory, name), 'utf8');
const up = read('001_project_access_up.sql');
const down = read('001_project_access_down.sql');
const verify = read('001_project_access_verify.sql');
const stripComments = sql => sql.replace(/--[^\n]*/g, '');
async function database(run, apply = true) {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE ceipol_app; REVOKE CREATE ON SCHEMA public FROM PUBLIC;');
    if (apply) await db.exec(up);
    await run(db);
  } finally { await db.close(); }
}
const insert = `INSERT INTO public.institutional_project_access
  (project_id, institutional_user_id, allowed_actions, created_by)
  VALUES ('fixture-project', '7', ARRAY['READ','WRITE'], 'fixture-administrator')`;
test('UP creates exactly the governed table, PK, valid partial index and no grants', () => database(async db => {
  const columns = (await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='institutional_project_access' ORDER BY ordinal_position`)).rows;
  assert.deepEqual(columns.map(x => x.column_name), ['project_id','institutional_user_id','relation','allowed_actions','created_at','created_by','revoked_at','revoked_by']);
  const constraints = (await db.query(`SELECT contype, pg_get_constraintdef(oid) definition FROM pg_constraint
    WHERE conrelid='public.institutional_project_access'::regclass`)).rows;
  assert.equal(constraints.find(x => x.contype === 'p').definition, 'PRIMARY KEY (project_id, institutional_user_id)');
  const index = (await db.query(`SELECT pg_get_indexdef(indexrelid) definition, indisvalid,
    pg_get_expr(indpred,indrelid) predicate FROM pg_index WHERE indexrelid='public.idx_institutional_project_access_active_user'::regclass`)).rows[0];
  assert.ok(index.indisvalid); assert.match(index.definition, /\(institutional_user_id, project_id\)/);
  assert.equal(index.predicate, '(revoked_at IS NULL)');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.institutional_project_access')).rows[0].n, 0);
}));
for (const action of ['READ','WRITE','ANALYZE_SCINCE','GENERATE_REPORT']) {
  test(`UP admits canonical ${action} and ASSIGNED`, () => database(async db => {
    await db.query(`INSERT INTO public.institutional_project_access
      (project_id,institutional_user_id,allowed_actions,created_by) VALUES ('p','7', $1::text[], 'admin')`, [[action]]);
    assert.equal((await db.query('SELECT relation FROM public.institutional_project_access')).rows[0].relation, 'ASSIGNED');
  }));
}
test('UP rejects empty/null/foreign actions, invalid relation, duplicate key and incoherent revocation', () => database(async db => {
  for (const actions of [[], [null], ['ADMIN'], ['READ','PUBLISH_REPORT']]) {
    await assert.rejects(db.query(`INSERT INTO public.institutional_project_access
      (project_id,institutional_user_id,allowed_actions,created_by) VALUES ('p','7',$1::text[],'admin')`, [actions]));
  }
  await assert.rejects(db.exec(insert
    .replace('(project_id, institutional_user_id, allowed_actions, created_by)', '(project_id, institutional_user_id, allowed_actions, created_by, relation)')
    .replace("'fixture-administrator')", "'fixture-administrator', 'OWNER')")));
  await db.exec(insert); await assert.rejects(db.exec(insert), /duplicate key/);
  await assert.rejects(db.exec("UPDATE public.institutional_project_access SET revoked_at=CURRENT_TIMESTAMP"), /check constraint/);
}));
test('UP grants runtime effective SELECT only and PUBLIC no table privileges', () => database(async db => {
  const privileges = (await db.query(`SELECT privilege_type FROM pg_class c,
    LATERAL aclexplode(c.relacl) a WHERE c.oid='public.institutional_project_access'::regclass AND a.grantee=0`)).rows;
  assert.equal(privileges.length, 0);
  await db.exec('SET ROLE ceipol_app');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.institutional_project_access')).rows[0].n, 0);
  for (const sql of [insert, "UPDATE public.institutional_project_access SET relation='ASSIGNED'",
    'DELETE FROM public.institutional_project_access', 'TRUNCATE public.institutional_project_access',
    'ALTER TABLE public.institutional_project_access ADD COLUMN forbidden text',
    'DROP TABLE public.institutional_project_access', 'CREATE TABLE public.forbidden_runtime_table (id int)']) {
    await assert.rejects(db.exec(sql), /permission denied|must be owner/);
  }
  await db.exec('RESET ROLE');
}));
test('verify is SELECT-only and works before and after UP, including missing role', () => database(async db => {
  const commands = stripComments(verify).split(';').map(x => x.trim()).filter(Boolean);
  assert.ok(commands.length >= 6); assert.ok(commands.every(x => /^SELECT\b/i.test(x)));
  assert.doesNotMatch(stripComments(verify), /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|DO|SET|COPY|CALL)\s+(?:INTO|TABLE|ROLE|ON|FROM|ALL|SELECT|SCHEMA|LOCAL|\$)/i);
  await db.exec(verify);
  await db.exec('DROP ROLE ceipol_app'); await db.exec(verify);
  await db.exec('CREATE ROLE ceipol_app'); await db.exec(up); await db.exec(verify);
}, false));
test('verify exposes inherited writer roles and column-level privilege leakage', () => database(async db => {
  await db.exec('CREATE ROLE fixture_writer; GRANT INSERT ON public.institutional_project_access TO fixture_writer; GRANT fixture_writer TO ceipol_app');
  await db.exec('GRANT UPDATE(project_id) ON public.institutional_project_access TO ceipol_app');
  const results = await db.exec(verify);
  const reachable = results.flatMap(x => x.rows).find(x => x.reachable_role === 'fixture_writer');
  assert.equal(reachable.can_insert, true);
  const columns = results.flatMap(x => x.rows).filter(x => x.column_name === 'project_id' && x.grantee === 'ceipol_app');
  assert.equal(columns.length, 1); assert.equal(columns[0].privilege_type, 'UPDATE');
}));
test('UP failure rolls back partial table creation instead of leaving an uncertified authority', () => database(async db => {
  await db.exec('CREATE TABLE public.fixture_other (id int); CREATE INDEX idx_institutional_project_access_active_user ON public.fixture_other(id)');
  await assert.rejects(db.exec(up), /already exists/); await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT to_regclass('public.institutional_project_access') t")).rows[0].t, null);
  assert.ok((await db.query("SELECT to_regclass('public.fixture_other') t")).rows[0].t);
}, false));
test('DOWN drops empty table and its index, preserving unrelated users', () => database(async db => {
  await db.exec('CREATE TABLE public.users (id int PRIMARY KEY); INSERT INTO public.users VALUES (7)');
  await db.exec(down);
  const result = (await db.query(`SELECT to_regclass('public.institutional_project_access') AS t,
    to_regclass('public.idx_institutional_project_access_active_user') AS i`)).rows[0];
  assert.equal(result.t, null); assert.equal(result.i, null);
  assert.deepEqual((await db.query('SELECT id FROM public.users')).rows, [{ id: 7 }]);
}));
for (const revoked of [false, true]) {
  test(`DOWN fails closed with ${revoked ? 'revoked historical' : 'active'} grant and preserves row/ACL`, () => database(async db => {
    await db.exec(insert);
    if (revoked) await db.exec("UPDATE public.institutional_project_access SET revoked_at=CURRENT_TIMESTAMP, revoked_by='admin'");
    await assert.rejects(db.exec(down), /PROJECT_ACCESS_ROLLBACK_NONEMPTY/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM public.institutional_project_access')).rows[0].n, 1);
    assert.equal((await db.query("SELECT has_table_privilege('ceipol_app','public.institutional_project_access','SELECT') ok")).rows[0].ok, true);
  }));
}
test('DOWN refuses runtime and missing/unexpected object explicitly', () => database(async db => {
  await db.exec('SET ROLE ceipol_app');
  await assert.rejects(db.exec(down), /PROJECT_ACCESS_ROLLBACK_ADMIN_REQUIRED/);
  await db.exec('ROLLBACK; RESET ROLE;'); await db.exec(down);
  await assert.rejects(db.exec(down), /PROJECT_ACCESS_ROLLBACK_TABLE_MISSING/); await db.exec('ROLLBACK');
  await db.exec('CREATE VIEW public.institutional_project_access AS SELECT 1 AS fixture');
  await assert.rejects(db.exec(down), /PROJECT_ACCESS_ROLLBACK_UNEXPECTED_OBJECT/); await db.exec('ROLLBACK');
}));
test('DOWN refuses dependent view with RESTRICT and transaction retains table', () => database(async db => {
  await db.exec('CREATE VIEW public.fixture_dependency AS SELECT project_id FROM public.institutional_project_access');
  await assert.rejects(db.exec(down), /depend/); await db.exec('ROLLBACK');
  assert.ok((await db.query("SELECT to_regclass('public.institutional_project_access') t")).rows[0].t);
}));
test('UP/DOWN are transactional; exclusive lock precedes all-row check and DROP; no silent data deletion', () => {
  for (const sql of [up, down]) {
    const clean = stripComments(sql).trim(); assert.match(clean, /^BEGIN;/); assert.match(clean, /COMMIT;$/);
  }
  const clean = stripComments(down);
  assert.ok(clean.indexOf('ACCESS EXCLUSIVE MODE') < clean.indexOf('IF EXISTS (SELECT 1 FROM public.institutional_project_access)'));
  assert.ok(clean.indexOf('PROJECT_ACCESS_ROLLBACK_NONEMPTY') < clean.indexOf('DROP TABLE public.institutional_project_access RESTRICT'));
  assert.doesNotMatch(clean, /\b(CASCADE|DELETE|TRUNCATE|INSERT|UPDATE)\b/i);
  assert.equal((clean.match(/\bDROP TABLE\b/g) || []).length, 1);
  assert.doesNotMatch(stripComments(up), /\bINSERT\b|createdBy|Firestore/);
});
test('runtime authority consumers remain SELECT-only, with no migration runner or grant writer', () => {
  const files = ['src/services/institutionalProjectAccessRepository.ts',
    'src/services/institutionalAuthorizationProjectionRepository.ts', 'src/lib/institutionalCollectionActions.ts',
    'src/app/api/geoint/events/outbox/dispatch/route.ts'];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(source, /SELECT[\s\S]*public\.institutional_project_access/);
    assert.doesNotMatch(source, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\s+(?:public\.)?institutional_project_access/i);
    assert.doesNotMatch(source, /001_project_access_(?:up|down)\.sql/);
  }
  const creation = fs.readFileSync(path.join(__dirname, '../src/services/institutionalProjectCreationBoundary.ts'), 'utf8');
  assert.doesNotMatch(creation, /\.provision\(/);
  const policy = fs.readFileSync(path.join(__dirname, '../src/services/institutionalProjectAccessService.ts'), 'utf8');
  assert.match(policy, /PROJECT_ACCESS_UNAVAILABLE/);
  assert.doesNotMatch(policy, /project\.createdBy|project\.username/);
});
