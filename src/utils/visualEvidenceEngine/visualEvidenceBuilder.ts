import { VisualEvidenceInternal, VisualEvidenceEditorial } from "./models/visualEvidenceTypes";

export class VisualEvidenceBuilder {
  /**
   * Construye el pie de foto analítico editorial a partir del metadato estructurado interno.
   */
  static buildEditorial(evidence: VisualEvidenceInternal, index: number): VisualEvidenceEditorial {
    const rawObs = evidence.observation || "";

    let title = `EVIDENCIA VISUAL 0${index + 1}`;
    if (evidence.source === "STREET_VIEW") {
      title = `EVIDENCIA VIRTUAL STREET VIEW 0${index + 1}`;
    }

    let description = rawObs;
    if (description.length > 150) {
      description = description.slice(0, 150) + "...";
    }

    let finding = "Anomalía física en el entorno territorial.";
    let operationalImpact = "Dificulta la prevención situacional de conductas delictivas.";

    // Reglas basadas en categorías del Analyzer
    if (evidence.category === "ALUMBRADO_PUBLICO") {
      finding = "Fallas críticas de iluminación artificial.";
      operationalImpact = "Favorece zonas de baja supervisión visual y reduce la vigilancia natural nocturna.";
    } else if (evidence.category === "CERRAMIENTOS_DEFICIENTES") {
      finding = "Pérdida de control físico de accesos perimetrales.";
      operationalImpact = "Facilita la intrusión y genera rutas informales de escape rápido.";
    } else if (evidence.category === "PREDIOS_ABANDONADOS") {
      finding = "Presencia de predios deshabitados o lotes baldíos sin cerramiento.";
      operationalImpact = "Propicia puntos de ocultamiento temporal y nula cohesión social territorial.";
    } else if (evidence.category === "GRAFITI_TERRITORIAL") {
      finding = "Repetición espacial de grafitis o marcas urbanas.";
      operationalImpact = "Constituye un indicador visual de apropiación del espacio y posible deterioro del control territorial.";
    } else if (evidence.category === "ZONAS_DE_OCULTAMIENTO") {
      finding = "Acumulación de maleza alta u obstáculos visuales naturales.";
      operationalImpact = "Disminuye el campo de visión peatonal y facilita el acecho o resguardo de infractores.";
    }

    return {
      image: evidence.image,
      title,
      description,
      finding,
      operationalImpact
    };
  }
}
