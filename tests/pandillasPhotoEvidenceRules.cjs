// Local Firestore emulator only. Synthetic fixtures; no production SDK/project.
const { test, before, beforeEach, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
let env;
const children = ['pandillasMemberIdentities', 'pandillasPhotoAssociations', 'pandillasPrimarySelections'];
const db = (id = 'reader') => env.authenticatedContext(`user:${id}`, { institutionalUserId: id, role: 'USER' }).firestore();
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') throw new Error('LOCAL_EMULATOR_REQUIRED');
  env = await initializeTestEnvironment({ projectId: 'demo-pandillas-r4', firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const d = context.firestore(); const now = Date.now();
    await d.doc('projects/A').set({ deleted: false });
    for (const [id, revoked, actions] of [['reader', false, ['READ','WRITE']], ['revoked', true, ['READ','WRITE']], ['writer', false, ['WRITE']]]) await d.doc(`projectAccess/A/members/${id}`).set({ projectId: 'A', institutionalUserId: id, relation: 'ASSIGNED', allowedActions: actions, revoked, revokedAt: revoked ? 'fixture' : null, source: 'POSTGRESQL', policyVersion: 'EXPLICIT_ACTION_GRANT_V1', synchronizedAt: now, expiresAt: now + 300000 });
    for (const child of children) {
      await d.doc(`projects/A/${child}/fixture`).set({ projectId: 'A' });
      await d.doc(`projects/A/${child}/cross`).set({ projectId: 'B' });
    }
    await d.doc('projects/A/documents/asset').set({ projectId: 'A', photoAsset: { id: 'fixture' } });
    await d.doc('projects/A/documents/legacy').set({ projectId: 'A', context: 'legacy' });
  });
});
after(async () => { if (env) await env.cleanup(); });
for (const child of children) {
  test(`${child}: READ autorizado`, () => assertSucceeds(db().doc(`projects/A/${child}/fixture`).get()));
  test(`${child}: grant revocado`, () => assertFails(db('revoked').doc(`projects/A/${child}/fixture`).get()));
  test(`${child}: WRITE no sustituye READ`, () => assertFails(db('writer').doc(`projects/A/${child}/fixture`).get()));
  test(`${child}: proyecto declarado cruzado`, () => assertFails(db().doc(`projects/A/${child}/cross`).get()));
  test(`${child}: create cliente denegado`, () => assertFails(db().doc(`projects/A/${child}/new`).set({ projectId: 'A' })));
  test(`${child}: update cliente denegado`, () => assertFails(db().doc(`projects/A/${child}/fixture`).update({ forged: true })));
  test(`${child}: delete cliente denegado`, () => assertFails(db().doc(`projects/A/${child}/fixture`).delete()));
}
test('metadata de activo R4 no puede alterarse', () => assertFails(db().doc('projects/A/documents/asset').update({ context: 'forged' })));
test('no inyectar activo en documento legacy', () => assertFails(db().doc('projects/A/documents/legacy').update({ photoAsset: { id: 'forged' } })));
test('no crear activo R4 por cliente', () => assertFails(db().doc('projects/A/documents/new').set({ projectId: 'A', photoAsset: { id: 'forged' } })));
test('edición legacy conserva permiso previo', () => assertSucceeds(db().doc('projects/A/documents/legacy').update({ context: 'authorized' })));
