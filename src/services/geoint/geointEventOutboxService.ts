import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { getDb } from "@/lib/firebase";
import {
  GeointEventOutboxEntry,
  GeointOutboxClaimResult,
} from "@/types/geointEventOutbox";
import { GeointEventFingerprintService } from "./geointEventFingerprintService";
import { EventFingerprintRecord } from "@/types/geointEventFingerprint";

function getFirestoreInstance() {
  return typeof window === "undefined" ? getFirebaseServerDb() : getDb();
}

export interface GeointOutboxEventPayload {
  eventType: string;
  expedienteId: string;
  traceabilityId: string;
  actor: string;
  source: string;
  status: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

const RETRYABLE_OUTBOX_STATUSES: GeointEventOutboxEntry["status"][] = ["CREATED", "QUEUED"];
const TERMINAL_OUTBOX_STATUSES: GeointEventOutboxEntry["status"][] = ["COMPLETED", "FAILED", "REJECTED"];

function buildDeterministicEventId(fingerprint: string): string {
  return `evt-${fingerprint.substring(0, 16)}`;
}

function normalizeOutboxEntry(entry: GeointEventOutboxEntry): GeointEventOutboxEntry {
  const failures = typeof entry.retryCount === "number" ? entry.retryCount : 0;
  return {
    ...entry,
    retryCount: failures,
    attempts: typeof entry.attempts === "number" ? entry.attempts : failures,
    processedAt: entry.processedAt ?? null,
    claimId: entry.claimId ?? null,
    claimedAt: entry.claimedAt ?? null,
    completedAt: entry.completedAt ?? null,
    failedAt: entry.failedAt ?? null,
    lastError: entry.lastError ?? entry.errorMessage ?? null,
    errorMessage: entry.errorMessage ?? entry.lastError ?? null,
  };
}

export class GeointEventOutboxService {
  static buildEventIdFromFingerprint(fingerprint: string): string {
    return buildDeterministicEventId(fingerprint);
  }

  static async enqueueEventInTransaction(
    transaction: {
      get: (ref: any) => Promise<{ exists: () => boolean; data: () => any }>;
      set: (ref: any, data: any, options?: any) => void;
    },
    db: any,
    payload: GeointOutboxEventPayload
  ): Promise<GeointEventOutboxEntry> {
    const fingerprint = GeointEventFingerprintService.generateEventFingerprint({
      expedienteId: payload.expedienteId,
      traceabilityId: payload.traceabilityId,
      eventType: payload.eventType,
      entityId: payload.entityId,
    });

    const fingerprintRef = doc(db, "geoint_event_fingerprints", fingerprint);
    const fpSnap = await transaction.get(fingerprintRef);
    const existingFingerprint = fpSnap.exists()
      ? (fpSnap.data() as EventFingerprintRecord)
      : null;
    const eventId = existingFingerprint?.eventId || buildDeterministicEventId(fingerprint);
    const outboxId = `outbox-${eventId}`;
    const outboxDocRef = doc(db, "geoint_event_outbox", outboxId);
    const outboxSnap = await transaction.get(outboxDocRef);

    if (outboxSnap.exists()) {
      return normalizeOutboxEntry(outboxSnap.data() as GeointEventOutboxEntry);
    }

    const outboxEntry: GeointEventOutboxEntry = {
      outboxId,
      eventId,
      fingerprint,
      payload: {
        eventType: payload.eventType,
        expedienteId: payload.expedienteId,
        traceabilityId: payload.traceabilityId,
        actor: payload.actor,
        source: payload.source,
        status: payload.status,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: payload.metadata || {},
      },
      status: "CREATED",
      attempts: 0,
      claimId: null,
      claimedAt: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      processedAt: null,
      errorMessage: null,
    };

    transaction.set(outboxDocRef, {
      ...outboxEntry,
      createdAt: serverTimestamp(),
    });

    transaction.set(fingerprintRef, {
      fingerprint,
      eventId,
      expedienteId: payload.expedienteId,
      traceabilityId: payload.traceabilityId,
      eventType: payload.eventType,
      entityId: payload.entityId,
      status: payload.status,
      createdAt: serverTimestamp(),
    });

    return outboxEntry;
  }

  /**
   * Encola un evento en la outbox de forma transaccional y segura, validando idempotencia.
   */
  static async enqueueEvent(
    eventType: string,
    expedienteId: string,
    traceabilityId: string,
    actor: string,
    source: string,
    status: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, any> = {}
  ): Promise<GeointEventOutboxEntry> {
    const db = getFirestoreInstance();
    let resolvedOutbox: GeointEventOutboxEntry | null = null;

    await runTransaction(db, async (transaction) => {
      resolvedOutbox = await GeointEventOutboxService.enqueueEventInTransaction(transaction, db, {
        eventType,
        expedienteId,
        traceabilityId,
        actor,
        source,
        status,
        entityType,
        entityId,
        metadata,
      });
    });

    return normalizeOutboxEntry(resolvedOutbox!);
  }

