/**
 * Intelligence Depth Score (IDS) (ADR-010 - INDE)
 * Calcula y califica la calidad analítica y profundidad narrativa de los capítulos y del dictamen global.
 */

export interface ChapterScoreResult {
  chapterName: string;
  idsScore: number;
  evidenceScore: number;
  causalScore: number;
  inferentialScore: number;
  confidenceScore: number;
  operationalScore: number;
  violations: string[];
}

export interface GlobalScoreResult {
  overallScore: number;
  classification: "Dictamen Estratégico" | "Dictamen Operativo" | "Requiere revisión analítica";
  status: "APPROVED" | "REJECTED";
  chapterScores: Record<string, ChapterScoreResult>;
  criticalChaptersBelowThreshold: string[];
}

export class IntelligenceDepthScore {
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

  private static CRITICAL_CHAPTERS = [
    "Capítulo 2",       // Hipótesis
    "Capítulo 4",       // Estadística
    "Capítulo 5",       // Evidencia Fotográfica
    "Capítulo 6",       // Street View
    "Capítulo 8",       // Pandillas
    "Capítulo 10"       // Conclusiones
  ];

  /**
   * Calcula el IDS para un capítulo específico analizando su narrativa textual.
   */
  public static calculateChapterScore(text: string, chapterName: string): ChapterScoreResult {
    const fullText = (text || "").toLowerCase();
    const violations: string[] = [];

    // A. Evidencia Identificada (25%)
    let evidenceScore = 0;
    const hasPhotoRef = /foto|fotografía|imagen|captura|street view/i.test(fullText);
    const hasSourceRef = /denue|inegi|registro|incidencia|fuente|datos/i.test(fullText);
    const hasTrazabilidad = /trazabilidad|origen|sustentado en|evidencia/i.test(fullText);

    if (hasPhotoRef) evidenceScore += 10;
    if (hasSourceRef) evidenceScore += 10;
    if (hasTrazabilidad) evidenceScore += 5;

    // B. Relación Causal (25%)
    let causalScore = 0;
    let causalMatches = 0;
    this.CAUSAL_CONNECTORS.forEach(connector => {
      const regex = new RegExp(connector, "g");
      causalMatches += (fullText.match(regex) || []).length;
    });

    if (causalMatches >= 3) {
      causalScore = 25;
    } else if (causalMatches >= 1) {
      causalScore = 15;
    } else {
      causalScore = 5;
    }

    // C. Control de Inferencia (20%)
    let inferentialScore = 0;
    const detectedProhibited: string[] = [];
    this.PROHIBITED_WORDS.forEach(word => {
      if (fullText.includes(word)) {
        detectedProhibited.push(word);
        violations.push(`Uso no sustentado de término policial sensible: "${word}" en ${chapterName}.`);
      }
    });

    const hasMitigations = /compatible con|condición que requiere|posible dinámica|hipótesis|línea de análisis/i.test(fullText);

    if (detectedProhibited.length === 0) {
      inferentialScore += 15;
      if (hasMitigations) inferentialScore += 5;
    } else {
      inferentialScore = Math.max(0, 15 - detectedProhibited.length * 5);
      if (hasMitigations) inferentialScore += 3;
    }

    // D. Nivel de Confianza (15%)
    let confidenceScore = 0;
    const hasConfidenceDecl = /confianza/i.test(fullText) || /nivel de confianza/i.test(fullText) || /alta|media|baja certeza/i.test(fullText);
    const hasConfidenceRationale = /fundamento|motivo|debido a|convergencia|sustenta/i.test(fullText);

    if (hasConfidenceDecl) confidenceScore += 10;
    if (hasConfidenceRationale) confidenceScore += 5;

    // E. Acción Operacional (15%)
    let operationalScore = 0;
    let opMatches = 0;
    this.OPERATIONAL_ACTIONS.forEach(word => {
      const regex = new RegExp(word, "g");
      opMatches += (fullText.match(regex) || []).length;
    });

    const hasTimeWindow = /\b\d{2}:\d{2}\s*(a|y|-)\s*\d{2}:\d{2}\b/i.test(fullText) || /horario/i.test(fullText);

    if (opMatches >= 2) operationalScore += 10;
    if (hasTimeWindow) operationalScore += 5;

    const idsScore = evidenceScore + causalScore + inferentialScore + confidenceScore + operationalScore;

    return {
      chapterName,
      idsScore,
      evidenceScore,
      causalScore,
      inferentialScore,
      confidenceScore,
      operationalScore,
      violations
    };
  }

  /**
   * Agrega todos los resultados de capítulos y computa el IDS global del dictamen.
   */
  public static calculateGlobalScore(chapterScores: Record<string, ChapterScoreResult>): GlobalScoreResult {
    let totalScoreSum = 0;
    let count = 0;
    const criticalChaptersBelowThreshold: string[] = [];

    Object.entries(chapterScores).forEach(([name, res]) => {
      totalScoreSum += res.idsScore;
      count++;

      // Verificar si un capítulo crítico tiene un score por debajo del umbral mínimo de 70
      if (this.CRITICAL_CHAPTERS.includes(name) && res.idsScore < 70) {
        criticalChaptersBelowThreshold.push(name);
      }
    });

    const overallScore = count > 0 ? Math.round(totalScoreSum / count) : 0;

    let classification: GlobalScoreResult["classification"] = "Requiere revisión analítica";
    let status: GlobalScoreResult["status"] = "APPROVED";

    if (overallScore >= 90) {
      classification = "Dictamen Estratégico";
    } else if (overallScore >= 70) {
      classification = "Dictamen Operativo";
    } else {
      classification = "Requiere revisión analítica";
      status = "REJECTED";
    }

    if (criticalChaptersBelowThreshold.length > 0) {
      status = "REJECTED";
    }

    return {
      overallScore,
      classification,
      status,
      chapterScores,
      criticalChaptersBelowThreshold
    };
  }
}
