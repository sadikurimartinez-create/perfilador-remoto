import { getDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import { GangEntity, FusionResult, GeointeligenciaShape } from "./pandillas.mapper";
import dossierData from "./dossier_pandillas.json";

/**
 * Helper to convert static JSON dossiers into valid GangEntity records.
 */
function getStaticFallbackGangs(): GangEntity[] {
  if (!dossierData || !dossierData.dossiers) return [];
  
  return dossierData.dossiers.map((d: any, index: number) => {
    const gangName = d.pandilla || `Pandilla ${index + 1}`;
    
    // Map members
    const integrantes = (d.integrantes || []).map((m: any) => {
      const dir = m.direccion || {};
      const domicilio = dir.calle 
        ? `${dir.calle}${dir.numero ? " #" + dir.numero : ""}, ${dir.colonia || ""}, ${dir.municipio || "Aguascalientes"}`.trim().replace(/, ,/g, ",").replace(/,,/g, ",")
        : "";
      
      // estatusPandilla mapping
      let estatus: any = "Integrante";
      const rolLower = (m.rol || "").toLowerCase();
      if (rolLower.includes("lider")) estatus = "Líder";
      else if (rolLower.includes("segundo")) estatus = "Segundo al mando";
      else if (rolLower.includes("reclutador")) estatus = "Reclutador";
      else if (rolLower.includes("distribuidor")) estatus = "Distribuidor";
      else if (rolLower.includes("vigilante") || rolLower.includes("halcon")) estatus = "Vigilante";
      else if (rolLower.includes("operador")) estatus = "Operador";
      else if (rolLower.includes("exintegrante")) estatus = "Exintegrante";
      else if (rolLower.includes("colaborador")) estatus = "Colaborador externo";
      
      return {
        nombre: m.nombre_completo || m.nombre || "Sujeto Desconocido",
        alias: m.alias || "",
        rol: m.rol || "Integrante",
        estatusPandilla: estatus,
        domicilioConocido: domicilio,
        sexo: "Masculino",
        edad: m.edad || "",
        nivelViolencia: "Medio",
        riesgoCriminogeno: "Medio",
        tatuajes: "",
        cicatrices: "",
        marcasDistintivas: ""
      };
    });

    // Map activities to ilicitos
    const ilicitos: any[] = [];
    const acts = d.actividades_delictivas || [];
    acts.forEach((a: string) => {
      const lower = a.toLowerCase();
      if (lower.includes("robo")) ilicitos.push("Robo");
      if (lower.includes("droga") || lower.includes("narco") || lower.includes("venta")) ilicitos.push("Narcomenudeo");
      if (lower.includes("extor")) ilicitos.push("Extorsión");
      if (lower.includes("homicidio") || lower.includes("asesinato")) ilicitos.push("Homicidio");
      if (lower.includes("lesion") || lower.includes("golpe") || lower.includes("rina")) ilicitos.push("Lesiones");
      if (lower.includes("vandal") || lower.includes("grafiti") || lower.includes("daño")) ilicitos.push("Vandalismo");
    });
    if (ilicitos.length === 0) {
      ilicitos.push("Robo");
    }

    // Create mock geointeligencia shapes from geocoded members
    const geometrias: GeointeligenciaShape[] = [];
    const puntos: { lat: number; lng: number }[] = [];
    
    (d.integrantes || []).forEach((m: any) => {
      if (m.georreferencia && typeof m.georreferencia.lat === "number" && typeof m.georreferencia.lng === "number") {
        puntos.push({ lat: m.georreferencia.lat, lng: m.georreferencia.lng });
      }
    });

    if (puntos.length > 0) {
      const center = puntos[0];
      geometrias.push({
        id: `shape-buffer-${index}`,
        nombre: `Zona de Influencia: ${gangName}`,
        tipo: "buffer",
        puntos: [center],
        radio: 500,
        nivelControlTerritorial: "Medio",
        fechaActualizacion: new Date().toLocaleDateString("es-MX")
      });

      puntos.forEach((p, pIdx) => {
        geometrias.push({
          id: `shape-pnt-${index}-${pIdx}`,
          nombre: `Punto Táctico: ${integrantes[pIdx]?.alias || integrantes[pIdx]?.nombre || gangName}`,
          tipo: "zona_riesgo",
          puntos: [p],
          radio: 50,
          nivelControlTerritorial: "Medio",
          fechaActualizacion: new Date().toLocaleDateString("es-MX")
        });
      });
    }

    const listDrogas = d.sustancias_consumidores || d.narcoticos_asociados || ["Cristal", "Marihuana"];

    return {
      id: `static-gang-${index}`,
      nombre: gangName,
      aliasConocidos: d.alias_gang || "",
      estatus: "Activa",
      zonaInfluencia: d.area_influencia || "Aguascalientes",
      coloniasAsociadas: d.area_influencia ? [d.area_influencia] : ["Zona Centro"],
      municipiosAsociados: ["Aguascalientes"],
      ilicitos: ilicitos,
      drogasConsumidas: listDrogas,
      modusOperandi: `Operan principalmente en horarios nocturnos mediante agresiones en grupo. Actividades de ${acts.join(", ")}.`,
      simbolosIdentificacion: `Grafitis con las siglas ${gangName}.`,
      peligrosidad: d.integrantes_registrados > 4 ? "Alto" : "Medio",
      integrantes: integrantes,
      geometrias: geometrias,
      relaciones: [],
      cronologiaEventos: [
        {
          id: `evt-${index}-1`,
          fecha: new Date().toLocaleDateString("es-MX"),
          titulo: "Registro de Inteligencia",
          descripcion: `Consolidación de expediente de la pandilla ${gangName} en el dossier general.`,
          gravedad: "Media",
          categoria: "detencion"
        }
      ],
      imagenesGrafiti: [],
      geoReportId: `CEIPOL-GEO-${gangName.toUpperCase().replace(/[^A-Z0-9]/g, "")}-ALTO-${index + 100}`,
      createdAt: Date.now() - (index * 60000),
      createdBy: "Inyector Automático OSINT"
    };
  });
}

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

    if (gang.id && !gang.id.startsWith("static-gang-")) {
      const docRef = doc(db, this.collectionName, gang.id);
      const { id, ...cleanData } = dataToSave;
      await updateDoc(docRef, cleanData);
      return gang.id;
    } else {
      const colRef = collection(db, this.collectionName);
      // Remove temporary static id before saving
      const { id, ...cleanData } = dataToSave;
      const docRef = await addDoc(colRef, {
        ...cleanData,
        createdAt: Date.now(),
      });
      return docRef.id;
    }
  }

  /**
   * Fetches all gang records saved in Firestore. Falls back to mapped dossier JSON if empty.
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
      
      if (list.length === 0) {
        console.info("[PandillasService] Firestore vacío. Retornando 29 pandillas estáticas de dossier_pandillas.json.");
        return getStaticFallbackGangs();
      }
      return list;
    } catch (e) {
      console.warn("[PandillasService] Fallo consultando Firestore. Retornando 29 pandillas estáticas de dossier_pandillas.json.", e);
      return getStaticFallbackGangs();
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
   * Fetches a gang record associated with a specific geoReportId. Falls back to static list.
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
    
    // Fallback: search in static dossiers
    const fallbackList = getStaticFallbackGangs();
    const found = fallbackList.find(g => g.geoReportId?.toLowerCase() === geoReportId.toLowerCase());
    if (found) {
      console.info(`[PandillasService] Encontrado reporte estático para ID: ${geoReportId}`);
      return found;
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
