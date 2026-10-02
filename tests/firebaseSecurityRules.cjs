// Real engines only. Never initialize a production SDK or a live project.
const { test, before, beforeEach, after } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { getBytes } = require('firebase/storage');
let env;
const projectId = 'demo-perfilador-remoto';
function db(id = '1', role = 'USER', claims = {}) {
  return env.authenticatedContext(`user:${id}`, { institutionalUserId: id, role, ...claims }).firestore();
}
function storage(id = '1', role = 'USER') {
  return env.authenticatedContext(`user:${id}`, { institutionalUserId: id, role }).storage();
}
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9195') {
    throw new Error('LOCAL_EMULATORS_REQUIRED');
  }
  env = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9195, rules: fs.readFileSync('storage.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const now = Date.now();
  await env.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore();
    await firestore.doc('projects/A').set({ createdBy: 'historical-username', nombre: 'Fixture A' });
    await firestore.doc('projects/B').set({ nombre: 'Fixture B' });
    for (const [id, actions, revoked] of [['1', ['READ','WRITE'], false], ['2', ['READ'], false], ['3', ['WRITE'], false], ['4', ['READ','WRITE'], true], ['5', ['ANALYZE_SCINCE'], false], ['6', ['GENERATE_REPORT'], false]]) {
      await firestore.doc(`projectAccess/A/members/${id}`).set({ projectId: 'A', institutionalUserId: id, relation: 'ASSIGNED',
        allowedActions: actions, revoked, revokedAt: revoked ? new Date(now).toISOString() : null,
        source: 'POSTGRESQL', policyVersion: 'EXPLICIT_ACTION_GRANT_V1', synchronizedAt: now, expiresAt: now + 300000 });
    }
    await firestore.doc('users/1').set({ role: 'USER', displayName: 'Fixture' });
    await firestore.doc('users/2').set({ role: 'USER' });
    await firestore.doc('audit_logs/log').set({ projectId: 'A', action: 'FIXTURE' });
    await firestore.doc('projects/A/reportCertifications/c').set({ status: 'CERTIFIED' });
    await context.storage().ref('projects/A/fixture.jpg').put(Buffer.from([1,2,3]), { contentType: 'image/jpeg' });
    await context.storage().ref('projects/A/reports/pkg/v1/report.pdf').put(Buffer.from([1,2,3]), { contentType: 'application/pdf' });
  });
});
after(async () => { if (env) await env.cleanup(); });
const deny = (name, operation) => test(name, async () => assertFails(operation()));
const allow = (name, operation) => test(name, async () => assertSucceeds(operation()));
deny('01 unauthenticated read', () => env.unauthenticatedContext().firestore().doc('projects/A').get());
deny('02 unauthenticated write', () => env.unauthenticatedContext().firestore().doc('projects/A').update({ nombre: 'forged' }));
deny('03 forged client role without grant', () => db('99', 'SUPER_ADMIN').doc('projects/A').get());
deny('04 forged document identity', () => db('99').doc('projects/A/photos/forged').set({ institutionalUserId: '1' }));
allow('05 USER READ grant', () => db('2').doc('projects/A').get());
deny('06 USER without READ', () => db('3').doc('projects/A').get());
allow('07 USER WRITE grant', () => db().doc('projects/A').update({ nombre: 'authorized' }));
deny('08 READ only cannot write', () => db('2').doc('projects/A').update({ nombre: 'forged' }));
deny('09 cross project read', () => db().doc('projects/B').get());
deny('10 revoked grant', () => db('4').doc('projects/A').get());
deny('11 ADMIN without grant', () => db('99', 'ADMIN').doc('projects/A').get());
deny('12 SUPER_ADMIN without grant', () => db('99', 'SUPER_ADMIN').doc('projects/A').get());
allow('13 ADMIN explicit READ', () => db('2', 'ADMIN').doc('projects/A').get());
allow('14 SUPER_ADMIN explicit WRITE', () => db('3', 'SUPER_ADMIN').doc('projects/A').update({ nombre: 'authorized' }));
for (const [n, child] of [[15,'photos'],[16,'documents'],[17,'streetview_findings'],[18,'denueAnalyticalRelations'],[19,'geoint_temporal_comparisons']]) {
  deny(`${n} ${child} cross project`, () => db().doc(`projects/B/${child}/x`).set({}));
  (['geoint_temporal_comparisons','denueAnalyticalRelations','streetview_findings'].includes(child) ? deny : allow)(`authorized child ${child}`, () => db().doc(`projects/A/${child}/x`).set({}));
}
deny('20 own role escalation', () => db().doc('users/1').update({ role: 'ADMIN' }));
deny('21 another role escalation', () => db().doc('users/2').update({ role: 'SUPER_ADMIN' }));
deny('22 another profile read', () => db().doc('users/2').get());
deny('22b another profile edit', () => db().doc('users/2').update({ displayName: 'forged' }));
deny('23 create SUPER_ADMIN', () => db().doc('users/99').set({ role: 'SUPER_ADMIN' }));
deny('24 audit delete', () => db().doc('audit_logs/log').delete());
deny('25 audit update', () => db().doc('audit_logs/log').update({ action: 'forged' }));
deny('26 projection create', () => db().doc('projectAccess/B/members/1').set({ allowedActions: ['READ'] }));
deny('27 projection update', () => db().doc('projectAccess/A/members/1').update({ allowedActions: ['READ'] }));
deny('28 projection delete', () => db().doc('projectAccess/A/members/1').delete());
deny('29 unauthenticated upload', () => env.unauthenticatedContext().storage().ref('projects/A/photo.jpg').put(Buffer.from([1]), { contentType: 'image/jpeg' }));
deny('30 wrong project upload', () => storage().ref('projects/B/photo.jpg').put(Buffer.from([1]), { contentType: 'image/jpeg' }));
allow('31 READ download', () => getBytes(storage('2').ref('projects/A/fixture.jpg')));
deny('32 READ only upload', () => storage('2').ref('projects/A/photo.jpg').put(Buffer.from([1]), { contentType: 'image/jpeg' }));
allow('33 WRITE upload', () => storage('3').ref('projects/A/photo.jpg').put(Buffer.from([1]), { contentType: 'image/jpeg' }));
deny('34 revoked upload', () => storage('4').ref('projects/A/photo.jpg').put(Buffer.from([1]), { contentType: 'image/jpeg' }));
deny('34b revoked download', () => getBytes(storage('4').ref('projects/A/fixture.jpg')));
deny('35 cross project download', () => getBytes(storage().ref('projects/B/fixture.jpg')));
deny('36 alter certificate', () => db().doc('projects/A/reportCertifications/c').update({ status: 'CERTIFIED' }));
deny('37 replace published artifact', () => storage().ref('projects/A/reports/pkg/v1/report.pdf').put(Buffer.from([9]), { contentType: 'application/pdf' }));
deny('unknown role', () => db('1', 'UNKNOWN').doc('projects/A').get());
deny('uid claim mismatch', () => db('1', 'USER', { institutionalUserId: '2' }).doc('projects/A').get());
deny('WRITE cannot read', () => db('3').doc('projects/A').get());
deny('ANALYZE_SCINCE cannot write', () => db('5').doc('projects/A').update({ nombre: 'forged' }));
deny('GENERATE_REPORT cannot fabricate package', () => db('6').doc('projects/A/reportPackages/forged').set({ state: 'GENERATED' }));
deny('counter mutation', () => db().doc('counters/projects').set({ count: 99 }));
deny('unknown root', () => db().doc('unknown/x').set({ projectId: 'A' }));
deny('unknown child', () => db().doc('projects/A/unknown/x').set({}));
deny('invalid MIME', () => storage().ref('projects/A/photo.jpg').put(Buffer.from([1]), { contentType: 'text/html' }));
allow('own safe profile edit', () => db().doc('users/1').update({ displayName: 'Safe fixture' }));
for (const [name, patch] of [['expired', { expiresAt: 1 }], ['future', { synchronizedAt: Date.now() + 3600000 }],
  ['unknown action', { allowedActions: ['READ', 'ROOT'] }], ['wrong source', { source: 'CLIENT' }],
  ['wrong policy', { policyVersion: 'OTHER' }], ['wrong project', { projectId: 'B' }], ['wrong relation', { relation: 'OWNER' }]]) {
  test(`malformed mirror ${name} denies Firestore and Storage`, async () => {
    await env.withSecurityRulesDisabled(context => context.firestore().doc('projectAccess/A/members/1').update(patch));
    await assertFails(db().doc('projects/A').get());
    await assertFails(getBytes(storage().ref('projects/A/fixture.jpg')));
  });
}
for (const patch of [{ deleted: true }, { estado: 'ARCHIVADO' }, { status: 'ARCHIVADO' }]) {
  test(`inaccessible project ${JSON.stringify(patch)}`, async () => {
    await env.withSecurityRulesDisabled(context => context.firestore().doc('projects/A').update(patch));
    await assertFails(db().doc('projects/A/photos/x').set({}));
    await assertFails(getBytes(storage().ref('projects/A/fixture.jpg')));
  });
}

