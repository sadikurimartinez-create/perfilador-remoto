/**
 * AIOutputSanitizerEngine - Motor de Sanitización de Salidas de IA para la SSPE-CEIPOL.
 * Protege la confidencialidad, filtra la jerga técnica y errores de API, y asegura la consistencia lingüística institucional.
 */

export type SanitizerMode = "DOCUMENT_PUBLICATION" | "DATA_PROCESSING";

export class AIOutputSanitizerEngine {
  // Lista de términos prohibidos de marcas / APIs y sus correspondientes transformaciones institucionales
  private static BRAND_TRANSFORMATIONS: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bGemini\s*(?:[\d.]+\s*(?:Flash|Pro|Ultra)?)?\b/gi, replacement: "el motor de inteligencia artificial" },
    { pattern: /\bOpenAI\s*(?:GPT(?:-[\d\w.]+)?|ChatGPT)?\b/gi, replacement: "el sistema de procesamiento de lenguaje natural" },
    { pattern: /\bVertex\s*(?:AI)?\b/gi, replacement: "la plataforma de modelado predictivo de inteligencia artificial" },
    { pattern: /\bgenerativelanguage\b/gi, replacement: "tecnología de procesamiento de lenguaje" },
    { pattern: /\bGPT-?4o?\b/gi, replacement: "el modelo analítico avanzado" }
  ];

  // Términos que denotan fallas de API / Red y que deben gatillar el fallback completo
  private static CRITICAL_ERROR_TERMS = [
    "error 429", "429", "quota exceeded", "quota", "500", "503", "unauthorized",
    "timeout", "retrydelay", "stacktrace", "exception", "at line", "syntaxerror",
    "unhandled", "failed to fetch", "internal server error", "api response",
    "bad gateway", "gateway timeout"
  ];

  // Fallback oficial unificado
  public static OFFICIAL_FALLBACK = `[Información analítica no disponible durante procesamiento automático]

El módulo correspondiente no afecta la integridad del dictamen principal.`;

  /**
   * Sanitiza un texto plano basándose en el modo de publicación del documento.
   */
  public static sanitize(text: string, mode: SanitizerMode = "DOCUMENT_PUBLICATION"): string {
    if (!text || typeof text !== "string") return text;

    const lowerText = text.toLowerCase();

    // 1. Detectar errores de API/Infraestructura reales o volcados de pila
    const containsCriticalError = this.CRITICAL_ERROR_TERMS.some(term => {
      // Evitar que números normales como "500 metros" gatillen el error por "500"
      if (term === "500") {
        return /\b500\b/.test(lowerText) && !/\b500\s*(?:metros|m\b|eventos|llamadas)\b/i.test(lowerText);
      }
      return lowerText.includes(term);
    });

    // Detectar si el texto parece JSON crudo proveniente de un volcado de error de API
    const isRawJsonError = lowerText.startsWith("{") && (lowerText.includes("error") || lowerText.includes("status") || lowerText.includes("message"));

    if (containsCriticalError || isRawJsonError) {
      console.warn("[AIOutputSanitizerEngine] Se detectó un error técnico o fuga de API. Aplicando fallback de gobernanza.");
      return this.OFFICIAL_FALLBACK;
    }

    // 2. Ejecutar transformaciones de marcas (DOCUMENT_PUBLICATION)
    if (mode === "DOCUMENT_PUBLICATION") {
      let sanitizedText = text;
      for (const { pattern, replacement } of this.BRAND_TRANSFORMATIONS) {
        sanitizedText = sanitizedText.replace(pattern, replacement);
      }
      return sanitizedText;
    }

    return text;
  }

  /**
   * Sanitiza recursivamente cualquier objeto o estructura de datos (Payload)
   */
  public static sanitizeObject<T>(obj: T, mode: SanitizerMode = "DOCUMENT_PUBLICATION"): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "string") {
      return this.sanitize(obj, mode) as any;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, mode)) as any;
    }

    if (typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Omitir sanitización de campos que representen buffers o datos binarios
          if (key === "dataUrl" || key === "image" || key === "previewUrl" || key === "data") {
            result[key] = obj[key];
          } else {
            result[key] = this.sanitizeObject(obj[key], mode);
          }
        }
      }
      return result as T;
    }

    return obj;
  }
}
