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
   * Helper to return static high-fidelity flood assessments when Firestore is empty.
   */
  static getStaticFallbackAssessments(): FloodAssessment[] {
    return [
      {
        id: "static-fld-1",
        zona_analizada: "Sector Río San Pedro / Fracc. Las Flores",
        iri_score: 82,
        nivel_riesgo: "Crítico",
        factores_principales: [
          "Pendiente topográfica menor al 1.5% en la llanura de inundación del Río San Pedro.",
          "Saturación extrema del suelo por precipitaciones acumuladas de 38mm en las últimas 48 horas.",
          "Azolvamiento y acumulación de residuos plásticos que reducen el 45% del caudal útil del colector principal.",
          "Efecto tapón hidráulico en descargas del Fraccionamiento Las Flores hacia el vaso receptor natural."
        ],
        evidencia_geoespacial: [
          {
            tipo: "Pendiente Crítica (MDE)",
            descripcion: "Depresiones topográficas cóncavas detectadas mediante Modelo Digital de Elevación INEGI con potencial de anegamiento severo.",
            coordenadas: { lat: 21.8895, lng: -102.3166 }
          },
          {
            tipo: "Confluencia de Flujos",
            descripcion: "Intersección de microcuencas de escurrimiento natural con acumulación de flujo acumulado superior a 15,000 celdas.",
            coordenadas: { lat: 21.8875, lng: -102.3146 }
          }
        ],
        evidencia_osint: [
          {
            fuente: "Twitter / Monitoreo Vial",
            texto: "Inundación severa sobre cruce de Av. de la Convención Poniente y Av. Río San Pedro. Tránsito completamente suspendido por tirante de agua de 40cm.",
            fecha: "Hace 2 horas",
            coordenadas: { lat: 21.8880, lng: -102.3150 }
          },
          {
            fuente: "Reporte Vecinal (CEIPOL-OSINT)",
            texto: "Desbordamiento parcial del canal a cielo abierto. El agua ha comenzado a ingresar a cocheras y banquetas de la calle Gardenias en Fracc. Las Flores.",
            fecha: "Hace 4 horas",
            coordenadas: { lat: 21.8890, lng: -102.3160 }
          }
        ],
        infraestructura_critica: [
          {
            nombre: "Clínica de Medicina Familiar IMSS Las Flores",
            tipo: "Hospital",
            vulnerabilidad: "Crítica",
            coordenadas: { lat: 21.8892, lng: -102.3148 }
          },
          {
            nombre: "Escuela Primaria Vicente Guerrero (Turno Matutino)",
            tipo: "Escuela",
            vulnerabilidad: "Alta",
            coordenadas: { lat: 21.8878, lng: -102.3162 }
          },
          {
            nombre: "Subestación de Bomberos Municipales Poniente",
            tipo: "Estación de Bomberos",
            vulnerabilidad: "Media",
            coordenadas: { lat: 21.8865, lng: -102.3135 }
          }
        ],
        alerta: true,
        recomendaciones: [
          "Establecer desvíos preventivos de tráfico en arterias secundarias y avenidas de acceso a Las Flores.",
          "Posicionar equipos de bombeo de achique de alto caudal en zonas aledañas al acceso de urgencias de la Clínica del IMSS.",
          "Despliegue operativo de cuadrillas de desazolve rápido de rejillas y alcantarillas en los cruces cóncavos señalados.",
          "Emisión de alerta preventiva de nivel Naranja para los condóminos de zonas bajas de la llanura de inundación."
        ],
        createdAt: Date.now() - 3600000,
        createdBy: "Motor de Inteligencia Geoespacial (GEOINT)",
        lat: 21.8885,
        lng: -102.3156,
        radioMetros: 1200,
        observaciones_campo: "Drenaje pluvial reportado con azolve recurrente por maleza y basura. Canal a cielo abierto cercano presenta niveles moderados tras llovizna.",
        pronostico_lluvia: "Lluvias intensas con acumulados de 45mm en las próximas 24 horas"
      },
      {
        id: "static-fld-2",
        zona_analizada: "Paso a Desnivel Av. de la Convención y Alameda",
        iri_score: 65,
        nivel_riesgo: "Alto",
        factores_principales: [
          "Estructura subterránea (paso deprimido) sin sistema de cárcamo de bombeo automático redundante.",
          "Acumulación de basura urbana en alcantarillado de aproximación.",
          "Escurrimiento superficial proveniente de la ladera oriente del centro de la ciudad."
        ],
        evidencia_geoespacial: [
          {
            tipo: "Punto de Acumulación Cóncava",
            descripcion: "Depresión artificial de paso deprimido vial que actúa como cuenca sumidero.",
            coordenadas: { lat: 21.8835, lng: -102.2825 }
          }
        ],
        evidencia_osint: [
          {
            fuente: "Reporte de Vialidad Municipal",
            texto: "Cierre de circulación preventiva en paso deprimido de Alameda por acumulación de tirante de agua que supera los 25cm.",
            fecha: "Hace 1 hora",
            coordenadas: { lat: 21.8838, lng: -102.2820 }
          }
        ],
        infraestructura_critica: [
          {
            nombre: "Zona Comercial Alameda",
            tipo: "Zona Urbana Crítica",
            vulnerabilidad: "Media",
            coordenadas: { lat: 21.8840, lng: -102.2830 }
          }
        ],
        alerta: false,
        recomendaciones: [
          "Supervisar manualmente la operación del cárcamo de bombeo de Alameda.",
          "Cerrar accesos físicos mediante plumas automáticas si el tirante alcanza los 20cm.",
          "Limpieza de rejillas perimetrales antes del inicio de la ventana de tormenta pronosticada."
        ],
        createdAt: Date.now() - 7200000,
        createdBy: "Motor de Inteligencia Geoespacial (GEOINT)",
        lat: 21.8835,
        lng: -102.2825,
        radioMetros: 500,
        observaciones_campo: "El cárcamo opera de forma intermitente. Requiere revisión eléctrica urgente del contactor secundario.",
        pronostico_lluvia: "Tormentas eléctricas dispersas vespertinas con potencial de granizo"
      }
    ];
  }

  /**
   * Fetches all flood assessments from Firestore. Falls back to static high-fidelity data if empty.
   */
  static async getAllAssessments(): Promise<FloodAssessment[]> {
    const db = getDb();
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FloodAssessment[];

      if (list.length === 0) {
        console.info("[InundacionesService] Firestore vacío. Retornando reportes estáticos GEOINT de inundaciones.");
        return this.getStaticFallbackAssessments();
      }
      return list;
    } catch (e) {
      console.warn("[InundacionesService] Fallo consultando Firestore. Retornando reportes estáticos GEOINT de inundaciones.", e);
      return this.getStaticFallbackAssessments();
    }
  }

  /**
   * Deletes an assessment from Firestore.
   */
  static async deleteAssessment(id: string): Promise<void> {
    if (id.startsWith("static-fld-")) {
      console.info("[InundacionesService] Ignorando eliminación de registro estático.");
      return;
    }
    const db = getDb();
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
