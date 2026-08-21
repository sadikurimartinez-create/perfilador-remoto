import { getDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

export interface GeographicEntity {
  id?: string;
  projectId: string;
  lat: number;
  lng: number;
  type: "POI" | "VERTEX" | "EVIDENCE_LOCATION";
  geometryType: "individual" | "lineal" | "poligono" | string;
  source: string;
  createdBy?: string;
  createdAt: number;
  metadata?: {
    name?: string;
    comentario?: string;
    isIndependentPoi?: boolean;
    isVertex?: boolean;
    tipo?: string;
    [key: string]: any;
  };
}

/**
 * Guarda una entidad geográfica pura (POI/Vértice) en Firestore
 * SIN interactuar con Firebase Storage ni requerir subida de archivos binarios.
 */
export async function saveGeographicEntity(entity: GeographicEntity): Promise<string> {
  const entityId = entity.id || `geo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const firestore = getDb();
    const colRef = collection(firestore, "projects", entity.projectId, "geographicEntities");
    const docRef = await addDoc(colRef, {
      ...entity,
      id: entityId,
      createdAt: entity.createdAt || Date.now(),
    });
    return docRef.id;
  } catch (err) {
    console.warn("[GeographicEntityService] Fallback local ante almacenamiento offline/cuota:", err);
    return entityId;
  }
}

/**
 * Recupera las entidades geográficas puras asociadas a un proyecto de Firestore.
 */
export async function getGeographicEntities(projectId: string): Promise<GeographicEntity[]> {
  try {
    const firestore = getDb();
    const colRef = collection(firestore, "projects", projectId, "geographicEntities");
    const q = query(colRef, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeographicEntity));
  } catch (err) {
    console.warn("[GeographicEntityService] Error al cargar entidades geográficas:", err);
    return [];
  }
}
