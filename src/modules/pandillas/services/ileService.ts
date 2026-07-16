import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { ILEMemory, VariableEvaluada } from "../types";
import { GangService } from "./gangService";

const COLLECTION_NAME = "ile_memory";

export class ILEService {
  /**
   * Saves an explanatory ILE memory log in Firestore.
   */
  static async saveILEMemory(memory: Omit<ILEMemory, "id" | "fecha">, username: string): Promise<string> {
    const db = getDb();
    const timestamp = Date.now();

    const savedData = {
      entidadOrigen: memory.entidadOrigen,
      entidadDestino: memory.entidadDestino,
      tipoRelacion: memory.tipoRelacion || "pertenece",
      algoritmo: memory.algoritmo || "ILE-AnalyticalMatch-v1.0",
      variablesEvaluadas: memory.variablesEvaluadas || [],
      resultado: memory.resultado || "",
      confianza: memory.confianza || 0,
      fecha: timestamp,
      estado: memory.estado || "pendiente_validacion",
      usuarioValidacion: memory.usuarioValidacion || null
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), savedData);

    await GangService.logAudit("GUARDAR_MEMORIA_ILE", username, {
      id: docRef.id,
      entidadOrigen: memory.entidadOrigen,
      entidadDestino: memory.entidadDestino,
      confianza: memory.confianza
    });

    return docRef.id;
  }

  /**
   * Fetches an ILE memory record by ID.
   */
  static async getILEMemory(id: string): Promise<ILEMemory | null> {
    const db = getDb();
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      fecha: new Date(data.fecha)
    } as ILEMemory;
  }

  /**
   * Programmatic calculation of the Persona-Gang Linkage Index (IVPP).
   * Formula: IVPP = (W_geo * S_geo) + (W_temp * S_temp) + (W_evid * C_evid) + (W_rel * S_rel)
   */
  static calculateIVPP(
    similitudGeo: number,   // 0 to 100
    similitudTemp: number,  // 0 to 100
    confianzaEvid: number,  // 0 to 100
    similitudRel: number    // 0 to 100
  ): { score: number; variables: VariableEvaluada[] } {
    // Weights defined under the Phase 1 Architectural Contract
    const W_GEO = 0.35;
    const W_EVID = 0.30;
    const W_REL = 0.20;
    const W_TEMP = 0.15;

    const geoContribution = W_GEO * similitudGeo;
    const evidContribution = W_EVID * confianzaEvid;
    const relContribution = W_REL * similitudRel;
    const tempContribution = W_TEMP * similitudTemp;

    const totalScore = Math.min(100, Math.round(geoContribution + evidContribution + relContribution + tempContribution));

    const variables: VariableEvaluada[] = [
      { name: "coincidencia territorial", value: `${similitudGeo}%`, weight: W_GEO },
      { name: "evidencia visual", value: `${confianzaEvid}%`, weight: W_EVID },
      { name: "relaciones sociales", value: `${similitudRel}%`, weight: W_REL },
      { name: "coincidencia temporal", value: `${similitudTemp}%`, weight: W_TEMP }
    ];

    return {
      score: totalScore,
      variables
    };
  }

  /**
   * Programmatic mock calculations for IFA (Fuerza Asociativa) and IER (Expansión).
   * To be formally integrated in Phase 6.
   */
  static calculateMockIFA(numMembers: number, relationDensity: number): number {
    if (numMembers === 0) return 0;
    return Math.min(100, Math.round((50 + (relationDensity * 10)) * (1 + Math.log(1 + numMembers / 10))));
  }

  static calculateMockIER(netGrowthLastMonth: number): number {
    return Math.min(100, Math.max(0, Math.round(netGrowthLastMonth * 8.5)));
  }
}
