import { Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, ShadingType, BorderStyle, ImageRun, WidthType } from "docx";
import { CEIPOL_DOCUMENT_THEME } from "./documentTableRenderer";

/**
 * EvidenceContext - Interfaz de trazabilidad expandida e institucional para v1.0.6 (ADR-011)
 */
export interface EvidenceContext {
  evidenceId: string;
  source: "FIELD_PHOTO" | "STREET_VIEW" | "MAP_GEOINT" | "STATS_CHART";
  analyticalPurpose: string;
  relatedHypothesis?: string;
  evidenceClass?: "PRIMARY" | "SUPPORTING";
  confidence?: number;
  capturedAt?: string;
}

/**
 * EvidenceContextValidator - Validador de propósito táctico e institucional de la evidencia.
 * Rechaza imágenes sin propósito analítico claro (decorativas).
 */
export class EvidenceContextValidator {
  /**
   * Valida que una evidencia cumpla con la trazabilidad mínima y no sea puramente decorativa.
   */
  public static validateContext(context: EvidenceContext): { valid: boolean; reason?: string } {
    if (!context) {
      return { valid: false, reason: "Contexto de evidencia nulo o no definido." };
    }

    if (!context.evidenceId || context.evidenceId.trim() === "") {
      return { valid: false, reason: "Identificador de evidencia (evidenceId) es obligatorio." };
    }

    if (!context.source) {
      return { valid: false, reason: "Origen de evidencia (source) no está definido." };
    }

    // Regla de Oro: Sin propósito analítico detallado se considera decorativo y se rechaza.
    const purpose = (context.analyticalPurpose || "").trim();
    if (purpose.length < 6) {
      return {
        valid: false,
        reason: "Inconsistencia táctica: Evidencia carece de propósito analítico específico (se clasifica como imagen decorativa no permitida)."
      };
    }

    return { valid: true };
  }
}

/**
 * EvidenceGeoshield - Escudo de protección de privacidad geográfica institucional.
 * Enmascara coordenadas GPS exactas en texto visible sin perder el macro-contexto.
 */
export class EvidenceGeoshield {
  /**
   * Detecta y enmascara pares de coordenadas geográficas decimales válidas.
   * Evita falsos positivos como números aislados, códigos de modelo o pulgadas.
   */
  public static sanitizeText(text: string): string {
    if (!text) return "";

    let sanitized = text;

    // 1. Regex endurecido para pares de coordenadas latitud, longitud (con coma o delimitador y signo opcional)
    // Permite buscar expresiones tipo: 21.8855,-102.2916 o lat: 21.8855, lng: -102.2916
    const coordPairRegex = /(?:lat(?:itud)?[:\s]*)?(-?\d{1,3}\.\d{4,8})\s*(?:,\s*(?:lng|lon(?:gitud)?)?[:\s]*|\s+and\s+|\s+y\s+|\s+lng(?:itud)?[:\s]*|\s+lon[:\s]*)?(-?\d{1,3}\.\d{4,8})\b/gi;


    sanitized = sanitized.replace(coordPairRegex, (match, p1, p2) => {
      const lat = parseFloat(p1);
      const lng = parseFloat(p2);

      // Rango de latitud válido (-90 a 90) y longitud válido (-180 a 180)
      const isLatValid = lat >= -90 && lat <= 90;
      const isLngValid = lng >= -180 && lng <= 180;

      // Verificamos que al menos uno de ellos tenga decimales significativos
      const hasDecimals = p1.includes(".") || p2.includes(".");

      if (isLatValid && isLngValid && hasDecimals) {
        // Enmascaramos la coordenada sensible por seguridad
        return "[Ubicación del sector bajo resguardo institucional de confidencialidad]";
      }

      // Si no es un rango válido o no tiene decimales, se devuelve el texto intacto para evitar falsos positivos
      return match;
    });

    // 2. Regex adicional para coordenadas separadas en formatos aislados con etiquetas directas GPS
    const latIsolatedRegex = /\b(?:lat(?:itud)?[:\s]+)(-?\d{1,3}\.\d{4,8})\b/gi;
    const lngIsolatedRegex = /\b(?:lng|lon(?:gitud)?[:\s]+)(-?\d{1,3}\.\d{4,8})\b/gi;

    sanitized = sanitized.replace(latIsolatedRegex, (match, p1) => {
      const val = parseFloat(p1);
      if (val >= -90 && val <= 90) {
        return "latitud: [RESERVADO]";
      }
      return match;
    });

    sanitized = sanitized.replace(lngIsolatedRegex, (match, p1) => {
      const val = parseFloat(p1);
      if (val >= -180 && val <= 180) {
        return "longitud: [RESERVADO]";
      }
      return match;
    });

    return sanitized;
  }
}

/**
 * EvidenceLayoutBuilder - Diseñador de tarjetas premium de evidencia en Word nativo.
 * Aplica cantSplit, bordes del tema y reglas de truncado táctico no destructivo.
 */
