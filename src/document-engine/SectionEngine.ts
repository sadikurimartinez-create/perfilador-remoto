import { NarrativeBlock } from "./NarrativeRenderer";
import { FormattedEvidence } from "./EvidenceRenderer";

export interface DocumentSection {
  id: string;
  title: string;
  blocks: NarrativeBlock[];
  evidences?: FormattedEvidence[];
}

export class SectionEngine {
  static buildSections(request: {
    expediente: any;
    narrativeBlocks: NarrativeBlock[];
    evidences: FormattedEvidence[];
  }): DocumentSection[] {
    return [
      {
        id: "PORTADA",
        title: "PORTADA INSTITUCIONAL",
        blocks: [
          { type: "TITLE", text: `REPORTE OFICIAL: ${request.expediente.id || "EXP-2026"}` },
          { type: "SUBTITLE", text: "DIRECCIÓN GENERAL DE INTELIGENCIA OPERATIVA CEIPOL" },
        ],
      },
      {
        id: "IDENTIFICACION",
        title: "IDENTIFICACIÓN DEL EXPEDIENTE",
        blocks: [
          { type: "PARAGRAPH", text: `Folio: ${request.expediente.id || "EXP-2026"}` },
          { type: "PARAGRAPH", text: `Clasificación: CONFIDENCIAL / RESERVADO` },
        ],
      },
      {
        id: "HIPOTESIS",
        title: "HIPÓTESIS INICIAL",
        blocks: request.narrativeBlocks.filter((b) => b.type !== "TITLE"),
      },
      {
        id: "HALLAZGOS",
        title: "HALLAZGOS TÁCTICOS STREET VIEW",
        blocks: [],
        evidences: request.evidences,
      },
    ];
  }
}
