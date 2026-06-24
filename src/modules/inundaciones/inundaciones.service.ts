import { getDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import { FloodAssessment } from "./inundaciones.types";

export class InundacionesService {
  private static collectionName = "inundaciones";

  /**
   * Triggers the flood risk intelligence sweep from the backend API.
   */
  static async analyzeFloodRisk(params: {
    lat: number;
    lng: number;
    radioMetros: number;
    observaciones_campo?: string;
    pronostico_lluvia?: string;
    zona_analizada?: string;
  }): Promise<FloodAssessment & { isAiGenerated: boolean; warning?: string }> {
    const response = await fetch("/api/inundaciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Error en el motor de barrido de inundaciones: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Saves a new flood assessment record or updates an existing one in Firestore.
   */
  static async saveAssessment(assessment: FloodAssessment, username: string): Promise<string> {
    const db = getDb();
    const dataToSave = {
      ...assessment,
      updatedAt: Date.now(),
      createdBy: assessment.createdBy || username,
    };

    if (assessment.id) {
      const docRef = doc(db, this.collectionName, assessment.id);
      const { id, ...cleanData } = dataToSave;
      await updateDoc(docRef, cleanData);
      return assessment.id;
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
   * Fetches all flood assessments from Firestore.
   */
  static async getAllAssessments(): Promise<FloodAssessment[]> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FloodAssessment[];
    } catch (e) {
      console.warn("[InundacionesService] Fallo consultando Firestore. Retornando arreglo vacío.", e);
      return [];
    }
  }

  /**
   * Deletes an assessment from Firestore.
   */
  static async deleteAssessment(id: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
