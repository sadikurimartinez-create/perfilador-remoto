import { ConsolidatedReport } from '../types/Report';

export const buildReport = (project: any): ConsolidatedReport => {
  return {
    projectId: project.id || '',
    projectName: project.name || 'Sin nombre',

    createdAt: new Date().toISOString(),

    geometryType: project.geometryType || 'individual',

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
      })) || [],

    conclusions: [],

    recommendations: [],

    analyst: project.analyst || 'CEIPOL',
  };
};