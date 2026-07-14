import { HIEValidationVector } from "./models/aceTypes";

export class HIEValidationVectorAdapter {
  /**
   * Adapta la hipótesis cualitativa del HIE y la descripción del proyecto a un vector estructurado semántico HIEValidationVector.
   * Esto previene que el motor ACE tenga que realizar análisis de lenguaje natural o texto libre directamente.
   */
  public static adapt(hypothesisText: string = "", projectDescription: string = ""): HIEValidationVector {
    const text = `${hypothesisText} ${projectDescription}`.toUpperCase();

    // 1. Mapeo de Patrón Espacial (spatialPattern)
    let spatialPattern: HIEValidationVector["spatialPattern"] = "STABLE";
    if (
      text.includes("CONCENTRA") ||
      text.includes("CLUSTER") ||
      text.includes("AGRUPA") ||
      text.includes("HOTSPOT") ||
      text.includes("NÚCLEO") ||
      text.includes("PATRÓN DE CONCENTRACIÓN")
    ) {
      spatialPattern = "CONCENTRATED";
    } else if (
      text.includes("DISPERS") ||
      text.includes("ALEATORI") ||
      text.includes("DIFUS") ||
      text.includes("DISTRIBUIDO")
    ) {
      spatialPattern = "DISPERSED";
    } else if (text.includes("UNIFORME") || text.includes("HOMOGÉNE")) {
      spatialPattern = "UNIFORM";
    }

    // 2. Mapeo de Patrón Temporal (temporalPattern)
    let temporalPattern: HIEValidationVector["temporalPattern"] = "STABLE";
    if (
      text.includes("ESTACION") ||
      text.includes("TEMPORAD") ||
      text.includes("FIN DE SEMANA") ||
      text.includes("MENSUAL") ||
      text.includes("SEMANAL") ||
      text.includes("CICLO")
    ) {
      temporalPattern = "SEASONAL";
    } else if (
      text.includes("TENDENCIA") ||
      text.includes("CRECIENTE") ||
      text.includes("INCREMENTO") ||
      text.includes("DECRECIENTE") ||
      text.includes("SEN-THEIL") ||
      text.includes("THEIL-SEN")
    ) {
      temporalPattern = "TRENDING";
    }

    // 3. Mapeo de Oportunidad Crítica (criticalOpportunity)
    let criticalOpportunity: HIEValidationVector["criticalOpportunity"] = "MEDIUM";
    if (
      text.includes("ALTA OPORTUNIDAD") ||
      text.includes("RIESGO ALTO") ||
      text.includes("VULNERABILIDAD ALTA") ||
      text.includes("FACILITADOR CRÍTICO") ||
      text.includes("ALTA DEBILIDAD")
    ) {
      criticalOpportunity = "HIGH";
    } else if (
      text.includes("BAJA OPORTUNIDAD") ||
      text.includes("RIESGO BAJO") ||
      text.includes("VULNERABILIDAD BAJA") ||
      text.includes("SEGURA")
    ) {
      criticalOpportunity = "LOW";
    }

    return {
      spatialPattern,
      temporalPattern,
      criticalOpportunity
    };
  }
}
