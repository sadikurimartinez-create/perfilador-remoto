import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  PageOrientation,
} from 'docx';

import { saveAs } from 'file-saver';

import { ConsolidatedReport } from '../types/Report';

import { generateStaticMapBase64, generateStreetViewBase64, generateRiskChartBase64 } from './captureMpas';

import { getPhotoDataURLs } from './capturePhotos';

import { calculateRisk } from './scoring';
import { generateNarrative } from './narrative';
import { classifyCriminology } from './criminologyClassifier';
import {
  createAuditLog,
  appendAuditLog,
} from './auditLogger';

export const exportWord = async (
  report: ConsolidatedReport
) => {
  const mapImage = await generateStaticMapBase64(report);
  const chartImage = await generateRiskChartBase64(report.findings);

  const photoDataURLs = await getPhotoDataURLs(report.findings);

  let groups: { title: string; items: { finding: any; dataURL: string; index: number }[] }[] = [];

  const findingsWithPhotos = report.findings.map((finding, idx) => ({
    finding,
    dataURL: photoDataURLs[idx],
    index: idx
  }));

  if ((report as any).geometryType === "lineal") {
    groups = [
      { title: "NODO INICIAL", items: findingsWithPhotos.filter(f => (f.finding as any).tipo === "Nodo Inicial") },
      { title: "CORREDOR", items: findingsWithPhotos.filter(f => (f.finding as any).tipo === "Corredor") },
      { title: "NODO FINAL", items: findingsWithPhotos.filter(f => (f.finding as any).tipo === "Nodo Final") },
      { title: "EVIDENCIA ADICIONAL", items: findingsWithPhotos.filter(f => !["Nodo Inicial", "Corredor", "Nodo Final"].includes((f.finding as any).tipo)) },
    ];
  } else if ((report as any).geometryType === "poligono") {
    groups = [
      { title: "PERÍMETRO", items: findingsWithPhotos.filter(f => (f.finding as any).tipo === "Perímetro") },
      { title: "INTERIOR", items: findingsWithPhotos.filter(f => (f.finding as any).tipo === "Interior") },
      { title: "EVIDENCIA ADICIONAL", items: findingsWithPhotos.filter(f => !["Perímetro", "Interior"].includes((f.finding as any).tipo)) },
    ];
  } else {
    groups = [
      { title: "NODO Y ENTORNO", items: findingsWithPhotos }
    ];
  }

  groups = groups.filter(g => g.items.length > 0);

  const createPhotoTable = (items: any[]) => {
    const WORD_MAX_WIDTH = 380;
    const cells: TableCell[] = items.map((item) => {
      const imgBuf = Uint8Array.from(atob(item.dataURL.split(',')[1]), c => c.charCodeAt(0));
      return new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: `Evidencia Foto ${item.index + 1} - ${(item.finding as any).tipo || 'Sin clasificar'}`, bold: true })],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuf,
                transformation: { width: WORD_MAX_WIDTH, height: Math.floor(WORD_MAX_WIDTH * 0.75) }
              } as any)
            ]
          }),
          new Paragraph({
            text: `Riesgo: ${(item.finding.riskLevel || 'N/A').toUpperCase()} | Observación: ${item.finding.note || 'Sin observación'}`,
            spacing: { before: 100 }
          })
        ],
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        margins: { top: 200, bottom: 200, left: 100, right: 100 }
      });
    });

    const rows: TableRow[] = [];
    for (let i = 0; i < cells.length; i += 2) {
      const rowCells = [cells[i]];
      if (i + 1 < cells.length) {
        rowCells.push(cells[i + 1]);
      } else {
        rowCells.push(new TableCell({ children: [], borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } }));
      }
      rows.push(new TableRow({ children: rowCells }));
    }

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
    });
  };

  const photoBlockParagraphs = groups.flatMap(group => {
    const groupHeader = new Paragraph({
      children: [new TextRun({ text: group.title, bold: true, size: 24 })],
      spacing: { before: 400, after: 200 }
    });

    const validItems = group.items.filter(item => item.dataURL && item.dataURL.includes(','));
    if (validItems.length > 0) {
      return [groupHeader, createPhotoTable(validItems)];
    }
    return [groupHeader];
  });

  const risk = calculateRisk(report.findings);
  const narrative = generateNarrative(report);
  const classification = classifyCriminology(
    report.findings,
    (report as any).geometryType
  );

  const narrativeParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: 'NARRATIVA CRIMINOLÓGICA', bold: true }),
      ],
    }),
    ...narrative.split('. ').filter(Boolean).map(sentence => new Paragraph({ text: sentence.trim() + (sentence.endsWith('.') ? '' : '.') })),
    new Paragraph({ text: `Nivel de riesgo global: ${risk.classification} (Promedio: ${risk.averageScore.toFixed(2)})` }),
  ];

  const classificationParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: 'CLASIFICACIÓN CRIMINOLÓGICA', bold: true }),
      ],
    }),
    new Paragraph({ text: classification.category }),
    new Paragraph({ text: classification.interpretation }),
  ];

  const explanationParagraphs: Paragraph[] = [];
  const explanationText = (report as any).descripcion || (report.voiceNotes && report.voiceNotes.length > 0 ? report.voiceNotes.join('\n') : "");
  if (explanationText) {
    explanationParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: 'EXPLICACIÓN DEL PROYECTO (VOZ)', bold: true })],
        spacing: { before: 200, after: 100 }
      })
    );
    explanationText.split('\n').forEach((note: string) => {
      if (note.trim()) {
        explanationParagraphs.push(new Paragraph({ text: note.trim() }));
      }
    });
  }

  // STREET VIEW ELEMENTS
  const svFindings = report.findings.slice(0, 3);
  const svCells: TableCell[] = [];
  if (svFindings.length > 0) {
    for (let i = 0; i < 3; i++) {
      const f = svFindings[i % svFindings.length] as any;
      if (!f) continue;
      const heading = [0, 90, 180][i];
      const lat = Number(f?.latitude ?? f?.lat);
      const lng = Number(f?.longitude ?? f?.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const svDataUrl = await generateStreetViewBase64(lat, lng, heading);
      if (svDataUrl && svDataUrl.includes(',')) {
        const base64Data = svDataUrl.split(',')[1];
        if (!base64Data) continue;
        const imgBuf = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        svCells.push(new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: `Street View Evidencia ${i + 1}`, bold: true })], spacing: { after: 100 } }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBuf,
                  transformation: { width: 380, height: 250 }
                } as any)
              ]
            })
          ],
          borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
          margins: { top: 200, bottom: 200, left: 100, right: 100 }
        }));
      }
    }
  }
  let svTable: Table | null = null;
  if (svCells.length > 0) {
    const rows: TableRow[] = [];
    for (let i = 0; i < svCells.length; i += 2) {
      const rowCells = [svCells[i]];
      if (i + 1 < svCells.length) rowCells.push(svCells[i + 1]);
      else rowCells.push(new TableCell({ children: [], borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } }));
      rows.push(new TableRow({ children: rowCells }));
    }
    svTable = new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } });
  }

  // Construimos el arreglo de elementos fuera del Document para evitar sobrecarga de tipado (TS Union Types)
  const docChildren: (Paragraph | Table)[] = [];

  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'CEIPOL - INFORME CRIMINOLÓGICO',
          bold: true,
          size: 32,
        }),
      ],
    })
  );

  docChildren.push(new Paragraph({ text: `Proyecto: ${report.projectName}` }));
  docChildren.push(new Paragraph({ text: `Tipo de geometría: ${(report as any).geometryType}` }));
  docChildren.push(new Paragraph({ text: `Fecha: ${report.createdAt}` }));
  docChildren.push(new Paragraph({ text: ' ' }));

  docChildren.push(...explanationParagraphs);
  docChildren.push(new Paragraph({ text: ' ' }));

    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'ATLAS CARTOGRÁFICO Y GRÁFICO TÁCTICO (2x2)', bold: true, size: 24 })],
        spacing: { before: 200, after: 200 }
      })
    );

  const mapChartCells: TableCell[] = [];
  if (mapImage) {
    mapChartCells.push(new TableCell({
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Mapa del Proyecto', bold: true })], spacing: { after: 100 } }),
        new Paragraph({ children: [new ImageRun({ data: Uint8Array.from(atob((mapImage as string).split(',')[1]), c => c.charCodeAt(0)), transformation: { width: 380, height: 210 } } as any)] })
      ],
      borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
      margins: { top: 100, bottom: 100, left: 100, right: 100 }
    }));
  }
  if (chartImage) {
    mapChartCells.push(new TableCell({
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Distribución Estadística', bold: true })], spacing: { after: 100 } }),
        new Paragraph({ children: [new ImageRun({ data: Uint8Array.from(atob((chartImage as string).split(',')[1]), c => c.charCodeAt(0)), transformation: { width: 350, height: 180 } } as any)] })
      ],
      borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
      margins: { top: 100, bottom: 100, left: 100, right: 100 }
    }));
  }
  if (mapChartCells.length > 0) {
    if (mapChartCells.length === 1) mapChartCells.push(new TableCell({ children: [], borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } } }));
    const mcTable = new Table({ rows: [new TableRow({ children: mapChartCells })], width: { size: 100, type: WidthType.PERCENTAGE }, borders: { insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 } } });
    docChildren.push(mcTable);
  }

  docChildren.push(new Paragraph({ text: ' ' }));
  docChildren.push(...narrativeParagraphs);
  docChildren.push(new Paragraph({ text: ' ' }));
  docChildren.push(...classificationParagraphs);
  docChildren.push(new Paragraph({ text: ' ' }));
  docChildren.push(...photoBlockParagraphs);
  docChildren.push(new Paragraph({ text: ' ' }));

  if (svTable) {
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'EVIDENCIA VISUAL DE CONTEXTO - STREET VIEW', bold: true, size: 24 })],
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true
      })
    );
    docChildren.push(svTable);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } }
        },
        // Inyectamos el arreglo ya ensamblado y forzamos el tipo 'any' para evitar falsos positivos del tipado
        children: docChildren as any,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  if ((report as any).projectRef) {

    const log =
      createAuditLog(
        'Exportación Word',
        (report as any).userRole || 'USER',
        (report as any).username || 'Usuario',
        `Se exportó el informe Word del proyecto ${report.projectName}`
      );

    appendAuditLog(
      (report as any).projectRef,
      log
    );
  }

  saveAs(blob, `Informe_${report.projectName}.docx`);
};