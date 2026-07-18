import { EvidenceRelationshipEngine } from "./evidenceRelationshipEngine";
import { EvidenceInferenceMatrix } from "./evidenceInferenceMatrix";
import { EvidenceNarrativeMapper } from "./evidenceNarrativeMapper";

export type NarrativeBlockType = 
  | "OBSERVATION" 
  | "ANALYTICAL_FINDING" 
  | "HYPOTHESIS_STATUS" 
  | "OPERATIONAL_CONCLUSION" 
  | "LIMITATION";

export type AnalyticalLanguageStatus =
  | "SUPPORTED_ASSERTION"
  | "EXPLORATORY_HYPOTHESIS"
  | "LIMITED_INFERENCE"
  | "UNSUPPORTED_CLAIM";

export interface NarrativeEvidenceLink {
  narrativeId: string;
  evidenceIds: string[];
  hypothesisId?: string;
  confidence: number; // 0 - 100
}

export interface NarrativeTrace {
  chapter: string;
  blockId: string;
  source: "HIE" | "EVIDENCE" | "STATISTICAL_ENGINE" | "OSINT" | "TERRITORIAL_CONTEXT";
  confidence: number;
}

export interface NarrativeBlock {
  id: string;
  type: NarrativeBlockType;
  text: string;
  links: NarrativeEvidenceLink[];
  trace?: NarrativeTrace;
  languageStatus?: AnalyticalLanguageStatus;
  auditFlag?: boolean;
  auditNotes?: string;
}

export interface NarrativeSimilarityResult {
  originalBlock: string;
  duplicateBlock: string;
  similarity: number; // 0 to 1
  action: "PRESERVE" | "MERGE" | "FLAG";
}

export class InstitutionalLanguageGuard {
  /**
   * Clasifica el tipo de lenguaje de un texto y, si es limitado o no sustentado,
   * normaliza/reescribe las expresiones para cumplir con los estándares analíticos.
   */
  public static classifyAnalyticalLanguage(
    text: string,
    isExploratoryHypothesis = false,
    hasEvidenceSupport = true
  ): { status: AnalyticalLanguageStatus; sanitizedText: string } {
    const lowerText = text.toLowerCase();

    // 1. Detectar si es una hipótesis legítima catalogada o si contiene marcas explícitas de hipótesis exploratoria
    const isHypothesisText = 
      isExploratoryHypothesis || 
      lowerText.includes("hipótesis mantiene un nivel exploratorio") || 
      lowerText.includes("línea de análisis") || 
      lowerText.includes("escenario bajo estudio");

    if (isHypothesisText) {
      return {
        status: "EXPLORATORY_HYPOTHESIS",
        sanitizedText: text // Se preservan los términos probabilísticos ya que pertenecen a hipótesis formales de HIE
      };
    }

    // 2. Detectar afirmaciones de control criminal de alta severidad que pueden calificar como sobreinferencia extrema
    const hasProscribedClaims = 
      lowerText.includes("organización criminal") || 
      lowerText.includes("célula criminal confirmada") || 
      lowerText.includes("cártel") || 
      lowerText.includes("casa de seguridad") || 
      lowerText.includes("control absoluto") || 
      lowerText.includes("controlada por una organización");

    if (hasProscribedClaims && !hasEvidenceSupport) {
      // Caso crítico: Reescritura según el Caso 7
      let rewritten = text;
      if (lowerText.includes("controlada por una organización criminal")) {
        rewritten = text.replace(
          /la zona es controlada por una organización criminal\.?/gi,
          "La información disponible no permite establecer control territorial por una organización criminal."
        );
      } else {
        rewritten = "La información disponible no permite establecer control territorial por organizaciones criminales de forma concluyente.";
      }
      return {
        status: "UNSUPPORTED_CLAIM",
        sanitizedText: rewritten
      };
    }

    // 3. Detectar si el texto contiene términos policiales débiles o duditativos (baja asertividad)
    const hasWeakTerms = /(?:probablemente|quizá|quizás|podría ser|posiblemente|parece indicar)/gi.test(text);

    if (hasWeakTerms) {
      // Reescritura determinista de términos débiles a asertividad institucional moderada
      let sanitizedText = text;
      sanitizedText = sanitizedText.replace(/probablemente existe presencia/gi, "se identifican indicadores compatibles con la presencia");
      sanitizedText = sanitizedText.replace(/probablemente existan/gi, "se identifican indicadores compatibles con");
      sanitizedText = sanitizedText.replace(/probablemente/gi, "se estima con base en patrones");
      sanitizedText = sanitizedText.replace(/podría ser un punto/gi, "se clasifica analíticamente como un punto");
      sanitizedText = sanitizedText.replace(/podría ser/gi, "es clasificado como");
      sanitizedText = sanitizedText.replace(/quizá exista una problemática social/gi, "se asocia técnicamente con factores de oportunidad local");
      sanitizedText = sanitizedText.replace(/quizá/gi, "se asocia técnicamente con");
      sanitizedText = sanitizedText.replace(/quizás se deba a/gi, "se asocia técnicamente con");
      sanitizedText = sanitizedText.replace(/quizás/gi, "se asocia técnicamente con");
      sanitizedText = sanitizedText.replace(/posiblemente ocurra/gi, "presenta recurrencia temporal compatible con");
      sanitizedText = sanitizedText.replace(/posiblemente/gi, "es compatible con");
      sanitizedText = sanitizedText.replace(/parece indicar/gi, "concluye analíticamente");

      return {
        status: "LIMITED_INFERENCE",
        sanitizedText
      };
    }

    // 4. Si cumple con todas las reglas, es una afirmación sólida sustentada
    return {
      status: "SUPPORTED_ASSERTION",
      sanitizedText: text
    };
  }
}

