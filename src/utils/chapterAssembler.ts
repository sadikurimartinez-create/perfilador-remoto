/**
 * Chapter Assembler v1.0
 * ADR-013
 *
 * Responsabilidad:
 * Transformar IntelligenceReportPayload
 * en capítulos documentales estructurados.
 *
 * No modifica:
 * - Intelligence Layout Engine
 * - HIE Engine
 * - ACE Engine
 * - Evidence Governance Engine
 */

export interface DocumentChapterBlock {
  type: 
    | "TITLE"
    | "SUBTITLE"
    | "PARAGRAPH"
    | "BULLET"
    | "ANALYTICAL_BLOCK";

  content: unknown;
}


export interface DocumentChapter {
  id: string;
  title: string;
  blocks: DocumentChapterBlock[];
}


function createParagraph(content: unknown): DocumentChapterBlock {
  return {
    type: "PARAGRAPH",
    content
  };
}


function createAnalyticalBlock(content: unknown): DocumentChapterBlock {
  return {
    type: "ANALYTICAL_BLOCK",
    content
  };
}


export function buildDocumentChapters(
  payload: any
): DocumentChapter[] {


  const chapters: DocumentChapter[] = [];


  chapters.push({
    id: "chapter-01",
    title: "Contexto Territorial",
    blocks: [
      createParagraph(payload.contextoTerritorial)
    ]
  });


  chapters.push({
    id: "chapter-02",
    title: "Hipótesis Principal",
    blocks: [
      createAnalyticalBlock(
        payload.hipotesisPrincipal
      )
    ]
  });


  chapters.push({
    id: "chapter-03",
    title: "Valoración Operacional",
    blocks: [
      createAnalyticalBlock(
        payload.valoracionOperacional
      )
    ]
  });


  chapters.push({
    id: "chapter-04",
    title: "Evidencia Cartográfica",
    blocks: [
      createParagraph(
        payload.maps
      )
    ]
  });


  chapters.push({
    id: "chapter-05",
    title: "Evidencia Estadística",
    blocks: [
      createParagraph(
        payload.graphs
      ),
      createParagraph(
        payload.trazabilidadMatrix
      )
    ]
  });


  chapters.push({
    id: "chapter-06",
    title: "Evidencia Fotográfica",
    blocks: [
      createParagraph(
        payload.photoEvidence
      )
    ]
  });


  chapters.push({
    id: "chapter-07",
    title: "Análisis Street View",
    blocks: [
      createParagraph(
        payload.streetViewAnalysis
      )
    ]
  });


  chapters.push({
    id: "chapter-08",
    title: "Inteligencia OSINT",
    blocks: [
      createParagraph(
        payload.osintSynthesized
      )
    ]
  });


  chapters.push({
    id: "chapter-09",
    title: "Inteligencia Criminal",
    blocks: [
      createParagraph(
        payload.pandillasAnalysis
      )
    ]
  });


  chapters.push({
    id: "chapter-10",
    title: "Conclusiones",
    blocks: [
      createParagraph(
        payload.conclusions
      )
    ]
  });


  return chapters.filter(
    chapter =>
      chapter.blocks.some(
        block =>
          block.content !== undefined &&
          block.content !== null &&
          block.content !== ""
      )
  );

}