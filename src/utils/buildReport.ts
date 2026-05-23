import { ConsolidatedReport } from '../types/Report';

export const buildReport = (project: any): ConsolidatedReport => {
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

    analyst: project.analyst || 'CEIPOL',
  };

  return report as ConsolidatedReport;
};