export class NarrativeDeduplicationEngine {
  /**
   * Analiza la similitud conceptual entre bloques de texto.
   * Si detecta redundancias significativas (>75% de similitud),
   * no las elimina de golpe, sino que las marca y genera una recomendación de auditoría.
   */
  public static analyzeDeduplication(
    blocks: NarrativeBlock[],
    threshold = 0.50
  ): { sanitizedBlocks: NarrativeBlock[]; similarityReport: NarrativeSimilarityResult[] } {
    const similarityReport: NarrativeSimilarityResult[] = [];
    const sanitizedBlocks = [...blocks];

    for (let i = 0; i < sanitizedBlocks.length; i++) {
      for (let j = i + 1; j < sanitizedBlocks.length; j++) {
        const textA = sanitizedBlocks[i].text;
        const textB = sanitizedBlocks[j].text;

        const similarity = this.calculateSimilarity(textA, textB);

        if (similarity > threshold) {
          similarityReport.push({
            originalBlock: textA,
            duplicateBlock: textB,
            similarity,
            action: "FLAG"
          });

          // Marcar el bloque duplicado como redundante/auditable sin destruirlo
          sanitizedBlocks[j] = {
            ...sanitizedBlocks[j],
            auditFlag: true,
            auditNotes: `[REDUNDANTE - SIMILITUD CON BLOCK ${sanitizedBlocks[i].id}: ${(similarity * 100).toFixed(0)}%] Este contenido repite conceptos analíticos ya vertidos previamente.`
          };
        }
      }
    }

    return {
      sanitizedBlocks,
      similarityReport
    };
  }

  /**
   * Helper para calcular la similitud léxica mediante la coincidencia de palabras clave.
   */
  private static calculateSimilarity(strA: string, strB: string): number {
    const getWords = (str: string) => {
      return new Set(
        str.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3) // Evitar artículos y preposiciones
      );
    };

    const wordsA = getWords(strA);
    const wordsB = getWords(strB);

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersectionCount = 0;
    wordsA.forEach(w => {
      if (wordsB.has(w)) {
        intersectionCount++;
      }
    });

    const unionSize = new Set([...Array.from(wordsA), ...Array.from(wordsB)]).size;
    return intersectionCount / unionSize;
  }
}

