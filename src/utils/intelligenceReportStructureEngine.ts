import { EditorialStructureEngine, EditorialBlock } from "./editorialStructureEngine";
import { EvidenceNarrativeMapper } from "./evidenceNarrativeMapper";
import { InstitutionalChapterID } from "../types/Report";

export enum AnalyticalFlowStatus {
  COMPLETE,
  MISSING_EVIDENCE,
  MISSING_HYPOTHESIS,
  UNSUPPORTED_CONCLUSION,
  STRUCTURAL_GAP
}

export interface ChapterBalance {
  chapter: string;
  narrativeWeight: number; // Porcentaje de bloques narrativos (párrafos, listas)
  evidenceWeight: number;  // Porcentaje de referencias a evidencias físicas y de campo
  visualWeight: number;    // Porcentaje de bloques visuales (gráficas, tablas)
  balanceScore: number;    // Índice de equilibrio de 0 a 100
  isExcessiveVisual?: boolean;
}

export interface EvidenceCoverageMatrix {
  chapterId: string;
  hypothesisCoverage: number; // Porcentaje de hipótesis sustentada (0 a 100)
  evidenceCoverage: number;   // Porcentaje de evidencias descritas (0 a 100)
  visualCoverage: number;     // Porcentaje de visuales asociados (0 a 100)
  unsupportedClaims: number;  // Cantidad de aserciones severas sin evidencia
}

export interface RedundancyAlert {
  sourceChapter: string;
  targetChapter: string;
  similarity: number;         // Grado de solapamiento léxico (0 a 1.0)
  snippet: string;            // Fragmento conceptual duplicado o descripción
}

export interface FlowValidationResult {
  status: AnalyticalFlowStatus;
  isValid: boolean;
  unsupportedConclusions: string[];
  orphanedEvidence: string[];
  incompleteCapitols: string[];
  warnings: string[];
}

export interface StructuralQualityScore {
  coherence: number;          // 0 a 100 (alineación hipótesis-conclusión)
  traceability: number;       // 0 a 100 (tasa de enlace texto-evidencia)
  evidenceAlignment: number;  // 0 a 100 (densidad de evidencia frente a afirmaciones)
  visualSupport: number;      // 0 a 100 (proporción óptima de tablas y gráficos)
  overall: number;            // Promedio ponderado de salud estructural (indicador diagnóstica)
}

export interface ChapterStructureReport {
  chapterKey: string;
  balance: ChapterBalance;
  coverage: EvidenceCoverageMatrix;
  scores: StructuralQualityScore;
}

export interface ReportStructureAuditResult {
  isValid: boolean;
  globalScore: number;
  chapters: Record<string, ChapterStructureReport>;
  flow: FlowValidationResult;
  redundancies: RedundancyAlert[];
}

