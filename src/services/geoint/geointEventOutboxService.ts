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
import { GeointEventOutboxEntry } from "@/types/geointEventOutbox";
import { GeointEventFingerprintService } from "./geointEventFingerprintService";
import { EventFingerprintRecord } from "@/types/geointEventFingerprint";

function getFirestoreInstance() {
  return typeof window === "undefined" ? getFirebaseServerDb() : getDb();
}

export class GeointEventOutboxService {
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
    const fingerprint = GeointEventFingerprintService.generateEventFingerprint({
      expedienteId,
      traceabilityId,
      eventType,
      entityId,
    });

    const fingerprintRef = doc(db, "geoint_event_fingerprints", fingerprint);
    let resolvedOutbox: GeointEventOutboxEntry | null = null;

    await runTransaction(db, async (transaction) => {
      const fpSnap = await transaction.get(fingerprintRef);
      if (fpSnap.exists()) {
        const fpData = fpSnap.data() as EventFingerprintRecord;
        const outboxDocRef = doc(db, "geoint_event_outbox", `outbox-${fpData.eventId}`);
        const outboxSnap = await transaction.get(outboxDocRef);
        if (outboxSnap.exists()) {
          resolvedOutbox = outboxSnap.data() as GeointEventOutboxEntry;
          return;
        }
      }

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const eventId = `evt-geoint-${uniqueSuffix}`;
      const outboxId = `outbox-${eventId}`;

      const outboxEntry: GeointEventOutboxEntry = {
        outboxId,
        eventId,
        fingerprint,
        payload: {
          eventType,
          expedienteId,
          traceabilityId,
          actor,
          source,
          status,
          entityType,
          entityId,
          metadata,
        },
        status: "CREATED",
        retryCount: 0,
        createdAt: new Date().toISOString(),
        processedAt: null,
      };

      const outboxDocRef = doc(db, "geoint_event_outbox", outboxId);
      transaction.set(outboxDocRef, {
        ...outboxEntry,
        createdAt: serverTimestamp(),
      });

      const fingerprintRecord: EventFingerprintRecord = {
        fingerprint,
        eventId,
        expedienteId,
        traceabilityId,
        eventType,
        entityId,
        status,
        createdAt: outboxEntry.createdAt,
      };

      transaction.set(fingerprintRef, {
        ...fingerprintRecord,
        createdAt: serverTimestamp(),
      });

      resolvedOutbox = outboxEntry;
    });

    return resolvedOutbox!;
  }

  /**
   * Obtiene los registros pendientes (CREATED, QUEUED, FAILED) de la outbox,
   * ordenados cronológicamente y limitados para procesamiento seguro.
   */
  static async getPendingEntries(limitCount: number = 50): Promise<GeointEventOutboxEntry[]> {
    const db = getFirestoreInstance();
    const q = query(
      collection(db, "geoint_event_outbox"),
      where("status", "in", ["CREATED", "QUEUED", "FAILED"]),
      orderBy("createdAt", "asc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as GeointEventOutboxEntry);
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