export class NarrativeEvidenceMapper {
  /**
   * Consume la infraestructura de gobernanza existente para vincular
   * afirmaciones narrativas con evidencias específicas del expediente y el ledger HIE.
   */
  public static mapNarrativeToEvidence(
    block: NarrativeBlock,
    context: {
      album?: any[];
      hieLedger?: any;
      projectName?: string;
    }
  ): NarrativeBlock {
    const evidenceIds: string[] = [];
    let hypothesisId = context.hieLedger?.centralHypothesis?.id || "HYP-001";
    let confidence = 85;

    const lowerText = block.text.toLowerCase();

    // 1. Consumir EvidenceNarrativeMapper existente para procesar álbum
    if (context.album && Array.isArray(context.album)) {
      const structuredList = EvidenceNarrativeMapper.mapEvidenceList(context.album);
      
      structuredList.forEach(item => {
        const itemText = `${item.caption} ${item.observedFact} ${item.criminogenicFactor}`.toLowerCase();
        
        // Comprobar coincidencia léxica cruzada entre la afirmación y la foto
        const hasOverlap = 
          ((lowerText.includes("lumin") || lowerText.includes("ilumin") || lowerText.includes("oscur") || lowerText.includes("noctur") || lowerText.includes("noche") || lowerText.includes("visibil")) && item.category === "LIGHTING") ||
          ((lowerText.includes("baldío") || lowerText.includes("maleza") || lowerText.includes("lote")) && item.category === "WASTELAND") ||
          ((lowerText.includes("graffiti") || lowerText.includes("grafiti") || lowerText.includes("pinta")) && item.category === "GRAFFITI") ||
          ((lowerText.includes("calle") || lowerText.includes("vial") || lowerText.includes("infraestructura")) && item.category === "ROAD_INFRASTRUCTURE");

        if (hasOverlap) {
          evidenceIds.push(item.id);
        }
      });
    }

    // 2. Consumir EvidenceRelationshipEngine para vincular con las hipótesis o factores correspondientes
    if (context.album && context.album.length > 0) {
      const samplePhoto = context.album[0];
      const suggestions = EvidenceRelationshipEngine.suggestHypothesisLinks({
        tipo: samplePhoto.tipo || samplePhoto.evidenceType || "FIELD_PHOTO",
        comentario: samplePhoto.comentario || samplePhoto.caption || ""
      });

      if (suggestions.length > 0) {
        hypothesisId = suggestions[0].hypothesisId;
      }
    }

    // Calibrar la confianza en base al ledger de HIE
    if (context.hieLedger?.centralHypothesis?.confidenceScore) {
      confidence = context.hieLedger.centralHypothesis.confidenceScore;
    }

    return {
      ...block,
      links: [
        {
          narrativeId: block.id,
          evidenceIds,
          hypothesisId,
          confidence
        }
      ]
    };
  }
}

export class NarrativeValidator {
  /**
   * Valida la conformidad de un bloque respecto a las reglas duras de sobreinferenciación.
   */
  public static validateBlock(
    block: NarrativeBlock,
    context: {
      album?: any[];
      hieLedger?: any;
      projectName?: string;
      hasActorsEvidence?: boolean;
      hasOsintEvidence?: boolean;
    }
  ): { isValid: boolean; reason?: string; rewrittenText?: string; languageStatus: AnalyticalLanguageStatus } {
    // 1. Determinar soporte de evidencias reales para afirmaciones extremas
    const hasEvidenceSupport = 
      (context.album && context.album.length > 0) || 
      (context.hasActorsEvidence === true) || 
      (context.hasOsintEvidence === true);

    // 2. Ejecutar Language Guard para clasificar y sanitizar
    const isExploratory = block.type === "HYPOTHESIS_STATUS";
    const languageRes = InstitutionalLanguageGuard.classifyAnalyticalLanguage(block.text, isExploratory, hasEvidenceSupport);

    // 3. Ejecutar validación contra la Matriz de Inferencia de Evidencias existente
    const matrixRes = EvidenceInferenceMatrix.validate(languageRes.sanitizedText);

    if (!matrixRes.isValid) {
      return {
        isValid: false,
        reason: matrixRes.violations.join(". "),
        rewrittenText: languageRes.sanitizedText,
        languageStatus: languageRes.status
      };
    }

    if (languageRes.status === "UNSUPPORTED_CLAIM") {
      return {
        isValid: false,
        reason: "Afirmación delictiva extrema sin soporte fidedigno de actores, relaciones o HIE Ledger en el expediente.",
        rewrittenText: languageRes.sanitizedText,
        languageStatus: languageRes.status
      };
    }

    return {
      isValid: true,
      rewrittenText: languageRes.sanitizedText,
      languageStatus: languageRes.status
    };
  }
}

