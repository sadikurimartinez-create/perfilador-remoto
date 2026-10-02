jest.mock('server-only', () => ({}), { virtual: true });
import { reserveInstitutionalProjectId, createReservedInstitutionalProject, type ProjectCreationDependencies, type GovernedProjectGrantProvisioner } from '../src/services/institutionalProjectCreationBoundary';
import { dryRunInstitutionalProjectReconciliation } from '../src/utils/institutionalProjectAccessReconciliation';
const now = 1800000000000;
function dependencies(): ProjectCreationDependencies {
  const reservations = new Map();
  return { identity: async () => ({ institutionalUserId: '1', username: 'fixture', role: 'USER' }),
    reservations: { reserve: async r => { reservations.set(r.projectId, r); }, read: async id => reservations.get(id) ?? null },
    authority: { findRelation: jest.fn(async (projectId, institutionalUserId) => ({ projectId, institutionalUserId, relation: 'ASSIGNED', allowedActions: ['WRITE'], revokedAt: null })) },
    createAtomically: jest.fn(async input => ({ projectId: input.projectId, createdBy: input.actor.username })), now: () => now };
}
test('reservation does not create project or provision authority', async () => {
  const deps = dependencies(); const reservation = await reserveInstitutionalProjectId('session', deps);
  expect(reservation.institutionalUserId).toBe('1');
  expect(deps.authority.findRelation).not.toHaveBeenCalled(); expect(deps.createAtomically).not.toHaveBeenCalled();
});
test('creation verifies an explicit active grant and preserves reserved ID', async () => {
  const deps = dependencies(); const reservation = await reserveInstitutionalProjectId('session', deps);
  await expect(createReservedInstitutionalProject({ session: 'session', projectId: reservation.projectId, payload: { createdBy: 'forged' } }, deps)).resolves.toEqual({ projectId: reservation.projectId, createdBy: 'fixture' });
  expect(deps.authority.findRelation).toHaveBeenCalledWith(reservation.projectId, '1');
});
test.each(['USER', 'ADMIN', 'SUPER_ADMIN'] as const)('missing grant blocks %s', async role => {
  const deps = dependencies(); deps.identity = async () => ({ institutionalUserId: '1', username: 'fixture', role });
  const reservation = await reserveInstitutionalProjectId('session', deps);
  deps.authority.findRelation = async () => null;
  await expect(createReservedInstitutionalProject({ session: 'session', projectId: reservation.projectId, payload: {} }, deps)).rejects.toThrow('PROVISIONING_REQUIRED');
  expect(deps.createAtomically).not.toHaveBeenCalled();
});
test.each(['revoked', 'READ_ONLY', 'SOURCE_FAILURE', 'OTHER_USER', 'EXPIRED', 'UNRESERVED'])('%s fails closed before any creation', async kind => {
  const deps = dependencies(); const r = await reserveInstitutionalProjectId('session', deps);
  if (kind === 'revoked') deps.authority.findRelation = async () => ({ projectId: r.projectId, institutionalUserId: '1', relation: 'ASSIGNED', allowedActions: ['WRITE'], revokedAt: new Date(now - 1) });
  if (kind === 'READ_ONLY') deps.authority.findRelation = async () => ({ projectId: r.projectId, institutionalUserId: '1', relation: 'ASSIGNED', allowedActions: ['READ'], revokedAt: null });
  if (kind === 'SOURCE_FAILURE') deps.authority.findRelation = async () => { throw new Error('INFRASTRUCTURE_FAILURE'); };
  if (kind === 'OTHER_USER') deps.identity = async () => ({ institutionalUserId: '2', username: 'other', role: 'SUPER_ADMIN' });
  if (kind === 'EXPIRED') deps.now = () => now + 24 * 60 * 60 * 1000;
  await expect(createReservedInstitutionalProject({ session: 'session', projectId: kind === 'UNRESERVED' ? 'other' : r.projectId, payload: {} }, deps)).rejects.toThrow();
  expect(deps.createAtomically).not.toHaveBeenCalled();
});
test.each([
  [undefined, [], [], 'NO_ASSOCIATION'], ['fixture', [], [], 'USER_NOT_FOUND'],
  ['fixture', [{ id: '1', username: 'fixture' }, { id: '2', username: 'fixture' }], [], 'AMBIGUOUS_USER'],
  ['fixture', [{ id: '1', username: 'fixture' }], [], 'MISSING_GRANT'],
  ['fixture', [{ id: '1', username: 'fixture' }], [{ projectId: 'A', institutionalUserId: '1', revokedAt: '2026-01-01' }], 'REVOKED_GRANT'],
  ['fixture', [{ id: '1', username: 'fixture' }], [{ projectId: 'A', institutionalUserId: '2', revokedAt: null }], 'HISTORICAL_CONFLICT'],
  ['fixture', [{ id: '1', username: 'fixture' }], [{ projectId: 'A', institutionalUserId: '1', revokedAt: null }], 'RECONCILED'],
] as const)('dry run classifies %s without mutation', (createdBy, users, grants, finding) => {
  const input = { projects: [{ id: 'A', createdBy }], users: [...users], grants: [...grants] };
  const before = JSON.stringify(input);
  expect(dryRunInstitutionalProjectReconciliation(input)[0].finding).toBe(finding);
  expect(JSON.stringify(input)).toBe(before);
});

