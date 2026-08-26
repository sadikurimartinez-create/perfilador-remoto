import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { getDb } from "@/lib/firebase";
import { 
  GeointEventLogEntry, 
  GeointEventType, 
  buildGeointEventLogEntry 
} from "@/types/geointEventLog";
import { GeointEventFingerprintService } from "./geointEventFingerprintService";
import { EventFingerprintRecord } from "@/types/geointEventFingerprint";

function getFirestoreInstance() {
  return typeof window === "undefined" ? getFirebaseServerDb() : getDb();
}

export class GeointEventLogService {
  /**
   * Persiste un evento en la colección geoint_event_logs
   */
  static async persistGeointEvent(event: GeointEventLogEntry): Promise<void> {
    const db = getFirestoreInstance();
    await setDoc(doc(db, "geoint_event_logs", event.eventId), {
      ...event,
      timestamp: serverTimestamp(), // Sobrescribir con servidor para consistencia
    });
  }

  /**
   * Crea y persiste un evento en una sola operación aplicando Idempotencia y Event Fingerprint (ADR-019.19 FASE 1) de forma atómica mediante runTransaction.
   */
  static async createAndPersistEvent(
    eventType: GeointEventType,
    expedienteId: string,
    traceabilityId: string,
    actor: string,
    source: string,
    status: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, any> = {}
  ): Promise<GeointEventLogEntry> {
    const db = getFirestoreInstance();
    const fingerprint = GeointEventFingerprintService.generateEventFingerprint({
      expedienteId,
      traceabilityId,
      eventType,
      entityId,
    });

    const fingerprintRef = doc(db, "geoint_event_fingerprints", fingerprint);

    let resolvedEvent: GeointEventLogEntry | null = null;

    await runTransaction(db, async (transaction) => {
      const fpSnap = await transaction.get(fingerprintRef);
      if (fpSnap.exists()) {
        const fpData = fpSnap.data() as EventFingerprintRecord;
        const eventDocRef = doc(db, "geoint_event_logs", fpData.eventId);
        const eventSnap = await transaction.get(eventDocRef);
        if (eventSnap.exists()) {
          resolvedEvent = eventSnap.data() as GeointEventLogEntry;
          return;
        }
      }

      // Si no existe, crearlo dentro de la transacción atómica usando el fingerprint como base para el eventId
      const eventId = `evt-${fingerprint.substring(0, 16)}`;

      const event: GeointEventLogEntry = {
        eventId,
        eventType,
        timestamp: new Date().toISOString(),
        expedienteId,
        traceabilityId,
        actor,
        source,
        status,
        payload: { entityType, entityId, ...metadata }
      };

      // 2. Verificar existencia del evento en el log (doble validación atómica)
      const eventDocRef = doc(db, "geoint_event_logs", event.eventId);
      const eventSnap = await transaction.get(eventDocRef);

      if (eventSnap.exists()) {
        resolvedEvent = eventSnap.data() as GeointEventLogEntry;
        return;
      }

      // 3. Escribir Log y Fingerprint solo si no existen
      transaction.set(eventDocRef, {
        ...event,
        timestamp: serverTimestamp(),
      });

      transaction.set(fingerprintRef, {
        fingerprint,
        eventId: event.eventId,
        expedienteId,
        traceabilityId,
        eventType,
        entityId,
        status,
        createdAt: serverTimestamp(),
      });

      resolvedEvent = event;
    });

    return resolvedEvent!;
  }

  /**
   * Recupera el timeline completo de un expediente (ordenado en memoria por timestamp)
   */
  static async getExpedientEventHistory(expedienteId: string): Promise<GeointEventLogEntry[]> {
    const db = getFirestoreInstance();
    const q = query(
      collection(db, "geoint_event_logs"),
      where("expedienteId", "==", expedienteId)
    );
    
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as GeointEventLogEntry);
    // Ordenar en memoria por timestamp de manera segura
    return list.sort((a, b) => {
      const tA = String(a.timestamp || "");
      const tB = String(b.timestamp || "");
      return tA.localeCompare(tB);
    });
  }
}



