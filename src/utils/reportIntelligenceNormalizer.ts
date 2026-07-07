/**
 * ReportIntelligenceNormalizer - Módulo para depurar lenguaje crudo de la IA
 * y convertirlo a un estándar institucional formal.
 */
export class ReportIntelligenceNormalizer {
  /**
   * Normaliza y depura el texto de la IA para adaptarlo al estándar institucional SSPE-CEIPOL.
   */
  public static normalize(text: string): string {
    if (!text) return "";

    let cleaned = text;

    // 1. Eliminar etiquetas técnicas / brackets prohibidos
    const forbiddenLabels = [
      /\[Hecho observado\]/gi,
      /\[Hecho observado\]:/gi,
      /\[Inferencia analítica\]/gi,
      /\[Inferencia analítica\]:/gi,
      /\[Inferencia analitica\]/gi,
      /\[Inferencia analitica\]:/gi,
      /\[Sintetizado\]/gi,
      /\[Sintetizado\]:/gi,
      /\[Recomendación operativa\]/gi,
      /\[Recomendación operativa\]:/gi,
      /\[Recomendacion operativa\]/gi,
      /\[Recomendacion operativa\]:/gi,
      /\[Acción Inmediata[^\]]*\]/gi,
      /\[Acción Preventiva[^\]]*\]/gi,
      /\[Acción Estratégica[^\]]*\]/gi,
      /Ejecuta Visuales/gi,
      /PowerUp OCR/gi,
      /PowerUp[s]?/gi,
      /OCR Avanzado y Extracción de Atributos/gi,
      /Análisis de Diarización y Sentimiento/gi,
      /Consulta de Proximidad ST_DWithin y Grounding Dinámico/gi,
      /Activa Extracción de Entidades Salientes/gi,
      /Despliega Búsqueda Semántica en Discovery Engine/gi,
      /ST_DWithin/gi,
      /Discovery Engine/gi,
      /Grounding Dinámico/gi,
      /Grounding/gi,
      /OCR/gi,
      /APIs?/gi,
      /hash(es)?/gi,
      /IDs? internos/gi,
      /SWEEP/gi,
      /PROJECT/gi,
      /prompts?/gi,
      /instrucciones IA/gi,
      /comandos técnicos/gi,
      /funciones/gi,
      /logs/gi,
      /\[Logs omitidos por regla de consistencia ejecutiva\]/gi
    ];

    for (const regex of forbiddenLabels) {
      cleaned = cleaned.replace(regex, "");
    }

    // 2. Eliminar marcas de Markdown (como asteriscos de negrita/cursiva, backticks, rayas horizontales)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1"); // Quitar negritas **
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");    // Quitar cursivas *
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");      // Quitar backticks `
    cleaned = cleaned.replace(/_{2,}/g, "");            // Quitar rayas horizontales __

    // 3. Traducir texto IA a lenguaje institucional formal y descriptivo
    cleaned = cleaned.replace(/deterioro urbano y la desorganización ambiental/gi, "una convergencia de factores ambientales asociados a pérdida de vigilancia natural, deterioro físico y reducción del control social informal, condiciones que incrementan la oportunidad criminológica");
    cleaned = cleaned.replace(/deterioro urbano y desorganización ambiental/gi, "una convergencia de factores ambientales asociados a pérdida de vigilancia natural, deterioro físico y reducción del control social informal, condiciones que incrementan la oportunidad criminológica");
    cleaned = cleaned.replace(/deterioro urbano/gi, "factores de vulnerabilidad en la infraestructura urbana y pérdida de mantenimiento del entorno");
    cleaned = cleaned.replace(/desorganización ambiental/gi, "debilitamiento en el control informal y la vigilancia pasiva del entorno");
    
    cleaned = cleaned.replace(/oportunidad delictiva/gi, "oportunidad criminológica");
    cleaned = cleaned.replace(/delito de oportunidad/gi, "vulnerabilidades de oportunidad criminológica");

    cleaned = cleaned.replace(/(generan|genera|causan|causa) delincuencia/gi, "incrementa la vulnerabilidad y la facilitación criminal");
    cleaned = cleaned.replace(/(generan|genera|causan|causa) inseguridad/gi, "eleva el nivel de riesgo y la percepción de vulnerabilidad");

    cleaned = cleaned.replace(/pandillas en la zona/gi, "dinámicas territoriales asociadas a grupos de atención especial");
    cleaned = cleaned.replace(/pandilla/gi, "grupo de atención especial o de riesgo");

    cleaned = cleaned.replace(/inmueble abandonado|casa abandonada/gi, "estructura deshabitada con deficiencias de cerramiento y pérdida de control propietario");

    cleaned = cleaned.replace(/falta de luz|no hay luz|sin iluminación/gi, "déficit en la cobertura de alumbrado público que limita la vigilancia natural");

    cleaned = cleaned.replace(/rutas de escape|ruta de escape/gi, "vías de escape secundarias con escasa visibilidad y control físico");

    cleaned = cleaned.replace(/puntos de ocultamiento|punto de ocultamiento/gi, "espacios de baja vigilancia y facilitación de ocultamiento");

    cleaned = cleaned.replace(/deterioro social/gi, "debilitamiento del tejido social y del control informal");

    // Limpieza de espacios y saltos de línea repetidos
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
  }
}
