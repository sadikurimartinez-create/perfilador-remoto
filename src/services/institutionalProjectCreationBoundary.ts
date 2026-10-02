import "server-only";
import { randomUUID } from "crypto";
import { validateAuthorizationSnapshot, AUTHORIZATION_POLICY, validAuthorizationId } from "./institutionalAuthorizationProjectionService";
import type { InstitutionalActor, ProjectAccessRelation } from "@/types/institutionalProjectAccess";

export interface ProjectIdReservation {
  projectId: string; institutionalUserId: string; reservedAt: number; expiresAt: number;
}
export interface ProjectReservationRepository {
  reserve(reservation: ProjectIdReservation): Promise<void>;
  read(projectId: string): Promise<ProjectIdReservation | null>;
}
// Deliberately a separate administrative contract, with no production adapter.
// ceipol_app remains SELECT-only. The ordinary creation boundary never invokes it.
export interface GovernedProjectGrantProvisioner {
  provision(input: {
    reservation: ProjectIdReservation; actions: ProjectAccessRelation["allowedActions"];
    administrativeApprovalId: string; approvedByInstitutionalUserId: string;
  }): Promise<{ auditId: string; relation: ProjectAccessRelation }>;
}
export interface ProjectCreationDependencies {
  identity(session: unknown): Promise<InstitutionalActor>;
  reservations: ProjectReservationRepository;
  authority: { findRelation(projectId: string, userId: string): Promise<ProjectAccessRelation | null> };
  // The adapter must atomically allocate counters/projects, create the project
  // and append audit; reject an existing project rather than overwrite it.
  createAtomically(input: { projectId: string; actor: InstitutionalActor; payload: unknown }): Promise<unknown>;
  now(): number;
}
export async function reserveInstitutionalProjectId(session: unknown, deps: ProjectCreationDependencies) {
  const actor = await deps.identity(session);
  validateAuthorizationSnapshot({ actor, relations: [], source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY }, deps.now());
  const reservedAt = deps.now();
  const reservation = { projectId: randomUUID(), institutionalUserId: actor.institutionalUserId,
    reservedAt, expiresAt: reservedAt + 24 * 60 * 60 * 1000 };
  await deps.reservations.reserve(reservation);
  return reservation;
}
export async function createReservedInstitutionalProject(input: { session: unknown; projectId: unknown; payload: unknown }, deps: ProjectCreationDependencies) {
  const actor = await deps.identity(input.session);
  if (!validAuthorizationId(input.projectId)) throw new Error("PROJECT_CREATION_INVALID_ID");
  const reservation = await deps.reservations.read(input.projectId);
  if (!reservation || reservation.projectId !== input.projectId || reservation.institutionalUserId !== actor.institutionalUserId ||
      !Number.isSafeInteger(reservation.reservedAt) || !Number.isSafeInteger(reservation.expiresAt) ||
      reservation.reservedAt > deps.now() || reservation.expiresAt <= reservation.reservedAt ||
      reservation.expiresAt - reservation.reservedAt > 24 * 60 * 60 * 1000 || reservation.expiresAt <= deps.now()) {
    throw new Error("PROJECT_CREATION_RESERVATION_REQUIRED");
  }
  // Read the already provisioned authority. No role, username or createdBy inference.
  const relation = await deps.authority.findRelation(input.projectId, actor.institutionalUserId);
  if (!relation) throw new Error("PROJECT_CREATION_PROVISIONING_REQUIRED");
  const [projection] = validateAuthorizationSnapshot({ actor, relations: [relation], source: "POSTGRESQL", policyVersion: AUTHORIZATION_POLICY }, deps.now());
  if (projection.projectId !== input.projectId || projection.revoked || !projection.allowedActions.includes("WRITE")) {
    throw new Error("PROJECT_CREATION_EXPLICIT_WRITE_REQUIRED");
  }
  return deps.createAtomically({ projectId: input.projectId, actor, payload: input.payload });
}
