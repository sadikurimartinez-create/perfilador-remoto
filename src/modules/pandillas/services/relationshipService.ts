import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { AnalyticalRelationship, LinkState } from "../types";
import { GangService } from "./gangService";

const COLLECTION_NAME = "relaciones_analiticas";

export class RelationshipService {
  /**
   * Proposes a new analytical relationship (e.g. Persona <-> Pandilla) in Firestore.
   */
  static async proposeRelationship(rel: Omit<AnalyticalRelationship, "id" | "fecha">, username: string): Promise<string> {
    const db = getDb();
    const timestamp = Date.now();
    
    const savedData = {
      origen: rel.origen,
      destino: rel.destino,
      tipoRelacion: rel.tipoRelacion || "pertenece",
      confianza: rel.confianza || 0,
      evidencia: rel.evidencia || [],
      algoritmoOrigen: rel.algoritmoOrigen || "Manual",
      estado: "propuesto" as LinkState,
      analista: null,
      fecha: timestamp
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), savedData);
    
    await GangService.logAudit("PROPONER_RELACION", username, {
      id: docRef.id,
      origen: rel.origen,
      destino: rel.destino,
      tipoRelacion: rel.tipoRelacion
    });

    return docRef.id;
  }

  /**
   * Certifies an existing relationship.
   * Business Rule validation: "No permitir certificar integrante sin evidencia."
   */
  static async certifyRelationship(id: string, analistaUsername: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Error: No se encontró la relación con ID: ${id}`);
    }

    const data = snap.data() as AnalyticalRelationship;

    if (!data.evidencia || data.evidencia.length === 0) {
      throw new Error("Validación: No se permite certificar un integrante sin evidencias asociadas.");
    }

    const updateData = {
      estado: "certificado" as LinkState,
      analista: analistaUsername,
      fecha: Date.now()
    };

    await updateDoc(docRef, updateData);

    await GangService.logAudit("CERTIFICAR_RELACION", analistaUsername, {
      id: id,
      origen: data.origen,
      destino: data.destino,
      tipoRelacion: data.tipoRelacion,
      evidencias: data.evidencia
    });
  }

  /**
   * Deletes a relationship.
   * Business Rule validation: "No permitir eliminar relaciones certificadas."
   */
  static async deleteRelationship(id: string, username: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as AnalyticalRelationship;

    if (data.estado === "certificado") {
      throw new Error("Validación: No se permite eliminar relaciones de inteligencia ya certificadas.");
    }

    await deleteDoc(docRef);

    await GangService.logAudit("ELIMINAR_RELACION", username, {
      id: id,
      origen: data.origen,
      destino: data.destino,
      tipoRelacion: data.tipoRelacion,
      estadoAnterior: data.estado
    });
  }

  /**
   * Retrieves relationships by source/origin.
   */
  static async getRelationshipsByOrigin(origen: string): Promise<AnalyticalRelationship[]> {
    const db = getDb();
    const q = query(collection(db, COLLECTION_NAME), where("origen", "==", origen));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: new Date(data.fecha)
      };
    }) as AnalyticalRelationship[];
  }
}
