import { getDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
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
    if (gang.id?.startsWith("static-gang-")) {
      throw new Error("No se permite promover un registro estático al catálogo productivo de pandillas.");
    }

    const db = getDb();
    const dataToSave = {
      ...gang,
      updatedAt: Date.now(),
      updatedBy: username,
      ...(gang.id
        ? (gang.createdBy ? { createdBy: gang.createdBy } : {})
        : { createdBy: username }),
    };

    if (gang.id) {
      const docRef = doc(db, this.collectionName, gang.id);
      const { id, ...cleanData } = dataToSave;
      await updateDoc(docRef, cleanData);
      return gang.id;
    } else {
      const colRef = collection(db, this.collectionName);
      const { id, ...cleanData } = dataToSave;
      const docRef = await addDoc(colRef, {
        ...cleanData,
        createdAt: Date.now(),
      });
      return docRef.id;
    }
  }

  /**
   * Fetches only productive gang records persisted in Firestore.
   */
  static async getAllGangs(): Promise<GangEntity[]> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GangEntity[];
      
      return list;
    } catch (e) {
      console.warn("[PandillasService] Fallo consultando Firestore. No se retornarán datos estáticos.", e);
      return [];
    }
  }

  /**
   * Fetches a gang record associated with a specific projectId.
   */
  static async getGangByProjectId(projectId: string): Promise<GangEntity | null> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, where("projectId", "==", projectId));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const firstDoc = snap.docs[0];
      return {
        id: firstDoc.id,
        ...firstDoc.data()
      } as GangEntity;
    } catch (e) {
      console.warn("[PandillasService] Fallo consultando pandilla por projectId:", e);
      return null;
    }
  }

  /**
   * Fetches a persisted gang record associated with a specific geoReportId.
   */
  static async getGangByGeoReportId(geoReportId: string): Promise<GangEntity | null> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, where("geoReportId", "==", geoReportId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        return {
          id: firstDoc.id,
          ...firstDoc.data()
        } as GangEntity;
      }
    } catch (e) {
      console.warn("[PandillasService] Fallo consultando pandilla por geoReportId en Firestore:", e);
    }
    return null;
  }

  /**
   * Deletes a gang record from Firestore.
   */
  static async deleteGang(id: string): Promise<void> {
    if (id.startsWith("static-gang-")) {
      console.info("[PandillasService] Ignorando eliminación de registro estático.");
      return;
    }
    const db = getDb();
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
