import { jsPDF } from 'jspdf';
import {
  generateStaticMapBase64,
  generateStreetViewBase64,
  generateRiskChartBase64,
} from './captureMpas';
import { ConsolidatedReport } from '../types/Report';
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

const PAGE = {
  width: 297,
  height: 210,
  margin: 16,
};

const COLORS = {
  navy: '#0b1f3a',
  blue: '#1d4f91',
  line: '#d7dee8',
  text: '#172033',
  muted: '#5d6b7c',
};

const addHeader = (doc: jsPDF, title: string) => {
  doc.setFillColor(COLORS.navy);
  doc.rect(0, 0, PAGE.width, 13, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(8);
  doc.text('SSPE-CEIPOL | Intelligence Briefing', PAGE.margin, 8.5);
  doc.text(title, PAGE.width - PAGE.margin, 8.5, { align: 'right' });
  doc.setTextColor(COLORS.text);
};

const addSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setFillColor(COLORS.blue);
  doc.rect(PAGE.margin, y - 5, 3, 8, 'F');
  doc.setFontSize(13);
  doc.setTextColor(COLORS.navy);
  doc.text(title, PAGE.margin + 6, y);
  doc.setTextColor(COLORS.text);
};

const addBullets = (
  doc: jsPDF,
  bullets: string[],
  x: number,
  y: number,
  width: number,
  lineHeight = 5.2
) => {
  doc.setFontSize(8.8);
  let cursor = y;
  bullets.forEach((bullet) => {
    const lines = doc.splitTextToSize(`- ${bullet}`, width);
    lines.forEach((line: string) => {
      doc.text(line, x, cursor);
      cursor += lineHeight;
    });
  });
  return cursor;
};

const addVisualFrame = (
  doc: jsPDF,
  visual: IntelligenceVisualProduct,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  doc.setDrawColor(COLORS.line);
  doc.setLineWidth(0.4);
  doc.rect(x, y, width, height);
  doc.addImage(visual.dataUrl, visual.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', x + 1, y + 1, width - 2, height - 16);
  doc.setFillColor('#f4f7fb');
  doc.rect(x, y + height - 15, width, 15, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.text);
  const caption = doc.splitTextToSize(visual.caption, width - 6).slice(0, 2);
  doc.text(caption, x + 3, y + height - 10);
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
    const headings = [0, 90, 180, 270];
    for (const heading of headings) {
      const streetView = await generateStreetViewBase64(Number(baseLat), Number(baseLng), heading);
      if (!streetView) continue;
      visuals.push({
        id: `street-view-${heading}`,
        type: 'streetView',
        title: `Street View ${heading} grados`,
        dataUrl: await applyInstitutionalWatermark(streetView),
        caption:
          'Street View Intelligence: identifica lineas de vista, puntos de acecho, rutas de escape, vulnerabilidades y zonas ciegas.',
      });
    }
  }

  return visuals;
};

