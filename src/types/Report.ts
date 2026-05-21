export interface ReportFinding {
  photoId: string;
  riskLevel: 'low' | 'medium' | 'high';
  note: string;
  latitude?: number;
  longitude?: number;
}

export interface ConsolidatedReport {
  projectId: string;
  projectName: string;
  createdAt: string;

  geometryType: 'individual' | 'linear' | 'polygon';

  objectives: string[];

  textNotes: string[];

  voiceNotes: string[];

  findings: ReportFinding[];

  conclusions: string[];

  recommendations: string[];

  analyst?: string;
}