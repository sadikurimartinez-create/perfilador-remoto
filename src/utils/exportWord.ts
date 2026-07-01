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
  AlignmentType,
  ShadingType,
} from 'docx';

import { saveAs } from 'file-saver';

import { ConsolidatedReport } from '../types/Report';

import {
  generateStaticMapBase64,
  generateStreetViewBase64,
  generateRiskChartBase64,
} from './captureMpas';

import { getPhotoDataURLs } from './capturePhotos';
import {
  createAuditLog,
  appendAuditLog,
} from './auditLogger';
import {
  IntelligenceVisualProduct,
  applyInstitutionalWatermark,
  buildIntelligenceBriefing,
  buildPhotoCaption,
  loadPublicImageAsDataUrl,
} from './intelligenceLayoutEngine';

const imageBuffer = (dataUrl: string) =>
  Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0));

const heading = (text: string, pageBreakBefore = false) =>
  new Paragraph({
    pageBreakBefore,
    spacing: { before: 220, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: '0B1F3A',
      }),
    ],
  });

const compactParagraph = (text: string) =>
  new Paragraph({
    spacing: { after: 90 },
    children: [new TextRun({ text, size: 19, color: '172033' })],
  });

const bulletParagraph = (text: string) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 19 })],
  });

const visualCell = (
  visual: IntelligenceVisualProduct,
  width = 420,
  height = 245
) =>
  new TableCell({
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D7DEE8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D7DEE8' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D7DEE8' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D7DEE8' },
    },
    children: [
      new Paragraph({
        spacing: { after: 90 },
        children: [new TextRun({ text: visual.title, bold: true, size: 19, color: '0B1F3A' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: imageBuffer(visual.dataUrl),
            transformation: { width, height },
          } as any),
        ],
      }),
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: visual.caption, size: 16, color: '4B5563' })],
      }),
    ],
  });

const twoColumnVisualTable = (visuals: IntelligenceVisualProduct[]) => {
  const cells = visuals.map((visual) => visualCell(visual));
  if (cells.length === 1) {
    cells.push(
      new TableCell({
        children: [],
        borders: {
          top: { style: BorderStyle.NONE, size: 0 },
          bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.NONE, size: 0 },
          right: { style: BorderStyle.NONE, size: 0 },
        },
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: cells })],
    borders: {
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
  });
};

const buildVisualProducts = async (
  report: ConsolidatedReport
): Promise<IntelligenceVisualProduct[]> => {
  const visuals: IntelligenceVisualProduct[] = [];
  const mapImage = await generateStaticMapBase64(report);
  const chartImage = await generateRiskChartBase64(report.findings);
  const photoDataURLs = await getPhotoDataURLs(report.findings);

  if (mapImage) {
    visuals.push({
      id: 'map-main',
      type: 'map',
      title: 'Mapa operativo',
      dataUrl: await applyInstitutionalWatermark(mapImage),
      caption: 'Producto cartografico existente con simbologia visible para ubicar hallazgos, rutas y zonas de riesgo.',
    });
  }

  if (chartImage) {
    visuals.push({
      id: 'chart-risk',
      type: 'chart',
      title: 'Grafica de riesgo',
      dataUrl: await applyInstitutionalWatermark(chartImage),
      caption: 'Distribucion estadistica de hallazgos por nivel de riesgo para priorizacion operativa.',
    });
  }

  for (let i = 0; i < photoDataURLs.length; i++) {
    const dataUrl = photoDataURLs[i];
    if (!dataUrl) continue;
    const finding = report.findings[i] as any;
    visuals.push({
      id: `photo-${i + 1}`,
      type: 'photo',
      title: `Evidencia fotografica ${i + 1}`,
      dataUrl: await applyInstitutionalWatermark(dataUrl),
      caption: buildPhotoCaption(finding, i),
      riskLevel: finding?.riskLevel,
    });
  }

  const firstFinding = report.findings?.[0] as any;
  const baseLat = firstFinding?.latitude ?? firstFinding?.lat;
  const baseLng = firstFinding?.longitude ?? firstFinding?.lng;
  if (baseLat && baseLng) {
    for (const headingValue of [0, 90, 180, 270]) {
      const streetView = await generateStreetViewBase64(Number(baseLat), Number(baseLng), headingValue);
      if (!streetView) continue;
      visuals.push({
        id: `street-view-${headingValue}`,
        type: 'streetView',
        title: `Street View ${headingValue} grados`,
        dataUrl: await applyInstitutionalWatermark(streetView),
        caption:
          'Street View Intelligence: identifica lineas de vista, puntos de acecho, rutas de escape, vulnerabilidades y zonas ciegas.',
      });
    }
  }

  return visuals;
};

