/**
 * EvidenceNarrativeMapper - Mapeador Estructurado de Narrativa de Evidencia para la SSPE-CEIPOL.
 * Evita asignaciones incorrectas de texto-imagen vinculando de forma unívoca cada recurso visual con su categoría, factor e impacto operacional.
 */

export interface StructuredEvidence {
  id: string;
  dataUrl: string;
  caption: string;
  category: "LIGHTING" | "WASTELAND" | "GRAFFITI" | "ROAD_INFRASTRUCTURE" | "GENERAL_URBAN";
  criminogenicFactor: string;
  observedFact: string;
  operationalImpact: string;
  recommendation: string;
  location: string;
  // Backward compatibility aliases for exportToWord legacy renderers and validators
  observed?: string;
  inferenciaAnalitica?: string;
  relation?: string;
}

export class EvidenceNarrativeMapper {
  /**
   * Mapea y normaliza un objeto de evidencia para asegurar la consistencia absoluta de su cadena narrativa.
   */
  public static mapEvidence(rawEvidence: any, index: number): StructuredEvidence {
    const id = rawEvidence.id || `evidence-${index}`;
    const dataUrl = rawEvidence.dataUrl || rawEvidence.image || "";
    const caption = rawEvidence.caption || rawEvidence.title || "Evidencia fotográfica de campo.";

    // 1. Extraer la categoría del texto de forma determinista para evitar errores de asignación
    const textContext = `${caption} ${rawEvidence.criminologicalInterpretation || ""} ${rawEvidence.observed || ""} ${rawEvidence.observedFact || ""}`.toLowerCase();
    
    let category: StructuredEvidence["category"] = "GENERAL_URBAN";
    let criminogenicFactor = "Desorden Urbano y Pérdida de Cohesión Social";
    let recommendation = "Coordinar remediación urbana con servicios públicos municipales.";

    if (/\b(?:iluminacion|alumbrado|lampara|luminaria|foco|oscuridad|punto ciego)\b/i.test(textContext)) {
      category = "LIGHTING";
      criminogenicFactor = "Fallas Críticas de Alumbrado Público (Facilitador de Oportunidad)";
      recommendation = "Gestionar de forma inmediata la reparación del alumbrado perimetral dañado.";
    } else if (/\b(?:predio|baldio|maleza|basura|escombro|lote|abandonado)\b/i.test(textContext)) {
      category = "WASTELAND";
      criminogenicFactor = "Predios Baldíos sin Cerramientos ni Control de Accesos";
      recommendation = "Notificar a los propietarios del lote baldío para implementar cerramientos de seguridad.";
    } else if (/\b(?:graffiti|pinta|rayado|rayar|placa|marca|vandalismo)\b/i.test(textContext)) {
      category = "GRAFFITI";
      criminogenicFactor = "Presencia de Grafiti / Marcaje Territorial (Desorden Visual)";
      recommendation = "Coordinar cuadrilla de limpieza y remoción del grafiti para recuperar el control territorial.";
    } else if (/\b(?:bache|calle|pavimento|asfalto|infraestructura|vial|banqueta)\b/i.test(textContext)) {
      category = "ROAD_INFRASTRUCTURE";
      criminogenicFactor = "Deficiencias notables de infraestructura vial y diseño ambiental";
      recommendation = "Solicitar bacheo y pavimentación al departamento de obras públicas.";
    }

    // 2. Extraer el hecho observado e impacto operativo
    const observedFact = rawEvidence.observedFact || 
                         rawEvidence.observed || 
                         rawEvidence.caption || 
                         "Se observa desorden físico en el sector analizado.";

    const operationalImpact = rawEvidence.operationalImpact || 
                              rawEvidence.inferenciaAnalitica || 
                              rawEvidence.relation || 
                              "Incrementa la vulnerabilidad táctica del cuadrante facilitando la comisión de conductas antisociales.";

    const location = rawEvidence.location || "Sector perimetral de estudio";

    return {
      id,
      dataUrl,
      caption,
      category,
      criminogenicFactor,
      observedFact,
      operationalImpact,
      recommendation,
      location,
      // Backward compatibility aliases for exportToWord legacy renderers and validators
      observed: observedFact,
      inferenciaAnalitica: operationalImpact,
      relation: operationalImpact
    };
  }

  /**
   * Mapea una lista completa de evidencias crudas a la estructura oficial de gobernanza.
   */
  public static mapEvidenceList(rawList: any[]): StructuredEvidence[] {
    if (!rawList || !Array.isArray(rawList)) return [];
    return rawList.map((item, idx) => this.mapEvidence(item, idx));
  }
}
