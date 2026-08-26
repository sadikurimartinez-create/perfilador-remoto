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
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { getDb } from "@/lib/firebase";
import { EventFingerprintRecord } from "@/types/geointEventFingerprint";
import { createHash } from "crypto";

function getFirestoreInstance() {
  return typeof window === "undefined" ? getFirebaseServerDb() : getDb();
}

export class GeointEventFingerprintService {
  /**
   * Genera un SHA-256 determinístico basado en expedienteId, traceabilityId, eventType y entityId.
   */
  static generateEventFingerprint(params: {
    expedienteId: string;
    traceabilityId: string;
    eventType: string;
    entityId: string;
  }): string {
    const rawData = `${params.expedienteId}|${params.traceabilityId}|${params.eventType}|${params.entityId}`;
    return createHash("sha256").update(rawData).digest("hex");
  }

  /**
   * Verifica si ya existe un fingerprint registrado en geoint_event_fingerprints/{fingerprint}
   */
  static async checkExistingFingerprint(fingerprint: string): Promise<EventFingerprintRecord | null> {
    const db = getFirestoreInstance();
    const docRef = doc(db, "geoint_event_fingerprints", fingerprint);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as EventFingerprintRecord;
    }
    return null;
  }

  /**
   * Registra un nuevo fingerprint en geoint_event_fingerprints/{fingerprint}
   */
  static async registerFingerprint(record: EventFingerprintRecord): Promise<void> {
    const db = getFirestoreInstance();
    const docRef = doc(db, "geoint_event_fingerprints", record.fingerprint);
    await setDoc(docRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  }
}