export class ChapterBalanceAnalyzer {
  /**
   * Analiza cuantitativamente las proporciones de bloques de contenido en un capítulo.
   * Sin emitir juicios lingüísticos, clasifica y mide el peso de cada tipología de información.
   */
  public static analyzeChapter(
    chapterKey: string,
    text: string,
    photoEvidence: any[] = []
  ): ChapterBalance {
    const blocks = EditorialStructureEngine.parse(text);
    const totalBlocks = blocks.length;

    if (totalBlocks === 0) {
      return {
        chapter: chapterKey,
        narrativeWeight: 0,
        evidenceWeight: 0,
        visualWeight: 0,
        balanceScore: 100,
        isExcessiveVisual: false
      };
    }

    let narrativeCount = 0;
    let evidenceCount = 0;
    let visualCount = 0;

    // 1. Contar bloques por tipología cuantitativa pura
    blocks.forEach(b => {
      if (b.type === "PARAGRAPH" || b.type === "BULLET" || b.type === "NUMBERED_LIST") {
        narrativeCount++;
      } else if (b.type === "ANALYTICAL_BLOCK" && b.category === "EVIDENCIA") {
        evidenceCount++;
      } else if (b.type === "VISUAL_BLOCK" || b.type === "TABLE") {
        visualCount++;
      }
    });

    // Añadir peso de evidencias específicas del álbum asociadas a este capítulo por contexto de texto
    const lowerText = text.toLowerCase();
    const mappedEvidences = photoEvidence.filter(item => {
      const cap = (item.caption || item.comentario || "").toLowerCase();
      return cap.length > 0 && lowerText.includes(cap.substring(0, Math.min(cap.length, 15)));
    });
    evidenceCount += mappedEvidences.length;

    const totalWeightUnits = narrativeCount + evidenceCount + visualCount;
    const narrativeWeight = totalWeightUnits > 0 ? Math.round((narrativeCount / totalWeightUnits) * 100) : 0;
    const evidenceWeight = totalWeightUnits > 0 ? Math.round((evidenceCount / totalWeightUnits) * 100) : 0;
    const visualWeight = totalWeightUnits > 0 ? Math.round((visualCount / totalWeightUnits) * 100) : 0;

    // 2. Calcular balanceScore métrico
    // Un capítulo balanceado idealmente tiene una presencia sana de narrativa de contexto (60%), evidencia (20%), y apoyos visuales (20%)
    const narrativeDiff = Math.abs(narrativeWeight - 60);
    const evidenceDiff = Math.abs(evidenceWeight - 20);
    const visualDiff = Math.abs(visualWeight - 20);
    const balanceScore = Math.max(0, 100 - Math.round((narrativeDiff + evidenceDiff + visualDiff) / 2));

    // Caso 10: Controlar saturación o exceso visual sin eliminar contenido (Advertencia)
    const isExcessiveVisual = visualCount > 4 || (visualCount > narrativeCount * 1.5 && visualCount > 0);

    return {
      chapter: chapterKey,
      narrativeWeight,
      evidenceWeight,
      visualWeight,
      balanceScore,
      isExcessiveVisual
    };
  }
}