for (const field of ['ceipolId', 'numeroExpedienteAsignadoAt', 'numeroExpedienteVersion', 'creationReservationId', 'createdByInstitutionalUserId']) {
  deny(`protected institutional field ${field}`, () => db().doc('projects/A').update({ [field]: 'forged' }));
}
for (const path of ['projects/A/reportPackageInputs/forged', 'projects/A/reportPackageSystem/versionAllocator', 'projectCreationReservations/A', 'authorizationUsers/1', 'authorizationAudit/forged']) {
  deny(`server-only create ${path}`, () => db().doc(path).set({ projectId: 'A' }));
}

deny('P8J client cannot delete photo without atomic server audit', () => db().doc('projects/A/photos/x').delete());
deny('P8J client cannot delete document without atomic server audit', () => db().doc('projects/A/documents/x').delete());
deny('P8J client cannot archive by bypassing lifecycle boundary', () => db().doc('projects/A').update({estado:'ARCHIVADO'}));
deny('P8J client cannot soft delete by bypassing lifecycle boundary', () => db().doc('projects/A').update({deleted:true}));
deny('P8J client cannot fabricate sweep certification', () => db().doc('projects/A').update({sweeps:[{status:'CERTIFIED'}]}));
deny('P8J client cannot create server visual proof', () => db().doc('projects/A/reportVisualAuthority/forged').set({state:'ASSET_RENDERED'}));

