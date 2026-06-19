import { getDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { GangEntity, FusionResult } from "./pandillas.mapper";

/**
 * Service class to manage Firestore data persistence and execute intelligence sweep requests.
 */
export class PandillasService {
  private static collectionName = "pandillas";

  /**
   * Triggers the full intelligence fusion engine from the backend API.
   */
  static async analyzeGang(gang: GangEntity, userContext: string): Promise<FusionResult & { isAiGenerated: boolean; warning?: string }> {
    const response = await fetch("/api/pandillas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nombre: gang.nombre,
        zonaInfluencia: gang.zonaInfluencia,
        antagonicas: gang.antagonicas,
        integrantes: gang.integrantes,
        grafitiInfo: gang.grafitiInfo,
        archivosAnexos: gang.archivosAnexos || [],
        contextoUsuario: userContext
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el motor de barrido: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Saves a new gang record or updates an existing one in Firestore.
   */
  static async saveGang(gang: GangEntity, username: string): Promise<string> {
    const db = getDb();
    const dataToSave = {
      ...gang,
      updatedAt: Date.now(),
      createdBy: gang.createdBy || username,
    };

    if (gang.id) {
      const docRef = doc(db, this.collectionName, gang.id);
      const { id, ...cleanData } = dataToSave;
      await updateDoc(docRef, cleanData);
      return gang.id;
    } else {
      const colRef = collection(db, this.collectionName);
      const docRef = await addDoc(colRef, {
        ...dataToSave,
        createdAt: Date.now(),
      });
      return docRef.id;
    }
  }

  /**
   * Fetches all gang records saved in Firestore.
   */
  static async getAllGangs(): Promise<GangEntity[]> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GangEntity[];
    } catch (e) {
      console.warn("[PandillasService] Fallo consultando Firestore. Retornando arreglo vacío.", e);
      return [];
    }
  }

  /**
   * Deletes a gang record from Firestore.
   */
  static async deleteGang(id: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
