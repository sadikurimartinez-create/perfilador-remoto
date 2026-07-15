import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';

export interface NarrativeValidationReport {
  status: "APPROVED" | "REJECTED";
  idsScore: number;
  classification: "Dictamen Estratégico" | "Dictamen Operativo" | "Requiere revisión analítica";
  strengths: string[];
  pendingItems: string[];
  violations: string[];
  reasons: string[];
}

export class IntelligenceNarrativeValidator {
  private static PROHIBITED_WORDS = [
    "control territorial de la organización",
    "zona dominada por",
    "presencia confirmada de grupo criminal",
    "operación del cártel",
    "la pandilla utiliza",
    "los delincuentes operan",
    "célula criminal",
    "célula operativa",
    "control territorial",
    "zona de operación",
    "plaza criminal",
    "halcones",
    "punto de venta",
    "casa de seguridad",
    "narcomenudeo activo",
    "presencia del cártel"
  ];

  private static CAUSAL_CONNECTORS = [
    "debido a",
    "causa",
    "provoca",
    "consecuencia",
    "vulnerabilidad compatible",
    "pérdida de vigilancia",
    "incrementa la oportunidad",
    "factor de oportunidad",
    "relación causal",
    "asociado con",
    "deriva de",
    "condición territorial"
  ];

  private static OPERATIONAL_ACTIONS = [
    "patrulla",
    "recorrido",
    "presencia",
    "vigilancia",
    "horario",
    "operativ",
    "acción",
    "despliegue",
    "mitiga",
    "intervenc"
  ];

