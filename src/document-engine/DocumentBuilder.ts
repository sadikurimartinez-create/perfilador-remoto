import { NarrativeRenderer, NarrativeBlock } from "./NarrativeRenderer";
import { EvidenceRenderer, FormattedEvidence } from "./EvidenceRenderer";
import { SectionEngine, DocumentSection } from "./SectionEngine";

export interface DocumentBuildRequest {
  expediente: any;
  evidencia: any[];
  mapas: any[];
  graficos: any[];
  narrativa: any;
  configuracionVisual: any;
}

export class DocumentBuilder {
  static build(request: DocumentBuildRequest): DocumentSection[] {
    // 1. Normalizar textos y convertirlos en bloques narrativos
    const narrativeText = typeof request.narrativa === "string" ? request.narrativa : JSON.stringify(request.narrativa);
    const narrativeBlocks = NarrativeRenderer.renderMarkdownToBlocks(narrativeText);

    // 2. Normalizar evidencias fotográficas e imágenes de campo
    const formattedEvidences: FormattedEvidence[] = [];
    request.evidencia.forEach((ev) => {
      const formatted = EvidenceRenderer.formatEvidence(ev);
      if (formatted) {
        formattedEvidences.push(formatted);
      }
    });

    // 3. Compilar la estructura editorial oficial utilizando el SectionEngine
    return SectionEngine.buildSections({
      expediente: request.expediente,
      narrativeBlocks,
      evidences: formattedEvidences,
    });
  }
}
