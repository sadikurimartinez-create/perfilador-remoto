/**
 * SSPE-CEIPOL - MOTOR DE GOBERNANZA DE EVIDENCIA FOTOGRÁFICA (ADR-011)
 * 
 * Este motor centraliza la clasificación, puntuación y depuración en caliente 
 * del álbum fotográfico de un expediente, previniendo la degradación del rendimiento 
 * de renderizado y exportación, sin destruir la evidencia almacenada en Firestore.
 */

export enum EvidencePhotoClass {
  PRIMARY = "PRIMARY",
  SUPPORTING = "SUPPORTING",
  DUPLICATE = "DUPLICATE",
  LOW_ANALYTICAL_VALUE = "LOW_ANALYTICAL_VALUE"
}

export interface GovernedPhotoEvidence {
  primaryPhotos: any[];
  supportingPhotos: any[];
  duplicatePhotos: any[];
  excludedPhotos: any[];
  summary: {
    total: number;
    included: number; // PRIMARY (máximo 12)
    preserved: number; // SUPPORTING + LOW_ANALYTICAL_VALUE
    duplicates: number;
  };
}

export class PhotoEvidenceGovernanceEngine {
  private static MAX_PRIMARY_LIMIT = 12;

  /**
   * Genera una firma hash unificada para identificar duplicados físicos o lógicos.
   */
  private static generateHash(photo: any): string {
    const url = photo.previewUrl || photo.url || "";
    if (url && typeof url === "string") {
      // Usar la URL sin espacios como identificador base
      return url.trim();
    }
    // Fallback de firma espacio-temporal-narrativa si no existe URL de recurso
    const latStr = photo.lat !== null && photo.lat !== undefined ? Number(photo.lat).toFixed(4) : "null";
    const lngStr = photo.lng !== null && photo.lng !== undefined ? Number(photo.lng).toFixed(4) : "null";
    const tipo = photo.tipo || photo.category || "Otro";
    const comentario = photo.comentario || photo.description || "";
    return `${latStr}_${lngStr}_${tipo}_${comentario.trim().toLowerCase()}`;
  }

  /**
   * Calcula el score de relevancia criminológica de la fotografía (0 - 100).
   * Factores:
   * - Calidad Técnica: 25% (Presencia de recurso visual válido)
   * - Valor Territorial: 30% (Georreferenciación GPS válida)
   * - Valor Criminológico Ambiental: 35% (Facilitadores urbanos explícitos en comentario)
   * - Metadata: 10% (Categoría específica no genérica)
   */
  public static calculateRelevanceScore(photo: any): { score: number; details: string } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Calidad Técnica (25%)
    const url = photo.previewUrl || photo.url || "";
    if (url && url.length > 15) {
      score += 25;
      reasons.push("Imagen con URL de almacenamiento válida (+25 pts)");
    } else {
      reasons.push("Sin URL de recurso visual (+0 pts)");
    }

    // 2. Valor Territorial (30%)
    const lat = photo.lat ?? photo.latitude ?? null;
    const lng = photo.lng ?? photo.longitude ?? null;
    if (lat !== null && lng !== null && lat !== 0 && lng !== 0 && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      score += 30;
      reasons.push("Georreferenciación GPS válida (+30 pts)");
    } else {
      reasons.push("Ausencia de referencia espacial (+0 pts)");
    }

    // 3. Valor Criminológico Ambiental (35%)
    const comment = (photo.comentario || photo.description || "").toLowerCase();
    const criticalKeywords = [
      "grafiti", "graffiti", "pinta", "rayón", "rayone",
      "baldío", "lote", "maleza", "deshabitad", "abandon", "quemad",
      "oscur", "iluminac", "luz", "alumbrado", "falla", "fundid",
      "picadero", "anexo", "cachimba", "vulnerab", "acceso", "barda", "cerca", "muro", "ocultamiento"
    ];

    let kwCount = 0;
    criticalKeywords.forEach(kw => {
      if (comment.includes(kw)) kwCount++;
    });

    if (kwCount > 0) {
      const pts = Math.min(35, kwCount * 12 + 11); // 1 kw = 23 pts, 2+ kw = 35 pts (máximo)
      score += pts;
      reasons.push(`Criminología: ${kwCount} indicador(es) ambiental(es) (+${pts} pts)`);
    } else {
      reasons.push("Comentario genérico (+0 pts)");
    }

    // 4. Metadata (10%)
    const tipo = photo.tipo || photo.category || "";
    if (tipo && tipo.trim() !== "" && tipo !== "Otro; ventana para contextualizar") {
      score += 10;
      reasons.push("Categoría táctica específica (+10 pts)");
    } else {
      reasons.push("Sin categoría específica (+0 pts)");
    }

    return { score, details: reasons.join("; ") };
  }

  /**
   * Procesa la colección bruta de fotografías y produce un payload gobernado unificado.
   */
  public static process(rawPhotos: any[]): GovernedPhotoEvidence {
    if (!rawPhotos || rawPhotos.length === 0) {
      return {
        primaryPhotos: [],
        supportingPhotos: [],
        duplicatePhotos: [],
        excludedPhotos: [],
        summary: { total: 0, included: 0, preserved: 0, duplicates: 0 }
      };
    }

    const seenHashes = new Set<string>();
    const scoredPhotos: any[] = [];
    const duplicatePhotos: any[] = [];

    // 1. Depurar duplicados y puntuar en caliente
    rawPhotos.forEach((photo) => {
      const hash = this.generateHash(photo);
      
      if (seenHashes.has(hash)) {
        duplicatePhotos.push({
          ...photo,
          governanceClass: EvidencePhotoClass.DUPLICATE,
          relevanceScore: 0
        });
      } else {
        seenHashes.add(hash);
        const { score, details } = this.calculateRelevanceScore(photo);
        scoredPhotos.push({
          ...photo,
          relevanceScore: score,
          relevanceDetails: details
        });
      }
    });

    // 2. Ordenar las fotos únicas por relevancia decreciente (Score)
    scoredPhotos.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 3. Separar en Principal (PRIMARY, máx 12), Soporte (SUPPORTING) o Baja Relevancia (LOW_ANALYTICAL_VALUE)
    const primaryPhotos: any[] = [];
    const supportingPhotos: any[] = [];
    const excludedPhotos: any[] = [];

    scoredPhotos.forEach((photo, idx) => {
      if (idx < this.MAX_PRIMARY_LIMIT) {
        photo.governanceClass = EvidencePhotoClass.PRIMARY;
        primaryPhotos.push(photo);
      } else {
        if (photo.relevanceScore >= 40) {
          photo.governanceClass = EvidencePhotoClass.SUPPORTING;
          supportingPhotos.push(photo);
        } else {
          photo.governanceClass = EvidencePhotoClass.LOW_ANALYTICAL_VALUE;
          excludedPhotos.push(photo);
        }
      }
    });

    const total = rawPhotos.length;
    const included = primaryPhotos.length;
    const preserved = supportingPhotos.length + excludedPhotos.length;
    const duplicates = duplicatePhotos.length;

    return {
      primaryPhotos,
      supportingPhotos,
      duplicatePhotos,
      excludedPhotos,
      summary: {
        total,
        included,
        preserved,
        duplicates
      }
    };
  }
}