export const exportWord = async (
  report: ConsolidatedReport
) => {
  const visuals = await buildVisualProducts(report);
  const briefing = buildIntelligenceBriefing(report, visuals);
  const logoSsp = await loadPublicImageAsDataUrl('/logos/logo-ssp.png');
  const logoCeipol = await loadPublicImageAsDataUrl('/logos/logo-ceipol.png');

  const children: (Paragraph | Table)[] = [];

  const logoCells = [
    new TableCell({
      width: { size: 20, type: WidthType.PERCENTAGE },
      children: logoSsp
        ? [new Paragraph({ children: [new ImageRun({ data: imageBuffer(logoSsp), transformation: { width: 90, height: 60 } } as any)] })]
        : [new Paragraph({ text: 'SSPE' })],
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
    }),
    new TableCell({
      width: { size: 60, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: '0B1F3A' },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 260, after: 60 },
          children: [new TextRun({ text: briefing.title, bold: true, size: 34, color: 'FFFFFF' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'INFORME DE GEOINTELIGENCIA OPERATIVA', size: 18, color: 'FFFFFF' })],
        }),
      ],
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
    }),
    new TableCell({
      width: { size: 20, type: WidthType.PERCENTAGE },
      children: logoCeipol
        ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: imageBuffer(logoCeipol), transformation: { width: 90, height: 60 } } as any)] })]
        : [new Paragraph({ text: 'CEIPOL' })],
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
    }),
  ];

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: logoCells })] }));
  children.push(compactParagraph(`Expediente: ${briefing.fileNumber}`));
  children.push(compactParagraph(`Fecha de generacion: ${new Date(briefing.generatedAt).toLocaleString()}`));
  children.push(compactParagraph(`Clasificacion: ${briefing.classification}`));

  children.push(heading('Executive Summary'));
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: `RIESGO GLOBAL: ${briefing.globalRisk}`, bold: true, size: 30, color: briefing.globalRisk === 'ALTO' ? 'B91C1C' : '1D4F91' })],
    })
  );
  briefing.executiveBullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
  children.push(compactParagraph(`Accion inmediata: ${briefing.immediateRecommendation}`));

  children.push(heading('Hipotesis Final Unica', true));
  briefing.finalHypothesis.forEach((item) => children.push(bulletParagraph(item)));

  briefing.pages.forEach((page) => {
    children.push(heading(page.title, true));
    children.push(twoColumnVisualTable(page.visuals));
    children.push(compactParagraph(page.interpretation));
  });

  children.push(heading('Conclusiones Operativas', true));
  briefing.conclusions.forEach((item) => children.push(bulletParagraph(item)));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } },
        },
        children: children as any,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  if ((report as any).projectRef) {
    const log =
      createAuditLog(
        'Exportacion Word',
        (report as any).userRole || 'USER',
        (report as any).username || 'Usuario',
        `Se exporto el informe de geointeligencia Word del proyecto ${report.projectName}`
      );

    appendAuditLog(
      (report as any).projectRef,
      log
    );
  }

  saveAs(blob, `Informe_Geointeligencia_${report.projectName}.docx`);
};
