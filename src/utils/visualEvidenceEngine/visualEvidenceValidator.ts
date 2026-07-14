export class VisualEvidenceValidator {
  /**
   * Valida que no se filtren coordenadas geográficas ni términos técnicos en capas editoriales.
   */
  static validateEditorialSanitization(payload: any): { isValid: boolean; message?: string } {
    const textToScan = JSON.stringify(payload);

    // Patrón regex para decimales característicos de coordenadas (ej: 21.80929 o -102.26964)
    const coordPattern = /\b\d{2}\.\d{4,}\b|\b-\d{2,3}\.\d{4,}\b/g;
    
    // Términos etiquetadores sensibles prohibidos en Word
    const labelPattern = /\b(lat|lng|latitude|longitude|coordinates|coordenadas|coordenada)\b/i;

    if (coordPattern.test(textToScan) || labelPattern.test(textToScan)) {
      return {
        isValid: false,
        message: "Información geográfica sensible detectada en capa editorial"
      };
    }

    return { isValid: true };
  }

  /**
   * Audita que la IA no realice inferencias delictivas subjetivas basadas puramente en imágenes (No-alucinación visual).
   */
  static validateVisualInference(narrative: string): { isValid: boolean; message?: string } {
    const text = (narrative || "").toLowerCase();

    // Frases prohibidas que representan conclusiones de delincuencia directa sin bases estadísticas
    const forbiddenPatterns = [
      "venta de drogas",
      "punto de venta",
      "punto delincuencial",
      "zona utilizada por delincuentes",
      "zona de drogadictos",
      "presencia criminal",
      "lugar de asaltantes",
      "operación de pandillas",
      "nido de criminales"
    ];

    for (const pattern of forbiddenPatterns) {
      if (text.includes(pattern)) {
        return {
          isValid: false,
          message: `Unsupported visual inference: La narrativa infiere actividad criminal subjetiva ("${pattern}").`
        };
      }
    }

    return { isValid: true };
  }
}
