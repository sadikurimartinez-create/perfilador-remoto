import "server-only";
import { createHash } from "crypto";
import { FieldValue, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { applyHumanValidationAction } from "@/utils/humanValidationPolicy";
import { evidenceAliases, evidenceReviewLocatorId, institutionalReviewState, reviewVersion, type EvidenceReviewRequest } from "@/utils/institutionalEvidenceReview";
import { GeointEventOutboxService } from "./geoint/geointEventOutboxService";
import { normalizeStreetViewFindingForPersistence, recoverHistoricalStreetViewFindingForApproval } from "./streetViewFindingService";
import { makeFirestoreSafe } from "@/utils/firestoreSafe";

// Invoked only after the existing institutional entity boundary authorizes WRITE.
export async function commitInstitutionalEvidenceReview(db: Firestore, actor: any, input: EvidenceReviewRequest) {
  return db.runTransaction(async tx => {
    const parentRef = db.doc(`projects/${input.projectId}`);
    const parent = (await tx.get(parentRef)).data();
    if (!parent || parent.deleted || parent.estado === "ARCHIVADO" || parent.status === "ARCHIVADO") throw new Error("EVIDENCE_REVIEW_PROJECT_INACCESSIBLE");
    const tactical = Array.isArray(parent.tacticalStreetViews) ? parent.tacticalStreetViews : [];
    const childRef = input.source === "TACTICAL_STREET_VIEW" ? null : db.doc(`projects/${input.projectId}/${input.source === "PHOTO" ? "photos" : input.source === "DOCUMENT_PHOTO" ? "documents" : "streetview_findings"}/${input.id}`);
    const child = childRef ? await tx.get(childRef) : null;
    const rootRef = input.source === "STREETVIEW_FINDING" ? db.doc(`streetview_findings/${input.id}`) : null;
    const root = rootRef ? await tx.get(rootRef) : null;
    if (root?.exists && root.data()?.expedienteId !== input.projectId) throw new Error("EVIDENCE_REVIEW_CROSS_PROJECT");
    const matches = tactical.filter((item: any) => evidenceReviewLocatorId(item) === input.id);
    if (input.source === "TACTICAL_STREET_VIEW" && matches.length !== 1) throw new Error("EVIDENCE_REVIEW_TARGET_AMBIGUOUS_OR_MISSING");
    const prior = input.source === "TACTICAL_STREET_VIEW" ? matches[0] : child?.data() || root?.data();
    if (!prior || prior.deleted) throw new Error("EVIDENCE_REVIEW_NOT_FOUND");
    for (const record of [prior, root?.data()].filter(Boolean)) {
      if (record.expedienteId && record.expedienteId !== input.projectId || record.projectId && record.projectId !== input.projectId) throw new Error("EVIDENCE_REVIEW_CROSS_PROJECT");
    }
    if (input.source === "DOCUMENT_PHOTO" && !/^image\//i.test(prior.type || prior.mimeType || prior.multimodalEvidence?.mimeType || "")) throw new Error("EVIDENCE_REVIEW_NOT_PHOTOGRAPHIC");
    if (reviewVersion(prior) !== input.expectedReview) throw new Error("EVIDENCE_REVIEW_STALE_RELOAD_REQUIRED");
    const now = new Date().toISOString();
    const identity = { id: actor.institutionalUserId, uid: `user:${actor.institutionalUserId}`, name: actor.username, role: actor.role };
    const patch = { ...applyHumanValidationAction({ action: input.action, validatorIdentity: identity, validatedAt: now }),
      validationDate: now, validationComment: input.comment.trim() };
    const isStreetView = (input.source === "TACTICAL_STREET_VIEW" || input.source === "STREETVIEW_FINDING") || prior.isStreetView || prior.streetViewMetadata || prior.sourceProvider === "GOOGLE_STREET_VIEW" || /STREET_?VIEW/i.test(prior.tipo || prior.evidenceType || "");
    const reviewPatch = isStreetView ? { ...patch, estado: institutionalReviewState(input.action), estado_revision: institutionalReviewState(input.action), status: institutionalReviewState(input.action) } : patch;
    let result = { ...prior, ...reviewPatch, id: prior.id || input.id };
    if (input.source === "STREETVIEW_FINDING") {
      const candidate = { ...result, expedienteId: input.projectId, usuarioRevision: actor.username };
      // Validate existing traceability; do not synthesize or create another finding.
      const normalized = normalizeStreetViewFindingForPersistence(input.action === "APPROVE" ? recoverHistoricalStreetViewFindingForApproval(candidate) : candidate);
      result = { ...candidate, ...normalized };
    }
    if (input.source === "DOCUMENT_PHOTO" && prior.multimodalEvidence) result = { ...result, multimodalEvidence: { ...prior.multimodalEvidence, ...patch } };
    result = makeFirestoreSafe(result);
    const aliases = new Set(evidenceAliases({ ...prior, id: prior.id || input.id }));
    const updatedTactical = tactical.map((item: any) => isStreetView && evidenceAliases(item).some(alias => aliases.has(alias)) ? { ...item, ...reviewPatch } : item);
    const eventType = input.action === "APPROVE" ? "HUMAN_APPROVED" : input.action === "REJECT" ? "HUMAN_REJECTED" : "HUMAN_RETURNED_FOR_REANALYSIS";
    const digest = createHash("sha256").update(JSON.stringify([input.source, input.id, patch, input.expectedReview])).digest("hex");
    const writes: Array<() => void> = [];
    const adapter = { get: async (ref: any) => { const snapshot = await tx.get(ref as DocumentReference); return { exists: () => snapshot.exists, data: () => snapshot.data() }; },
      set: (ref: any, data: any, options?: any) => writes.push(() => options ? tx.set(ref, data, options) : tx.set(ref, data)) };
    const prepared = await GeointEventOutboxService.prepareEventInTransaction(adapter, db, {
      eventType, expedienteId: input.projectId, traceabilityId: `evidence-review:${input.source}:${input.id}:${digest}`,
      actor: identity.uid, source: "INSTITUTIONAL_SERVER_ENTITY", status: patch.humanValidationStatus,
      entityType: input.source, entityId: input.id, metadata: { decision: input.action, comment: patch.validationComment },
    }, (database, ...segments) => database.doc(segments.join("/")));
    const auditRef = db.doc(`audit_logs/evidence-review-${digest}`);
    const audit = await tx.get(auditRef);
    if (audit.exists || prepared.exists) throw new Error("EVIDENCE_REVIEW_CONFLICT");
    GeointEventOutboxService.commitPreparedEventInTransaction(adapter, prepared, () => FieldValue.serverTimestamp());
    if (childRef) tx.set(childRef, result);
    if (rootRef) tx.set(rootRef, result);
    const parentPatch: any = { institutionalSourceRevision: Number.isSafeInteger(parent.institutionalSourceRevision) ? parent.institutionalSourceRevision + 1 : 1 };
    if (input.source === "TACTICAL_STREET_VIEW" || updatedTactical.some((item: any, index: number) => item !== tactical[index])) parentPatch.tacticalStreetViews = makeFirestoreSafe(updatedTactical);
    tx.update(parentRef, parentPatch);
    for (const write of writes) write();
    tx.create(auditRef, { projectId: input.projectId, entityId: input.id, evidenceSource: input.source,
      action: eventType, decision: input.action, actorInstitutionalUserId: actor.institutionalUserId,
      user: actor.username, timestamp: now, comment: patch.validationComment, source: "SERVER", eventId: prepared.eventId });
    return { ...result, reviewTarget: { source: input.source, id: input.id } };
  });
}
