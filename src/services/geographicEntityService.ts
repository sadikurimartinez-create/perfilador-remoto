import { persistInstitutionalGeointEntity } from "@/lib/institutionalGeointEntityActions";

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
 const result=await persistInstitutionalGeointEntity({projectId:entity.projectId,kind:'GEOGRAPHIC',operation:'SAVE',id:entity.id,data:entity});return result.id;
}
export async function getGeographicEntities(projectId:string):Promise<GeographicEntity[]> {return await persistInstitutionalGeointEntity({projectId,kind:'GEOGRAPHIC',operation:'LIST'}) as GeographicEntity[];}
export async function updateGeographicEntityMetadata(projectId:string,entityId:string,metadata:GeographicEntity['metadata']):Promise<void>{await persistInstitutionalGeointEntity({projectId,kind:'GEOGRAPHIC',operation:'UPDATE',id:entityId,data:{metadata}});}
export async function deleteGeographicEntity(projectId:string,entityId:string):Promise<void>{await persistInstitutionalGeointEntity({projectId,kind:'GEOGRAPHIC',operation:'DELETE',id:entityId});}