  /**
   * Obtiene los registros retryables (CREATED, QUEUED) de la outbox,
   * ordenados cronológicamente y limitados para procesamiento seguro.
   * FAILED es terminal desde ADR-019.19 FASE 2A y no se reprocesa automaticamente.
   */
  static async getPendingEntries(limitCount: number = 50): Promise<GeointEventOutboxEntry[]> {
    const db = getFirestoreInstance();
    const q = query(
      collection(db, "geoint_event_outbox"),
      where("status", "in", RETRYABLE_OUTBOX_STATUSES),
      orderBy("createdAt", "asc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeOutboxEntry(d.data() as GeointEventOutboxEntry));
  }

  /**
   * Reclama una entrada para procesamiento. attempts representa intentos
   * iniciados; retryCount representa fallos acumulados.
   */
  static async claimEntry(
    outboxId: string,
    maxAttempts: number,
    claimId: string = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ): Promise<GeointOutboxClaimResult> {
    const db = getFirestoreInstance();
    const outboxRef = doc(db, "geoint_event_outbox", outboxId);
    let result: GeointOutboxClaimResult = { claimed: false, reason: "NOT_FOUND" };

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(outboxRef);
      if (!snap.exists()) {
        result = { claimed: false, reason: "NOT_FOUND" };
        return;
      }

      const current = normalizeOutboxEntry(snap.data() as GeointEventOutboxEntry);

      if (current.status === "PROCESSING") {
        result = { claimed: false, reason: "ALREADY_PROCESSING", entry: current };
        return;
      }

      if (TERMINAL_OUTBOX_STATUSES.includes(current.status)) {
        result = { claimed: false, reason: "TERMINAL", entry: current };
        return;
      }

      if (!RETRYABLE_OUTBOX_STATUSES.includes(current.status)) {
        result = { claimed: false, reason: "NOT_ELIGIBLE", entry: current };
        return;
      }

      const attempts = typeof current.attempts === "number" ? current.attempts : current.retryCount || 0;
      if (attempts >= maxAttempts) {
        transaction.set(
          outboxRef,
          {
            status: "FAILED",
            failedAt: serverTimestamp(),
            processedAt: null,
            claimId: null,
            lastError: current.lastError || current.errorMessage || "MAX_ATTEMPTS_EXHAUSTED",
            errorMessage: current.errorMessage || current.lastError || "MAX_ATTEMPTS_EXHAUSTED",
          },
          { merge: true }
        );
        result = { claimed: false, reason: "MAX_ATTEMPTS_EXHAUSTED", entry: current };
        return;
      }

      const claimedEntry = normalizeOutboxEntry({
        ...current,
        status: "PROCESSING",
        attempts: attempts + 1,
        claimId,
        claimedAt: new Date().toISOString(),
        processedAt: null,
      });

      transaction.set(
        outboxRef,
        {
          status: "PROCESSING",
          attempts: claimedEntry.attempts,
          claimId,
          claimedAt: serverTimestamp(),
          processedAt: null,
          lastError: null,
          errorMessage: null,
        },
        { merge: true }
      );

      result = { claimed: true, reason: "CLAIMED", entry: claimedEntry };
    });

    return result;
  }

  static async markCompleted(outboxId: string): Promise<void> {
    const db = getFirestoreInstance();
    const docRef = doc(db, "geoint_event_outbox", outboxId);
    await setDoc(
      docRef,
      {
        status: "COMPLETED",
        processedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        claimId: null,
        lastError: null,
        errorMessage: null,
      },
      { merge: true }
    );
  }

  static async markFailure(
    entry: GeointEventOutboxEntry,
    error: unknown,
    maxAttempts: number
  ): Promise<"QUEUED" | "FAILED"> {
    const db = getFirestoreInstance();
    const docRef = doc(db, "geoint_event_outbox", entry.outboxId);
    const failures = (entry.retryCount || 0) + 1;
    const attempts = typeof entry.attempts === "number" ? entry.attempts : failures;
    const finalStatus: "QUEUED" | "FAILED" = attempts >= maxAttempts ? "FAILED" : "QUEUED";
    const message = error instanceof Error ? error.message : String(error);

    await setDoc(
      docRef,
      {
        status: finalStatus,
        retryCount: failures,
        attempts,
        processedAt: null,
        failedAt: finalStatus === "FAILED" ? serverTimestamp() : null,
        claimId: null,
        lastError: message,
        errorMessage: message,
      },
      { merge: true }
    );

    return finalStatus;
  }

  static async ledgerEventExists(eventId: string): Promise<boolean> {
    const db = getFirestoreInstance();
    const eventRef = doc(db, "geoint_event_logs", eventId);
    const snap = await getDoc(eventRef);
    return snap.exists();
  }

  /**
   * Actualiza el estado de una entrada en la outbox.
   */
  static async updateEntryStatus(
    outboxId: string,
    status: GeointEventOutboxEntry["status"],
    updates: Partial<GeointEventOutboxEntry> = {}
  ): Promise<void> {
    const db = getFirestoreInstance();
    const docRef = doc(db, "geoint_event_outbox", outboxId);
    await setDoc(
      docRef,
      {
        ...updates,
        status,
        processedAt: status === "COMPLETED" ? new Date().toISOString() : null,
      },
      { merge: true }
    );
  }
}
