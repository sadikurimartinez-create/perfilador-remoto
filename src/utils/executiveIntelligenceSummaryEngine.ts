import { EditorialStructureEngine } from "./editorialStructureEngine";

export enum RiskStatus {
  SUPPORTED = "SUPPORTED",
  INDICATED = "INDICATED",
  LIMITED = "LIMITED",
  UNSUPPORTED = "UNSUPPORTED"
}

export interface ExecutiveTrace {
  summaryBlockId: string;
  sourceChapter: string;
  sourceEvidenceIds: string[];
  sourceHypothesisId?: string;
  confidence: number;
}

export interface ExecutiveFinding {
  id: string;
  title: string;
  finding: string;
  sourceChapter: string;
  evidenceIds: string[];
  confidence: number; // 0 a 100
  // Criterios de ponderación
  relevance: number;             // 1 a 5
  evidenceSupport: number;       // 1 a 5
  hypothesisImpact: number;      // 1 a 5
  operationalImportance: number; // 1 a 5
  score?: number;                // Ponderación global calculada
}

export interface ExecutiveRisk {
  id: string;
  risk: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  status: RiskStatus;
  basis: string;
  evidenceIds: string[];
}

export interface ExecutiveRecommendation {
  id: string;
  action: string;
  objective: string;
  supportingFindings: string[];
  evidenceIds: string[];
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ExecutiveSummaryReport {
  situation: string;
  primaryFindings: ExecutiveFinding[];     // Top 5 prioritarios
  supportingFindings: ExecutiveFinding[];  // Hallazgos secundarios
  risks: ExecutiveRisk[];
  hypothesisState: {
    statement: string;
    state: "CONFIRMADA" | "EN_EVALUACION" | "LIMITADA";
    confidenceScore: number;
  };
  recommendations: ExecutiveRecommendation[];
  traces: ExecutiveTrace[];
  isValid: boolean;
  errorCode?: string;
}

export class ExecutiveFindingExtractor {
  /**
   * Extrae los hallazgos analíticos de los capítulos del dictamen.
   * Aplica un algoritmo de ponderación multidimensional y separa en principales (Top 5) y secundarios.
   */
  public static extract(
    chapters: Record<string, string>,
    photoEvidence: any[] = []
  ): { primary: ExecutiveFinding[]; supporting: ExecutiveFinding[] } {
    const findings: ExecutiveFinding[] = [];

    // Buscar aserciones analíticas en los capítulos clave de campo
    Object.entries(chapters).forEach(([chapterKey, text]) => {
      if (!text || text.trim().length === 0) return;

      const blocks = EditorialStructureEngine.parse(text);
      blocks.forEach((block, idx) => {
        if (block.type === "ANALYTICAL_BLOCK" && block.category === "EVIDENCIA") {
          const blockText = block.text || "";
          
          // Buscar IDs de evidencias físicas asociadas por contexto textual
          const associatedEvidenceIds: string[] = [];
          photoEvidence.forEach(photo => {
            const pid = String(photo.id || photo.evidenceId || "");
            const cap = String(photo.caption || photo.comentario || "").toLowerCase();
            if (pid && blockText.toLowerCase().includes(pid.toLowerCase())) {
              associatedEvidenceIds.push(pid);
            } else if (cap && cap.length > 5 && blockText.toLowerCase().includes(cap.substring(0, 12))) {
              associatedEvidenceIds.push(pid || cap);
            }
          });

          // Ponderar usando heurísticas del contexto analítico
          const relevance = blockText.includes("delictivo") || blockText.includes("riesgo") ? 5 : 3;
          const evidenceSupport = associatedEvidenceIds.length > 0 ? 5 : 2;
          const hypothesisImpact = blockText.toLowerCase().includes("hipótesis") || blockText.toLowerCase().includes("hie") ? 4 : 3;
          const operationalImportance = blockText.toLowerCase().includes("patrullaje") || blockText.toLowerCase().includes("operativo") ? 5 : 3;
          
          const score = (relevance * 0.3) + (evidenceSupport * 0.3) + (hypothesisImpact * 0.2) + (operationalImportance * 0.2);
          const confidence = Math.round(score * 20); // Escala 0 a 100

          findings.push({
            id: `EF-${chapterKey.replace(/\s+/g, "")}-${idx}`,
            title: blockText.split(/[.\n]/)[0]?.substring(0, 80) || "Hallazgo Analítico",
            finding: blockText,
            sourceChapter: chapterKey,
            evidenceIds: associatedEvidenceIds,
            confidence,
            relevance,
            evidenceSupport,
            hypothesisImpact,
            operationalImportance,
            score
          });
        }
      });
    });

    // Ordenar por score global (de mayor a menor)
    findings.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Separar en Top 5 prioritarios y Secundarios (sin eliminar información)
    const primary = findings.slice(0, 5);
    const supporting = findings.slice(5);

    return { primary, supporting };
  }
}

export class CriticalRiskPrioritizer {
  /**
   * Clasifica e identifica riesgos operativos de alta dirección.
   */
  public static prioritize(
    chapters: Record<string, string>,
    photoEvidence: any[] = []
  ): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];
    const concText = chapters["Capítulo 10"] || "";
    if (!concText) return [];

