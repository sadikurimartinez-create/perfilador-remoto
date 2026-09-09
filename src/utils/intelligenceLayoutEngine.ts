import { ConsolidatedReport } from '../types/Report';
import { ReportIntelligenceNormalizer } from './reportIntelligenceNormalizer';
import { validateGeoIntegrity } from './geoIntegrityEngine';
import { buildOperationalOsintChapter } from './osintChapterBuilder';
import { StatisticalIntelligenceEngineV2 } from './statisticalIntelligenceEngineV2';
import { StatisticalEvidenceMatrixManager } from './statisticalEvidenceMatrix';
import { TCE_DEFAULT_FALLBACK, TerritorialContextEngine } from './territorialContextEngine';
import { VisualEvidenceEngine } from "./visualEvidenceEngine";
import { HypothesisIntelligenceEngine, HIEResult } from './hypothesisIntelligenceEngine';
import { CartographicIntelligenceEngine } from './cartographicIntelligenceEngine';
import { safeUpperCase } from '../lib/exportToWord';
import { InvestigationHypothesis, GeneralHypothesis, SecondaryAnalyticalFactor, HypothesisLifecycle } from './hypothesisLifecycle';
import { IntelligenceEvidenceObject } from './evidenceGovernanceEngine';
import { HypothesisConfidenceAssessment } from './hypothesisConfidenceCalibrationEngine';
import { OperationalDecisionObject } from './hypothesisDecisionIntelligenceEngine';
import { PhotoEvidenceGovernanceEngine } from './photoEvidenceGovernanceEngine';
import { isValidStreetViewImage } from './streetViewValidator';
import { resolveVisibleNumeroExpediente } from './documentIdentity';
import type { PandillasSweepStatus } from '../modules/pandillas/pandillas.sweepStatus';


import {
  renderDensityMap,
  renderMobilityMap,
  renderAttractorsMap,
  renderPredictiveMap,
  renderTemporalShiftChart,
  renderCrimeTopologyChart,
  renderEnvironmentalFactorsChart,
  renderPredictiveLineChart,
  renderHypothesisGraph
} from "./vectorRenderEngine";

export type IntelligenceVisualType =
  | 'map'
  | 'graph'
  | 'streetView'
  | 'chart';

const formatToFourPartStructure = (
  text: string,
  projectName: string,
  date: string,
  location: string,
  defaultHallazgo = "",
  defaultEvidencia = "",
  defaultAnalisis = "",
  defaultImplicacion = ""
): string => {
  if (text.includes("HALLAZGO") && text.includes("EVIDENCIA") && text.includes("ANÁLISIS")) {
    return text;
  }
  const clean = text.replace(/^(hallazgo|evidencia|análisis|implicación operativa):\s*/gi, "").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const hallazgo = sentences[0] || defaultHallazgo || `Presencia de facilitadores de oportunidad en el perímetro de ${projectName}.`;
  const evidencia = defaultEvidencia || `Registros documentales de incidentes delictivos y censo de campo de geointeligencia CEIPOL con fecha ${date} en ubicación ${location}.`;
  const analisis = sentences.slice(1, 4).join(" ") || defaultAnalisis || `El análisis criminológico territorial confirma la convergencia de vulnerabilidades ambientales que posibilitan conductas delictivas recurrentes.`;
  const implicacion = sentences.slice(4).join(" ") || defaultImplicacion || `Reforzar la vigilancia preventiva en el cuadrante mediante patrullajes dinámicos y solicitar el mantenimiento prioritario del entorno.`;

  return `HALLAZGO:\n${hallazgo}\n\nEVIDENCIA:\n${evidencia}\n\nANÁLISIS:\n${analisis}\n\nIMPLICACIÓN OPERATIVA:\n${implicacion}`;
};

export interface IntelligenceVisualProduct {
  id: string;
  type: IntelligenceVisualType;
  title: string;
  dataUrl: string;
  caption: string;
  riskLevel?: string;
}

export interface IntelligenceLayoutPage {
  id: string;
  title: string;
  mode: 'single' | 'double' | 'text' | 'cover' | 'hypothesis' | 'sweeps' | 'conclusions' | 'executive' | 'trazabilidad';
  visuals: IntelligenceVisualProduct[];
  interpretation?: string;
  // Metadata for custom pages
  riskLevel?: string;
  bullets?: string[];
  recommendation?: string;
  summary?: string;
  hypothesis?: string[];
  sweeps?: any[];
  conclusions?: string[];
}

export interface IntelligenceBriefing {
  title: string;
  fileNumber: string;
  generatedAt: string;
  classification: string;
  globalRisk: string;
  pages: IntelligenceLayoutPage[];
}

const normalizeRisk = (risk?: string): string => {
  const value = (risk || '').toLowerCase();
  if (value === 'high' || value === 'alto' || value === 'crítico' || value === 'critico') return 'ALTO';
  if (value === 'medium' || value === 'medio') return 'MEDIO';
  if (value === 'low' || value === 'bajo') return 'BAJO';
  return 'NO DETERMINADO';
};

export const getGlobalRiskLabel = (report: ConsolidatedReport): string => {
  const risks = report.findings.map((finding: any) =>
    normalizeRisk(finding.riskLevel)
  );

  if (risks.includes('ALTO')) return 'ALTO';
  if (risks.includes('MEDIO')) return 'MEDIO';
  if (risks.includes('BAJO')) return 'BAJO';
  return 'NO DETERMINADO';
};

const firstNonEmpty = (...values: Array<string | undefined | null>): string =>
  values.find((value) => value && value.trim().length > 0)?.trim() || '';

const compactText = (text: string, maxLength = 120): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

export const buildPhotoCaption = (finding: any, index: number): string => {
  const risk = normalizeRisk(finding.riskLevel);
  const observation = firstNonEmpty(
    finding.note,
    finding.descripcion,
    finding.description,
    'Evidencia registrada.'
  );
  return compactText(`[Riesgo ${risk}] Foto ${index + 1}: ${observation}`, 110);
};

export const applyInstitutionalWatermark = async (
  dataUrl: string,
  label = 'SSPE-CEIPOL'
): Promise<string> => {
  if (!dataUrl || typeof document === 'undefined') return dataUrl;

  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No fue posible cargar el visual'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const bandHeight = Math.max(34, Math.floor(canvas.height * 0.095));
    ctx.fillStyle = 'rgba(7, 31, 64, 0.72)';
    ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);

    const fontSize = Math.max(18, Math.floor(canvas.width * 0.038));
    ctx.font = `700 ${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width - 22, canvas.height - bandHeight / 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.floor(canvas.width * 0.004));
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    return canvas.toDataURL(dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 0.92);
  } catch {
    return dataUrl;
  }
};

export const loadPublicImageAsDataUrl = async (path: string): Promise<string | null> => {
  if (typeof document === 'undefined') return null;

  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = path;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No fue posible cargar el logotipo'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

/**
 * Genera una gráfica de fallback en formato base64 usando HTML Canvas
 */
export const generateFallbackChart = (type: 'delitos' | 'atractores' | 'riesgo'): string => {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Fondo institucional
    ctx.fillStyle = '#0b1f3a';
    ctx.fillRect(0, 0, 600, 400);

    // Borde
    ctx.strokeStyle = '#1d4f91';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 596, 396);

    // Título
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    if (type === 'delitos') {
      ctx.fillText('Distribución de Delitos (Fallback)', 300, 40);
      const data = [45, 25, 15, 10, 5];
      const labels = ['Robo', 'Asalto', 'Lesiones', 'Vandalismo', 'Otros'];
      const colors = ['#e11d48', '#f59e0b', '#3b82f6', '#10b981', '#6b7280'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = colors[i];
        const h = data[i] * 5;
        ctx.fillRect(80 + i * 90, 320 - h, 60, h);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(labels[i], 110 + i * 90, 340);
        ctx.fillText(`${data[i]}%`, 110 + i * 90, 310 - h);
      }
    } else if (type === 'atractores') {
      ctx.fillText('Densidad de Atractores Ambientales (Fallback)', 300, 40);
      const data = [40, 30, 20, 10];
      const labels = ['Alcohol', 'Baldíos', 'Taller', 'Comercio'];
      const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];
      let totalAngle = 0;
      for (let i = 0; i < 4; i++) {
        const angle = (data[i] / 100) * Math.PI * 2;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(300, 200);
        ctx.arc(300, 200, 100, totalAngle, totalAngle + angle);
        ctx.closePath();
        ctx.fill();
        totalAngle += angle;

        ctx.fillStyle = colors[i];
        ctx.fillRect(450, 100 + i * 30, 15, 15);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${labels[i]} (${data[i]}%)`, 475, 112 + i * 30);
      }
    } else {
      ctx.fillText('Índice de Riesgo por Zona (Fallback)', 300, 40);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(300, 100);
      ctx.lineTo(400, 200);
      ctx.lineTo(350, 300);
      ctx.lineTo(250, 300);
      ctx.lineTo(200, 200);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText('Zona N', 300, 90);
      ctx.fillText('Zona E', 420, 200);
      ctx.fillText('Zona S', 300, 320);
      ctx.fillText('Zona W', 180, 200);
    }

    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * DEFINE EL OBJETO INTERMEDIO (FUENTE ÚNICA DE VERDAD v9.0 - DICTAMEN TÉCNICO DE INTELIGENCIA)
 */