export class AnalyticalFlowValidator {
  /**
   * Valida la secuencia lógica de la cadena de inteligencia, detectando brechas de flujo estructural.
   */
  public static validateFlow(
    chapters: Record<string, string>,
    photoEvidence: any[] = []
  ): FlowValidationResult {
    const unsupportedConclusions: string[] = [];
    const orphanedEvidence: string[] = [];
    const incompleteCapitols: string[] = [];
    const warnings: string[] = [];
    let status = AnalyticalFlowStatus.COMPLETE;

    const cap5Text = (chapters["Capítulo 5"] || "").toLowerCase();
    const cap6Text = (chapters["Capítulo 6"] || "").toLowerCase();
    const fullTextCombined = Object.values(chapters).join("\n").toLowerCase();

    // Caso 8: Evidencias sin interpretación ni mención textual asociada
    photoEvidence.forEach(item => {
      const id = String(item.id || item.evidenceId || "");
      const caption = String(item.title || item.caption || item.comentario || "").toLowerCase();
      
      const isMentioned = 
        (id && fullTextCombined.includes(id.toLowerCase())) || 
        (caption && caption.length > 5 && fullTextCombined.includes(caption.substring(0, Math.min(caption.length, 12))));

      if (!isMentioned) {
        orphanedEvidence.push(id || caption || "Evidencia fotográfica");
      }
    });

    if (orphanedEvidence.length > 0) {
      status = AnalyticalFlowStatus.MISSING_EVIDENCE;
      warnings.push(`ORPHAN_EVIDENCE: Se detectan ${orphanedEvidence.length} recursos visuales sin correspondencia narrativa.`);
    }

    // Caso 7: Capítulos huérfanos o con vacíos de estructura (STRUCTURAL_GAP)
    Object.entries(chapters).forEach(([key, text]) => {
      if (key === "Capítulo 1" || key === "Capítulo 5") {
        const blocks = EditorialStructureEngine.parse(text);
        const narrativeBlocks = blocks.filter(b => b.type === "PARAGRAPH" || b.type === "BULLET");
        const evidenceBlocks = blocks.filter(b => b.type === "ANALYTICAL_BLOCK" && b.category === "EVIDENCIA");

        if (narrativeBlocks.length >= 5 && evidenceBlocks.length === 0 && photoEvidence.length === 0) {
          incompleteCapitols.push(key);
          status = AnalyticalFlowStatus.STRUCTURAL_GAP;
          warnings.push(`STRUCTURAL_GAP: El capítulo [${key}] posee abundante prosa explicativa pero no cuenta con referencias físicas.`);
        }
      }
    });

    // Caso 3 y Caso 9: Conclusiones sin soporte analítico (UNSUPPORTED_CONCLUSION y TRACEABILITY_WARNING)
    const conclusionText = chapters["Capítulo 10"] || "";
    if (conclusionText) {
      const concBlocks = EditorialStructureEngine.parse(conclusionText);
      concBlocks.forEach(b => {
        if (b.type === "ANALYTICAL_BLOCK" && b.category === "RECOMMENDATION") {
          const blockText = (b.text || "").toLowerCase();
          
          // Buscar si el sustento de la recomendación está demasiado alejado o ausente
          const keywords = ["iluminación", "baldío", "graffiti", "pandillas", "actores", "vehículo"];
          keywords.forEach(kw => {
            if (blockText.includes(kw)) {
              // Si se concluye de iluminación pero no se menciona en Cap 5/6 ni Cap 2
              const inHip = (chapters["Capítulo 2"] || "").toLowerCase().includes(kw);
              const inEvid = cap5Text.includes(kw) || cap6Text.includes(kw);
              
              if (!inHip && !inEvid) {
                unsupportedConclusions.push(b.text || "Conclusión operativa");
                status = AnalyticalFlowStatus.UNSUPPORTED_CONCLUSION;
                warnings.push(`UNSUPPORTED_CONCLUSION: Se inyectó recomendación delictiva sobre '${kw}' sin soporte empírico previo.`);
              } else if (inHip && !inEvid) {
                // Caso 9: Conclusión descrita en Capítulo 10 cuya evidencia de base se sitúa únicamente en el planteamiento Capítulo 2 sin intermediarios
                status = AnalyticalFlowStatus.UNSUPPORTED_CONCLUSION;
                warnings.push(`TRACEABILITY_WARNING: La conclusión sobre '${kw}' se asocia con el planteamiento del Cap 2, pero carece de un correlato de campo en los capítulos intermedios.`);
              }
            }
          });
        }
      });
    }

    const isValid = unsupportedConclusions.length === 0 && incompleteCapitols.length === 0;

    return {
      status,
      isValid,
      unsupportedConclusions,
      orphanedEvidence,
      incompleteCapitols,
      warnings
    };
  }
}

export class ReportRedundancyAnalyzer {
  /**
   * Analiza de forma pasiva la redundancia y similitud léxica inter-capítulo.
   * No altera ni borra texto de manera automática; emite reportes REDUNDANCY_ALERT.
   */
  public static analyzeRedundancy(
    chapters: Record<string, string>
  ): RedundancyAlert[] {
    const alerts: RedundancyAlert[] = [];
    const entries = Object.entries(chapters);

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [keyA, textA] = entries[i];
        const [keyB, textB] = entries[j];

        if (!textA || !textB || textA.length < 50 || textB.length < 50) continue;

        const similarity = this.calculateSimilarity(textA, textB);

        if (similarity > 0.75) {
          alerts.push({
            sourceChapter: keyA,
            targetChapter: keyB,
            similarity,
            snippet: `Se detecta un nivel excesivo de repetición conceptual analítica (${(similarity * 100).toFixed(0)}%) entre el [${keyA}] y el [${keyB}].`
          });
        }
      }
    }

    return alerts;
  }

  private static calculateSimilarity(strA: string, strB: string): number {
    const getWords = (str: string) => {
      return new Set(
        str.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 4) // Evitar palabras cortas irrelevantes
      );
    };

    const wordsA = getWords(strA);
    const wordsB = getWords(strB);

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let matchCount = 0;
    wordsA.forEach(w => {
      if (wordsB.has(w)) {
        matchCount++;
      }
    });

    const unionSize = new Set([...Array.from(wordsA), ...Array.from(wordsB)]).size;
    return matchCount / unionSize;
  }
}

