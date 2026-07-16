import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import { GangProfile, GangMemberCandidate, AuditLog } from "../types";

const COLLECTION_NAME = "pandillas";
const AUDIT_COLLECTION = "auditoria_pandillas";

export class GangService {
  /**
   * Registers a security audit log in Firestore.
   */
  static async logAudit(action: string, username: string, details: any): Promise<void> {
    const db = getDb();
    const audit: Omit<AuditLog, "idAuditoria"> = {
      timestamp: Date.now(),
      usuarioId: username,
      accion: action,
      moduloOrigen: "MODULO_PANDILLAS",
      detalles: details,
      ipDireccion: "127.0.0.1", // Standard localhost fallback
      dispositivo: "Perfilador Remoto Web Client"
    };
    try {
      await addDoc(collection(db, AUDIT_COLLECTION), audit);
    } catch (e) {
      console.error("[GangService] Failed to write audit log:", e);
    }
  }

  /**
   * Fetches a specific GangProfile by ID.
   */
  static async getGangProfile(id: string): Promise<GangProfile | null> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    } as GangProfile;
  }

  /**
   * Saves or updates a GangProfile in Firestore.
   * Enforces validations: No gang can be created without a valid name.
   */
  static async saveGangProfile(profile: Omit<GangProfile, "createdAt" | "updatedAt"> & { createdAt?: Date }, username: string): Promise<string> {
    if (!profile.identidad || !profile.identidad.nombre.trim()) {
      throw new Error("Validación: No se permite crear o actualizar una pandilla sin un nombre de identidad mínimo.");
    }

    const db = getDb();
    const timestamp = Date.now();
    const cleanId = profile.id && !profile.id.startsWith("static-") ? profile.id : null;

    const savedData = {
      identidad: profile.identidad,
      estadoInteligencia: profile.estadoInteligencia || "descubierto",
      organizacion: profile.organizacion || { nivel: "Clica Local", descripcion: "" },
      integrantes: profile.integrantes || [],
      territorios: profile.territorios || [],
      eventos: profile.eventos || [],
      evidencias: profile.evidencias || [],
      indicadores: profile.indicadores || { riesgo: 30, cohesion: 30, expansion: 10 },
      updatedAt: timestamp
    };

    if (cleanId) {
      const docRef = doc(db, COLLECTION_NAME, cleanId);
      const prevSnap = await getDoc(docRef);
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
      
      await updateDoc(docRef, savedData);
      
      await this.logAudit("MODIFICAR_PANDILLA", username, {
        id: cleanId,
        estadoAnterior: prevData.estadoInteligencia,
        estadoNuevo: profile.estadoInteligencia,
        nombre: profile.identidad.nombre
      });
      return cleanId;
    } else {
      const colRef = collection(db, COLLECTION_NAME);
      const newDocRef = await addDoc(colRef, {
        ...savedData,
        createdAt: timestamp
      });
      
      await this.logAudit("CREAR_PANDILLA", username, {
        id: newDocRef.id,
        estadoNuevo: profile.estadoInteligencia || "descubierto",
        nombre: profile.identidad.nombre
      });
      return newDocRef.id;
    }
  }

  /**
   * Deletes a GangProfile in Firestore. Requires auditing.
   */
  static async deleteGangProfile(id: string, username: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const prevSnap = await getDoc(docRef);
    if (!prevSnap.exists()) return;
    
    const prevData = prevSnap.data();
    await deleteDoc(docRef);
    
    await this.logAudit("ELIMINAR_PANDILLA", username, {
      id: id,
      nombre: prevData.identidad?.nombre || "Desconocido",
      estadoAnterior: prevData.estadoInteligencia
    });
  }

  /**
   * Subcollection handlers for /pandillas/{id}/integrantes
   */
  static async addMemberCandidate(gangId: string, candidate: Omit<GangMemberCandidate, "id">): Promise<string> {
    const db = getDb();
    const colRef = collection(db, COLLECTION_NAME, gangId, "integrantes");
    const docRef = await addDoc(colRef, {
      ...candidate,
      fechaRegistro: Date.now()
    });
    return docRef.id;
  }

  static async getMemberCandidates(gangId: string): Promise<GangMemberCandidate[]> {
    const db = getDb();
    const colRef = collection(db, COLLECTION_NAME, gangId, "integrantes");
    const snap = await getDocs(colRef);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaRegistro: new Date(data.fechaRegistro)
      };
    }) as GangMemberCandidate[];
  }
}
