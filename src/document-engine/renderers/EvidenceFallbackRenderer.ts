import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  BorderStyle,
  ShadingType,
  WidthType,
} from "docx";
import { UnifiedEvidence } from "@/utils/evidence/EvidenceAdapterEngine";

export class EvidenceFallbackRenderer {
  /**
   * Genera una Ficha de Evidencia Remota de emergencia en formato Tabla DOCX cuando la imagen no está disponible,
   * garantizando que NINGUNA evidencia desaparezca del dictamen (Cumplimiento Regla Institucional Obligatoria).
   */
  static renderFallbackCard(evidence: UnifiedEvidence, reasonText: string = "Imagen no disponible durante renderizado documental."): Table {
    const borders = {
      top: { style: BorderStyle.SINGLE, size: 6, color: "0D2B52" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "0D2B52" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "0D2B52" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "0D2B52" },
    };

    const headerCell = new TableCell({
      shading: { fill: "0D2B52", type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 150, right: 150 },
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `FICHA DE EVIDENCIA REMOTA: ${evidence.id.toUpperCase()}`,
              bold: true,
              color: "FFFFFF",
              size: 18,
              font: "Calibri",
            }),
            new TextRun({
              text: `  [ESTADO: ${evidence.status}]`,
              color: "FFD700",
              bold: true,
              size: 16,
              font: "Calibri",
            }),
          ],
        }),
      ],
    });

    const noticeCell = new TableCell({
      shading: { fill: "FFF3CD", type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `⚠️ ALERTA DE EVIDENCIA VISUAL: ${reasonText}`,
              bold: true,
              color: "856404",
              size: 16,
              font: "Calibri",
            }),
            ...(evidence.duplicateOf
              ? [
                  new TextRun({
                    text: ` (Relación analítica registrada con evidencia ${evidence.duplicateOf})`,
                    italics: true,
                    color: "856404",
                    size: 15,
                    font: "Calibri",
                  }),
                ]
              : []),
          ],
        }),
      ],
    });

    const latStr = evidence.coordinates.lat !== null ? evidence.coordinates.lat.toFixed(5) : "N/D";
    const lngStr = evidence.coordinates.lng !== null ? evidence.coordinates.lng.toFixed(5) : "N/D";
    const headingStr = evidence.metadata.heading !== undefined ? `${evidence.metadata.heading}°` : "N/D";
    const pitchStr = evidence.metadata.pitch !== undefined ? `${evidence.metadata.pitch}°` : "N/D";

    const dataCell = new TableCell({
      shading: { fill: "F8F9FA", type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 150, right: 150 },
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "Categoría: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `${evidence.category} | `, size: 16, font: "Calibri" }),
            new TextRun({ text: "Fuente: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `${evidence.source} (${evidence.metadata.sourceProvider || "Google Street View"}) | `, size: 16, font: "Calibri" }),
            new TextRun({ text: "Fecha Cobertura: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `${evidence.metadata.captureDate || "N/D"}`, size: 16, font: "Calibri" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Coordenadas Operacionales: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `Lat ${latStr}, Lng ${lngStr} | `, size: 16, font: "Calibri" }),
            new TextRun({ text: "Telemetría POV: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `Heading ${headingStr}, Pitch ${pitchStr}`, size: 16, font: "Calibri" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Descripción de Entorno: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `${evidence.metadata.description}\n`, size: 16, font: "Calibri" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Análisis Criminológico: ", bold: true, size: 16, font: "Calibri" }),
            new TextRun({ text: `${evidence.metadata.criminologicalInterpretation}\n`, size: 16, font: "Calibri" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Trazabilidad Hash SHA-256: ", bold: true, size: 14, font: "Calibri", color: "555555" }),
            new TextRun({ text: `${evidence.hash}`, size: 14, font: "Calibri", color: "555555" }),
          ],
        }),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ children: [headerCell] }),
        new TableRow({ children: [noticeCell] }),
        new TableRow({ children: [dataCell] }),
      ],
    });
  }
}
export default EvidenceFallbackRenderer;