  public static validateReport(
    payload: IntelligenceReportPayload,
    briefing: IntelligenceBriefing
  ): NarrativeValidationReport {
    const textValues: string[] = this.getEditorialTextValues(payload);
    const fullText = textValues.join("\n").toLowerCase();

    const strengths: string[] = [];
    const pendingItems: string[] = [];
    const violations: string[] = [];
    const reasons: string[] = [];

    // --- 1. Calcular Variables IDS ---
    let evidenceScore = 0; // Peso: 25%
    let causalScore = 0;   // Peso: 25%
    let inferentialScore = 0; // Peso: 20%
    let confidenceScore = 0; // Peso: 15%
    let operationalScore = 0; // Peso: 15%

    // A. Evidencia Identificada (25%)
    // Verificar referencias claras a fuentes (fotos, registros, denue, mapas)
    const hasPhotoRef = /foto|fotografía|imagen|captura/i.test(fullText);
    const hasSourceRef = /denue|inegi|registro|incidencia|fuente/i.test(fullText);
    const hasTrazabilidad = /trazabilidad|origen|sustentado en/i.test(fullText);

    if (hasPhotoRef) evidenceScore += 10;
    if (hasSourceRef) evidenceScore += 10;
    if (hasTrazabilidad) evidenceScore += 5;
    
    if (evidenceScore >= 20) {
      strengths.push("Evidencia plenamente identificada con fuentes territoriales, fotográficas y documentales sólidas.");
    } else {
      pendingItems.push("Falta declarar de forma más explícita la trazabilidad y las fuentes de evidencia utilizadas.");
    }

    // B. Relación Causal (25%)
    // Contar cuántos conectores causales criminológicos se usan
    let causalMatches = 0;
    this.CAUSAL_CONNECTORS.forEach(connector => {
      const regex = new RegExp(connector, "g");
      const count = (fullText.match(regex) || []).length;
      causalMatches += count;
    });

    if (causalMatches >= 5) {
      causalScore = 25;
      strengths.push("Explicación causal robusta de factores criminológicos ambientales.");
    } else if (causalMatches >= 2) {
      causalScore = 15;
      strengths.push("Relación de factores territoriales con baja vigilancia natural razonablemente explicados.");
      pendingItems.push("Se recomienda robustecer la relación de causa y efecto utilizando conectores de criminología ambiental.");
    } else {
      causalScore = 5;
      pendingItems.push("El informe tiende a ser descriptivo superficial; falta incorporar análisis de relación causa-efecto.");
    }

    // C. Control de Inferencia (20%)
    // Escaneo de palabras prohibidas y mitigaciones
    const detectedProhibited: string[] = [];
    this.PROHIBITED_WORDS.forEach(word => {
      if (fullText.includes(word)) {
        detectedProhibited.push(word);
      }
    });

    const hasMitigations = /compatible con|condición que requiere|posible dinámica|hipótesis/i.test(fullText);

    if (detectedProhibited.length === 0) {
      inferentialScore += 15;
      if (hasMitigations) inferentialScore += 5;
      strengths.push("Excelente control de inferencias y mantenimiento del principio de proporcionalidad analítica.");
    } else {
      inferentialScore = Math.max(0, 15 - detectedProhibited.length * 5);
      if (hasMitigations) inferentialScore += 3;
      
      detectedProhibited.forEach(word => {
        violations.push(`Uso no sustentado del término policial sensible: "${word}".`);
      });
      pendingItems.push("Debe eliminarse el catálogo de términos proscritos de imputación delictiva directa.");
    }

    // D. Nivel de Confianza (15%)
    const hasConfidenceDecl = /confianza[^\n]{0,60}(alto|medio|bajo)/i.test(fullText) || /nivel de confianza/i.test(fullText);
    const hasConfidenceRationale = /fundamento|motivo|debido a|convergencia|sustenta/i.test(fullText);

    if (hasConfidenceDecl) confidenceScore += 10;
    if (hasConfidenceRationale) confidenceScore += 5;

    if (confidenceScore >= 15) {
      strengths.push("Declaración formal y razonada del nivel de confianza de inteligencia.");
    } else {
      pendingItems.push("Falta incorporar de forma explícita el nivel de confianza del análisis y su justificación técnica.");
    }

    // E. Acción Operacional (15%)
    let opMatches = 0;
    this.OPERATIONAL_ACTIONS.forEach(word => {
      const regex = new RegExp(word, "g");
      const count = (fullText.match(regex) || []).length;
      opMatches += count;
    });

    const hasTimeWindow = /\b\d{2}:\d{2}\s*(a|y|-)\s*\d{2}:\d{2}\b/i.test(fullText);

    if (opMatches >= 4) {
      operationalScore += 10;
    }
    if (hasTimeWindow) {
      operationalScore += 5;
    }

    if (operationalScore >= 15) {
      strengths.push("Sugerencias tácticas accionables con enfoque operativo espacio-temporal.");
    } else if (operationalScore >= 8) {
      operationalScore = 10;
      pendingItems.push("Se recomienda definir ventanas de horario y áreas prioritarias específicas para patrullajes recomendados.");
    } else {
      pendingItems.push("Falta traducir el dictamen en implicaciones operativas de campo concretas en lugar de directrices generales.");
    }

    // --- 2. Score Final ---
    const totalScore = evidenceScore + causalScore + inferentialScore + confidenceScore + operationalScore;

    // Clasificación formal
    let classification: NarrativeValidationReport["classification"] = "Requiere revisión analítica";
    if (totalScore >= 90) {
      classification = "Dictamen Estratégico";
    } else if (totalScore >= 70) {
      classification = "Dictamen Operativo";
    }

    // Regla de bloqueo de violaciones éticas críticas
    let status: NarrativeValidationReport["status"] = "APPROVED";
    if (totalScore < 70) {
      status = "REJECTED";
      reasons.push(`El Score de Profundidad de Inteligencia (IDS: ${totalScore}/100) es inferior al estándar mínimo aprobado de 70 puntos.`);
    }

    if (violations.length > 0) {
      status = "REJECTED";
      reasons.push(`El informe contiene afirmaciones o términos de criminalidad delictiva sensible que no se sustentan en la evidencia del expediente (Inferencia sobrepasada).`);
    }

    return {
      status,
      idsScore: totalScore,
      classification,
      strengths,
      pendingItems,
      violations,
      reasons
    };
  }

  private static getEditorialTextValues(obj: IntelligenceReportPayload): string[] {
    const values: string[] = [];
    
    const add = (val: any) => {
      if (typeof val === 'string') {
        values.push(val);
      } else if (Array.isArray(val)) {
        val.forEach(add);
      } else if (val && typeof val === 'object') {
        Object.values(val).forEach(add);
      }
    };

    add(obj.contextoTerritorial);
    add(obj.executiveSummary);
    add(obj.finalHypothesis);
    add(obj.osintSynthesized);
    add(obj.pandillasAnalysis);
    add(obj.conclusiones);
    
    if (obj.maps) {
      obj.maps.forEach(m => add(m.interpretation));
    }
    if (obj.graphs) {
      obj.graphs.forEach(g => {
        add(g.explanation);
        add(g.finding);
        add(g.relation);
      });
    }
    if (obj.streetViewAnalysis) {
      obj.streetViewAnalysis.forEach(s => {
        add(s.observed);
        add(s.criminologicalAnalysis);
        add(s.relation);
      });
    }
    if (obj.photoEvidence) {
      obj.photoEvidence.forEach(p => {
        add(p.caption);
        add(p.criminologicalInterpretation);
        add(p.relation);
      });
    }

    return values;
  }
}
