import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

import { saveAs } from 'file-saver';

import { ConsolidatedReport } from '../types/Report';

export const exportWord = async (
  report: ConsolidatedReport
) => {
  const findingsParagraphs = report.findings.flatMap(
    (finding, index) => [
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. Riesgo: ${finding.riskLevel.toUpperCase()}`,
            bold: true,
          }),
        ],
      }),

      new Paragraph({
        text: `Observación: ${finding.note}`,
      }),
    ]
  );

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

          ...findingsParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  saveAs(blob, `Informe_${report.projectName}.docx`);
};