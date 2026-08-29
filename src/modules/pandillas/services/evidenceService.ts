import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { Evidence } from "../types";
import { GangService } from "./gangService";
import {
  createHashUnavailableIntegrity,
  createProvidedSha256Integrity,
  isValidSha256Hex,
} from "@/utils/forensicFileIntegrity";

const COLLECTION_NAME = "evidencias_pandillas";

export class EvidenceService {
  /**
   * Registers a new evidence item.
   */
  static async registerEvidence(ev: Omit<Evidence, "id" | "fecha">, username: string): Promise<string> {
    const db = getDb();
    const timestamp = Date.now();
    
    const secureHash = isValidSha256Hex(ev.hash) ? ev.hash.toLowerCase() : null;
    const forensicIntegrity = ev.forensicIntegrity ?? (
      secureHash
        ? createProvidedSha256Integrity({ rawSha256: secureHash })
        : createHashUnavailableIntegrity()
    );

    const savedData = {
      tipo: ev.tipo || "otro",
      fuente: ev.fuente || "Manual",
      fecha: timestamp,
      hash: secureHash,
      forensicIntegrity,
      confianza: ev.confianza || "Baja",
      relacion: ev.relacion || null
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), savedData);

    await GangService.logAudit("REGISTRAR_EVIDENCIA", username, {
      id: docRef.id,
      tipo: ev.tipo,
      hash: secureHash
    });

    return docRef.id;
  }

  /**
   * Fetches an evidence record by ID.
   */
  static async getEvidence(id: string): Promise<Evidence | null> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      fecha: new Date(data.fecha)
    } as Evidence;
  }

  /**
   * Fetches evidence associated with a specific relation.
   */
  static async getEvidenceByRelation(relacionId: string): Promise<Evidence[]> {
    const db = getDb();
    const q = query(collection(db, COLLECTION_NAME), where("relacion", "==", relacionId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: new Date(data.fecha)
      };
    }) as Evidence[];
  }
}
