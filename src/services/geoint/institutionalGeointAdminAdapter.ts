import "server-only";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { GeointEventOutboxService, normalizeOutboxEntry, RETRYABLE_OUTBOX_STATUSES, TERMINAL_OUTBOX_STATUSES, type GeointOutboxEventPayload } from "./geointEventOutboxService";
import type { GeointEventOutboxEntry, GeointOutboxClaimResult } from "@/types/geointEventOutbox";
import type { GeointEventLogEntry } from "@/types/geointEventLog";

/** Persistence adapter for the existing dispatcher. One explicitly authorized
 * project per instance; never scan/dispatch another project's outbox by role. */
export class InstitutionalGeointAdminAdapter {
  private db = getInstitutionalAdminDb();
  private claims = new Map<string,string>();
  constructor(private projectId: string) {}
  private outbox(id: string) { return this.db.collection("geoint_event_outbox").doc(id); }
  private scoped(entry: GeointEventOutboxEntry) {
    if (entry.payload?.expedienteId !== this.projectId) throw new Error("GEOINT_CROSS_PROJECT_DENIED");
    return normalizeOutboxEntry(entry);
  }
  async enqueue(payload: GeointOutboxEventPayload) {
    if (payload.expedienteId !== this.projectId) throw new Error("GEOINT_CROSS_PROJECT_DENIED");
    return this.db.runTransaction(async transaction => {
      const compatible = { get: async (ref: DocumentReference) => { const snap = await transaction.get(ref); return { exists: () => snap.exists, data: () => snap.data() }; },
        set: (ref: any, data: any) => { transaction.set(ref,data); } };
      const prepared = await GeointEventOutboxService.prepareEventInTransaction(compatible, this.db, payload,
        (db, ...segments) => db.doc(segments.join("/")));
      this.scoped(prepared.entry);
      return GeointEventOutboxService.commitPreparedEventInTransaction(compatible, prepared, () => FieldValue.serverTimestamp());
    });
  }
  async getPendingEntries(limit: number) {
    const snapshot = await this.db.collection("geoint_event_outbox").where("payload.expedienteId", "==", this.projectId)
      .where("status", "in", RETRYABLE_OUTBOX_STATUSES).limit(limit).get();
    return snapshot.docs.map(doc => this.scoped(doc.data() as GeointEventOutboxEntry));
  }
  async claimEntry(id: string, maxAttempts: number): Promise<GeointOutboxClaimResult> {
    return this.db.runTransaction(async transaction => {
      const ref = this.outbox(id); const snap = await transaction.get(ref);
      if (!snap.exists) return { claimed: false, reason: "NOT_FOUND" };
      const current = this.scoped(snap.data() as GeointEventOutboxEntry);
      if (current.status === "PROCESSING") return { claimed: false, reason: "ALREADY_PROCESSING", entry: current };
      if (TERMINAL_OUTBOX_STATUSES.includes(current.status)) return { claimed: false, reason: "TERMINAL", entry: current };
      if (!RETRYABLE_OUTBOX_STATUSES.includes(current.status)) return { claimed: false, reason: "NOT_ELIGIBLE", entry: current };
      const attempts = current.attempts ?? current.retryCount ?? 0;
      if (attempts >= maxAttempts) {
        transaction.update(ref, { status: "FAILED", failedAt: FieldValue.serverTimestamp(), claimId: null,
          lastError: "MAX_ATTEMPTS_EXHAUSTED", errorMessage: "MAX_ATTEMPTS_EXHAUSTED" });
        return { claimed: false, reason: "MAX_ATTEMPTS_EXHAUSTED", entry: current };
      }
      const claimId = randomUUID();
      const entry = normalizeOutboxEntry({ ...current, status: "PROCESSING", attempts: attempts + 1,
        claimId, claimedAt: new Date().toISOString(), processedAt: null });
      transaction.update(ref, { status: "PROCESSING", attempts: entry.attempts, claimId,
        claimedAt: FieldValue.serverTimestamp(), processedAt: null, lastError: null, errorMessage: null });
      this.claims.set(id, claimId);
      return { claimed: true, reason: "CLAIMED", entry };
    });
  }
  async ledgerEventExists(id: string) {
    const snap = await this.db.collection("geoint_event_logs").doc(id).get();
    if (snap.exists && snap.data()?.expedienteId !== this.projectId) throw new Error("GEOINT_CROSS_PROJECT_DENIED");
    return snap.exists;
  }
  async persistGeointEvent(event: GeointEventLogEntry) {
    if (event.expedienteId !== this.projectId) throw new Error("GEOINT_CROSS_PROJECT_DENIED");
    const ref = this.db.collection("geoint_event_logs").doc(event.eventId);
    await this.db.runTransaction(async transaction => {
      const prior = await transaction.get(ref);
      if (prior.exists) { if (prior.data()?.expedienteId !== this.projectId) throw new Error("GEOINT_CROSS_PROJECT_DENIED"); return; }
      transaction.create(ref, { ...event, timestamp: FieldValue.serverTimestamp() });
    });
  }
  private async transition(id: string, patch: Record<string, any>) {
    await this.db.runTransaction(async transaction => {
      const ref = this.outbox(id); const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error("GEOINT_OUTBOX_NOT_FOUND");
      const current = this.scoped(snap.data() as GeointEventOutboxEntry);
      if (current.status !== "PROCESSING" || current.claimId !== this.claims.get(id)) throw new Error("GEOINT_CLAIM_MISMATCH");
      transaction.update(ref, patch);
    });
    this.claims.delete(id);
  }
  async markCompleted(id: string) {
    await this.transition(id, { status: "COMPLETED", processedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp(),
      claimId: null, lastError: null, errorMessage: null });
  }
  async markFailure(entry: GeointEventOutboxEntry, _error: unknown, maxAttempts: number): Promise<"QUEUED" | "FAILED"> {
    const current = this.scoped(entry); const failures = (current.retryCount ?? 0) + 1;
    const attempts = current.attempts ?? failures;
    const status = attempts >= maxAttempts ? "FAILED" : "QUEUED";
    await this.transition(entry.outboxId, { status, retryCount: failures, attempts, processedAt: null,
      failedAt: status === "FAILED" ? FieldValue.serverTimestamp() : null, claimId: null,
      lastError: "GEOINT_DISPATCH_FAILED", errorMessage: "GEOINT_DISPATCH_FAILED" });
    return status;
  }
}