export class ChapterQualityScore {
  /**
   * Calcula indicadores métricos de salud estructural (Audit helper) sin bloquear.
   */
  public static calculateScores(
    balance: ChapterBalance,
    coverage: EvidenceCoverageMatrix,
    hasFlowWarning: boolean
  ): StructuralQualityScore {
    // 1. Coherence (Coherencia): Alineación hipótesis-conclusión
    const coherence = hasFlowWarning ? 65 : 95;

    // 2. Traceability (Trazabilidad): Tasa de enlace texto-evidencia
    const traceability = coverage.evidenceCoverage > 0 ? Math.round(coverage.evidenceCoverage) : 80;

    // 3. EvidenceAlignment (Alineación de Evidencias): Cantidad de aserciones sustentadas
    const evidenceAlignment = Math.max(10, 100 - (coverage.unsupportedClaims * 20));

    // 4. VisualSupport (Apoyo Visual): Presencia balanceada de recursos visuales
    let visualSupport = 90;
    if (balance.isExcessiveVisual) {
      visualSupport = 60; // Penalización de saturación visual (Caso 10)
    } else if (balance.visualWeight === 0) {
      visualSupport = 50; // Penalización por falta de apoyo visual
    }

    // 5. Overall (Promedio Ponderado de Salud)
    const overall = Math.round((coherence * 0.3) + (traceability * 0.2) + (evidenceAlignment * 0.3) + (visualSupport * 0.2));

    return {
      coherence,
      traceability,
      evidenceAlignment,
      visualSupport,
      overall
    };
  }
}

