import "server-only";
import { createHash } from "crypto";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { deserializeCanonicalGeographyFromFirestore } from "@/utils/canonicalProjectGeography";
import { projectPersistedInstitutionalInputs } from "@/utils/institutionalReportInputProjection";
import { normalizeInstitutionalBaseEvidence } from "@/utils/institutionalBaseEvidenceNormalizer";
import { mergeAdditionalPhotoEvidence } from "@/utils/institutionalProductsUi";

export interface AuthorizedInstitutionalReportSource {
  projectId: string;
  project: Record<string, any>;
  actor: { uid: string; displayName: string };
  sourceFingerprint: string;
  action: "GENERATE_REPORT";
}
type Dependencies = {
  authorize: typeof authorizeInstitutionalProjectAccess;
  readProject: (id: string) => Promise<Record<string, any> | null>;
};
const defaults: Dependencies = {
  authorize: authorizeInstitutionalProjectAccess,
  async readProject(id) {
    const reference = getInstitutionalAdminDb().collection("projects").doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) return null;
    const [photos, documents] = await Promise.all([reference.collection("photos").get(), reference.collection("documents").get()]);
    return { ...snapshot.data(), id: snapshot.id,
      album: photos.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: Record<string, unknown>) => item.deleted !== true),
      documents: documents.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: Record<string, unknown>) => item.deleted !== true) };
  },
};
function serialized(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

/** Client identity, roles and client-side analytical content are not inputs to this boundary. */
export async function resolveAuthorizedInstitutionalReportSource(input: { projectId: unknown; sessionToken: unknown },
  overrides: Partial<Dependencies> = {}): Promise<AuthorizedInstitutionalReportSource> {
  const deps = { ...defaults, ...overrides };
  const access = await deps.authorize({ projectId: input.projectId, sessionToken: input.sessionToken, action: "GENERATE_REPORT" });
  if (!access.allowed) throw new Error(`INSTITUTIONAL_REPORT_ACCESS_DENIED:${access.code}`);
  const stored = await deps.readProject(access.projectId);
  if (!stored || stored.id !== access.projectId || (stored.deleted !== undefined && stored.deleted !== false) ||
    stored.status === "ARCHIVADO" || stored.estado === "ARCHIVADO") throw new Error("INSTITUTIONAL_REPORT_SOURCE_UNAVAILABLE");
  const project = projectPersistedInstitutionalInputs(stored).project;
  if (project.canonicalGeography) project.canonicalGeography = deserializeCanonicalGeographyFromFirestore(project.canonicalGeography);
  const album = (project.album || []).map((photo: any) => {
    const normalized = normalizeInstitutionalBaseEvidence({ ...photo,
      expedienteId: photo.expedienteId || photo.projectId || access.projectId,
      geographyId: photo.geographyId ?? project.canonicalGeography?.geographyId ?? null,
      geographyType: photo.geographyType ?? project.canonicalGeography?.type ?? null,
      lat: photo.lat ?? photo.gpsLat ?? null, lng: photo.lng ?? photo.gpsLng ?? null,
      legacy: !photo.traceabilityId || !photo.sourceEvidenceId });
    return { ...photo, ...normalized.fields, previewUrl: photo.previewUrl || photo.url || "",
      evidenceClass: normalized.evidenceClass };
  });
  project.photoEvidence = mergeAdditionalPhotoEvidence([...project.photoEvidence || [], ...album], project.documents || [], {
    projectId: access.projectId, geographyId: project.canonicalGeography?.geographyId,
    geographyType: project.canonicalGeography?.type });
  project.album = project.photoEvidence;
  // Return only JSON-serializable persisted data; no cache or client state is consulted.
  const sourceFingerprint = `sha256:${createHash("sha256").update(serialized(stored)).digest("hex")}`;
  return { projectId: access.projectId, project: JSON.parse(serialized(project)),
    actor: { uid: `user:${access.actor.institutionalUserId}`, displayName: access.actor.username },
    sourceFingerprint, action: "GENERATE_REPORT" };
}
