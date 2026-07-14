import { VisualEvidenceInternal } from "./models/visualEvidenceTypes";

export class GraffitiDetector {
  /**
   * Detecta y analiza la densidad e indicadores de grafiti territorial.
   */
  static detect(allEvidence: VisualEvidenceInternal[]): {
    isActive: boolean;
    graffitiEvidence: VisualEvidenceInternal[];
    narrative: string;
  } {
    // Filtrar evidencias que contengan indicios de grafiti
    const rawGraffiti = allEvidence.filter(e => {
      const text = (e.observation || "").toLowerCase();
      const isGraffitiText =
        text.includes("grafiti") ||
        text.includes("graffiti") ||
        text.includes("rayone") ||
        text.includes("pinta");
      const isGraffitiCategory = e.category === "GRAFITI_TERRITORIAL";
      return isGraffitiText || isGraffitiCategory;
    });

    // Asignar nivel de confianza estricto según origen del dato (ANALYST vs STREET_VIEW)
    const graffitiEvidence = rawGraffiti.map(g => {
      let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (g.source === "ANALYST") {
        confidence = "HIGH";
      } else if (g.source === "STREET_VIEW") {
        confidence = "MEDIUM";
      }
      return {
        ...g,
        graffitiConfidence: confidence
      };
    });

    // Criterio de activación: >= 2 coincidencias visuales repetidas
    const isActive = graffitiEvidence.length >= 2;

    // Interpretación criminológica factual de apropiación espacial (Prohibido asertar delincuencia directa)
    const narrative = isActive
      ? "La repetición de grafitis en distintos puntos constituye un indicador de apropiación visual del espacio y posible deterioro del control territorial."
      : "La presencia aislada de expresiones gráficas no constituye un patrón consolidado de apropiación territorial en el sector.";

    return {
      isActive,
      graffitiEvidence,
      narrative
    };
  }
}