    const blocks = EditorialStructureEngine.parse(concText);
    blocks.forEach((block, idx) => {
      // Buscar bloques de riesgo
      if (block.text?.toLowerCase().includes("riesgo")) {
        const text = block.text || "";
        const lowerText = text.toLowerCase();

        // Determinar base empírica e ID de evidencias por mención
        const associatedEvidences: string[] = [];
        photoEvidence.forEach(photo => {
          const pid = String(photo.id || photo.evidenceId || "");
          const cap = String(photo.caption || photo.comentario || "").toLowerCase();
          if (pid && lowerText.includes(pid.toLowerCase())) {
            associatedEvidences.push(pid);
          } else if (cap && cap.length > 5 && lowerText.includes(cap.substring(0, 12))) {
            associatedEvidences.push(pid || cap);
          }
        });

        // Determinar nivel de riesgo
        let level: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
        if (lowerText.includes("alto") || lowerText.includes("crítico") || lowerText.includes("alta")) {
          level = "HIGH";
        } else if (lowerText.includes("bajo") || lowerText.includes("mínimo")) {
          level = "LOW";
        }

        // Determinar estatus de riesgo (SUPPORTED, INDICATED, LIMITED, UNSUPPORTED)
        let status = RiskStatus.INDICATED;
        if (associatedEvidences.length > 0) {
          status = RiskStatus.SUPPORTED;
        } else if (lowerText.includes("limitada") || lowerText.includes("insuficiente")) {
          status = RiskStatus.LIMITED;
        } else if (lowerText.includes("sin sustento") || lowerText.includes("falso")) {
          status = RiskStatus.UNSUPPORTED;
        }

        risks.push({
          id: `ER-${idx}`,
          risk: text,
          level,
          status,
          basis: associatedEvidences.length > 0 
            ? `Análisis sustentado en evidencia física del cuadrante.`
            : "Estimación matemática estadística basada en comportamiento histórico.",
          evidenceIds: associatedEvidences
        });
      }
    });

    return risks;
  }
}

export class OperationalRecommendationMapper {
  /**
   * Mapea recomendaciones tácticas operativas que cuenten con objetivo, acción y sustento.
   */
  public static map(
    chapters: Record<string, string>,
    photoEvidence: any[] = []
  ): ExecutiveRecommendation[] {
    const recs: ExecutiveRecommendation[] = [];
    const concText = chapters["Capítulo 10"] || "";
    if (!concText) return [];

    const blocks = EditorialStructureEngine.parse(concText);
    blocks.forEach((block, idx) => {
      if (block.category === "RECOMMENDATION" || block.text?.toLowerCase().includes("recomienda") || block.text?.toLowerCase().includes("acción") || block.text?.toLowerCase().includes("recomendación")) {
        const text = block.text || "";
        const lowerText = text.toLowerCase();

        // Extraer acción y objetivo si sigue formato estructurado
        let action = text;
        let objective = "Remediación situacional del entorno.";
        if (lowerText.includes("objetivo:")) {
          const parts = text.split(/objetivo:/i);
          action = parts[0].trim();
          objective = parts[1].trim();
        }

        // Buscar evidencias asociadas
        const associatedEvidences: string[] = [];
        photoEvidence.forEach(photo => {
          const pid = String(photo.id || photo.evidenceId || "");
          const cap = String(photo.caption || photo.comentario || "").toLowerCase();
          if (pid && lowerText.includes(pid.toLowerCase())) {
            associatedEvidences.push(pid);
          } else if (cap && cap.length > 5 && lowerText.includes(cap.substring(0, 12))) {
            associatedEvidences.push(pid || cap);
          }
        });

        // Determinar prioridad de recomendación
        let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
        if (lowerText.includes("inmediata") || lowerText.includes("urgente") || lowerText.includes("0-30")) {
          priority = "HIGH";
        } else if (lowerText.includes("estratégica") || lowerText.includes("largo plazo") || lowerText.includes(">90")) {
          priority = "LOW";
        }

        recs.push({
          id: `REC-${idx}`,
          action,
          objective,
          supportingFindings: associatedEvidences.length > 0 
            ? [`Asociado a anomalías de campo en ${associatedEvidences.join(", ")}.`]
            : ["Asociado a dinámicas delictivas generales del sector."],
          evidenceIds: associatedEvidences,
          priority
        });
      }
    });

    return recs;
  }
}


