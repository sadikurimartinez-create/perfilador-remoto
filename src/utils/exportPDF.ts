import jsPDF from 'jspdf';
import { ConsolidatedReport } from '../types/Report';

export const exportPDF = (report: ConsolidatedReport) => {
  const doc = new jsPDF();

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

  doc.setFontSize(14);
  doc.text('HALLAZGOS', 20, y);

  y += 10;

  report.findings.forEach((finding, index) => {
    doc.setFontSize(11);

    doc.text(
      `${index + 1}. Riesgo: ${finding.riskLevel.toUpperCase()}`,
      20,
      y
    );

    y += 8;

    doc.text(`Observación: ${finding.note}`, 25, y);

    y += 12;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(`Informe_${report.projectName}.pdf`);
};