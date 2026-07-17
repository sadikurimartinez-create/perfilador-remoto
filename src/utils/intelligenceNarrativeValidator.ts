import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';
import { EvidenceInferenceMatrix } from './evidenceInferenceMatrix';
import { IntelligenceDepthScore, ChapterScoreResult, GlobalScoreResult } from './intelligenceDepthScore';

export interface NarrativeValidationReport {
  status: "APPROVED" | "REJECTED";
  idsScore: number;
  classification: "Dictamen Estratégico" | "Dictamen Operativo" | "Requiere revisión analítica";
  strengths: string[];
  pendingItems: string[];
  violations: string[];
  reasons: string[];
  chapterScores: Record<string, ChapterScoreResult>;
}

export class IntelligenceNarrativeValidator {
  /**
   * Valida un reporte completo (payload) analizando cada capítulo y calculando las métricas INDE.
   */
  public static validateReport(
    payload: IntelligenceReportPayload,
    briefing: IntelligenceBriefing
  ): NarrativeValidationReport {
    const chapterTexts = this.extractChapters(payload);
    const chapterScores: Record<string, ChapterScoreResult> = {};
    const strengths: string[] = [];
    const pendingItems: string[] = [];
    const violations: string[] = [];
    const reasons: string[] = [];

    // 1. Evaluar cada capítulo de forma independiente
    Object.entries(chapterTexts).forEach(([chapterName, text]) => {
      const scoreRes = IntelligenceDepthScore.calculateChapterScore(text, chapterName);
      
      // Aplicar Matriz de Evidencia-Inferencia
      const matrixRes = EvidenceInferenceMatrix.validate(text);
      if (!matrixRes.isValid) {
        matrixRes.violations.forEach(v => {
          violations.push(`[${chapterName}] ${v}`);
          scoreRes.violations.push(v);
        });
      }

      // Consolidar violaciones encontradas en el escaneo léxico del capítulo
      if (scoreRes.violations.length > 0) {
        scoreRes.violations.forEach(v => {
          if (!violations.includes(v)) {
            violations.push(v);
          }
        });
      }

      chapterScores[chapterName] = scoreRes;
    });

    // 2. Calcular los resultados globales y validar umbrales críticos
    const globalRes: GlobalScoreResult = IntelligenceDepthScore.calculateGlobalScore(chapterScores);

    // 3. Generar fortalezas y pendientes dinámicos
    if (globalRes.overallScore >= 90) {
      strengths.push("Excepcional profundidad analítica y rigurosa trazabilidad de inteligencia en todos los capítulos.");
    } else if (globalRes.overallScore >= 70) {
      strengths.push("Estructura narrativa y explicaciones causales conformes con los requisitos operacionales.");
    }

    // Identificar capítulos críticos reprobados
    if (globalRes.criticalChaptersBelowThreshold.length > 0) {
      reasons.push(
        `Los siguientes capítulos críticos no alcanzaron el estándar mínimo de 70 puntos: ${globalRes.criticalChaptersBelowThreshold.join(", ")}.`
      );
      globalRes.criticalChaptersBelowThreshold.forEach(ch => {
        pendingItems.push(`Robustecer el análisis en el ${ch} para cumplir con la estructura analítica INDE.`);
      });
    }

    // Agregar violaciones por sobreinferencias detectadas
    if (violations.length > 0) {
      reasons.push("Se identificaron violaciones lógicas por sobreinferencia criminal no sustentada o términos policiales proscritos.");
    }

    // Si el promedio general es bajo
    if (globalRes.overallScore < 70) {
      reasons.push(`El Indicador de Profundidad Analítica global (IDS: ${globalRes.overallScore}/100) es inferior al umbral recomendado de 70 puntos.`);
    }

    // Determinar estatus final: Siempre APPROVED (Gobernanza analítica orientativa blanda - No bloqueante)
    const finalStatus: "APPROVED" | "REJECTED" = "APPROVED";

    return {
      status: finalStatus,
      idsScore: globalRes.overallScore,
      classification: globalRes.classification,
      strengths,
      pendingItems,
      violations,
      reasons,
      chapterScores
    };
  }

  /**
   * Extrae la narrativa de cada capítulo del payload para su mapeo de evaluación.
   */
  private static extractChapters(payload: IntelligenceReportPayload): Record<string, string> {
    const chapters: Record<string, string> = {};

    chapters["Capítulo 1"] = payload.contextoTerritorial || "";
    chapters["Capítulo 2"] = payload.finalHypothesis || "";
    
    // Capítulo 3 (Interpretación de mapas)
    chapters["Capítulo 3"] = (payload.maps || []).map(m => m.interpretation).join("\n");

    // Capítulo 4 (Modelos estadísticos / Gráficas)
    chapters["Capítulo 4"] = (payload.graphs || []).map(g => `${g.explanation}\n${g.finding}\n${g.relation}`).join("\n");

    // Capítulo 5 (Evidencia Fotográfica / Campo)
    chapters["Capítulo 5"] = (payload.photoEvidence || []).map(p => `${p.caption}\n${p.criminologicalInterpretation}\n${p.relation}`).join("\n");

    // Capítulo 6 (Street View / Entorno vial)
    chapters["Capítulo 6"] = (payload.streetViewAnalysis || []).map(s => `${s.observed}\n${s.criminologicalAnalysis}\n${s.relation}`).join("\n");

    chapters["Capítulo 7"] = payload.osintSynthesized || "";
    chapters["Capítulo 8"] = payload.pandillasAnalysis || "";
    
    // Capítulo 9 (Grafo de Vínculos Tácticos)
    chapters["Capítulo 9"] = (payload.intelligenceContext as any)?.narrative || "";

    const conc = payload.conclusiones;
    chapters["Capítulo 10"] = conc
      ? [
          ...(conc.hallazgosCriticos || []),
          ...(conc.riesgosInmediatos || []),
          ...(conc.escenariosFuturos || []),
          ...(conc.recomendacionesTacticas || []),
          ...(conc.recomendacionesEstrategicas || [])
        ].join("\n")
      : "";

    return chapters;
  }
}