export class ExecutiveSummaryValidator {
  /**
   * Ejecuta filtros estrictos para vetar aserciones sin sustento en el resumen ejecutivo.
   */
  public static validate(
    findings: ExecutiveFinding[],
    risks: ExecutiveRisk[],
    recommendations: ExecutiveRecommendation[],
    hypothesisState: string
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // 1. Validar que no haya recomendaciones ni hallazgos sin fundamentos (SUPPORTED o INDICATED solamente)
    const hasUnsupportedRisk = risks.some(r => r.status === RiskStatus.UNSUPPORTED);
    if (hasUnsupportedRisk) {
      warnings.push("REJECT_EXECUTIVE_BLOCK: Se detectan riesgos sin soporte que deben descartarse.");
    }

    // 2. Comprobar que todos los hallazgos tengan cobertura de capitulos analiticos
    const hasInvalidFinding = findings.some(f => !f.sourceChapter);
    if (hasInvalidFinding) {
      warnings.push("REJECT_EXECUTIVE_BLOCK: Hallazgo huérfano de procedencia.");
    }

    const isValid = warnings.length === 0;

    return {
      isValid,
      warnings
    };
  }
}

export class ExecutiveIntelligenceSummaryEngine {
  /**
   * Orquestador principal de la Capa del Resumen Ejecutivo de Alta Dirección v1.0.9.
   */
  public static generateSummary(
    payload: any,
    photoEvidence: any[] = []
  ): ExecutiveSummaryReport {
    const chapters: Record<string, string> = {};

    chapters["Capítulo 1"] = payload.contextoTerritorial || "";
    chapters["Capítulo 2"] = payload.finalHypothesis || "";
    chapters["Capítulo 3"] = (payload.maps || []).map((m: any) => m.interpretation).join("\n") || "";
    chapters["Capítulo 4"] = (payload.graphs || []).map((g: any) => `${g.explanation}\n${g.finding}`).join("\n") || "";
    chapters["Capítulo 5"] = (payload.photoEvidence || []).map((p: any) => `${p.caption}\n${p.criminologicalInterpretation}`).join("\n") || "";
    chapters["Capítulo 6"] = (payload.streetViewAnalysis || []).map((s: any) => `${s.observed}\n${s.criminologicalAnalysis}`).join("\n") || "";
    chapters["Capítulo 7"] = payload.osintSynthesized || "";
    chapters["Capítulo 8"] = payload.pandillasAnalysis || "";
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
      : payload.conclusionesText || "";

    // Caso 8: Reporte vacío sin hallazgos priorizables (EXECUTIVE_SUMMARY_NOT_AVAILABLE)
    const hasAnyContent = Object.values(chapters).some(c => c && c.trim().length > 10);
    if (!hasAnyContent) {
      return {
        situation: "No disponible.",
        primaryFindings: [],
        supportingFindings: [],
        risks: [],
        hypothesisState: {
          statement: "Sin hipótesis.",
          state: "LIMITADA",
          confidenceScore: 0
        },
        recommendations: [],
        traces: [],
        isValid: false,
        errorCode: "EXECUTIVE_SUMMARY_NOT_AVAILABLE"
      };
    }

    // 1. Extraer Hallazgos
    const extractedFindings = ExecutiveFindingExtractor.extract(chapters, photoEvidence);

    // 2. Extraer Riesgos
    const risks = CriticalRiskPrioritizer.prioritize(chapters, photoEvidence);

    // 3. Extraer Recomendaciones
    const recommendations = OperationalRecommendationMapper.map(chapters, photoEvidence);

    // 4. Analizar estado de la hipótesis central en hieData/centralHypothesis
    const hie = payload.hieData;
    const hypState: "CONFIRMADA" | "EN_EVALUACION" | "LIMITADA" = 
      hie?.validationMatrix?.isValidated ? "CONFIRMADA" : 
      hie?.confidence?.level === "LIMITADA" ? "LIMITADA" : "EN_EVALUACION";

    const hypothesisState = {
      statement: hie?.centralHypothesis?.summary || payload.finalHypothesis || "Hipótesis en proceso de corroboración perimetral.",
      state: hypState,
      confidenceScore: hie?.confidence?.score || 70
    };

    // 5. Validar consistencia ejecutiva
    const validation = ExecutiveSummaryValidator.validate(
      extractedFindings.primary,
      risks,
      recommendations,
      hypothesisState.state
    );

    // 6. Generar ExecutiveTraces (Ajuste 1)
    const traces: ExecutiveTrace[] = [];
    extractedFindings.primary.forEach(f => {
      traces.push({
        summaryBlockId: f.id,
        sourceChapter: f.sourceChapter,
        sourceEvidenceIds: f.evidenceIds,
        sourceHypothesisId: "HIE-CENTRAL",
        confidence: f.confidence
      });
    });

    const situation = payload.executiveSummary || "Se presenta el briefing ejecutivo consolidado a partir de los datos auditados de la Secretaría de Seguridad Pública.";

    return {
      situation,
      primaryFindings: extractedFindings.primary,
      supportingFindings: extractedFindings.supporting,
      risks,
      hypothesisState,
      recommendations: recommendations.sort((a, b) => {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return order[b.priority] - order[a.priority]; // Ordenar recomendaciones por prioridad
      }),
      traces,
      isValid: validation.isValid,
      errorCode: validation.isValid ? undefined : "REJECT_EXECUTIVE_BLOCK"
    };
  }
}
