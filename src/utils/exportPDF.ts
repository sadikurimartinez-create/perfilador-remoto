import { jsPDF } from 'jspdf';
import { captureMapImage } from './captureMpas';
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
  const doc = new jsPDF();

  const mapImage = await captureMapImage(
    'project-map-capture'
  );

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
  const lines = doc.splitTextToSize(narrative, 170);
  lines.forEach((line: string) => {
    // Salto de página automático si la narrativa es muy larga
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 7;
  });
  
  if (y > 270) {
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
    170
  );

  classificationLines.forEach((line: string) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 7;
  });

  y += 15;

 if (mapImage) {
  // Evitamos que el mapa quede cortado por la mitad en el borde inferior
  if (y > 170) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(14);

  doc.text('MAPA DEL PROYECTO', 20, y);

  y += 10;

  doc.addImage(
    mapImage,
    'PNG',
    20,
    y,
    170,
    90
  );

  y += 100;
} 

  doc.text('HALLAZGOS', 20, y);

  y += 10;

const photoDataURLs = await getPhotoDataURLs(report.findings);

for (let i = 0; i < photoDataURLs.length; i++) {
  const dataURL = photoDataURLs[i];
  if (dataURL) {
    y += 5;
    doc.setFontSize(12);
    doc.text(`Evidencia Foto ${i + 1}`, 20, y);
    y += 5;
    doc.addImage(dataURL, 'PNG', 20, y, 60, 45);
    y += 50;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }
}

  report.findings.forEach((finding, index) => {
    doc.setFontSize(11);

    doc.text(
      `${index + 1}. Riesgo: ${(finding.riskLevel || 'N/A').toUpperCase()}`,
      20,
      y
    );

    y += 8;

    doc.text(`Observación: ${finding.note || 'Sin observación'}`, 25, y);

    y += 12;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

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

  doc.save(`Dictamen_Ejecutivo_${report.projectName}.pdf`);
};