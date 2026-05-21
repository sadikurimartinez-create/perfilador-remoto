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

export const exportWord = async (
  report: ConsolidatedReport
) => {
  const mapImage = await captureMapImage(
    'project-map-capture'
  );

  const findingsParagraphs = report.findings.flatMap(
    (finding, index) => [
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. Riesgo: ${(finding.riskLevel || 'N/A').toUpperCase()}`,
            bold: true,
          }),
        ],
      }),

      new Paragraph({
        text: `Observación: ${finding.note || 'Sin observación'}`,
      }),
    ]
  );

  const photoDataURLs = await getPhotoDataURLs(report.findings);

  const photoParagraphs = photoDataURLs.flatMap((dataURL, index) => {
    // Prevenimos que explote si no hay URL o base64 válido
    if (!dataURL || !dataURL.includes(',')) return [];
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `Evidencia Foto ${index + 1}`,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: Uint8Array.from(
              atob(dataURL.split(',')[1]),
              (c) => c.charCodeAt(0)
            ),
            transformation: { width: 250, height: 180 },
            type: 'png',
          }),
        ],
      }),
    ];
  });

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
            text: `Tipo de geometría: ${report.geometryType}`,
          }),

          new Paragraph({
            text: `Fecha: ${report.createdAt}`,
          }),

          new Paragraph({
            text: ' ',
          }),

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
          ...photoParagraphs,
          ...findingsParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  saveAs(blob, `Informe_${report.projectName}.docx`);
};