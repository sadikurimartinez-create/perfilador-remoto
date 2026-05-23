import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
} from 'docx';

import { saveAs } from 'file-saver';

import { ConsolidatedReport } from '../types/Report';

import { captureMapImage } from './captureMpas';

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
  const mapImage = await captureMapImage(
    'project-map-capture'
  );

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

  const photoBlockParagraphs = groups.flatMap(group => {
    const groupHeader = new Paragraph({
      children: [new TextRun({ text: group.title, bold: true, size: 24 })],
      spacing: { before: 400, after: 200 }
    });

    const groupItems = group.items.flatMap(item => {
      if (!item.dataURL || !item.dataURL.includes(',')) return [];
      return [
        new Paragraph({
          children: [new TextRun({ text: `Evidencia Foto ${item.index + 1} - ${(item.finding as any).tipo || 'Sin clasificar'}`, bold: true })],
          spacing: { before: 200, after: 100 }
        }),
        new Paragraph({
          children: [
            new ImageRun({
              data: Uint8Array.from(atob(item.dataURL.split(',')[1]), c => c.charCodeAt(0)),
              transformation: { width: 250, height: 180 },
              type: 'png'
            })
          ]
        }),
        new Paragraph({
          text: `Riesgo: ${(item.finding.riskLevel || 'N/A').toUpperCase()} | Observación: ${item.finding.note || 'Sin observación'}`,
          spacing: { after: 300 }
        })
      ];
    });

    return [groupHeader, ...groupItems];
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

  const doc = new Document({
    sections: [
      {
        properties: {},

        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'CEIPOL - INFORME CRIMINOLÓGICO',
                bold: true,
                size: 32,
              }),
            ],
          }),

          new Paragraph({
            text: `Proyecto: ${report.projectName}`,
          }),

          new Paragraph({
            text: `Tipo de geometría: ${(report as any).geometryType}`,
          }),

          new Paragraph({
            text: `Fecha: ${report.createdAt}`,
          }),

          new Paragraph({
            text: ' ',
          }),

          ...explanationParagraphs,
          new Paragraph({ text: ' ' }),

          ...(mapImage
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'MAPA DEL PROYECTO',
                      bold: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: Uint8Array.from(
                        atob(mapImage.split(',')[1]),
                        c => c.charCodeAt(0)
                      ),
                      transformation: { width: 500, height: 250 },
                      type: 'png',
                    }),
                  ],
                }),
              ]
            : []),
          
          new Paragraph({ text: ' ' }),
          ...narrativeParagraphs,
          new Paragraph({ text: ' ' }),
          ...classificationParagraphs,
          new Paragraph({ text: ' ' }),
          ...photoBlockParagraphs,
        ],
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