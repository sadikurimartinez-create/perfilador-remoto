import { jsPDF } from 'jspdf';
import { generateStaticMapBase64, generateStreetViewBase64, generateRiskChartBase64 } from './captureMpas';
import { ConsolidatedReport } from '../types/Report';
import { getPhotoDataURLs } from './capturePhotos';
import { calculateRisk } from './scoring';
import { generateNarrative } from './narrative';
import { classifyCriminology } from './criminologyClassifier';
import {
  createAuditLog,
  appendAuditLog,
} from './auditLogger';

export const exportPDF = async (
  report: ConsolidatedReport
) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const PAGE_WIDTH = 297;
  const PAGE_HEIGHT = 210;
  const MARGIN = 20;
  const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const mapImage = await generateStaticMapBase64(report);
  const chartImage = await generateRiskChartBase64(report.findings);

  let y = 20;

  doc.setFontSize(18);
  doc.text('CEIPOL - INFORME CRIMINOLÓGICO', 20, y);

  y += 15;

  doc.setFontSize(12);

  doc.text(`Proyecto: ${report.projectName}`, 20, y);
  y += 10;

  doc.text(`Tipo de geometría: ${report.geometryType}`, 20, y);
  y += 10;

  doc.text(`Fecha: ${report.createdAt}`, 20, y);
  y += 15;

  const risk = calculateRisk(report.findings);
  const narrative = generateNarrative(report);
  const classification =
    classifyCriminology(
      report.findings,
      report.geometryType
    );
  y += 10;

  doc.setFontSize(14);
  doc.text('NARRATIVA CRIMINOLÓGICA', 20, y);
  y += 10;

  doc.setFontSize(12);
  const lines = doc.splitTextToSize(narrative, TEXT_WIDTH);
  lines.forEach((line: string) => {
    // Salto de página automático si la narrativa es muy larga
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 7;
  });
  
  if (y > PAGE_HEIGHT - 30) {
    doc.addPage();
    y = 20;
  } else {
    y += 10;
  }

  doc.text(`Nivel de riesgo global: ${risk.classification} (Promedio: ${risk.averageScore.toFixed(2)})`, 20, y);
  
  y += 10;

  doc.setFontSize(14);
  doc.text('CLASIFICACIÓN CRIMINOLÓGICA', 20, y);

  y += 10;

  doc.setFontSize(12);
  const classificationLines = doc.splitTextToSize(
    `${classification.category}: ${classification.interpretation}`,
    TEXT_WIDTH
  );

  classificationLines.forEach((line: string) => {
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 7;
  });

  y += 15;

  // ÁLBUM 2x2: MAPA Y GRÁFICA (A PETICIÓN DEL USUARIO)
  if (mapImage || chartImage) {
    doc.addPage();
    y = MARGIN;
    doc.setFontSize(14);
    doc.text('ATLAS CARTOGRÁFICO Y GRÁFICO TÁCTICO (2x2)', MARGIN, y);
    y += 15;

    if (mapImage) {
      doc.setFontSize(12);
      doc.text('Mapa del Proyecto', MARGIN, y);
      doc.addImage(mapImage, 'JPEG', MARGIN, y + 5, 120, 80);
    }
    if (chartImage) {
      doc.setFontSize(12);
      doc.text('Distribución de Riesgo', 150, y);
      doc.addImage(chartImage, 'PNG', 150, y + 5, 120, 60);
    }
  }

  // FOTOS 2x2
  doc.addPage();
  y = MARGIN;
  doc.setFontSize(14);
  doc.text('ANEXO FOTOGRÁFICO Y HALLAZGOS', MARGIN, y);
  y += 10;

  const photoDataURLs = await getPhotoDataURLs(report.findings);
  
  const PHOTO_WIDTH = 120;
  const PHOTO_HEIGHT = 80;
  const SPACING_X = 17;
  const SPACING_Y = 15;

  let photoCount = 0;
  report.findings.forEach((finding: any, i: number) => {
    const dataURL = photoDataURLs[i];
    if (dataURL) {
      if (photoCount > 0 && photoCount % 4 === 0) {
        doc.addPage();
        y = MARGIN;
      }
      const col = photoCount % 2;
      const rowInPage = Math.floor((photoCount % 4) / 2);
      const currentX = MARGIN + col * (PHOTO_WIDTH + SPACING_X);
      const currentY = y + rowInPage * (PHOTO_HEIGHT + SPACING_Y);

      doc.setFontSize(11);
      const findingText = `${i + 1}. Riesgo: ${(finding?.riskLevel || 'N/A').toUpperCase()} | Observación: ${finding?.note || ''}`;
      const textLines = doc.splitTextToSize(findingText, PHOTO_WIDTH);
      doc.text(textLines as any, currentX, currentY);
      doc.addImage(dataURL, 'PNG', currentX, currentY + 5, PHOTO_WIDTH, PHOTO_HEIGHT);
      photoCount++;
    }
  });

  // STREET VIEW 2x2
  doc.addPage();
  y = MARGIN;
  doc.setFontSize(14);
  doc.text('CONTEXTO VISUAL - STREET VIEW (2x2)', MARGIN, y);
  y += 10;

  let svCount = 0;
  const svFindings = report.findings.slice(0, 3);
  if (svFindings.length > 0) {
    for (let i = 0; i < 3; i++) {
      const f = svFindings[i % svFindings.length] as any;
      if (!f) continue;
      const heading = [0, 90, 180][i];
      const lat = Number(f?.latitude ?? f?.lat);
      const lng = Number(f?.longitude ?? f?.lng);
      if (isNaN(lat) || isNaN(lng)) continue;
      
      const svData = await generateStreetViewBase64(lat, lng, heading);
      if (svData) {
        if (svCount > 0 && svCount % 4 === 0) {
            doc.addPage();
            y = MARGIN;
        }
        const col = svCount % 2;
        const rowInPage = Math.floor((svCount % 4) / 2);
        const currentX = MARGIN + col * (PHOTO_WIDTH + SPACING_X);
        const currentY = y + rowInPage * (PHOTO_HEIGHT + SPACING_Y);
        
        doc.setFontSize(11);
        doc.text(`Street View Evidencia ${i + 1}`, currentX, currentY);
        doc.addImage(svData, 'JPEG', currentX, currentY + 5, PHOTO_WIDTH, PHOTO_HEIGHT);
        svCount++;
      }
    }
  }

  if ((report as any).projectRef) {
    const log = createAuditLog(
      'Exportación PDF',
      (report as any).userRole || 'USER',
      (report as any).username || 'Usuario',
      `Se exportó el informe PDF del proyecto ${report.projectName}`
    );
    appendAuditLog(
      (report as any).projectRef,
      log
    );
  }

  doc.save(`Informe_${report.projectName}.pdf`);
};