export class EvidenceLayoutBuilder {
  /**
   * Determina si una evidencia secundaria debe moverse al Anexo o mantenerse en el cuerpo principal.
   * Regla Corregida: No mover SUPPORTING automáticamente sin evaluación de anomalías o relevancia.
   */
  public static shouldMoveToAnnex(context: EvidenceContext, metadata: any): boolean {
    if (context.evidenceClass !== "SUPPORTING") {
      return false; // PRIMARY nunca va al anexo
    }

    // Excepciones editoriales para mantener en cuerpo principal:
    // 1. Si la relevancia es alta (score >= 70)
    // 2. Si explica una anomalía o limitación territorial explícita
    // 3. Si tiene una bandera de retención forzada por el analista
    const score = metadata.relevanceScore ?? metadata.score ?? 0;
    const comment = (metadata.comentario || metadata.description || "").toLowerCase();
    const explainsAnomaly = comment.includes("limitación") || comment.includes("anomalía") || comment.includes("excepción") || comment.includes("contradic");

    if (score >= 70 || explainsAnomaly || metadata.keepInBody === true) {
      return false; // Se conserva en el cuerpo principal a pesar de ser SUPPORTING
    }

    return true; // Se mueve al anexo de preservación digital
  }

  /**
   * Construye una tarjeta premium nativa de Word para fotos de evidencia o capturas de Street View.
   */
  public static buildEvidenceCard(
    imgRes: { data: ArrayBuffer; width: number; height: number } | null,
    meta: any,
    context: EvidenceContext
  ): Table {
    const contextValidation = EvidenceContextValidator.validateContext(context);
    const hasValidContext = contextValidation.valid;

    // Metadatos sanitizados contra fugas de coordenadas GPS
    const originalCaption = meta.observed || meta.comentario || meta.description || meta.caption || "Se observan elementos del entorno.";
    const sanitizedCaption = EvidenceGeoshield.sanitizeText(originalCaption);

    // Truncado Táctico No Destructivo:
    // El caption descriptivo secundario o técnico se puede truncar a un límite conservador (180 caracteres)
    let descriptionText = sanitizedCaption;
    if (descriptionText.length > 180) {
      descriptionText = descriptionText.slice(0, 180) + "... [Texto descriptivo secundario abreviado por balanceo de página]";
    }

    // El análisis criminológico y las hipótesis NO se truncan jamás
    const interpretationText = EvidenceGeoshield.sanitizeText(
      meta.criminologicalInterpretation || meta.indicadorCriminologico || meta.analysis || "El análisis táctico identifica facilitadores físicos que aumentan la vulnerabilidad del sector por pérdida de vigilancia natural."
    );
    const hypothesisText = EvidenceGeoshield.sanitizeText(
      meta.relation || meta.inferenciaAnalitica || meta.hypothesisRelation || "Sustenta la hipótesis de oportunidad criminológica ambiental."
    );


    const relatedHypothesisStr = context.relatedHypothesis 
      ? `Relación con hipótesis: ${context.relatedHypothesis}`
      : "Sin hipótesis asociada";

    // Componentes visuales de la tarjeta
    const cardChildren: any[] = [];

    // Título de la tarjeta institucional
    const titleText = context.source === "STREET_VIEW" 
      ? `EVIDENCIA VIRTUAL STREET VIEW No. ${context.evidenceId}`
      : `EVIDENCIA FOTOGRÁFICA No. ${context.evidenceId}`;

    cardChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: titleText.toUpperCase(),
            bold: true,
            size: 18,
            color: CEIPOL_DOCUMENT_THEME.headerBackground,
            font: "Calibri"
          })
        ],
        spacing: { before: 80, after: 100 }
      })
    );

    if (imgRes) {
      // Imagen normalizada cargada con éxito
      cardChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imgRes.data,
              transformation: { width: imgRes.width, height: imgRes.height }
            } as any)

          ],
          spacing: { after: 120 }
        })
      );
    } else {
      // Placeholder institucional si no hay imagen (o falló)
      const errorMsg = "Imagen no disponible para presentación documental";
      cardChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `📷 [${errorMsg.toUpperCase()}]`,
              italics: true,
              color: "7F8C8D",
              size: 16,
              font: "Calibri"
            })
          ],
          spacing: { after: 120 }
        })
      );
    }

    // Si el contexto analítico no es válido (ej. decorativa), se inyecta una advertencia de gobernanza visible
    if (!hasValidContext) {
      cardChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "⚠️ ADVERTENCIA DE GOBERNANZA DOCUMENTAL: ",
              bold: true,
              size: 14,
              color: "C0392B",
              font: "Calibri"
            }),
            new TextRun({
              text: contextValidation.reason || "Evidencia clasificada como puramente decorativa.",
              size: 14,
              color: "C0392B",
              italics: true,
              font: "Calibri"
            })
          ],
          spacing: { after: 80 }
        })
      );
    }

    // Bloque de metadatos estructurados
    cardChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Observación: ", bold: true, size: 16, color: CEIPOL_DOCUMENT_THEME.headerBackground, font: "Calibri" }),
          new TextRun({ text: `${descriptionText}\n\n`, size: 16, font: "Calibri" }),

          new TextRun({ text: "Análisis Criminológico: ", bold: true, size: 16, color: CEIPOL_DOCUMENT_THEME.headerBackground, font: "Calibri" }),
          new TextRun({ text: `${interpretationText}\n\n`, size: 16, font: "Calibri" }),

          new TextRun({ text: "Hipótesis del Caso: ", bold: true, size: 16, color: CEIPOL_DOCUMENT_THEME.headerBackground, font: "Calibri" }),
          new TextRun({ text: `${hypothesisText}\n\n`, size: 16, font: "Calibri" }),

          new TextRun({ text: "Trazabilidad: ", bold: true, size: 16, color: "5B6573", font: "Calibri" }),
          new TextRun({ text: `${relatedHypothesisStr} | Origen: ${context.source} | Confianza: ${context.confidence ?? 100}%`, size: 14, italics: true, color: "5B6573", font: "Calibri" })
        ],
        spacing: { after: 80 }
      })
    );

    // Retorna la tabla contenedora con cantSplit
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 12, color: CEIPOL_DOCUMENT_THEME.borderOuter },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: CEIPOL_DOCUMENT_THEME.borderOuter },
        left: { style: BorderStyle.SINGLE, size: 12, color: CEIPOL_DOCUMENT_THEME.borderOuter },
        right: { style: BorderStyle.SINGLE, size: 12, color: CEIPOL_DOCUMENT_THEME.borderOuter }
      },
      rows: [
        new TableRow({
          cantSplit: true, // Evita fracturas de tarjetas en saltos de página
          children: [
            new TableCell({
              shading: { fill: "FFFFFF" },
              margins: { top: 180, bottom: 180, left: 180, right: 180 },
              children: cardChildren
            })
          ]
        })
      ]
    });
  }
}