export const exportPDF = async (
  report: ConsolidatedReport
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const visuals = await buildVisualProducts(report);
  const briefing = buildIntelligenceBriefing(report, visuals);
  const logoSsp = await loadPublicImageAsDataUrl('/logos/logo-ssp.png');
  const logoCeipol = await loadPublicImageAsDataUrl('/logos/logo-ceipol.png');

  doc.setFillColor('#f7f9fc');
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setFillColor(COLORS.navy);
  doc.rect(0, 0, PAGE.width, 32, 'F');

  if (logoSsp) doc.addImage(logoSsp, 'PNG', PAGE.margin, 7, 22, 18);
  if (logoCeipol) doc.addImage(logoCeipol, 'PNG', PAGE.width - PAGE.margin - 22, 7, 22, 18);

  doc.setTextColor('#ffffff');
  doc.setFontSize(23);
  doc.text(briefing.title, PAGE.width / 2, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.text('INFORME DE GEOINTELIGENCIA OPERATIVA', PAGE.width / 2, 27, { align: 'center' });

  doc.setTextColor(COLORS.text);
  doc.setFontSize(10);
  doc.text(`Expediente: ${briefing.fileNumber}`, PAGE.margin, 47);
  doc.text(`Fecha de generacion: ${new Date(briefing.generatedAt).toLocaleString()}`, PAGE.margin, 54);
  doc.text(`Clasificacion: ${briefing.classification}`, PAGE.margin, 61);

  addSectionTitle(doc, 'Executive Summary', 78);
  doc.setFillColor('#ffffff');
  doc.roundedRect(PAGE.margin, 85, 128, 72, 2, 2, 'F');
  doc.setDrawColor(COLORS.line);
  doc.roundedRect(PAGE.margin, 85, 128, 72, 2, 2);
  doc.setFontSize(21);
  doc.setTextColor(briefing.globalRisk === 'ALTO' ? '#b91c1c' : COLORS.blue);
  doc.text(`RIESGO ${briefing.globalRisk}`, PAGE.margin + 8, 102);
  doc.setTextColor(COLORS.text);
  addBullets(doc, briefing.executiveBullets, PAGE.margin + 8, 116, 112);

  doc.setFillColor('#ffffff');
  doc.roundedRect(158, 85, 123, 72, 2, 2, 'F');
  doc.setDrawColor(COLORS.line);
  doc.roundedRect(158, 85, 123, 72, 2, 2);
  doc.setFontSize(10);
  doc.setTextColor(COLORS.navy);
  doc.text('Hallazgos criticos / zonas / actores', 166, 99);
  doc.setTextColor(COLORS.text);
  addBullets(doc, [...briefing.criticalFindings, ...briefing.riskZones.slice(0, 2), ...briefing.relevantActors.slice(0, 1)], 166, 111, 104, 5);
  doc.setFontSize(8.8);
  doc.setTextColor(COLORS.blue);
  doc.text(doc.splitTextToSize(`Accion inmediata: ${briefing.immediateRecommendation}`, 104), 166, 145);

  doc.addPage();
  addHeader(doc, 'Hipotesis final');
  addSectionTitle(doc, 'Hipotesis Final Unica', 29);
  addBullets(doc, briefing.finalHypothesis, PAGE.margin, 43, 260, 7);

  briefing.pages.forEach((page) => {
    doc.addPage();
    addHeader(doc, page.title);
    addSectionTitle(doc, page.title, 29);

    if (page.mode === 'single') {
      addVisualFrame(doc, page.visuals[0], 32, 40, 232, 126);
      doc.setTextColor(COLORS.muted);
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(page.interpretation, 232), 32, 178);
    } else {
      addVisualFrame(doc, page.visuals[0], PAGE.margin, 42, 128, 112);
      addVisualFrame(doc, page.visuals[1], 153, 42, 128, 112);
      doc.setTextColor(COLORS.muted);
      doc.setFontSize(8.8);
      doc.text(doc.splitTextToSize(page.visuals[0].caption, 120).slice(0, 2), PAGE.margin, 166);
      doc.text(doc.splitTextToSize(page.visuals[1].caption, 120).slice(0, 2), 153, 166);
    }
  });

  doc.addPage();
  addHeader(doc, 'Conclusiones operativas');
  addSectionTitle(doc, 'Conclusiones Operativas', 29);
  addBullets(doc, briefing.conclusions, PAGE.margin, 45, 250, 8);

  if ((report as any).projectRef) {
    const log = createAuditLog(
      'Exportacion PDF',
      (report as any).userRole || 'USER',
      (report as any).username || 'Usuario',
      `Se exporto el informe de geointeligencia PDF del proyecto ${report.projectName}`
    );
    appendAuditLog((report as any).projectRef, log);
  }

  doc.save(`Informe_Geointeligencia_${report.projectName}.pdf`);
};
