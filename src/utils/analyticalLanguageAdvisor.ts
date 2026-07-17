/**
 * AnalyticalLanguageAdvisor - Detector y recomendador de lenguaje analítico institucional SSPE-CEIPOL
 * Identifica términos policiales proscritos y sugiere o realiza conversiones preventivas para la salida documental,
 * evitando alterar de forma destructiva los textos narrativos internos del análisis original.
 */
export interface LinguisticCorrection {
  original: string;
  replacedWith: string;
}

export class AnalyticalLanguageAdvisor {
  private static CONVERSIONS: Record<string, string> = {
    "control territorial de la organización": "concentración de factores ambientales de oportunidad",
    "zona dominada por": "sector bajo análisis situacional",
    "presencia confirmada de grupo criminal": "dinámicas territoriales asociadas a grupos de riesgo",
    "operación del cártel": "actividad focalizada bajo estudio de geointeligencia",
    "la pandilla utiliza": "el grupo de atención especial se asocia con",
    "los delincuentes operan": "se registran conductas disonantes",
    "célula criminal": "patrón de comportamiento focalizado",
    "célula operativa": "grupo de atención especial focalizado",
    "control territorial": "concentración espacial de eventos y patrones compatibles que requieren validación investigativa",
    "zona de operation": "sector con persistencia delictiva",
    "zona de operación": "sector con persistencia delictiva",
    "plaza criminal": "cuadrante con factores de oportunidad ambiental",
    "halcones": "observadores informales no autorizados",
    "punto de venta": "espacio facilitador de conductas disonantes",
    "casa de seguridad": "estructura deshabitada con posible uso atípico",
    "narcomenudeo activo": "indicadores de distribución localizada de sustancias",
    "presencia del cártel": "dinámicas de atención delictiva especial"
  };

  /**
   * Escanea el texto y detecta si contiene términos proscritos, sugiriendo correcciones.
   * No modifica directamente, sino que devuelve la propuesta y los registros de correcciones.
   */
  public static adviseAndCorrect(text: string): {
    correctedText: string;
    corrections: LinguisticCorrection[];
  } {
    if (!text) return { correctedText: "", corrections: [] };

    let correctedText = text;
    const corrections: LinguisticCorrection[] = [];

    // Ordenar llaves de mayor a menor longitud para evitar problemas con sub-cadenas (p.ej. "control territorial de la organización" antes de "control territorial")
    const terms = Object.keys(this.CONVERSIONS).sort((a, b) => b.length - a.length);

    for (const term of terms) {
      // Usar coincidencia literal insensible a mayúsculas
      const regex = new RegExp(term, "gi");
      if (regex.test(correctedText)) {
        const replacement = this.CONVERSIONS[term];
        correctedText = correctedText.replace(regex, replacement);
        corrections.push({ original: term, replacedWith: replacement });
      }
    }

    return { correctedText, corrections };
  }
}