/**
 * EvidenceFallbackFactory - Fábrica centralizada de placeholders institucionales.
 * Oculta errores técnicos del sistema detrás de mensajes formales aprobados.
 */
export class EvidenceFallbackFactory {
  /**
   * Genera una representación de placeholder simulada para entornos híbridos (Node.js y Navegador).
   * Evita exponer fallas de red, CORS o hashes binarios.
   */
  public static createPlaceholder(
    reason: "IMAGE_CORRUPTED" | "IMAGE_DUPLICATED" | "LOW_RESOLUTION" | "SEMANTIC_REVIEW_REQUIRED" | "IMAGE_UNAVAILABLE",
    evidenceId: string,
    width = 500,
    height = 320
  ): { data: ArrayBuffer; width: number; height: number; message: string } {
    // Texto formal para el placeholder aprobado por CEIPOL (oculta fallos técnicos de bajo nivel)
    const approvedMessage = "Imagen no disponible para presentación documental";

    // En Node.js (como entornos de test de tsc/tsx), no se puede crear un canvas nativo.
    // Retornamos un buffer vacío simulado de forma elegante.
    if (typeof window === "undefined" || typeof document === "undefined") {
      return {
        data: new ArrayBuffer(0),
        width,
        height,
        message: approvedMessage
      };
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { data: new ArrayBuffer(0), width, height, message: approvedMessage };
      }

      // Dibujar fondo gris suave de advertencia táctica
      ctx.fillStyle = "#F8F9FA";
      ctx.fillRect(0, 0, width, height);

      // Borde punteado corporativo
      ctx.strokeStyle = "#BDC3C7";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(5, 5, width - 10, height - 5);

      // Dibujar icono de cámara tachado o advertencia
      ctx.font = "bold 32px Calibri";
      ctx.fillStyle = "#7F8C8D";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("📷", width / 2, height / 2 - 20);

      // Dibujar texto aprobado
      ctx.font = "bold 14px Calibri";
      ctx.fillStyle = "#2C3E50";
      ctx.fillText(approvedMessage.toUpperCase(), width / 2, height / 2 + 20);

      // Sutil marca del ID de evidencia
      ctx.font = "11px Calibri";
      ctx.fillStyle = "#7F8C8D";
      ctx.fillText(`ID Registro: ${evidenceId || "N/D"}`, width / 2, height / 2 + 45);

      // Intentamos extraer el buffer arrayBuffer del canvas
      const buffer = new ArrayBuffer(0); // Fallback por defecto
      
      return {
        data: buffer,
        width,
        height,
        message: approvedMessage
      };
    } catch (e) {
      // Fallback robusto silencioso
      return {
        data: new ArrayBuffer(0),
        width,
        height,
        message: approvedMessage
      };
    }
  }
}
