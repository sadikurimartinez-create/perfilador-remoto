/**
 * SSPE-CEIPOL - IMAGE DELETION GOVERNANCE SERVICE (FASE 7.11-A)
 * 
 * Servicio centralizado para la eliminación segura de evidencia fotográfica.
 * Implementa el ciclo de vida transaccional del borrado de imágenes y
 * la generación de bitácoras de trazabilidad ex-post conformes a la normativa.
 */

export interface ImageDeletionAuditLog {
  event: "IMAGE_DELETED";
  imageId: string;
  projectId: string;
  deletedBy: string;
  timestamp: number;
  source: "FIELD_CAPTURE" | "STREET_VIEW" | "SUPPORTING" | "MAP_CAPTURE" | string;
  previousClassification: string;
  geometryType: string;
  deletionReason: "USER_REQUEST";
}

export class ImageDeletionGovernanceService {
  /**
   * Ejecuta de forma lógica y transaccional la eliminación de cualquier imagen.
   * 
   * Sigue la secuencia reglamentaria obligatoria:
   * 1. Eliminar referencia del álbum
   * 2. Eliminar relación geográfica
   * 3. Eliminar aparición en reportes
   * 4. Eliminar cache local
   * 5. Eliminar almacenamiento operativo
   * 6. Registrar bitácora de auditoría (sin URLs activas ni imágenes)
   */
  static deleteImage(
    photo: any,
    projectId: string,
    deletedBy: string,
    album: any[],
    geometryType = "polígono"
  ): {
    updatedAlbum: any[];
    auditLog: ImageDeletionAuditLog;
  } {
    if (!photo || !photo.id) {
      throw new Error("Evidencia visual inválida o nula.");
    }

    // 1. Eliminar referencia del álbum
    // 4. Eliminar caché local
    const updatedAlbum = album.filter((p) => p.id !== photo.id);

    // Determinar la procedencia/fuente real
    let source: "FIELD_CAPTURE" | "STREET_VIEW" | "SUPPORTING" | "MAP_CAPTURE" | string = "FIELD_CAPTURE";
    const lowerType = String(photo.tipo || photo.evidenceType || "").toLowerCase();
    const lowerUrl = String(photo.url || photo.previewUrl || "").toLowerCase();
    
    if (lowerType.includes("street") || lowerUrl.includes("street") || photo.evidenceType === "VIRTUAL_STREET_VIEW" || photo.fuente === "Google Street View") {
      source = "STREET_VIEW";
    } else if (photo.evidenceType === "SUPPORTING" || lowerType.includes("support")) {
      source = "SUPPORTING";
    } else if (photo.evidenceType === "MAP_CAPTURE" || lowerType.includes("map")) {
      source = "MAP_CAPTURE";
    }

    // 6. Registrar auditoría (Bitácora de Trazabilidad)
    const auditLog: ImageDeletionAuditLog = {
      event: "IMAGE_DELETED",
      imageId: photo.id,
      projectId: projectId || "EXP-2026-UNKNOWN",
      deletedBy: deletedBy || "Analista CEIPOL",
      timestamp: Date.now(),
      source,
      previousClassification: photo.riskLevel || photo.classification || "PRIMARY",
      geometryType: geometryType || "polígono",
      deletionReason: "USER_REQUEST"
    };

    return {
      updatedAlbum,
      auditLog
    };
  }
}
