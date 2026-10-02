"use server";
import { cookies } from "next/headers";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { getPool } from "@/lib/db";
import { institutionalProjectAccessRepository } from "@/services/institutionalProjectAccessRepository";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { refreshInstitutionalAuthorization } from "@/services/institutionalAuthorizationProjectionRepository";
import { reserveInstitutionalProjectId, createReservedInstitutionalProject, type ProjectCreationDependencies } from "@/services/institutionalProjectCreationBoundary";
import { buildNumeroExpedienteFields, resolvePerfiladorIniciales } from "@/utils/documentIdentity";
import { deserializeCanonicalGeographyFromFirestore, rehydrateCanonicalProjectGeography, serializeCanonicalGeographyForFirestore } from "@/utils/canonicalProjectGeography";

function dependencies(session: string | undefined): ProjectCreationDependencies {
  const db = getInstitutionalAdminDb();
  return {
    identity: resolveInstitutionalSessionIdentity, authority: institutionalProjectAccessRepository, now: Date.now,
    reservations: {
      async reserve(reservation) {
        const batch = db.batch();
        batch.create(db.collection("projectCreationReservations").doc(reservation.projectId), reservation);
        batch.create(db.collection("audit_logs").doc(), { projectId: reservation.projectId,
          actorInstitutionalUserId: reservation.institutionalUserId, action: "PROJECT_ID_RESERVED",
          timestamp: reservation.reservedAt, source: "SERVER" });
        await batch.commit();
      },
      async read(id) {
        const snap = await db.collection("projectCreationReservations").doc(id).get();
        return snap.exists ? snap.data() as any : null;
      },
    },
    async createAtomically({ projectId, actor, payload }) {
      if (!payload || typeof payload !== "object") throw new Error("PROJECT_CREATION_PAYLOAD_INVALID");
      const input = payload as Record<string, any>;
      if (!["individual", "lineal", "poligono"].includes(input.geometryType) || typeof input.name !== "string" ||
          input.name.length > 500 || (input.descripcion !== undefined && typeof input.descripcion !== "string")) throw new Error("PROJECT_CREATION_PAYLOAD_INVALID");
      const historical = input.historicalProjectRecoveryOrigin;
      let geography = null;
      if (historical) {
        if (typeof historical.sourceProjectId !== "string" || !historical.recoveryReason?.trim()) throw new Error("HISTORICAL_RECOVERY_INVALID");
        const source = await authorizeInstitutionalProjectAccess({ sessionToken: session, projectId: historical.sourceProjectId, action: "READ" });
        if (!source.allowed) throw new Error("HISTORICAL_RECOVERY_SOURCE_ACCESS_DENIED");
      } else {
        geography = rehydrateCanonicalProjectGeography(deserializeCanonicalGeographyFromFirestore(input.canonicalGeography));
        if (!geography || geography.validationStatus !== "VALID") throw new Error("PROJECT_CREATION_GEOGRAPHY_INVALID");
      }
      const profile = await getPool().query("SELECT profile FROM users WHERE id::text = $1", [actor.institutionalUserId]);
      if (profile.rows.length !== 1) throw new Error("PROJECT_CREATION_IDENTITY_UNAVAILABLE");
      const initials = resolvePerfiladorIniciales({ profile: profile.rows[0].profile });
      const project = db.collection("projects").doc(projectId);
      const counter = db.collection("counters").doc("projects");
      return db.runTransaction(async transaction => {
        const existing = await transaction.get(project);
        if (existing.exists) {
          const saved = existing.data()!;
          if (saved.creationReservationId !== projectId) throw new Error("PROJECT_CREATION_EXISTING_PROJECT_PROTECTED");
          return saved;
        }
        const count = (await transaction.get(counter)).data()?.count ?? 0;
        if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) throw new Error("PROJECT_COUNTER_INVALID");
        const now = new Date();
        const fields = buildNumeroExpedienteFields({ createdAt: now, sequence: count + 1, perfiladorIniciales: initials });
        const ceipolId = `CEIPOL/${String(count + 1).padStart(6, "0")}/${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth()+1).padStart(2, "0")}/${now.getFullYear()}`;
        const data = { ...fields, ceipolId, name: input.name.trim() || "Sin nombre", geometryType: input.geometryType,
          descripcion: input.descripcion || "", createdAt: now.getTime(), createdBy: actor.username,
          creationReservationId: projectId, createdByInstitutionalUserId: actor.institutionalUserId,
          lockedBy: null, photoCount: 0, estado: "ABIERTO", canonicalHypothesis: null, hypothesisRequirementSatisfied: false,
          canonicalGeography: geography ? serializeCanonicalGeographyForFirestore(geography) : null,
          geographyId: geography?.geographyId ?? null, geographyValidationStatus: geography ? "VALID" : "INVALID",
          ...(historical ? { historicalGeographyReconciliation: null, historicalProjectRecoveryOrigin: {
            recoveryType: "HISTORICAL_PROJECT_RECOVERY", sourceProjectId: historical.sourceProjectId,
            sourceProjectName: historical.sourceProjectName ?? null, sourceGeometryType: historical.sourceGeometryType ?? null,
            recoveryReason: historical.recoveryReason, recoveredAt: now.getTime(),
            recoveredBy: { id: actor.institutionalUserId, username: actor.username, name: actor.username },
          } } : {}),
        };
        transaction.set(counter, { count: count + 1 });
        transaction.create(project, data);
        transaction.create(db.collection("audit_logs").doc(), { projectId, actorInstitutionalUserId: actor.institutionalUserId,
          action: "PROJECT_CREATED_AFTER_EXPLICIT_PROVISIONING", timestamp: now.toISOString(), source: "SERVER",
          policyVersion: "EXPLICIT_ACTION_GRANT_V1", numeroExpediente: fields.numeroExpediente });
        return data;
      });
    },
  };
}
export async function reserveInstitutionalProjectCreation() {
  const session = cookies().get("ceipol_session")?.value;
  return reserveInstitutionalProjectId(session, dependencies(session));
}
export async function completeInstitutionalProjectCreation(projectId: string, payload: unknown) {
  const session = cookies().get("ceipol_session")?.value;
  const created = await createReservedInstitutionalProject({ session, projectId, payload }, dependencies(session)) as Record<string, any>;
  await refreshInstitutionalAuthorization(await resolveInstitutionalSessionIdentity(session));
  return created;
}