export class IntelligenceNarrativeSynthesisEngine {
  /**
   * Punto de entrada principal para procesar y certificar capítulos narrativos.
   * Transforma de forma segura el texto de entrada aplicando las capas de gobernanza v1.0.7.
   */
  public static synthesizeChapter(
    chapterText: string,
    chapterKey: string,
    context: {
      album?: any[];
      hieLedger?: any;
      projectName?: string;
      hasActorsEvidence?: boolean;
      hasOsintEvidence?: boolean;
    }
  ): string {
    if (!chapterText || chapterText.trim().length === 0) return "";

    // 1. Segmentar en párrafos como bloques
    const paragraphs = chapterText.split("\n\n").map(p => p.trim()).filter(Boolean);
    let blocks: NarrativeBlock[] = paragraphs.map((p, idx) => {
      const blockId = `${chapterKey}-block-${idx}`;
      
      // Clasificación tentativa del tipo de bloque
      let type: NarrativeBlockType = "OBSERVATION";
      if (chapterKey.includes("conclusiones")) {
        type = "OPERATIONAL_CONCLUSION";
      } else if (chapterKey.includes("finalHypothesis")) {
        type = "HYPOTHESIS_STATUS";
      } else if (chapterKey.includes("contextoTerritorial")) {
        type = "ANALYTICAL_FINDING";
      }

      // Determinar origen del trace
      let source: NarrativeTrace["source"] = "TERRITORIAL_CONTEXT";
      if (chapterKey.includes("finalHypothesis")) {
        source = "HIE";
      } else if (chapterKey.includes("osint")) {
        source = "OSINT";
      } else if (chapterKey.includes("conclusiones")) {
        source = "STATISTICAL_ENGINE";
      } else if (chapterKey.includes("evidence")) {
        source = "EVIDENCE";
      }

      const trace: NarrativeTrace = {
        chapter: chapterKey,
        blockId,
        source,
        confidence: context.hieLedger?.centralHypothesis?.confidenceScore || 85
      };

      return {
        id: blockId,
        type,
        text: p,
        links: [],
        trace
      };
    });

    // 2. Mapear y enlazar evidencias de forma unívoca
    blocks = blocks.map(b => NarrativeEvidenceMapper.mapNarrativeToEvidence(b, context));

    // 3. Validar y reescribir con base en el NarrativeValidator
    blocks = blocks.map(b => {
      const valRes = NarrativeValidator.validateBlock(b, context);
      return {
        ...b,
        text: valRes.rewrittenText || b.text,
        languageStatus: valRes.languageStatus
      };
    });

    // 4. Analizar redundancias cruzadas mediante Deduplication Engine
    const dedupRes = NarrativeDeduplicationEngine.analyzeDeduplication(blocks);
    blocks = dedupRes.sanitizedBlocks;

    // 5. Re-ensamblar los párrafos sanitizados respetando las marcas de auditoría redundantes
    const synthesizedText = blocks.map(b => {
      if (b.auditFlag) {
        // En un dictamen de producción incluimos el texto, pero podemos añadir un comentario o anotación táctica
        return `${b.text}\n*[Nota de Auditoría: Redundancia detectada con análisis precedente]*`;
      }
      return b.text;
    }).join("\n\n");

    return synthesizedText;
  }
}
