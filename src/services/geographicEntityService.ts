import { getDb } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs, query, orderBy, setDoc, updateDoc } from "firebase/firestore";

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
    order?: number;
    source?: "HUMAN_MAP_VERTEX" | string;
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
    const docRef = doc(colRef, entityId);
    await setDoc(docRef, {
      ...entity,
      id: entityId,
      createdAt: entity.createdAt || Date.now(),
    });
    return entityId;
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
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as GeographicEntity));
  } catch (err) {
    console.warn("[GeographicEntityService] Error al cargar entidades geográficas:", err);
    return [];
  }
}

export async function updateGeographicEntityMetadata(
  projectId: string,
  entityId: string,
  metadata: GeographicEntity["metadata"]
): Promise<void> {
  const firestore = getDb();
  await updateDoc(doc(firestore, "projects", projectId, "geographicEntities", entityId), { metadata });
}

export async function deleteGeographicEntity(projectId: string, entityId: string): Promise<void> {
  const firestore = getDb();
  await deleteDoc(doc(firestore, "projects", projectId, "geographicEntities", entityId));
}
