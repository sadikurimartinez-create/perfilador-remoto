export interface ReportFinding {
  photoId: string;
  riskLevel: 'low' | 'medium' | 'high';
  note: string;
  timestamp?: string;
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

// ===================================================
// MASTER CHAPTER CONTRACT v2.6.0 (ADR-014)
// ===================================================

export enum InstitutionalChapterID {
  CAP_01_RESUMEN = "CAP_01_RESUMEN",
  CAP_02_FICHA_TECNICA = "CAP_02_FICHA_TECNICA",
  CAP_03_MARCO_GEOGRAFICO = "CAP_03_MARCO_GEOGRAFICO",
  CAP_04_GEOINT = "CAP_04_GEOINT",
  CAP_05_OSINT = "CAP_05_OSINT",
  CAP_06_IAC_NARRATIVA = "CAP_06_IAC_NARRATIVA",
  CAP_07_EVIDENCIA_VISUAL = "CAP_07_EVIDENCIA_VISUAL",
  CAP_08_RECOMENDACIONES = "CAP_08_RECOMENDACIONES",
  CAP_09_ANEXOS_TECNICOS = "CAP_09_ANEXOS_TECNICOS",
  CAP_10_CERTIFICACION = "CAP_10_CERTIFICACION",
}

export interface IInstitutionalChapterSchema {
  id: InstitutionalChapterID;
  index: number;
  title: string;
  shortTitle: string;
  minLength: number;
  weight: number;
  requiresEvidence: boolean;
}

export const INSTITUTIONAL_CHAPTERS_SCHEMA: Record<InstitutionalChapterID, IInstitutionalChapterSchema> = {
  [InstitutionalChapterID.CAP_01_RESUMEN]: {
    id: InstitutionalChapterID.CAP_01_RESUMEN,
    index: 1,
    title: "SÍNTESIS EJECUTIVA DE ALTA DIRECCIÓN",
    shortTitle: "Resumen Ejecutivo",
    minLength: 150,
    weight: 0.15,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_02_FICHA_TECNICA]: {
    id: InstitutionalChapterID.CAP_02_FICHA_TECNICA,
    index: 2,
    title: "FICHA TÉCNICA INSTITUCIONAL DEL EXPEDIENTE",
    shortTitle: "Ficha Técnica",
    minLength: 100,
    weight: 0.05,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO]: {
    id: InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO,
    index: 3,
    title: "MARCO GEOGRÁFICO Y CONTEXTO DEL SITIO",
    shortTitle: "Marco Geográfico",
    minLength: 200,
    weight: 0.10,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_04_GEOINT]: {
    id: InstitutionalChapterID.CAP_04_GEOINT,
    index: 4,
    title: "ANÁLISIS DE INTELIGENCIA TERRITORIAL Y GEOMÁTICA (GEOINT)",
    shortTitle: "GEOINT",
    minLength: 250,
    weight: 0.15,
    requiresEvidence: true,
  },
  [InstitutionalChapterID.CAP_05_OSINT]: {
    id: InstitutionalChapterID.CAP_05_OSINT,
    index: 5,
    title: "EXPLORACIÓN DIGITAL Y CIBERINTELIGENCIA (OSINT)",
    shortTitle: "OSINT",
    minLength: 200,
    weight: 0.10,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_06_IAC_NARRATIVA]: {
    id: InstitutionalChapterID.CAP_06_IAC_NARRATIVA,
    index: 6,
    title: "SÍNTESIS NARRATIVA E HIPÓTESIS DELICTIVA (IAC)",
    shortTitle: "Narrativa IAC",
    minLength: 300,
    weight: 0.20,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL]: {
    id: InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL,
    index: 7,
    title: "EVIDENCIA FOTOGRÁFICA Y RECONOCIMIENTO VISUAL GOBERNADO",
    shortTitle: "Evidencias",
    minLength: 150,
    weight: 0.10,
    requiresEvidence: true,
  },
  [InstitutionalChapterID.CAP_08_RECOMENDACIONES]: {
    id: InstitutionalChapterID.CAP_08_RECOMENDACIONES,
    index: 8,
    title: "LÍNEAS DE ACCIÓN Y RECOMENDACIONES OPERATIVAS",
    shortTitle: "Recomendaciones",
    minLength: 200,
    weight: 0.05,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS]: {
    id: InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS,
    index: 9,
    title: "ANEXOS TÁCTICOS Y MATRICES COMPLEMENTARIAS ENIGH/SCINCE",
    shortTitle: "Anexos",
    minLength: 100,
    weight: 0.05,
    requiresEvidence: false,
  },
  [InstitutionalChapterID.CAP_10_CERTIFICACION]: {
    id: InstitutionalChapterID.CAP_10_CERTIFICACION,
    index: 10,
    title: "CERTIFICACIÓN DE CALIDAD DE INTELIGENCIA Y LINAJE OPERATIVO",
    shortTitle: "Certificación",
    minLength: 100,
    weight: 0.05,
    requiresEvidence: false,
  },
};