export class IntelligenceReportStructureEngine {
  /**
   * Orquestador de la capa estructural v1.0.8.
   * Analiza el reporte, mide métricas, clasifica anomalías y entrega un reporte completo.
   */
  public static auditReportStructure(
    payload: any,
    photoEvidence: any[] = []
  ): ReportStructureAuditResult {
    const chapters: Record<string, string> = {};

    const cap01 = payload.contextoTerritorial || payload[InstitutionalChapterID.CAP_01_RESUMEN] || payload.resumenEjecutivo || "";
    const cap02 = payload.fichaTecnica || payload[InstitutionalChapterID.CAP_02_FICHA_TECNICA] || "";
    const cap03 = payload.marcoGeografico || payload[InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO] || "";
    const cap04 = (payload.maps || []).map((m: any) => m.interpretation).join("\n") || payload[InstitutionalChapterID.CAP_04_GEOINT] || "";
    const cap05 = payload.osintSynthesized || payload[InstitutionalChapterID.CAP_05_OSINT] || "";
    const cap06 = (payload.intelligenceContext as any)?.narrative || payload.finalHypothesis || payload[InstitutionalChapterID.CAP_06_IAC_NARRATIVA] || "";
    const cap07 = (payload.photoEvidence || []).map((p: any) => `${p.caption}\n${p.criminologicalInterpretation}\n${p.relation}`).join("\n") || payload[InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL] || "";
    const cap08 = payload.recomendaciones || payload[InstitutionalChapterID.CAP_08_RECOMENDACIONES] || "";
    const cap09 = payload.anexos || payload[InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS] || "";
    
    const conc = payload.conclusiones;
    const cap10 = conc
      ? [
          ...(conc.hallazgosCriticos || []),
          ...(conc.riesgosInmediatos || []),
          ...(conc.escenariosFuturos || []),
          ...(conc.recomendacionesTacticas || []),
          ...(conc.recomendacionesEstrategicas || [])
        ].join("\n")
      : payload.conclusionesText || payload[InstitutionalChapterID.CAP_10_CERTIFICACION] || "";

    // Mapeo legado para compatibilidad con validadores analíticos de flujo
    chapters["Capítulo 1"] = cap01 || cap03;
    chapters["Capítulo 2"] = cap06;
    chapters["Capítulo 3"] = cap04;
    chapters["Capítulo 4"] = (payload.graphs || []).map((g: any) => `${g.explanation}\n${g.finding}\n${g.relation}`).join("\n") || "";
    chapters["Capítulo 5"] = cap07;
    chapters["Capítulo 6"] = (payload.streetViewAnalysis || []).map((s: any) => `${s.observed}\n${s.criminologicalAnalysis}\n${s.relation}`).join("\n") || "";
    chapters["Capítulo 7"] = cap05;
    chapters["Capítulo 8"] = payload.pandillasAnalysis || "";
    chapters["Capítulo 9"] = cap09;
    chapters["Capítulo 10"] = cap10;

    // Mapeo unificado para el contrato maestro de capítulos institucionales (ADR-014)
    chapters[InstitutionalChapterID.CAP_01_RESUMEN] = cap01;
    chapters[InstitutionalChapterID.CAP_02_FICHA_TECNICA] = cap02;
    chapters[InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO] = cap03;
    chapters[InstitutionalChapterID.CAP_04_GEOINT] = cap04;
    chapters[InstitutionalChapterID.CAP_05_OSINT] = cap05;
    chapters[InstitutionalChapterID.CAP_06_IAC_NARRATIVA] = cap06;
    chapters[InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL] = cap07;
    chapters[InstitutionalChapterID.CAP_08_RECOMENDACIONES] = cap08;
    chapters[InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS] = cap09;
    chapters[InstitutionalChapterID.CAP_10_CERTIFICACION] = cap10;

    // 1. Ejecutar el validador de flujo analítico (sobre el esquema legado)
    const flow = AnalyticalFlowValidator.validateFlow(chapters, photoEvidence);

    // 2. Ejecutar análisis de redundancia inter-capítulo (sobre el esquema legado)
    const redundancies = ReportRedundancyAnalyzer.analyzeRedundancy(chapters);

    // 3. Evaluar cada capítulo canonizado de forma independiente (ADR-014)
    const reports: Record<string, ChapterStructureReport> = {};
    let scoresSum = 0;
    let chaptersCount = 0;

    Object.values(InstitutionalChapterID).forEach((enumKey) => {
      const text = chapters[enumKey];
      if (!text || text.trim().length === 0) return;

      const balance = ChapterBalanceAnalyzer.analyzeChapter(enumKey, text, photoEvidence);

      // Calcular la matriz de cobertura de evidencias (EvidenceCoverageMatrix)
      let evidenceCoverage = balance.evidenceWeight;
      let unsupportedClaims = 0;

      if (enumKey === InstitutionalChapterID.CAP_10_CERTIFICACION && flow.unsupportedConclusions.length > 0) {
        unsupportedClaims = flow.unsupportedConclusions.length;
      }

      const coverage: EvidenceCoverageMatrix = {
        chapterId: enumKey,
        hypothesisCoverage: enumKey === InstitutionalChapterID.CAP_06_IAC_NARRATIVA ? 95 : 70,
        evidenceCoverage,
        visualCoverage: balance.visualWeight,
        unsupportedClaims
      };

      const hasWarning = flow.warnings.some(w => w.includes(enumKey) || (enumKey === InstitutionalChapterID.CAP_10_CERTIFICACION && w.includes("Capítulo 10")));
      const scores = ChapterQualityScore.calculateScores(balance, coverage, hasWarning);

      reports[enumKey] = {
        chapterKey: enumKey,
        balance,
        coverage,
        scores
      };

      scoresSum += scores.overall;
      chaptersCount++;
    });

    const globalScore = chaptersCount > 0 ? Math.round(scoresSum / chaptersCount) : 100;
    const isValid = flow.isValid && redundancies.length === 0 && !Object.values(reports).some(r => r.balance.isExcessiveVisual);

    return {
      isValid,
      globalScore,
      chapters: reports,
      flow,
      redundancies
    };
  }
}
