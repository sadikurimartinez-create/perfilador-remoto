export interface EvidenceRelationship {
  id: string;
  evidenceId: string;
  projectId: string;
  source: "FIELD_CAPTURE" | "STREET_VIEW" | "VIRTUAL_CAPTURE" | "MAP_CAPTURE";
  geography: {
    type: "POINT" | "LINE" | "POLYGON";
    latitude?: number;
    longitude?: number;
    area?: string;
  };
  criminogenicFactors: string[];
  hypothesisLinks: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}

export class EvidenceRelationshipEngine {
  /**
   * Genera sugerencias probabilísticas y no absolutas para factores criminógenos
   * basadas en la clasificación de la imagen y los comentarios.
   * CUMPLE FASE 7.12.5 (NO INFERENCIA AUTOMÁTICA).
   */
  public static suggestCriminogenicFactors(photo: { tipo: string; comentario: string }): { factor: string; description: string }[] {
    const suggestions: { factor: string; description: string }[] = [];
    const text = `${photo.tipo} ${photo.comentario || ""}`.toLowerCase();

    if (text.includes("ilumin") || text.includes("luz") || text.includes("oscur") || text.includes("noche")) {
      suggestions.push({
        factor: "falta_iluminacion",
        description: "Puede representar una vulnerabilidad por baja iluminación artificial."
      });
    }

    if (text.includes("abandon") || text.includes("baldío") || text.includes("basura") || text.includes("deterioro")) {
      suggestions.push({
        factor: "abandono_urbano",
        description: "Posible relación con abandono urbano y desinterés social situacional."
      });
    }

    if (text.includes("ocult") || text.includes("acecho") || text.includes("maleza") || text.includes("obstáculo") || text.includes("escondite")) {
      suggestions.push({
        factor: "punto_oculto",
        description: "Se identifica un indicador compatible con potencial zona de ocultamiento o acecho táctico."
      });
    }

    if (text.includes("grafiti") || text.includes("graffiti") || text.includes("rayón") || text.includes("pinta") || text.includes("pandilla")) {
      suggestions.push({
        factor: "grafiti_territorial",
        description: "Posible indicio compatible con delimitación territorial o presencia de grupos de interés."
      });
    }

    // Default sugerencia si no hay matches específicos
    if (suggestions.length === 0) {
      suggestions.push({
        factor: "vulnerabilidad_generica",
        description: "Se sugiere valorar posible facilitador ambiental de oportunidad criminal."
      });
    }

    return suggestions;
  }

  /**
   * Sugiere hipótesis tácticas de forma estrictamente probabilística.
   * CUMPLE FASE 7.12.5 (NO INFERENCIA AUTOMÁTICA).
   */
  public static suggestHypothesisLinks(photo: { tipo: string; comentario: string }): { hypothesisId: string; description: string }[] {
    const suggestions: { hypothesisId: string; description: string }[] = [];
    const text = `${photo.tipo} ${photo.comentario || ""}`.toLowerCase();

    if (text.includes("grafiti") || text.includes("pinta") || text.includes("pandilla")) {
      suggestions.push({
        hypothesisId: "HYP-001",
        description: "Zona con probable disputa o demarcación territorial activa entre pandillas."
      });
    }

    if (text.includes("escape") || text.includes("callejón") || text.includes("corredor") || text.includes("barda") || text.includes("acceso")) {
      suggestions.push({
        hypothesisId: "HYP-002",
        description: "Eje compatible con ruta óptima de escape radial o vulnerabilidad de permeabilidad urbana."
      });
    }

    if (text.includes("ocult") || text.includes("abandono") || text.includes("baldío") || text.includes("luz") || text.includes("oscur")) {
      suggestions.push({
        hypothesisId: "HYP-003",
        description: "Inmueble o espacio con posible aprovechamiento para resguardo temporal de infractores."
      });
    }

    // Default fallback
    if (suggestions.length === 0) {
      suggestions.push({
        hypothesisId: "HYP-004",
        description: "Vulnerabilidad espacial que podría facilitar comisión recurrente de conductas antisociales."
      });
    }

    return suggestions;
  }
}