export interface IntelligenceReportPayload {
  projectName: string;
  projectId: string;
  ceipolId?: string;
  numeroExpediente?: string;
  date: string;
  analyst: string;
  geometryType: string;
  areaGeografica: string;
  contextoTerritorial: string;
  hipotesisPrincipal: {
    queOcurre: string;
    dondeOcurre: string;
    quienParticipa: string;
    porQueOcurre: string;
    evidenciaSustento: string;
    nivelConfianza: string;
  };
  valoracionOperacional: {
    amenaza: string;
    oportunidadCriminal: string;
    vulnerabilidades: string;
    capacidadRequerida: string;
  };
  trazabilidadMatrix: {
    componente: string;
    fuente: string;
    metodo: string;
    hallazgo: string;
    impacto: string;
  }[];
  maps: {
    title: string;
    dataUrl: string;
    interpretation: string;
  }[];
  graphs: {
    title: string;
    dataUrl: string;
    explanation: string;
    finding: string;
    relation: string;
  }[];
  photoEvidence: {
    id: string;
    dataUrl: string;
    caption: string;
    location: string;
    factor: string;
    criminologicalInterpretation: string;
    relation: string;
    riskLevel: string;
  }[];
  streetViewAnalysis: {
    id?: string;
    title: string;
    dataUrl: string;
    location: string;
    fuentePrimaria?: string;
    fechaCaptura?: string;
    direccion?: string;
    orientacion?: string;
    observed: string;
    indicadorCriminologico?: string;
    inferenciaAnalitica?: string;
    confianza?: string;
    impactoHipotesis?: string;
    recomendacion?: string;
    criminologicalAnalysis?: string;
    relation?: string;
  }[];
  hypothesisGraph: {
    title: string;
    dataUrl: string;
    interpretation: string;
  };
  osintSynthesized: string;
  pandillasAnalysis: string;
  sweepsData: {
    engine: string;
    source: string;
    data: string;
    context: string;
  }[];
  conclusiones: {
    hallazgosCriticos: string[];
    riesgosInmediatos: string[];
    escenariosFuturos: string[];
    recomendacionesTacticas: string[];
    recomendacionesEstrategicas: string[];
  };
  executiveSummary: string;
  finalHypothesis: string;
  mapsText?: string;
  statsText?: string;
  evidenceText?: string;
  streetViewText?: string;
  graphText?: string;
  conclusionesText?: string;
  latitude?: number | null;
  longitude?: number | null;
  analysisRadius?: number;
  hieData?: HIEResult;
  cieData?: any;
  historicalIncidents?: any[];
  sieData?: any;
  semData?: any;
  aceReport?: any;
  visualEvidenceMatrix?: any;
  intelligenceContext?: any;
  hypothesisLifecycle?: InvestigationHypothesis;
  hipotesisGeneral?: GeneralHypothesis;
  secondaryAnalyticalFactors?: SecondaryAnalyticalFactor[];
  hypothesisLifecycleUnificada?: HypothesisLifecycle;
  evidenceRegistry?: IntelligenceEvidenceObject[];
  confidenceAssessment?: HypothesisConfidenceAssessment;
  evidenceConflicts?: any[];
  operationalDecision?: OperationalDecisionObject;
  governedEvidence?: any;
}

/**
 * DEPURACIÓN DE JERGA TÉCNICA Y COMANDOS IA
 */
export function cleanTechnicalJargon(text: string): string {
  return ReportIntelligenceNormalizer.normalize(text);
}

/**
 * MOTOR DE RESUMEN FOTOGRÁFICO (Máx 800 caracteres)
 */
export function summarizeEvidence(description: string): string {
  let cleaned = cleanTechnicalJargon(description || "Evidencia fotográfica táctica.");
  if (cleaned.length > 800) {
    const truncated = cleaned.slice(0, 790);
    const lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > 100) {
      cleaned = truncated.slice(0, lastPeriod + 1) + "...";
    } else {
      cleaned = truncated + "...";
    }
  }
  return cleaned;
}

/**
 * ESTRUCTURAR EL PIE FOTOGRÁFICO
 */
export function getPhotoFooter(photo: any, index: number) {
  const comment = cleanTechnicalJargon(photo.comentario || photo.description || "");
  
  let location = "";
  if (photo.lat && photo.lng) {
    location = `${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`;
  } else {
    const locMatch = comment.match(/Ubicación:\s*([^.\n]+)/i);
    location = locMatch ? locMatch[1].trim() : "Perímetro inmediato del polígono";
  }

  let factor = "";
  const factorMatch = comment.match(/Factor[^:]*:\s*([^.\n]+)/i);
  if (factorMatch) {
    factor = factorMatch[1].trim();
  } else {
    factor = comment.split(/[.,;]/)[0] || "Factor de oportunidad ambiental por falta de control";
    if (factor.length > 80) factor = factor.slice(0, 80) + "...";
  }

  let relation = "";
  const relMatch = comment.match(/Relación[^:]*:\s*([^.\n]+)/i);
  if (relMatch) {
    relation = relMatch[1].trim();
  } else {
    relation = "Incidencia en la accesibilidad nocturna al área de interés";
  }

  const riskLevel = (photo.riskLevel || "medio").toUpperCase();

  return {
    location,
    factor,
    relation,
    riskLevel
  };
}

/**
 * EXTRAER SECCIONES DEL MARKDOWN DE LA IA
 */
