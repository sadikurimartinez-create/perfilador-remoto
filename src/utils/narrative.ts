import { ConsolidatedReport } from '../types/Report';
import { calculateRisk } from './scoring';

export const generateNarrative = (report: ConsolidatedReport): string => {
  const risk = calculateRisk(report.findings);
  const totalFindings = report.findings.length;

  let narrative = `El proyecto "${report.projectName}" contiene ${totalFindings} hallazgos analizados. `;
  narrative += `El nivel de riesgo promedio es ${risk.averageScore.toFixed(2)}, clasificado como "${risk.classification}". `;

  if (risk.classification === 'Alto') {
    narrative += 'Se recomienda atención inmediata y medidas preventivas en las zonas identificadas.';
  } else if (risk.classification === 'Medio') {
    narrative += 'Se recomienda monitoreo constante y análisis periódico de los hallazgos.';
  } else {
    narrative += 'Se considera que los hallazgos representan un riesgo bajo.';
  }

  narrative += ' Este informe integra evidencias fotográficas, mapa georreferenciado y hallazgos de IA.';

  return narrative;
};