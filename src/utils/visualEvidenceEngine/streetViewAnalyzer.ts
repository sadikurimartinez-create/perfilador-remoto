import { VisualEvidenceInternal } from "./models/visualEvidenceTypes";

export class StreetViewAnalyzer {
  /**
   * Clasifica y analiza las vulnerabilidades físicas de cada candidato Street View.
   */
  static analyze(candidates: VisualEvidenceInternal[]): VisualEvidenceInternal[] {
    return candidates.map(c => {
      const text = (c.observation || "").toLowerCase();
      let category = "DETERIORO_URBANO";
      let relHotspot = "Ubicado en el perímetro de flujo delictivo general.";
      let relHypothesis = "Sustenta facilitación por condiciones físicas de vulnerabilidad.";

      // Reglas deterministas de Clasificación e Identificación de Anomalías
      if (
        text.includes("iluminacion") ||
        text.includes("luz") ||
        text.includes("alumbrado") ||
        text.includes("oscur") ||
        text.includes("faro")
      ) {
        category = "ALUMBRADO_PUBLICO";
        relHotspot = "Cercano a zona de asaltos recurrentes favorecidos por la oscuridad.";
        relHypothesis = "Valida hipótesis de oportunidad criminógena nocturna por falta de vigilancia natural.";
      } else if (
        text.includes("barda") ||
        text.includes("cerca") ||
        text.includes("muro") ||
        text.includes("cerramien") ||
        text.includes("perimetr")
      ) {
        category = "CERRAMIENTOS_DEFICIENTES";
        relHotspot = "Aledaño a rutas de escape peatonales en el hotspot de robo.";
        relHypothesis = "Fortalece la hipótesis de permeabilidad física y escape rápido del infractor.";
      } else if (
        text.includes("baldio") ||
        text.includes("lote") ||
        text.includes("abandon") ||
        text.includes("vacio")
      ) {
        category = "PREDIOS_ABANDONADOS";
        relHotspot = "Adyacente a puntos de concentración y consumo reportados.";
        relHypothesis = "Sustenta hipótesis de refugio temporal de infractores y nulo control social.";
      } else if (
        text.includes("grafiti") ||
        text.includes("rayone") ||
        text.includes("graffiti") ||
        text.includes("pinta")
      ) {
        category = "GRAFITI_TERRITORIAL";
        relHotspot = "Indicador de apropiación espacial en el núcleo del polígono.";
        relHypothesis = "Sustenta hipótesis de pérdida de control territorial y deterioro urbano acumulado.";
      } else if (
        text.includes("maleza") ||
        text.includes("arbol") ||
        text.includes("vegetac") ||
        text.includes("basura") ||
        text.includes("matorral")
      ) {
        category = "ZONAS_DE_OCULTAMIENTO";
        relHotspot = "Punto ciego adyacente a zonas de tránsito de transeúntes.";
        relHypothesis = "Favorece el factor de acecho por presencia de barreras visuales naturales.";
      }

      return {
        ...c,
        category,
        relationToHotspot: relHotspot,
        relationToHypothesis: relHypothesis
      };
    });
  }
}