test('governed provisioning stays separate and creation waits for active authoritative grant', async () => {
  const deps = dependencies();
  const grantStore = new Map<string, any>();
  deps.authority.findRelation = jest.fn(async id => grantStore.get(id) ?? null);
  const reservation = await reserveInstitutionalProjectId('session', deps);
  const request = { session: 'session', projectId: reservation.projectId, payload: {} };
  await expect(createReservedInstitutionalProject(request, deps)).rejects.toThrow('PROVISIONING_REQUIRED');
  const provisioner: GovernedProjectGrantProvisioner = { provision: jest.fn(async input => {
    if (!input.administrativeApprovalId || !input.approvedByInstitutionalUserId) throw new Error('APPROVAL_REQUIRED');
    const relation = { projectId: input.reservation.projectId, institutionalUserId: input.reservation.institutionalUserId,
      relation: 'ASSIGNED' as const, allowedActions: input.actions, revokedAt: null };
    grantStore.set(relation.projectId, relation);
    return { auditId: 'offline-administrative-audit', relation };
  }) };
  await provisioner.provision({ reservation, actions: ['READ', 'WRITE'], administrativeApprovalId: 'fixture-approval', approvedByInstitutionalUserId: 'offline-administrator' });
  await expect(createReservedInstitutionalProject(request, deps)).resolves.toMatchObject({ projectId: reservation.projectId });
  expect(provisioner.provision).toHaveBeenCalledTimes(1);
  expect(deps.createAtomically).toHaveBeenCalledTimes(1);
});
test('failed administrative provisioning cannot create an operational project', async () => {
  const deps = dependencies(); deps.authority.findRelation = async () => null;
  const reservation = await reserveInstitutionalProjectId('session', deps);
  const provisioner: GovernedProjectGrantProvisioner = { provision: async () => { throw new Error('OFFLINE_PROVISIONING_FAILURE'); } };
  await expect(provisioner.provision({ reservation, actions: ['WRITE'], administrativeApprovalId: 'fixture', approvedByInstitutionalUserId: 'admin' })).rejects.toThrow();
  await expect(createReservedInstitutionalProject({ session: 'session', projectId: reservation.projectId, payload: {} }, deps)).rejects.toThrow('PROVISIONING_REQUIRED');
  expect(deps.createAtomically).not.toHaveBeenCalled();
});
test.each([NaN, Infinity, 'later', null, now, now + 48 * 60 * 60 * 1000])('malformed reservation expiry %s fails closed', async expiresAt => {
  const deps = dependencies(); const reservation = await reserveInstitutionalProjectId('session', deps);
  deps.reservations.read = async () => ({ ...reservation, expiresAt } as any);
  await expect(createReservedInstitutionalProject({ session: 'session', projectId: reservation.projectId, payload: {} }, deps)).rejects.toThrow('RESERVATION_REQUIRED');
  expect(deps.createAtomically).not.toHaveBeenCalled();
});