export function extractSection(content: string, secNum: number): string {
  const lines = content.split("\n");
  let capturing = false;
  const sectionLines: string[] = [];
  const secPattern = new RegExp(`^##\\s*${secNum}\\b`, 'i');
  const nextSecPattern = new RegExp(`^##\\s*${secNum + 1}\\b`, 'i');

  for (const line of lines) {
    if (secPattern.test(line.trim())) {
      capturing = true;
      continue;
    }
    if (capturing && nextSecPattern.test(line.trim())) {
      capturing = false;
      break;
    }
    if (capturing) {
      sectionLines.push(line);
    }
  }
  
  let result = sectionLines.join("\n").trim();
  // Limpia cualquier encabezado duplicado que empiece con "## X" o "X. CAPÍTULO" o similar al principio del texto extraído
  result = result.replace(/^\s*(?:#+\s*)?\d+\.?\s*(?:CAPÍTULO|PORTADA|EXECUTIVE|CONCLUSIONES|INTRODUCCIÓN|ANÁLISIS|EVIDENCIA|IMPLICACIÓN)[^\n]*\n?/i, "");
  return result.trim();
}

export function resolveProjectGeolocationForReport(project: any, sourceReference = "intelligenceLayoutEngine.project") {
  const geoValidation = validateGeoIntegrity({
    latitude: project?.lat ?? project?.latitude ?? null,
    longitude: project?.lng ?? project?.longitude ?? null,
    source: project?.geolocationSource || "PROJECT_GEOMETRY",
    precision: project?.geolocationPrecision ?? null,
    observedAt: project?.geolocationObservedAt ?? null,
    sourceReference,
  });

  return {
    latitude: geoValidation.reportableAsObservedGeoint ? geoValidation.latitude : null,
    longitude: geoValidation.reportableAsObservedGeoint ? geoValidation.longitude : null,
    geoValidation,
  };
}

export type PandillasEvidenceState =
  | "EVIDENCE_PRESENT"
  | "EVIDENCE_EMPTY"
  | "EVIDENCE_UNAVAILABLE"
  | "EVIDENCE_INELIGIBLE"
  | "NO_EVIDENCE";

const PANDILLAS_TERMINAL_STATUSES: PandillasSweepStatus[] = [
  "SUCCESS",
  "EMPTY",
  "NOT_CONFIGURED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "VALIDATION_ERROR",
];

export const PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT =
  "No se dispone de evidencia gobernada suficiente para establecer presencia, influencia o actividad de pandillas en el area analizada.";

export const PANDILLAS_EMPTY_EVIDENCE_TEXT =
  "El barrido de Pandillas no identifico coincidencias gobernadas en la consulta realizada. Esta ausencia se limita al alcance de la consulta ejecutada.";

export interface PandillasEvidenceAssessment {
  state: PandillasEvidenceState;
  status?: PandillasSweepStatus;
  sweep?: any;
  facts: string[];
  provenance: string[];
}

const getObjectValue = (value: any): any | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const isPandillasSweepCandidate = (sweep: any): boolean => {
  const markers = [
    sweep?.engine,
    sweep?.source,
    sweep?.sourceType,
    sweep?.provider,
    sweep?.type,
    sweep?.module,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return markers.some((value) =>
    value.includes("pandilla") ||
    value.includes("gang") ||
    value.includes("gim")
  );
};

const normalizePandillasStatus = (sweep: any): PandillasSweepStatus | undefined => {
  const candidates = [
    sweep?.sweepStatus,
    sweep?.statusP1E,
    sweep?.result?.sweepStatus,
    sweep?.data?.sweepStatus,
    sweep?.raw?.sweepStatus,
    sweep?.context?.sweepStatus,
  ];
  const status = candidates
    .map((value) => typeof value === "string" ? value.toUpperCase() : "")
    .find((value) => PANDILLAS_TERMINAL_STATUSES.includes(value as PandillasSweepStatus));
  return status as PandillasSweepStatus | undefined;
};

const pushFact = (facts: string[], label: string, value: any) => {
  if (value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) {
    const rendered = value
      .filter((item) => item !== undefined && item !== null && String(item).trim())
      .map((item) => String(item).trim())
      .join("; ");
    if (rendered) facts.push(`${label}: ${rendered}`);
    return;
  }
  facts.push(`${label}: ${String(value).trim()}`);
};

const extractPandillasFacts = (sweep: any): string[] => {
  const result = getObjectValue(sweep?.result) || getObjectValue(sweep?.data) || getObjectValue(sweep?.raw) || sweep;
  const facts: string[] = [];

  pushFact(facts, "grupo reportado", result?.nombre || result?.name || result?.grupo || result?.gangName);
  pushFact(facts, "zona reportada", result?.zonaInfluencia || result?.territorio || result?.area || result?.sector);
  pushFact(facts, "hallazgo", result?.hallazgo || result?.finding || result?.hallazgos || result?.findings);
  pushFact(facts, "descripcion", result?.descripcion || result?.description || result?.summary);
  pushFact(facts, "integrantes registrados", result?.integrantes || result?.members);
  pushFact(facts, "confidence", result?.confidence ?? result?.confidenceScore);

  return facts;
};

const extractPandillasProvenance = (sweep: any, status?: PandillasSweepStatus): string[] => {
  const provenance: string[] = [];
  pushFact(provenance, "sweepStatus", status);
  pushFact(provenance, "provider", sweep?.provider || sweep?.sourceProvider);
  pushFact(provenance, "source", sweep?.source || sweep?.engine);
  pushFact(provenance, "generatedAt", sweep?.generatedAt || sweep?.createdAt || sweep?.timestamp);
  pushFact(provenance, "model", sweep?.model);
  pushFact(provenance, "traceabilityId", sweep?.traceabilityId || sweep?.traceabilityReference);
  pushFact(provenance, "evidenceIds", sweep?.evidenceIds || sweep?.outputEvidenceIds);
  return provenance;
};

export const assessPandillasEvidence = (sweeps: any[] = []): PandillasEvidenceAssessment => {
  const pandillasSweeps = (sweeps || []).filter(isPandillasSweepCandidate);
  if (pandillasSweeps.length === 0) {
    return { state: "NO_EVIDENCE", facts: [], provenance: [] };
  }

  for (const sweep of pandillasSweeps) {
    const status = normalizePandillasStatus(sweep);
    if (!status) continue;

    const facts = extractPandillasFacts(sweep);
    const provenance = extractPandillasProvenance(sweep, status);

    if (status === "SUCCESS") {
      return { state: "EVIDENCE_PRESENT", status, sweep, facts, provenance };
    }
    if (status === "EMPTY") {
      return { state: "EVIDENCE_EMPTY", status, sweep, facts: [], provenance };
    }
    return { state: "EVIDENCE_UNAVAILABLE", status, sweep, facts: [], provenance };
  }

  return { state: "EVIDENCE_INELIGIBLE", facts: [], provenance: [] };
};

const renderPandillasProvenance = (provenance: string[]): string =>
  provenance.length > 0 ? provenance.map((item) => `- ${item}`).join("\n") : "- Sin provenance gobernado disponible.";

export const buildEvidenceBoundPandillasNarrative = (sweeps: any[] = []): string => {
  const assessment = assessPandillasEvidence(sweeps);

  if (assessment.state === "EVIDENCE_PRESENT") {
    const facts = assessment.facts.length > 0
      ? assessment.facts.map((fact) => `- ${fact}`).join("\n")
      : "- El resultado SUCCESS no contiene atributos narrables suficientes para afirmar presencia, influencia o actividad especifica.";

    return `HALLAZGO:\n${facts}\n\nEVIDENCIA:\n${renderPandillasProvenance(assessment.provenance)}\n\nANÁLISIS:\nLa narrativa se limita a los atributos presentes en el resultado gobernado del barrido de Pandillas. No se agregan atributos ausentes ni inferencias contextuales no sustentadas.\n\nIMPLICACIÓN OPERATIVA:\nUsar estos datos solo dentro del alcance, fuente y estado terminal reportados por el barrido gobernado.`;
  }

  if (assessment.state === "EVIDENCE_EMPTY") {
    return `HALLAZGO:\n${PANDILLAS_EMPTY_EVIDENCE_TEXT}\n\nEVIDENCIA:\n${renderPandillasProvenance(assessment.provenance)}\n\nANÁLISIS:\nEl resultado EMPTY se interpreta unicamente como ausencia de coincidencias dentro del alcance de la consulta ejecutada; no equivale a inexistencia absoluta de pandillas.\n\nIMPLICACIÓN OPERATIVA:\nNo elevar el capitulo a hecho positivo sin un nuevo barrido gobernado con hallazgos verificables.`;
  }

  const statusDetail = assessment.status ? ` Estado terminal recibido: ${assessment.status}.` : "";
  return `HALLAZGO:\n${PANDILLAS_INSUFFICIENT_EVIDENCE_TEXT}\n\nEVIDENCIA:\nNo existe barrido gobernado SUCCESS o EMPTY que habilite narrativa factual de Pandillas.${statusDetail}\n\nANÁLISIS:\nLas menciones lexicales en markdown, CIFA, SCINCE u otros contextos diagnosticos no constituyen corroboracion institucional de Pandillas.\n\nIMPLICACIÓN OPERATIVA:\nMantener el capitulo en condicion de evidencia insuficiente hasta contar con resultado gobernado admisible.`;
};

const buildPandillasTraceabilityEntry = (assessment: PandillasEvidenceAssessment) => {
  if (assessment.state === "EVIDENCE_PRESENT") {
    return {
      componente: "Motor de Pandillas",
      fuente: assessment.sweep?.source || assessment.sweep?.provider || "Barrido gobernado de Pandillas",
      metodo: "Evaluacion evidence-bound P1-E",
      hallazgo: assessment.facts[0] || "Resultado SUCCESS sin atributos narrables",
      impacto: `Estado: ${assessment.status}`
    };
  }
  if (assessment.state === "EVIDENCE_EMPTY") {
    return {
      componente: "Motor de Pandillas",
      fuente: assessment.sweep?.source || assessment.sweep?.provider || "Barrido gobernado de Pandillas",
      metodo: "Evaluacion evidence-bound P1-E",
      hallazgo: "Sin coincidencias gobernadas en la consulta ejecutada",
      impacto: `Estado: ${assessment.status}`
    };
  }
  return null;
};

export type EditorialEvidenceState =
  | "EVIDENCE_SUFFICIENT"
  | "EVIDENCE_LIMITED"
  | "EVIDENCE_EMPTY"
  | "EVIDENCE_UNAVAILABLE"
  | "EVIDENCE_INELIGIBLE"
  | "NO_EVIDENCE";

export type RecommendationClass =
  | "EVIDENCE_DERIVED"
  | "GENERIC_NON_FACTUAL"
  | "NOT_PERMITTED";

export const EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT =
  "No se dispone de evidencia gobernada suficiente para formular conclusiones operativas especificas en este rubro.";

export const EDITORIAL_EMPTY_EVIDENCE_TEXT =
  "La consulta realizada no identifico coincidencias dentro del universo y parametros analizados.";

interface EditorialEvidenceAssessment {
  state: EditorialEvidenceState;
  reasons: string[];
  facts: string[];
  provenance: string[];
}

interface EvidenceBoundConclusions {
  hallazgosCriticos: string[];
  riesgosInmediatos: string[];
  escenariosFuturos: string[];
  recomendacionesTacticas: string[];
  recomendacionesEstrategicas: string[];
}

const isIneligibleEditorialSource = (item: any): boolean => {
  const markers = [
    item?.source,
    item?.sourceId,
    item?.provider,
    item?.providerId,
    item?.sourceStatus,
    item?.acquisitionMode,
    item?.origin_type,
    item?.epistemicIntegrity?.acquisitionMode,
  ]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase());

  return markers.some((value) =>
    value.includes("SCINCE_LOCAL_SIMULATOR") ||
    value.includes("CIFA_LEGACY_DIAGNOSTIC") ||
    value.includes("SIMULATED") ||
    value.includes("MOCK") ||
    value.includes("CONNECTIVITY_ONLY")
  );
};

const normalizeEditorialStatus = (item: any): string => String(
  item?.queryStatus ||
  item?.sweepStatus ||
  item?.sourceStatus ||
  item?.providerStatus ||
  item?.denueStatus ||
  item?.status ||
  ""
).toUpperCase();

const hasGovernedSuccessStatus = (item: any): boolean => {
  const status = normalizeEditorialStatus(item);
  return status === "SUCCESS" ||
    status === "SUCCESS_WITH_DATA" ||
    status === "POSTGIS_AVAILABLE" ||
    status === "AUTHORITATIVE" ||
    status === "APPROVED_EVIDENCE" ||
    status === "APPROVED" ||
    status === "APROBADO";
};

const hasEditorialEmptyStatus = (item: any): boolean => normalizeEditorialStatus(item) === "EMPTY" ||
  normalizeEditorialStatus(item) === "SUCCESS_EMPTY";

const hasEditorialUnavailableStatus = (item: any): boolean => [
  "NOT_CONFIGURED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "AUTH_ERROR",
  "VALIDATION_ERROR",
  "INVALID_RESPONSE",
  "FAILED",
].includes(normalizeEditorialStatus(item));

const getIncidentType = (incident: any): string =>
  firstNonEmpty(
    incident?.incidentType,
    incident?.tipo,
    incident?.delito,
    incident?.classification,
    "incidencia documentada"
  );

const getIncidentDate = (incident: any): string =>
  firstNonEmpty(incident?.occurredDate, incident?.fecha, incident?.date, "");

const extractEditorialSuccessFacts = (item: any): string[] => {
  const result = getObjectValue(item?.result) || getObjectValue(item?.data) || getObjectValue(item?.raw) || item;
  const facts: string[] = [];

  pushFact(facts, "hallazgo", result?.hallazgo || result?.finding || result?.text || result?.summary);
  pushFact(facts, "descripcion", result?.descripcion || result?.description);
  pushFact(facts, "zona", result?.zona || result?.zonaInfluencia || result?.area || result?.sector);
  pushFact(facts, "confidence", result?.confidence ?? result?.confidenceScore);

  return facts;
};

export const assessEditorialEvidence = (input: {
  incidents?: any[];
  sweeps?: any[];
  album?: any[];
}): EditorialEvidenceAssessment => {
  const incidents = (input.incidents || []).filter((incident) => !isIneligibleEditorialSource(incident));
  const sweeps = (input.sweeps || []).filter((sweep) => !isIneligibleEditorialSource(sweep));
  const album = (input.album || []).filter((photo) => !isIneligibleEditorialSource(photo));
  const facts: string[] = [];
  const provenance: string[] = [];

  if (incidents.length > 0) {
    const incidentTypes = incidents.map(getIncidentType).filter(Boolean);
    const topType = incidentTypes[0] || "incidencia documentada";
    pushFact(facts, "incidencia", `${incidents.length} registro(s) gobernado(s); patron observado: ${topType}`);
    pushFact(provenance, "incidenceSource", incidents[0]?.sourceStatus || incidents[0]?.querySource || "INCIDENCIA_GOVERNED");
    pushFact(provenance, "incidenceEvidenceId", incidents[0]?.evidenceId || incidents[0]?.id);
    pushFact(provenance, "incidenceDate", getIncidentDate(incidents[0]));
  }

  for (const sweep of sweeps) {
    if (hasGovernedSuccessStatus(sweep)) {
      const sweepFacts = extractEditorialSuccessFacts(sweep);
      if (sweepFacts.length > 0) {
        facts.push(...sweepFacts.map((fact) => `${sweep.engine || sweep.source || "fuente gobernada"}: ${fact}`));
      }
      pushFact(provenance, "source", sweep.source || sweep.engine);
      pushFact(provenance, "provider", sweep.provider || sweep.providerId);
      pushFact(provenance, "status", normalizeEditorialStatus(sweep));
      pushFact(provenance, "traceabilityId", sweep.traceabilityId || sweep.traceabilityReference);
    }
  }

  if (album.length > 0) {
    pushFact(facts, "evidencia visual", `${album.length} registro(s) fotografico(s) gobernado(s)`);
    pushFact(provenance, "photoEvidenceId", album[0]?.evidenceId || album[0]?.id);
  }

  if (facts.length > 0) {
    return { state: "EVIDENCE_SUFFICIENT", reasons: [], facts, provenance };
  }

  const allItems = [...(input.incidents || []), ...(input.sweeps || []), ...(input.album || [])];
  if (allItems.some(isIneligibleEditorialSource)) {
    return { state: "EVIDENCE_INELIGIBLE", reasons: ["SOURCE_INELIGIBLE"], facts: [], provenance };
  }
  if (allItems.some(hasEditorialUnavailableStatus)) {
    return { state: "EVIDENCE_UNAVAILABLE", reasons: ["SOURCE_UNAVAILABLE"], facts: [], provenance };
  }
  if (allItems.some(hasEditorialEmptyStatus)) {
    return { state: "EVIDENCE_EMPTY", reasons: ["EMPTY_RESULT"], facts: [], provenance };
  }

  return { state: "NO_EVIDENCE", reasons: ["NO_GOVERNED_EVIDENCE"], facts: [], provenance };
};

export const classifyEditorialRecommendation = (
  recommendation: string,
  assessment: EditorialEvidenceAssessment
): RecommendationClass => {
  const text = recommendation.toLowerCase();
  const specificMarkers = [
    "patrullaje",
    "operativo",
    "corredor",
    "horario",
    "22:00",
    "02:00",
    "zona",
    "centro de gravedad",
    "coordenad",
  ];
  if (assessment.state === "EVIDENCE_SUFFICIENT") return "EVIDENCE_DERIVED";
  if (specificMarkers.some((marker) => text.includes(marker))) return "NOT_PERMITTED";
  return "GENERIC_NON_FACTUAL";
};

export const buildEvidenceBoundConclusions = (assessment: EditorialEvidenceAssessment): EvidenceBoundConclusions => {
  if (assessment.state === "EVIDENCE_SUFFICIENT") {
    const firstFact = assessment.facts[0] || "Evidencia gobernada disponible.";
    return {
      hallazgosCriticos: assessment.facts.map((fact) => `Hallazgo evidence-bound: ${fact}`),
      riesgosInmediatos: [`Riesgo operativo limitado al patron observado en evidencia gobernada: ${firstFact}`],
      escenariosFuturos: ["Escenario sujeto a actualizacion con nueva evidencia gobernada y validacion institucional."],
      recomendacionesTacticas: [`[Evidence-Derived] Priorizar revision operativa del patron documentado: ${firstFact}`],
      recomendacionesEstrategicas: ["[Generic-Non-Factual] Mantener ciclo de recoleccion, validacion y trazabilidad antes de ampliar conclusiones."]
    };
  }

  const baseText = assessment.state === "EVIDENCE_EMPTY"
    ? EDITORIAL_EMPTY_EVIDENCE_TEXT
    : EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT;

  return {
    hallazgosCriticos: [baseText],
    riesgosInmediatos: [baseText],
    escenariosFuturos: ["No se formula escenario especifico sin evidencia gobernada suficiente."],
    recomendacionesTacticas: ["[Generic-Non-Factual] Mantener documentacion, validacion humana y trazabilidad antes de ejecutar medidas operativas especificas."],
    recomendacionesEstrategicas: ["[Generic-Non-Factual] Fortalecer la disponibilidad de fuentes gobernadas sin presumir patrones, horarios, zonas ni actores."]
  };
};

export const buildEvidenceBoundExecutiveSummary = (assessment: EditorialEvidenceAssessment): string => {
  if (assessment.state === "EVIDENCE_SUFFICIENT") {
    const facts = assessment.facts.slice(0, 3).join(" | ");
    return `Resumen evidence-bound: ${facts}. Provenance: ${assessment.provenance.join(" | ") || "sin identificadores adicionales"}.`;
  }
  if (assessment.state === "EVIDENCE_EMPTY") {
    return `${EDITORIAL_EMPTY_EVIDENCE_TEXT} No se formulan conclusiones operativas especificas fuera de ese alcance.`;
  }
  return EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT;
};

const buildEvidenceBoundConclusionsText = (
  assessment: EditorialEvidenceAssessment,
  conclusions: EvidenceBoundConclusions
): string => {
  const evidence = assessment.provenance.length > 0
    ? assessment.provenance.map((item) => `- ${item}`).join("\n")
    : `- Estado editorial: ${assessment.state}.`;

  return `HALLAZGO:\n${conclusions.hallazgosCriticos.map((item) => `- ${item}`).join("\n")}\n\nEVIDENCIA:\n${evidence}\n\nANÁLISIS:\nLas conclusiones y recomendaciones se limitan al estado editorial ${assessment.state}. Los resultados EMPTY, errores de proveedor y fuentes simuladas no se transforman en hechos positivos.\n\nIMPLICACIÓN OPERATIVA:\n${conclusions.recomendacionesTacticas.concat(conclusions.recomendacionesEstrategicas).map((item) => `- ${item}`).join("\n")}`;
};

/**
 * CAPA EDITORIAL DE INTELIGENCIA (EDITORIAL LAYER v9.0)
 */
export const buildIntelligenceEditorialPayload = async (
  rawContent: string,
  album: any[],
  mapSnapshots: any[],
  sweeps: any[],
  project: any,
  reportNumber?: string,
  analystName?: string
): Promise<IntelligenceReportPayload> => {
  // REGLA GOBERNADA ADR-019.13-F4: El informe únicamente puede consumir evidencias aprobadas (APPROVED_EVIDENCE / APROBADO)
  const isApprovedEvidence = (item: any) => {
    if (!item) return false;
    const status = (item.status || item.estado || item.estado_revision || item.analystValidationStatus || "").toUpperCase();
    if (status === "REJECTED_FINDING" || status === "RECHAZADO" || status === "IGNORADO" || status === "PENDING_REVIEW" || status === "PENDIENTE_REVISION" || status === "GENERATED" || status === "GENERADO") {
      return false;
    }
    if (status === "APPROVED_EVIDENCE" || status === "APROBADO" || status === "APPROVED") {
      return true;
    }
    if (!status) return true;
    return false;
  };

  album = (album || []).filter(isApprovedEvidence).map(p => {
    if (p && (p.tipo === "REMOTE_STREET_VIEW" || p.tipo === "STREET_VIEW" || p.isStreetView)) {
      return {
        ...p,
        tipo: "REMOTE_STREET_VIEW",
        category: "STREET_VIEW",
        classification: "REMOTE_VISUAL",
        sourceProvider: "GOOGLE_STREET_VIEW",
        isStreetView: true
      };
    }
    return p;
  });

  sweeps = (sweeps || []).filter(isApprovedEvidence);

  const rawExecSummary = extractSection(rawContent, 1);
  const rawHypothesis = extractSection(rawContent, 3);
  const rawMapsText = extractSection(rawContent, 4);
  const rawStatsText = extractSection(rawContent, 5);
  const rawEvidenceText = extractSection(rawContent, 6);
  const rawStreetViewText = extractSection(rawContent, 7);
  const rawOsintText = extractSection(rawContent, 8);
  const rawGraphText = extractSection(rawContent, 10);
  const rawConclusionsText = extractSection(rawContent, 11);

  const projectName = project?.nombre || project?.name || "Zona de Estudio";
  const projectId = project?.id ? String(project.id) : "EXP-2026-XXXXX";
  const numeroExpediente = resolveVisibleNumeroExpediente({
    numeroExpediente: project?.numeroExpediente || reportNumber,
    ceipolId: project?.ceipolId,
  });
  const date = new Date().toLocaleDateString("es-MX");
  const analyst = analystName || project?.analyst || "Analista CEIPOL Táctico";
  const geometryType = project?.geometryType || "polígono";
  const areaGeografica = project?.areaGeografica || "Aguascalientes, Ags, México";

  // Bloque I.1: Contexto territorial
  const projectGeolocation = resolveProjectGeolocationForReport(project);
  const lat = projectGeolocation.latitude;
  const lng = projectGeolocation.longitude;
  const engineLat = lat ?? Number.NaN;
  const engineLng = lng ?? Number.NaN;
  const radius = project?.analysisRadius ?? project?.radius ?? 250;
  const incidents = project?.historicalIncidents ?? project?.incidents ?? project?.incidenciaCompleta ?? project?.incidenciaLocal ?? project?.iaAnalysis?.historicalCrimes ?? [];
  const stats = StatisticalIntelligenceEngineV2.analyze(incidents, engineLat, engineLng, radius);
  const semResult = StatisticalEvidenceMatrixManager.process(projectId, incidents, stats);
  const sem = semResult.sem;

  let contextoTerritorial = cleanTechnicalJargon(extractSection(rawContent, 2));
  if (!contextoTerritorial || contextoTerritorial.length < 10) {
    contextoTerritorial = TCE_DEFAULT_FALLBACK;
  }

  // Ejecutar el motor de contexto territorial TCE localmente para asegurar consistencia
  const tceData = TerritorialContextEngine.generate({
    projectName,
    projectId,
    projectDescription: project?.descripcion || project?.description || "",
    analysisRadius: radius,
    geometryType: project?.geometryType || "individual",
    lat,
    lng,
    incidenciaCompleta: incidents,
    streetViews: project?.streetViews || project?.tacticalStreetViews || [],
    datosGobMxData: project?.datosGobMxData || null,
    sweeps: sweeps || [],
    analysisContext: project?.analysisContext || ""
  });

  // Ejecutar el Hypothesis Intelligence Engine (HIE)
  const hieData = HypothesisIntelligenceEngine.build({
    tceData,
    sieData: stats,
    rawInput: project
  });

  // Ejecutar el Cartographic Intelligence Engine (CIE)
  const cieData = CartographicIntelligenceEngine.build({
    tceData,
    sieData: stats,
    rawInput: project,
    historicalIncidents: incidents
  });

  // Bloque I.2: Hipótesis principal
  const hipotesisPrincipal = {
    queOcurre: hieData.centralHypothesis.queOcurre,
    dondeOcurre: hieData.centralHypothesis.dondeOcurre,
    quienParticipa: hieData.validationMatrix.isValidated ? "Actores de oportunidad locales" : "No determinado (evidencia insuficiente)",
    porQueOcurre: hieData.centralHypothesis.porQueOcurre,
    evidenciaSustento: hieData.supportingEvidence.map(e => e.description).join(". "),
    nivelConfianza: `Confianza: ${hieData.confidence.level} (Score: ${hieData.confidence.score}/100)`
  };

  const valoracionOperacional = {
    amenaza: `Probabilidad del ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(0)}% de repetición delictiva semanal en el cuadrante.`,
    oportunidadCriminal: `Facilitadores tácticos y diseño urbano con índice de riesgo de contagio de ${sem.predictiveEvidence.nearRepeatRisk.toFixed(0)}/100.`,
    vulnerabilidades: `Dispersión de hotspots con clasificación de tendencia temporal: ${sem.temporalEvidence.trendDirection}.`,
    capacidadRequerida: `Patrullaje preventivo en baricentro durante periodos críticos: ${sem.temporalEvidence.criticalPeriods.join(", ") || "No definido"}.`
  };

  // Bloque II: Matriz de Trazabilidad Analítica
  const pandillasEvidence = assessPandillasEvidence(sweeps);
  const trazabilidadMatrix = Object.keys(hieData.traceability).map(key => {
    const item = hieData.traceability[key];
    return {
      componente: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      fuente: item.source,
      metodo: item.engine,
      hallazgo: item.variable,
      impacto: `Disponibilidad: ${item.availability}`
    };
  });

  const pandillasTraceabilityEntry = buildPandillasTraceabilityEntry(pandillasEvidence);
  if (pandillasTraceabilityEntry) trazabilidadMatrix.push(pandillasTraceabilityEntry);



  // Pandillas territorial analysis
  const pandillasAnalysis = buildEvidenceBoundPandillasNarrative(sweeps);

  // Helper para extraer la interpretación de mapas generada por Gemini
  const parseMapsInterpretation = (rawMapsText: string, mapIdx: number): string => {
    if (!rawMapsText) return "";
    const mapHeaders = [
      /MAPA 1\b/i,
      /MAPA 2\b/i,
      /MAPA 3\b/i,
      /MAPA 4\b/i,
    ];
    const indices: number[] = [];
    mapHeaders.forEach((regex) => {
      indices.push(rawMapsText.search(regex));
    });
    indices.push(rawMapsText.length);
    const sections: string[] = [];
    for (let i = 0; i < 4; i++) {
      const start = indices[i];
      const end = indices[i + 1];
      if (start !== -1 && end !== -1 && start < end) {
        sections.push(rawMapsText.substring(start, end).trim());
      } else {
        sections.push("");
      }
    }
    const parsed = sections[mapIdx];
    if (parsed && parsed.length > 20) {
      return parsed;
    }
    return "";
  };

  const getMapInterpretation = (idx: number, cie: any): string => {
    const parsed = parseMapsInterpretation(rawMapsText, idx);
    if (parsed) return cleanTechnicalJargon(parsed);

    if (idx === 0) {
      return `MAPA 1: CONTEXTO TERRITORIAL Y ÁREA DE ANÁLISIS\n\nHallazgo espacial: Área de amortiguamiento táctico con un radio de ${cie.spatialPattern?.radiusMetros || 250} metros clasificado como ${cie.spatialPattern?.classification || "Distribución sectorizada"}.\n\nInterpretación criminológica: ${cie.confidence?.description || "Consistencia espacial media basada en atractores y vulnerabilidades locales."}\n\nImpacto operativo: Monitorear límites perimetrales y patrullar epicentro.`;
    }
    if (idx === 1) {
      return `MAPA 2: DISTRIBUCIÓN ESPACIAL DEL FENÓMENO\n\nHallazgo espacial: Concentración táctica en ${cie.densityAnalysis?.hotspotsCount || 0} hotspots con un volumen de ${cie.densityAnalysis?.totalEvents || 0} delitos.\n\nInterpretación criminológica: Se detectaron ${cie.mobilityAnalysis?.corridors?.length || 0} corredores de escape radiales que facilitan la huida rápida de los infractores.\n\nImpacto operativo: Implementar filtros dinámicos en los corredores tácticos identificados.`;
    }
    if (idx === 2) {
      return `MAPA 3: FACTORES TERRITORIALES DE OPORTUNIDAD\n\nHallazgo espacial: Coincidencia espacial delictiva con ${cie.attractorAnalysis?.totalAttractors || 0} atractores del DENUE.\n\nInterpretación criminológica: Vulnerabilidades físicas en el entorno urbano: ${(cie.environmentalRisk?.detectedFacilitators || []).join(", ") || "Falta de iluminación y maleza"}.\n\nImpacto operativo: Gestionar la remediación urbana del cuadrante y cerramientos preventivos.`;
    }
    return `MAPA 4: PROYECCIÓN ESPACIAL DEL RIESGO\n\nHallazgo espacial: Baricentro delictivo y celdas de inercia prioritarias para la proyección a 6 meses.\n\nInterpretación criminológica: Concentración de riesgo delictivo activo calculado mediante Poisson en sector prioritario (Confianza: ${cie.confidence?.level || "MEDIO"}).\n\nImpacto operativo: Focalizar patrullaje dinámico en el baricentro y sector de patrullaje del CIE.`;
  };

  // Instanciar el motor de renderizado vectorial táctico para generar los mapas y gráficas HD directamente
  const vectorInput = {
    projectName: projectName || "Expediente",
    latitude: engineLat,
    longitude: engineLng,
    geometryType: project?.geometryType || "individual",
    incidents: incidents,
    sweeps: sweeps || [],
    photoCount: album?.length || 0,
    cieData: cieData
  };

  // Maps (Generados vectorialmente a alta resolución de forma nativa)
  const [
    densityMapUrl,
    mobilityMapUrl,
    attractorsMapUrl,
    predictiveMapUrl
  ] = await Promise.all([
    renderDensityMap(vectorInput),
    renderMobilityMap(vectorInput),
    renderAttractorsMap(vectorInput),
    renderPredictiveMap(vectorInput)
  ]);

  const maps = [
    {
      title: "1. MAPA DE CONTEXTO TERRITORIAL Y ÁREA DE ANÁLISIS",
      dataUrl: densityMapUrl,
      spatialFinding: cieData.spatialPattern.classification || "Distribución sectorizada perimetral.",
      interpretation: getMapInterpretation(0, cieData),
      recommendation: "Verificar límites de amortiguamiento táctico y coordinar sectores de patrullaje."
    },
    {
      title: "2. MAPA DE DISTRIBUCIÓN ESPACIAL DEL FENÓMENO (DENSIDAD Y CORREDORES DE MOVILIDAD)",
      dataUrl: mobilityMapUrl,
      spatialFinding: `Se identificaron ${cieData.densityAnalysis.hotspotsCount || 0} hotspots principales con ${cieData.densityAnalysis.totalEvents || 0} incidentes históricos.`,
      interpretation: getMapInterpretation(1, cieData),
      recommendation: "Desplegar patrullaje dinámico en horarios críticos en los corredores de huida."
    },
    {
      title: "3. MAPA DE FACTORES TERRITORIALES DE OPORTUNIDAD Y ATRACTORES",
      dataUrl: attractorsMapUrl,
      spatialFinding: `Concentración delictiva asociada a ${cieData.attractorAnalysis.totalAttractors || 0} atractores comerciales del DENUE.`,
      interpretation: getMapInterpretation(2, cieData),
      recommendation: "Notificar a comercio establecido y coordinar cerramiento de baldíos."
    },
    {
      title: "4. MAPA DE PROYECCIÓN Y PREDICCIÓN ESPACIAL DEL RIESGO (PREDICTIVA)",
      dataUrl: predictiveMapUrl,
      spatialFinding: `Baricentro delictivo calculado en lat ${cieData.priorityZones.baricenter?.lat.toFixed(4) || 0}, lng ${cieData.priorityZones.baricenter?.lng.toFixed(4) || 0}.`,
      interpretation: getMapInterpretation(3, cieData),
      recommendation: "Focalizar patrullaje dinámico disuasivo en el baricentro y sector de patrullaje del CIE."
    }
  ];

  const graphs = [
    {
      title: "GRÁFICA 1: Distribución temporal y estacionalidad del fenómeno delictivo",
      dataUrl: renderTemporalShiftChart(vectorInput),
      explanation: `Análisis secuencial del volumen de incidentes históricos registrados en la zona de estudio.`,
      finding: `Periodos de mayor riesgo delictivo concentrados durante los días ${sem.temporalEvidence.criticalPeriods?.[0] || "No definido"}.`,
      relation: `Focalizar patrullajes preventivos dinámicos en los rangos horarios críticos identificados.`
    },
    {
      title: "GRÁFICA 2: Concentración territorial del fenómeno delictivo",
      dataUrl: renderCrimeTopologyChart(vectorInput),
      explanation: `Distribución geoespacial densa focalizada en sectores tácticos prioritarios del cuadrante.`,
      finding: `Baricentro delictivo principal ubicado en Lat ${sem.spatialEvidence.centerOfGravity?.lat?.toFixed(4) || "0.0"}, Lng ${sem.spatialEvidence.centerOfGravity?.lng?.toFixed(4) || "0.0"}.`,
      relation: `Implementar cercos tácticos y puntos de control disuasivo alrededor del baricentro espacial.`
    },
    {
      title: "GRÁFICA 3: Proyección del riesgo y tendencia futura",
      dataUrl: renderPredictiveLineChart(vectorInput),
      explanation: `Estimación analítica de la probabilidad delictiva estimada para el periodo de corto plazo.`,
      finding: `Probabilidad de repetición calculada del ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(0)}% en el cuadrante estudiado.`,
      relation: `Sincronizar el despliegue analítico en calle según la tasa de riesgo predictivo.`
    }
  ];

  // ==================== STREET VIEW TRACE ====================
  const isStructuredStreetViewEvidence = (p: any) =>
    p.evidenceOrigin === "REMOTE" ||
    p.collectionMethod === "DESKTOP_ANALYSIS" ||
    p.evidenceCategoryClass === "REMOTE_VISUAL" ||
    p.sourceProvider === "GOOGLE_STREET_VIEW" ||
    !!p.streetViewMetadata;

  const isLegacyStreetViewEvidence = (p: any) =>
    p.tipo?.toLowerCase().includes("street") ||
    p.url?.toLowerCase().includes("street") ||
    p.previewUrl?.toLowerCase().includes("street") ||
    p.comentario?.toLowerCase().includes("street") ||
    p.description?.toLowerCase().includes("street") ||
    p.evidenceType === "VIRTUAL_STREET_VIEW" ||
    p.fuente === "Google Street View";

  const svCaptured = (album || []).filter(p =>
    isStructuredStreetViewEvidence(p) || isLegacyStreetViewEvidence(p)
  );
  
  const tacticalSVs = project?.tacticalStreetViews || [];
  const storedFirestore = svCaptured.length; 
  const receivedByEngine = (album || []).length;
  
  // ==================== GOBERNANZA FOTOGRÁFICA DE EVIDENCIA (ADR-011) ====================
  const analystRaw = (album || []).filter(p =>
    !isStructuredStreetViewEvidence(p) && !isLegacyStreetViewEvidence(p)
  );
  const streetViewRaw = (album || []).filter(p => {
    const isSv = isStructuredStreetViewEvidence(p) || isLegacyStreetViewEvidence(p);
    return isSv && isValidStreetViewImage(p);
  });
  
  const governedAnalyst = PhotoEvidenceGovernanceEngine.process(analystRaw);
  const governedAlbum = [
    ...governedAnalyst.primaryPhotos,
    ...streetViewRaw
  ];

  // 1. Ejecutar el Motor de Evidencia Visual Operacional con el álbum gobernado (máx 12 fotos primarias)
  const visualMatrix = VisualEvidenceEngine.process(
    projectId || "PR-001",
    governedAlbum,
    engineLat,
    engineLng,
    radius,
    sem?.spatialEvidence?.hotspots || []
  );

  console.log("=== STREET VIEW TRACE ===");
  console.log(`Cantidad de imágenes Street View capturadas: ${svCaptured.length}`);
  console.log(`Cantidad de objetos tacticalStreetViews: ${tacticalSVs.length}`);
  console.log(`Cantidad de objetos almacenados en Firestore: ${storedFirestore}`);
  console.log(`Cantidad recibida por VisualEvidenceEngine: ${receivedByEngine}`);
  console.log(`Cantidad clasificada como STREET_VIEW: ${svCaptured.filter(p => p.tipo === "STREET_VIEW" || p.evidenceType === "VIRTUAL_STREET_VIEW").length}`);
  console.log(`Cantidad enviada en payload.streetViewAnalysis: ${visualMatrix.streetViewEvidence.length}`);
  console.log(`Cantidad consumida por exportToWord: ${visualMatrix.streetViewEvidence.length}`);
  console.log("\nDetalle de cada etapa:");
  
  console.log("\n--- CAPTURADAS EN PHOTO ALBUM / FIRESTORE ---");
  svCaptured.forEach((item, idx) => {
    console.log(`[Item #${idx + 1}]`);
    console.log(`  id: ${item.id}`);
    console.log(`  tipo: ${item.tipo}`);
    console.log(`  fuente: ${item.fuente || "Google Street View"}`);
    console.log(`  URL/dataUrl: ${item.previewUrl || item.url || ""}`);
    console.log(`  thumbnail: ${item.previewUrl || item.url || ""}`);
    console.log(`  coordenadas: Lat ${item.lat ?? item.gpsLat ?? item.streetViewMetadata?.panoramaLat}, Lng ${item.lng ?? item.gpsLng ?? item.streetViewMetadata?.panoramaLng}`);
    console.log(`  timestamp: ${item.createdAt || item.fecha || ""}`);
  });

  console.log("\n--- CLASIFICADAS POR ENGINE EN payload.streetViewAnalysis ---");
  visualMatrix.streetViewEvidence.forEach((item, idx) => {
    console.log(`[Editorial SV #${idx + 1}]`);
    console.log(`  id: SV-00${idx + 1}`);
    console.log(`  tipo: STREET_VIEW`);
    console.log(`  fuente: Google Street View`);
    console.log(`  URL/dataUrl: ${item.image}`);
    console.log(`  thumbnail: ${item.image}`);
    console.log(`  coordenadas: Lat ${lat}, Lng ${lng}`);
    console.log(`  timestamp: ${new Date().toLocaleDateString("es-MX")}`);
  });
  console.log("=========================================\n");

  // Photos Sanitized Mapping (FASE 7.12.6)
  const photoEvidence = visualMatrix.analystPhotos.map((p, idx) => {
    const originalPhoto = (album || []).find(
      (item) => item.previewUrl === p.image || item.url === p.image
    );
    const rel = originalPhoto?.evidenceRelationship;

    let locationStr = "Sector perimetral de estudio";
    if (rel?.geography) {
      const geoType = rel.geography.type === "POLYGON" ? "POLÍGONO" : rel.geography.type === "LINE" ? "LÍNEA / CORREDOR" : "PUNTO";
      locationStr = `Contexto Territorial: ${geoType} - ${rel.geography.area || "Zona de Estudio"}`;
    }

    let factorStr = "Vulnerabilidad Física / Infraestructura";
    if (rel?.criminogenicFactors && rel.criminogenicFactors.length > 0) {
      factorStr = `Facilitador territorial: ${rel.criminogenicFactors.join(", ")}`;
    }

    let relationStr = p.operationalImpact;
    if (rel?.hypothesisLinks && rel.hypothesisLinks.length > 0) {
      relationStr = `Relación analítica - Hipótesis: ${rel.hypothesisLinks.join(". ")}`;
    }

    return {
      id: `photo-${idx}`,
      dataUrl: p.image,
      caption: p.title,
      location: locationStr,
      factor: factorStr,
      criminologicalInterpretation: p.finding,
      relation: relationStr,
      riskLevel: "Alto",
      lat: null,
      lng: null,
      fecha: new Date().toLocaleDateString("es-MX")
    };
  });

  // Street View Sanitized Mapping
  const streetViewAnalysis = visualMatrix.streetViewEvidence.map((s, idx) => {
    const originalPhoto = (album || []).find(
      (item) => item.previewUrl === s.image || item.url === s.image
    );
    const svMeta = originalPhoto?.streetViewMetadata;
    const heading = svMeta?.heading ?? originalPhoto?.heading ?? 0;
    const pitch = svMeta?.pitch ?? originalPhoto?.pitch ?? 0;
    const fov = svMeta?.fov ?? originalPhoto?.fov ?? 90;
    const captureDate = svMeta?.captureDate || originalPhoto?.captureDate || new Date().toLocaleDateString("es-MX");
    const confidenceLevel = originalPhoto?.confidenceLevel || "Alto";
    const confidencePercentage = originalPhoto?.confidencePercentage;

    return {
      id: `SV-00${idx + 1}`,
      title: s.title,
      dataUrl: s.image,
      location: "Sector perimetral", // Sanitizado: sin coordenadas geográficas numéricas
      fuentePrimaria: originalPhoto?.sourceProvider || svMeta?.provider || "Google Street View",
      fechaCaptura: captureDate,
      direccion: areaGeografica,
      orientacion: `Heading ${heading}° / Pitch ${pitch}° / FOV ${fov}°`,
      observed: s.description,
      indicadorCriminologico: s.finding,
      inferenciaAnalitica: s.operationalImpact,
      confianza: confidencePercentage != null ? `${confidenceLevel} (${confidencePercentage}%)` : confidenceLevel,
      impactoHipotesis: "Fortalece",
      recomendacion: "Coordinar remediación física situacional del entorno.",
      criminologicalAnalysis: s.operationalImpact,
      relation: "Coordinar remediación física situacional del entorno.",
      streetViewMetadata: svMeta,
      confidencePercentage,

      // Contrato Determinista Evidence Governance Engine
      tipo: "REMOTE_STREET_VIEW",
      category: "STREET_VIEW",
      classification: "REMOTE_VISUAL",
      sourceProvider: "GOOGLE_STREET_VIEW",
      isStreetView: true,
      evidenceOrigin: "REMOTE",
      evidenceCategoryClass: "REMOTE_VISUAL",
      source: "STREET_VIEW"
    };
  });

  // Hypothesis Graph (Generado programáticamente en lienzo HD)
  const hypothesisGraph = {
    title: "Hypothesis Intelligence Graph (HIG 2.0)",
    dataUrl: renderHypothesisGraph(vectorInput),
    interpretation: `Calibrado con un nivel de riesgo predictivo del ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(0)}% y confiabilidad analítica del ${sem.predictiveEvidence.confidenceMetrics.statisticalConfidence.toFixed(0)}%. \n\n${cleanTechnicalJargon(rawGraphText || "La relación entre factores de oportunidad y delitos en el área sustenta el grafo.")}`
  };

  // Sweeps Data — solo barridos reales integrados al expediente (sin inyección ficticia)
  const sweepsData = (sweeps || []).map((s) => ({
    engine: String(s.engine || "CIFA"),
    source: String(s.source || "Base de Datos"),
    data: cleanTechnicalJargon(s.data || "Sin información relevante."),
    context: cleanTechnicalJargon(s.context || "Sin contexto de integración.")
  }));

  // Bloque IX: Conclusiones evidence-bound
  const editorialEvidence = assessEditorialEvidence({ incidents, sweeps, album });
  const conclusiones = buildEvidenceBoundConclusions(editorialEvidence);

  const executiveSummary = buildEvidenceBoundExecutiveSummary(editorialEvidence).slice(0, 800);

  let finalHypothesis = cleanTechnicalJargon(rawHypothesis);
  if (!finalHypothesis || finalHypothesis.length < 50) {
    finalHypothesis = hieData.centralHypothesis.summary;
  }

  // Estructurar obligatoriamente todos los capítulos narrativos clave en formato de 4 partes (HALLAZGO, EVIDENCIA, ANÁLISIS, IMPLICACIÓN)
  const analysisRadius = Number(project?.analysisRadius) > 0 ? Number(project.analysisRadius) : 500;
  const geoValidation = validateGeoIntegrity(project?.latitude, project?.longitude);
  const epicenterLat = geoValidation.latitude;
  const epicenterLng = geoValidation.longitude;
  const locationStr = epicenterLat !== null && epicenterLng !== null 
    ? `${epicenterLat.toFixed(6)}, ${epicenterLng.toFixed(6)} (${projectName})`
    : "La representación territorial requiere validación geográfica.";

  const rawOsintClean = cleanTechnicalJargon(rawOsintText);
  const osintSynthesized = buildOperationalOsintChapter({
    sweeps: sweepsData,
    album: album || [],
    projectName,
    locationStr,
    analysisRadius,
    rawOsintText: rawOsintClean,
    streetViewAnalysis,
    incidents: project?.incidents || [],
  });

  const formattedContextoTerritorial = formatToFourPartStructure(
    contextoTerritorial,
    projectName,
    date,
    locationStr,
    "Vulnerabilidad en el perímetro comercial y habitacional por falta de control físico de accesos.",
    "El sector bajo análisis presenta un alto flujo de transeúntes combinado con zonas de nula iluminación nocturna, facilitando el acecho.",
    "Establecer presencia disuasiva coordinada con patrullajes tácticos dinámicos."
  );

  const formattedFinalHypothesis = formatToFourPartStructure(
    finalHypothesis,
    projectName,
    date,
    locationStr,
    "Fenómeno criminal de oportunidad concentrado en horarios nocturnos y de tercer turno.",
    "Registros de llamadas de auxilio y barridos de geointeligencia integrados en la hipótesis central.",
    "El análisis criminológico confirma que los agresores operan en zonas de baja visibilidad física por fallas de alumbrado público.",
    "Aumentar el despliegue policial táctico en los puntos ciegos identificados."
  );

  const formattedOsintSynthesized = osintSynthesized.includes("HALLAZGO")
    ? osintSynthesized
    : formatToFourPartStructure(osintSynthesized, projectName, date, locationStr);

  const formattedPandillasAnalysis = pandillasAnalysis;

  const formattedConclusionesText = buildEvidenceBoundConclusionsText(editorialEvidence, conclusiones);

  const hypothesisLifecycle: InvestigationHypothesis = {
    id: `H-${projectId}`,
    expedienteId: projectId,
    hipotesisInicial: hieData?.centralHypothesis?.queOcurre || (finalHypothesis && finalHypothesis.length > 10 ? finalHypothesis.split("\n")[0] : "Actividad delictiva disonante bajo investigación territorial."),
    hipotesisActual: finalHypothesis || hieData?.centralHypothesis?.queOcurre || "Línea de análisis en proceso.",
    variablesIniciales: ["incidencia", "territorio", "actores", "oportunidad"],
    estadoActual: "EN_ANALISIS",
    evidenciaConfirmatoria: (visualMatrix?.streetViewEvidence || []).map((s: any, idx: number) => `SV-00${idx + 1}`),
    evidenciaContradictoria: [],
    nivelConfianza: "ALTO",
    justificacionActual: "Se cuenta con un alto grado de convergencia en la evidencia física situacional y registros estadísticos delictivos locales.",
    historialEvolucion: [
      {
        fecha: Date.now(),
        estadoAnterior: "INICIAL",
        estadoNuevo: "EN_ANALISIS",
        tipoCambio: "AMPLIACION",
        evidenciaRelacionada: (visualMatrix?.streetViewEvidence || []).map((s: any, idx: number) => `SV-00${idx + 1}`),
        justificacionAnalitica: "Se integra geointeligencia operativa de barrido Street View y análisis estadístico local.",
        motorQueGeneroCambio: "HIE_ENGINE",
        usuarioResponsable: analyst
      }
    ],
    confidenceScore: sem?.predictiveEvidence?.confidenceMetrics?.statisticalConfidence ?? 85,
    confidenceLevel: "ALTO",
    confidenceHistory: []
  };

  return {
    projectName,
    projectId,
    ceipolId: project?.ceipolId,
    numeroExpediente,
    date,
    analyst,
    geometryType,
    areaGeografica,
    latitude: epicenterLat,
    longitude: epicenterLng,
    analysisRadius,
    contextoTerritorial: formattedContextoTerritorial,
    hipotesisPrincipal,
    valoracionOperacional,
    trazabilidadMatrix,
    maps,
    graphs,
    photoEvidence,
    streetViewAnalysis,
    hypothesisGraph,
    osintSynthesized: formattedOsintSynthesized,
    pandillasAnalysis: formattedPandillasAnalysis,
    sweepsData,
    conclusiones,
    executiveSummary,
    finalHypothesis: formattedFinalHypothesis,
    mapsText: cleanTechnicalJargon(rawMapsText),
    statsText: cleanTechnicalJargon(rawStatsText),
    evidenceText: cleanTechnicalJargon(rawEvidenceText),
    streetViewText: cleanTechnicalJargon(rawStreetViewText),
    graphText: cleanTechnicalJargon(rawGraphText),
    conclusionesText: formattedConclusionesText,
    hieData,
    cieData,
    historicalIncidents: incidents,
    sieData: stats,
    semData: sem,
    visualEvidenceMatrix: visualMatrix,
    hypothesisLifecycle,
    governedEvidence: governedAnalyst
  };
};

/**
 * IMPLEMENTACIÓN DEL LAYOUT ENGINE v5 (Strict 12-Page Institutional Layout SSPE-CEIPOL v9.0)
 */
export const buildIntelligenceBriefing = (
  report: ConsolidatedReport,
  payload: IntelligenceReportPayload
): IntelligenceBriefing => {
  const globalRisk = getGlobalRiskLabel(report);
  const pages: IntelligenceLayoutPage[] = [];

  // PÁGINAS ANALÍTICAS (Límite de 12 páginas)

  // Página 1: Portada Institucional
  pages.push({
    id: 'page-cover',
    title: 'Informe de Geointeligencia Operativa',
    mode: 'cover',
    visuals: [],
    riskLevel: globalRisk,
    summary: payload.executiveSummary,
    bullets: [
      `Expediente: ${payload.projectName}`,
      `Número de Expediente: ${resolveVisibleNumeroExpediente(payload)}`,
      `Fecha: ${payload.date}`,
      `Analista Responsable: ${payload.analyst}`,
      `Geometría de Cobertura: ${safeUpperCase(payload.geometryType, "POLÍGONO")}`,
      `Clasificación: CONFIDENCIAL / EXCLUSIVO SSPE-CEIPOL`
    ]
  });

  // Página 2: CAPÍTULO 1 - Contexto territorial
  pages.push({
    id: 'page-context',
    title: 'CAPÍTULO 1: CONTEXTO DEL ANÁLISIS',
    mode: 'executive',
    visuals: [],
    interpretation: payload.contextoTerritorial
  });

  // Página 3: CAPÍTULO 2 - Hipótesis principal
  pages.push({
    id: 'page-hypothesis-principal',
    title: 'CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL',
    mode: 'executive',
    visuals: [],
    interpretation: payload.finalHypothesis
  });

  // CAPÍTULO 3: Atlas Cartográfico Operativo (1 mapa por página)
  payload.maps.forEach((m, idx) => {
    pages.push({
      id: `page-visual-map-${idx + 1}`,
      title: `CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO - ${m.title}`,
      mode: 'single',
      visuals: [{
        id: `map-product-${idx}`,
        type: 'map',
        title: m.title,
        dataUrl: m.dataUrl,
        caption: m.interpretation
      }],
      interpretation: m.interpretation
    });
  });

  // CAPÍTULO 4: Modelos Analíticos (Gráficas)
  payload.graphs.forEach((g, idx) => {
    pages.push({
      id: `page-visual-graph-${idx + 1}`,
      title: `CAPÍTULO 4: ANÁLISIS ESTADÍSTICO - ${g.title}`,
      mode: 'single',
      visuals: [{
        id: `graph-product-${idx}`,
        type: 'chart',
        title: g.title,
        dataUrl: g.dataUrl,
        caption: `Explicación: ${g.explanation}\nHallazgo: ${g.finding}\nRelación: ${g.relation}`
      }],
      interpretation: `Explicación técnica: ${g.explanation}\nHallazgo: ${g.finding}\nRelación: ${g.relation}`
    });
  });

  // CAPÍTULO 5: Evidencia Fotográfica (Anexo de campo)
  const photos = payload.photoEvidence;
  for (let i = 0; i < photos.length; i += 2) {
    const chunk = photos.slice(i, i + 2);
    const visuals = chunk.map(p => ({
      id: p.id,
      type: 'photo' as any,
      title: p.caption,
      dataUrl: p.dataUrl,
      caption: `Ubicación: ${p.location}\nFactor: ${p.factor}\nAnálisis IA: ${p.criminologicalInterpretation}\nRelación: ${p.relation}\nRiesgo: ${p.riskLevel}`
    }));
    pages.push({
      id: `page-visual-photo-${Math.floor(i / 2) + 1}`,
      title: `CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA (PARTE ${Math.floor(i / 2) + 1})`,
      mode: 'double',
      visuals
    });
  }

  // Si existen fotos preservadas digitalmente bajo Soft Governance, inyectar el Anexo de Evidencia Digital Preservada
  if (payload.governedEvidence?.summary?.preserved > 0) {
    pages.push({
      id: "page-visual-photo-digital-annex",
      title: "CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA - ANEXO DIGITAL",
      mode: "executive",
      visuals: [],
      interpretation: `ANEXO DIGITAL DE EVIDENCIA PRESERVADA\n\nEl expediente oficial contiene ${payload.governedEvidence.summary.preserved} registros fotográficos adicionales preservados de forma íntegra en el repositorio digital del Perfilador Remoto CEIPOL para consulta operativa, auditoría ambiental y ampliación investigativa de campo.\n\nEsta medida de gobernanza analítica inteligente previene la redundancia documental, optimiza el tamaño de los informes y garantiza que el dictamen ejecutivo represente análisis estratégico enfocado en la mitigación del riesgo.`
    });
  }

  // CAPÍTULO 6: ANÁLISIS TERRITORIAL OPERACIONAL Y CONTEXTO DE OPORTUNIDAD
  pages.push({
    id: "page-territorial-analysis",
    title: "CAPÍTULO 6: ANÁLISIS TERRITORIAL OPERACIONAL Y CONTEXTO DE OPORTUNIDAD",
    mode: "text",
    visuals: [],
    interpretation: payload.streetViewText || "Análisis territorial no generado."
  });

  // Página 8: CAPÍTULO 7 - OSINT Sintetizado (Textual o Certificado de Gobernanza)
  let osintText = payload.osintSynthesized;
  const certifiedOsint = payload.intelligenceContext?.aceReport?.certifiedOsintOutput;

  if (certifiedOsint) {
    if (certifiedOsint.validatedByACE === false) {
      osintText = `RECOMENDACIÓN INSTITUCIONAL DE DESCARTE:\n\nEl análisis del Capítulo 7 (OSINT) para el expediente ${resolveVisibleNumeroExpediente(payload)} ha sido SUSPENDIDO de forma oficial. Las fuentes de datos abiertas recopiladas no superaron los criterios de consistencia analítica, madurez técnica o trazabilidad digital de la gobernanza de la SSPE.\n\nEVIDENCIA:\nNo certificada por inconsistencia de procedencia o violación de estilo.\n\nANÁLISIS:\nAnálisis suspendido temporalmente por inconsistencia metodológica o lingüística.\n\nIMPLICACIÓN OPERATIVA:\nNo habilitado para visualización o publicación oficial. Se requiere auditoría del lote original.`;
    } else {
      const hallazgosBullets = certifiedOsint.analyticalFindings.map((f: string) => `- ${f}`).join("\n");
      const territorialBullets = certifiedOsint.territorialSummary.map((t: string) => `- ${t}`).join("\n");
      const limitacionesBullets = certifiedOsint.limitations.map((l: string) => `- ${l}`).join("\n");
      const calidadBullets = certifiedOsint.qualitySummary.map((q: string) => `- ${q}`).join("\n");
      const trazabilidadFirma = `Referencia de Certificación Única: ${certifiedOsint.traceabilityReference}`;

      let advertenciaBanner = "";
      if (certifiedOsint.validationStatus === "CERTIFIED_WITH_LIMITATIONS") {
        advertenciaBanner = `⚠️ ADVERTENCIA METODOLÓGICA (RESERVA ANALÍTICA INSTITUCIONAL):\nEl presente capítulo incorpora indicios con madurez técnica limitada o bajo score de Almirantazgo. El análisis debe interpretarse con carácter preventivo y requiere corroboración policial de campo de Aguascalientes.\n\n`;
      }

      osintText = `${advertenciaBanner}RESUMEN DE CALIDAD DE FUENTES:\n${calidadBullets}\n\nHALLAZGOS DE INTELIGENCIA:\n${hallazgosBullets}\n\nANÁLISIS DE DINÁMICAS ESPACIALES:\n${territorialBullets}\n\nRESTRICCIONES Y LIMITACIONES METODOLÓGICAS:\n${limitacionesBullets || "- No se registraron limitaciones de calidad analítica en este lote."}\n\n${trazabilidadFirma}`;
    }
  }

  pages.push({
    id: 'page-osint',
    title: 'CAPÍTULO 7: INTELIGENCIA OSINT',
    mode: 'text',
    visuals: [],
    interpretation: osintText
  });

  // Página 9: CAPÍTULO 8 - Pandillas (Textual o Certificado de Gobernanza)
  let pandillasText = payload.pandillasAnalysis;
  const certifiedGim = payload.intelligenceContext?.aceReport?.certifiedGimOutput;

  if (certifiedGim) {
    if (certifiedGim.validatedByACE === false) {
      pandillasText = `RECOMENDACIÓN INSTITUCIONAL DE DESCARTE:\n\nEl análisis territorial del Capítulo 8 para el expediente ${resolveVisibleNumeroExpediente(payload)} ha sido SUSPENDIDO de forma oficial. Los datos levantados en campo no superaron los criterios de consistencia analítica o neutralidad lingüística establecidos por la gobernanza de la SSPE.\n\nEVIDENCIA:\nNo certificada por inconsistencia o violación de estilo.\n\nANÁLISIS:\n${certifiedGim.analyticalFindings[0]}\n\nIMPLICACIÓN OPERATIVA:\n${certifiedGim.limitations[0]}`;
    } else {
      const hallazgosBullets = certifiedGim.analyticalFindings.map((f: string) => `- ${f}`).join("\n");
      const evidenciaBullets = certifiedGim.evidenceSummary.map((e: string) => `- ${e}`).join("\n");
      const territorialBullets = certifiedGim.territorialSummary.map((t: string) => `- ${t}`).join("\n");
      const limitacionesBullets = certifiedGim.limitations.map((l: string) => `- ${l}`).join("\n");
      const trazabilidadFirma = `Referencia de Certificación Única: ${certifiedGim.traceabilityReference}`;

      pandillasText = `HALLAZGO:\n${hallazgosBullets || "- No se registraron marcas territoriales activas."}\n\nEVIDENCIA:\n${evidenciaBullets || "- Registros del censo local."}\n\nANÁLISIS:\n${territorialBullets || "- Sector perimetral general."}\n\nIMPLICACIÓN OPERATIVA:\n${limitacionesBullets || "- Monitoreo y patrullaje preventivo rutinario."}\n\n${trazabilidadFirma}`;
    }
  }

  pages.push({
    id: 'page-pandillas',
    title: 'CAPÍTULO 8: ACTORES TERRITORIALES Y PANDILLAS',
    mode: 'text',
    visuals: [],
    interpretation: pandillasText
  });


  // Página 10: CAPÍTULO 9: Hypothesis Graph (HIG 2.0)
  pages.push({
    id: 'page-visual-graph-hig',
    title: 'CAPÍTULO 9: GRAFO DE HIPÓTESIS HIG 2.0',
    mode: 'single',
    visuals: [{
      id: 'graph-hig-vis-product',
      type: 'graph',
      title: payload.hypothesisGraph.title,
      dataUrl: payload.hypothesisGraph.dataUrl,
      caption: 'Mapeo interactivo de relaciones, actores, lugares y evidencias.'
    }],
    interpretation: `Lectura Operacional del Grafo HIG 2.0:\n${payload.hypothesisGraph.interpretation}`
  });

  // Página 11: CAPÍTULO 10 - Conclusiones Operativas
  pages.push({
    id: 'page-conclusions',
    title: 'CAPÍTULO 10: CONCLUSIONES OPERATIVAS',
    mode: 'conclusions',
    visuals: [],
    conclusions: [
      ...payload.conclusiones.hallazgosCriticos.map(h => `Hallazgo Crítico: ${h}`),
      ...payload.conclusiones.riesgosInmediatos.map(r => `Riesgo Inmediato: ${r}`),
      ...payload.conclusiones.escenariosFuturos.map(e => `Escenario Futuro: ${e}`),
      ...payload.conclusiones.recomendacionesTacticas.map(t => `Recomendación Táctica: ${t}`),
      ...payload.conclusiones.recomendacionesEstrategicas.map(s => `Recomendación Estratégica: ${s}`)
    ]
  });

  // Página 12: CAPÍTULO 11 - Calibración de Confianza de la Hipótesis (HCCE ADR-014)
  if (payload.confidenceAssessment) {
    const ca = payload.confidenceAssessment;
    const bulletPositivos = [
      `Contribución de Evidencia Gobernada: ${ca.evidenceContribution}%`,
      `Contribución de Correlación Multidominio: ${ca.correlationContribution}%`,
      `Consistencia Temporal: ${ca.temporalConsistency}%`,
      `Estabilidad Analítica: ${ca.analyticalStability}%`
    ].map(item => `✓ ${item}`).join("\n");

    const bulletLimites = ca.limitingFactors.map(f => `- ${f}`).join("\n");
    const bulletReqs = ca.validationRequirements.map(r => `- ${r}`).join("\n");
    const bulletPenalties = ca.penaltiesApplied.length > 0
      ? ca.penaltiesApplied.map(p => `• ${p}`).join("\n")
      : "• Ninguna penalización aplicada.";

    const confidenceText = `DIAGNÓSTICO DE CALIBRACIÓN DE CONFIANZA (HCCS v1.0)

ESTADO DE LA HIPÓTESIS:
${payload.hypothesisLifecycle?.estadoActual || "EN_ANALISIS"}

SCORE DE CONFIANZA MATEMÁTICO:
${ca.confidenceScore} / 100

NIVEL FINAL DE CONFIANZA:
${ca.confidenceLevel} — ${ca.justification}

FACTORES POSITIVOS DE SOPORTE:
${bulletPositivos}

FACTORES LIMITANTES (RAZONES QUE IMPIDEN MAYOR CONFIANZA):
${bulletLimites || "- No se identificaron factores limitantes relevantes."}

REQUERIMIENTOS DE VALIDACIÓN TÁCTICA PARA INCREMENTAR LA CONFIANZA:
${bulletReqs || "- La hipótesis ha alcanzado el máximo rigor metodológico."}

PENALIZACIONES Y TOPES DE GOBERNANZA APLICADOS:
${bulletPenalties}`;

    pages.push({
      id: 'page-confidence-calibration',
      title: 'CAPÍTULO 11: CALIBRACIÓN DE CONFIANZA DE LA HIPÓTESIS',
      mode: 'text',
      visuals: [],
      interpretation: confidenceText
    });
  }

  // Página 13: CAPÍTULO 12 - Decisión Operacional Derivada de la Hipótesis (HDIE ADR-015)
  if (payload.operationalDecision) {
    const dec = payload.operationalDecision;
    const bulletIndicators = dec.successIndicators.map(item => `- ${item}`).join("\n");
    const bulletLimitations = dec.limitations.map(item => `- ${item}`).join("\n");
    const bulletEvidences = dec.evidenceBasis.map(item => `• ${item}`).join("\n");

    const decisionText = `CAPÍTULO 12: DECISIÓN OPERACIONAL DERIVADA DE LA HIPÓTESIS

12.1 HIPÓTESIS EVALUADA:
${payload.hypothesisLifecycle?.hipotesisActual || "Hipótesis no registrada."}

12.2 NIVEL DE CONFIANZA CALIBRADO (HCCS):
${dec.confidenceScore} / 100 — ${payload.confidenceAssessment?.confidenceLevel || "DETERMINADO"}

12.3 EVIDENCIAS DETERMINANTES DE SOPORTE:
${bulletEvidences || "• No se registraron evidencias asociadas de soporte."}

12.4 DECISIÓN Y PLAN DE ACCIÓN RECOMENDADO:
TIPO: ${dec.decisionType}
PRIORIDAD: ${dec.priority}
OBJETIVO OPERACIONAL: ${dec.objective}

12.5 VARIABLES DE DESPLIEGUE OPERATIVO:
ZONA DE INTERVENCIÓN: ${dec.operationalVariables.zona}
HORARIO CRÍTICO: ${dec.operationalVariables.horario || "No especificado"}
FACTOR DE INTERVENCIÓN TÁCTICA: ${dec.operationalVariables.factorIntervencion}
POBLACIÓN OBJETIVO: ${dec.operationalVariables.poblacionObjetivo || "No especificado"}

12.6 FUNDAMENTO ANALÍTICO OPERACIONAL:
La hipótesis evaluada, sustentada por evidencia gobernada, correlación multidominio y confianza calibrada, genera una recomendación operacional proporcional, medible y sujeta a reevaluación.

12.7 INDICADORES DE ÉXITO DE LA INTERVENCIÓN:
${bulletIndicators || "- No se definieron indicadores de medición."}

12.8 LIMITACIONES TÁCTICAS OPERACIONALES:
${bulletLimitations || "- No se identificaron limitaciones operativas."}

12.9 REQUERIMIENTOS DE REEVALUACIÓN POST-INTERVENCION:
Se requiere registrar obligatoriamente los resultados e impacto en la incidencia delictiva mediante el DecisionOutcomeTracker al concluir el periodo de despliegue táctico.`;

    pages.push({
      id: 'page-operational-decision',
      title: 'CAPÍTULO 12: DECISIÓN OPERACIONAL DERIVADA DE LA HIPÓTESIS',
      mode: 'text',
      visuals: [],
      interpretation: decisionText
    });
  }

  return {
    title: 'INFORME DE GEOINTELIGENCIA OPERATIVA',
    fileNumber: resolveVisibleNumeroExpediente(payload),
    generatedAt: new Date().toISOString(),
    classification: 'CONFIDENCIAL - EXCLUSIVO SSPE-CEIPOL',
    globalRisk,
    pages
  };
};