deny('P8J client cannot fabricate DENUE human approval', () => db().doc('projects/A/denueAnalyticalReviewEvents/forged').set({reviewedBy:'forged',nextStatus:'ACCEPTED'}));

deny('P8J client cannot forge geographic entity with separate audit', () => db().doc('projects/A/geographicEntities/forged').set({projectId:'A'}));

// PRE-P8.3: immutable evidence must not bypass server lifecycle/audit.
for (const role of ['USER','ADMIN','SUPER_ADMIN']) {
 deny(`PREP83 ${role} cannot replace existing photo bytes`,()=>storage('1',role).ref('projects/A/fixture.jpg').put(Buffer.from([9]),{contentType:'image/jpeg'}));
 deny(`PREP83 ${role} cannot delete existing photo without server audit`,()=>storage('1',role).ref('projects/A/fixture.jpg').delete());
}
test('PREP83 existing document bytes cannot be replaced or deleted by client',async()=>{
 await env.withSecurityRulesDisabled(context=>context.storage().ref('projects/A/documents/fixture.pdf').put(Buffer.from([1]),{contentType:'application/pdf'}));
 await assertFails(storage().ref('projects/A/documents/fixture.pdf').put(Buffer.from([9]),{contentType:'application/pdf'}));
 await assertFails(storage().ref('projects/A/documents/fixture.pdf').delete());
});
allow('PREP83 new document upload still requires and accepts WRITE',()=>storage('3').ref('projects/A/documents/new.pdf').put(Buffer.from([1]),{contentType:'application/pdf'}));
