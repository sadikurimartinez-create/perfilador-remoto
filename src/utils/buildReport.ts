import { ConsolidatedReport } from '../types/Report';
import {
  renderPredictiveProductsForInstitutionalReport,
  selectPredictiveProductsForInstitutionalReport,
} from './institutionalPredictiveProductIntegration';

export const buildReport = (project: any): ConsolidatedReport => {
  const predictiveSelection = selectPredictiveProductsForInstitutionalReport(project, {
    expedienteId: project?.projectId || project?.id || project?.expedienteId || null,
    geographyId: project?.geographyId || project?.canonicalGeography?.geographyId || null,
    canonicalGeographyType: project?.canonicalGeography?.type || null,
  });
  const report: any = {
    projectId: project.id || '',
    projectName: project.name || 'Sin nombre',

    createdAt: new Date().toISOString(),

    geometryType: project.geometryType || 'individual',

    descripcion: project.descripcion || project.voiceNotes?.join('\n') || '',

    objectives: project.objectives || [],

    textNotes: project.textNotes || [],

    voiceNotes: project.voiceNotes || [],

    findings:
      project.iaAnalysis?.map((item: any) => ({
        photoId: item.photoId,
        riskLevel: item.riskLevel,
        note: item.note,
        timestamp:
          item.timestamp ||
          item.createdAt ||
          new Date().toISOString(),
        latitude: item.latitude,
        longitude: item.longitude,
        tipo: item.tipo || item.photoType || 'Sin clasificar',
      })) || [],

    conclusions: [],

    recommendations: [],

    predictiveAnalyticalProducts: predictiveSelection.products,
    prospectiveAnalysis: renderPredictiveProductsForInstitutionalReport(predictiveSelection.products),
    predictiveProductExclusions: predictiveSelection.exclusions,

    analyst: project.analyst || 'CEIPOL',
  };

  return report as ConsolidatedReport;
};
