jest.mock('server-only', () => ({}), { virtual: true });
import { AUTHORIZATION_POLICY, validateAuthorizationSnapshot, synchronizeInstitutionalAuthorization, type AuthorizationAuthoritySnapshot } from '../src/services/institutionalAuthorizationProjectionService';
const now = 1800000000000;
function fixture(): AuthorizationAuthoritySnapshot {
  return { actor: { institutionalUserId: '1', username: 'fixture', role: 'USER' }, source: 'POSTGRESQL', policyVersion: AUTHORIZATION_POLICY,
    relations: [{ projectId: 'A', institutionalUserId: '1', relation: 'ASSIGNED', allowedActions: ['WRITE', 'READ', 'READ'], revokedAt: null }] };
}
test('new grant canonicalizes and has deterministic semantic revision', () => {
  const first = validateAuthorizationSnapshot(fixture(), now)[0];
  expect(first.allowedActions).toEqual(['READ', 'WRITE']);
  expect(first.revoked).toBe(false);
  expect(validateAuthorizationSnapshot(fixture(), now + 1)[0].revision).toBe(first.revision);
});
test('updated grant changes revision', () => {
  const source = fixture(); const old = validateAuthorizationSnapshot(source, now)[0];
  source.relations[0].allowedActions = ['READ'];
  expect(validateAuthorizationSnapshot(source, now)[0].revision).not.toBe(old.revision);
});
test('revocation is preserved', () => {
  const source = fixture(); source.relations[0].revokedAt = new Date(now - 1);
  expect(validateAuthorizationSnapshot(source, now)[0]).toMatchObject({ revoked: true, revokedAt: new Date(now - 1).toISOString() });
});
test.each(['', '../A', 'A/B', ' A ', '.', '..', 'A\\B'])('rejects project id %p', value => {
  const source = fixture(); source.relations[0].projectId = value;
  expect(() => validateAuthorizationSnapshot(source, now)).toThrow();
});
test.each([
  (s: any) => { s.actor.institutionalUserId = ''; }, (s: any) => { s.actor.role = 'ROOT'; },
  (s: any) => { s.relations[0].relation = 'OWNER'; }, (s: any) => { s.relations[0].allowedActions = ['ROOT']; },
  (s: any) => { s.source = 'CLIENT'; }, (s: any) => { s.policyVersion = 'OTHER'; },
  (s: any) => { s.relations.push({ ...s.relations[0] }); }, (s: any) => { s.relations[0].institutionalUserId = '2'; },
  (s: any) => { s.relations[0].revokedAt = 'invalid'; }, (s: any) => { s.relations[0].revokedAt = new Date(now + 1); },
])('rejects invalid authority snapshot %# without partial persistence', async mutate => {
  const source = fixture(); mutate(source); const commit = jest.fn();
  await expect(synchronizeInstitutionalAuthorization(async () => source, { commit }, () => now)).rejects.toThrow();
  expect(commit).not.toHaveBeenCalled();
});
test('Firestore failure is propagated', async () => {
  await expect(synchronizeInstitutionalAuthorization(async () => fixture(), { commit: async () => { throw new Error('FIXTURE_FAILURE'); } }, () => now)).rejects.toThrow('FIXTURE_FAILURE');
});
test('authority failure never calls persistence', async () => {
  const commit = jest.fn(); await expect(synchronizeInstitutionalAuthorization(async () => { throw new Error('SOURCE_FAILURE'); }, { commit })).rejects.toThrow();
  expect(commit).not.toHaveBeenCalled();
});
test('repeated snapshot commits deterministically', async () => {
  const commit = jest.fn(); const resolve = async () => fixture();
  const a = await synchronizeInstitutionalAuthorization(resolve, { commit }, () => now);
  const b = await synchronizeInstitutionalAuthorization(resolve, { commit }, () => now);
  expect(a).toEqual(b); expect(commit).toHaveBeenCalledTimes(2);
});
