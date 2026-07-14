import { ConsolidatedReport } from '../types/Report';
import { ReportIntelligenceNormalizer } from './reportIntelligenceNormalizer';
import { buildOperationalOsintChapter } from './osintChapterBuilder';
import { StatisticalIntelligenceEngineV2 } from './statisticalIntelligenceEngineV2';
import { StatisticalEvidenceMatrixManager } from './statisticalEvidenceMatrix';
import { TCE_DEFAULT_FALLBACK, TerritorialContextEngine } from './territorialContextEngine';
import { VisualEvidenceEngine } from "./visualEvidenceEngine";
import { HypothesisIntelligenceEngine, HIEResult } from './hypothesisIntelligenceEngine';
import { CartographicIntelligenceEngine } from './cartographicIntelligenceEngine';
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
  latitude?: number;
  longitude?: number;
  analysisRadius?: number;
  hieData?: HIEResult;
  cieData?: any;
  historicalIncidents?: any[];
  sieData?: any;
  semData?: any;
  aceReport?: any;
  visualEvidenceMatrix?: any;
  intelligenceContext?: any;
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
  const projectId = reportNumber || (project?.id ? String(project.id) : "EXP-2026-XXXXX");
  const date = new Date().toLocaleDateString("es-MX");
  const analyst = analystName || project?.analyst || "Analista CEIPOL Táctico";
  const geometryType = project?.geometryType || "polígono";
  const areaGeografica = project?.areaGeografica || "Aguascalientes, Ags, México";

  // Bloque I.1: Contexto territorial
  const lat = project?.lat ?? project?.latitude ?? 0;
  const lng = project?.lng ?? project?.longitude ?? 0;
  const radius = project?.analysisRadius ?? project?.radius ?? 250;
  const incidents = project?.historicalIncidents ?? project?.incidents ?? project?.incidenciaCompleta ?? project?.incidenciaLocal ?? project?.iaAnalysis?.historicalCrimes ?? [];
  const stats = StatisticalIntelligenceEngineV2.analyze(incidents, lat, lng, radius);
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
  const hasPandillaMention = rawContent.toLowerCase().includes("pandilla") || rawContent.toLowerCase().includes("clica") || sweeps.some(s => s.engine?.toLowerCase().includes("pandillas"));
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

  if (hasPandillaMention) {
    trazabilidadMatrix.push({
      componente: "Motor de Pandillas",
      fuente: "Censo Local Pandillas",
      metodo: "Análisis de territorialidad",
      hallazgo: "Zona de influencia activa identificada",
      impacto: "Disponibilidad: Media"
    });
  }



  // Pandillas territorial analysis
  let pandillasAnalysis = cleanTechnicalJargon(extractSection(rawContent, 9));
  if (!pandillasAnalysis || pandillasAnalysis.length < 10) {
    if (hasPandillaMention) {
      pandillasAnalysis = "El análisis territorial identificó dinámicas delictivas asociadas a grupos locales con influencia en el polígono estudiado, principalmente en conductas de oportunidad y consumo de sustancias en la vía pública, lo que impacta la percepción de seguridad.";
    } else {
      pandillasAnalysis = "No se identificó presencia territorial directa asociada al área analizada.";
    }
  }

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
    latitude: lat,
    longitude: lng,
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

  // Graphs (Generados programáticamente en lienzo HD, consumiendo SEM de forma unificada)
  const graphs = [
    {
      title: "GRÁFICA 1: Distribución temporal y estacionalidad del fenómeno delictivo",
      dataUrl: renderTemporalShiftChart(vectorInput),
      explanation: `Análisis de serie de tiempo de ${sem.metadata.totalCanonicalIncidents} incidentes registrados. Tendencia clasificada como ${sem.temporalEvidence.trendDirection} (pendiente: ${sem.temporalEvidence.trendSlope.toFixed(2)}).`,
      finding: `Periodos críticos identificados: ${sem.temporalEvidence.criticalPeriods.join(", ") || "No definido"}.`,
      relation: `Coincidencia temporal del fenómeno con anomalías detectadas en fechas clave: ${sem.temporalEvidence.anomalies.map(a => a.date).slice(0, 3).join(", ") || "Ninguna registrada"}.`
    },
    {
      title: "GRÁFICA 2: Concentración espacial y topología de hotspots (frecuencia de incidentes)",
      dataUrl: renderCrimeTopologyChart(vectorInput),
      explanation: `Tabulación espacial cruzada y georreferenciación. El algoritmo adaptativo DBSCAN detectó ${sem.spatialEvidence.hotspots.length} hotspots densos.`,
      finding: `Baricentro delictivo principal ubicado en coordenadas tácticas: Lat ${sem.spatialEvidence.hotspots[0]?.center?.lat.toFixed(4) ?? "0.0"}, Lng ${sem.spatialEvidence.hotspots[0]?.center?.lng.toFixed(4) ?? "0.0"}.`,
      relation: `Los hotspots identificados concentran la actividad criminal recurrente, representando focos rojos de alta concentración geoespacial.`
    },
    {
      title: "GRÁFICA 3: Modelo predictivo y nivel de riesgo de oportunidad (pronóstico futuro)",
      dataUrl: renderPredictiveLineChart(vectorInput),
      explanation: `Estimación probabilística mediante distribución de Poisson (Prueba Chi-Square con nivel de confianza de ${sem.predictiveEvidence.confidenceMetrics.statisticalConfidence.toFixed(1)}%).`,
      finding: `Probabilidad del ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(1)}% de repetición delictiva para la siguiente semana de estudio.`,
      relation: `Índice de contagio Near-Repeat indica propagación de riesgo en un radio extendido de contagio espacio-temporal de ${sem.predictiveEvidence.nearRepeatRisk.toFixed(1)} metros.`
    }
  ];

  // 1. Ejecutar el Motor de Evidencia Visual Operacional
  const visualMatrix = VisualEvidenceEngine.process(
    projectId || "PR-001",
    album || [],
    lat,
    lng,
    radius,
    sem?.spatialEvidence?.hotspots || []
  );

  // Photos Sanitized Mapping
  const photoEvidence = visualMatrix.analystPhotos.map((p, idx) => {
    return {
      id: `photo-${idx}`,
      dataUrl: p.image,
      caption: p.title,
      location: "Sector perimetral", // Sanitizado: sin coordenadas geográficas numéricas
      factor: "Vulnerabilidad Física / Infraestructura",
      criminologicalInterpretation: p.finding,
      relation: p.operationalImpact,
      riskLevel: "Alto",
      lat: 0,
      lng: 0,
      fecha: new Date().toLocaleDateString("es-MX")
    };
  });

  // Street View Sanitized Mapping
  const streetViewAnalysis = visualMatrix.streetViewEvidence.map((s, idx) => {
    return {
      id: `SV-00${idx + 1}`,
      title: s.title,
      dataUrl: s.image,
      location: "Sector perimetral", // Sanitizado: sin coordenadas geográficas numéricas
      fuentePrimaria: "Google Street View",
      fechaCaptura: new Date().toLocaleDateString("es-MX"),
      direccion: areaGeografica,
      orientacion: "Norte (0°)",
      observed: s.description,
      indicadorCriminologico: s.finding,
      inferenciaAnalitica: s.operationalImpact,
      confianza: "Alto",
      impactoHipotesis: "Fortalece",
      recomendacion: "Coordinar remediación física situacional del entorno.",
      criminologicalAnalysis: s.operationalImpact,
      relation: "Coordinar remediación física situacional del entorno."
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

  // Bloque IX: Conclusiones
  const conclusiones = {
    hallazgosCriticos: [] as string[],
    riesgosInmediatos: [] as string[],
    escenariosFuturos: [] as string[],
    recomendacionesTacticas: [] as string[],
    recomendacionesEstrategicas: [] as string[]
  };

  // Precalentamiento de conclusiones cuantitativas basadas en SIE y SEM
  conclusiones.hallazgosCriticos.push(
    `Concentración criminal de ${sem.metadata.totalCanonicalIncidents} eventos identificados en el sector, con un nivel de riesgo predictivo del ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(0)}%.`
  );
  conclusiones.riesgosInmediatos.push(
    `Probabilidad de repetición delictiva semanal estimada en ${(sem.predictiveEvidence.poissonProbability * 100).toFixed(0)}% bajo el modelo de Poisson (Nivel de confianza: ${sem.predictiveEvidence.confidenceMetrics.statisticalConfidence.toFixed(0)}%).`
  );
  conclusiones.recomendacionesTacticas.push(
    `[Acción Inmediata 0-30 días] Focalizar presencia y patrullaje dinámico en el centro de gravedad (${stats.spatialAnalysis.centerOfGravity.lat.toFixed(4)}, ${stats.spatialAnalysis.centerOfGravity.lng.toFixed(4)}) durante periodos críticos: ${sem.temporalEvidence.criticalPeriods.join(", ") || "No definido"}.`
  );
  conclusiones.recomendacionesTacticas.push(
    `[Acción Inmediata 0-30 días] Desplegar patrullajes preventivos para contener la dispersión espacial estimada en ${stats.spatialAnalysis.dispersionMeters.toFixed(0)} metros.`
  );

  if (rawConclusionsText && rawConclusionsText.trim().length > 10) {
    const lines = rawConclusionsText.split("\n").map(l => l.trim()).filter(Boolean);
    let currentCategory: 'inmediata' | 'preventiva' | 'estrategica' | 'other' = 'other';
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("inmediata") || lower.includes("0-30") || lower.includes("0 a 30")) {
        currentCategory = 'inmediata';
        continue;
      } else if (lower.includes("preventiva") || lower.includes("30-90") || lower.includes("30 a 90")) {
        currentCategory = 'preventiva';
        continue;
      } else if (lower.includes("estratégica") || lower.includes("estrategica") || lower.includes("90 días") || lower.includes("90 dias")) {
        currentCategory = 'estrategica';
        continue;
      }

      if (line.startsWith("-") || line.startsWith("*") || line.match(/^\d+\./)) {
        const cleanLine = line.replace(/^[-*\d.]+\s*/, "").trim();
        if (cleanLine.length > 5) {
          if (currentCategory === 'inmediata') {
            conclusiones.recomendacionesTacticas.push(`[Acción Inmediata 0-30 días] ${cleanLine}`);
          } else if (currentCategory === 'preventiva') {
            conclusiones.recomendacionesEstrategicas.push(`[Acción Preventiva 30-90 días] ${cleanLine}`);
          } else if (currentCategory === 'estrategica') {
            conclusiones.escenariosFuturos.push(`[Acción Estratégica >90 días] ${cleanLine}`);
          } else {
            conclusiones.hallazgosCriticos.push(cleanLine);
          }
        }
      }
    }
  }

  // Fallback default bullets if parsing results in empty lists
  if (conclusiones.recomendacionesTacticas.length <= 2) {
    conclusiones.recomendacionesTacticas.push(
      "[Acción Inmediata 0-30 días] Sincronizar las bitácoras de patrullaje dinámico nocturno en las zonas de riesgo.",
      "[Acción Inmediata 0-30 días] Desplegar presencia disuasiva en los nodos viales identificados."
    );
  }
  if (conclusiones.recomendacionesEstrategicas.length === 0) {
    conclusiones.recomendacionesEstrategicas = [
      "[Acción Preventiva 30-90 días] Gestionar la reparación del alumbrado público dañado en el cuadrante.",
      "[Acción Preventiva 30-90 días] Promover la inspección de giros comerciales con venta de alcohol."
    ];
  }
  if (conclusiones.escenariosFuturos.length === 0) {
    conclusiones.escenariosFuturos = [
      "[Acción Estratégica >90 días] Implementar políticas de diseño ambiental (CPTED) y recuperación de predios baldíos.",
      "[Acción Estratégica >90 días] Fomentar la participación ciudadana y la vigilancia comunitaria formal."
    ];
  }
  if (conclusiones.hallazgosCriticos.length <= 1) {
    conclusiones.hallazgosCriticos.push(
      "Deficiencias notables de alumbrado perimetral detectadas en el relevamiento de campo.",
      "Predios baldíos sin cerramientos adecuados que incrementan la vulnerabilidad de escape."
    );
  }

  const executiveSummary = cleanTechnicalJargon(
    rawExecSummary || project?.reportSummary || "Dictamen estratégico de geointeligencia operativa perimetral."
  ).slice(0, 800);

  let finalHypothesis = cleanTechnicalJargon(rawHypothesis);
  if (!finalHypothesis || finalHypothesis.length < 50) {
    finalHypothesis = hieData.centralHypothesis.summary;
  }

  // Estructurar obligatoriamente todos los capítulos narrativos clave en formato de 4 partes (HALLAZGO, EVIDENCIA, ANÁLISIS, IMPLICACIÓN)
  const analysisRadius = Number(project?.analysisRadius) > 0 ? Number(project.analysisRadius) : 500;
  const epicenterLat = project?.latitude || 21.8853;
  const epicenterLng = project?.longitude || -102.2916;
  const locationStr = `${epicenterLat.toFixed(6)}, ${epicenterLng.toFixed(6)} (${projectName})`;

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

  const formattedPandillasAnalysis = formatToFourPartStructure(
    pandillasAnalysis,
    projectName,
    date,
    locationStr,
    "Presencia probable de grupos locales no estructurados vinculados a conductas delictivas menores.",
    "Monitoreo de graffiti/marcas de territorio e inteligencia de campo registrada en la base de datos.",
    "Las agrupaciones aprovechan predios baldíos sin cerramientos como puntos de reunión y zonas de resguardo temporal.",
    "Notificar formalmente a dueños de baldíos para cerramientos y coordinar remoción de graffiti."
  );

  const formattedConclusionesText = formatToFourPartStructure(
    cleanTechnicalJargon(rawConclusionsText) || "Conclusiones tácticas de la geointeligencia delictiva.",
    projectName,
    date,
    locationStr,
    "Recomendaciones tácticas y estratégicas para neutralizar los factores de oportunidad delictiva.",
    "Censo criminológico territorial y bitácora de auditoría de este expediente oficial.",
    "La oportuna corrección de los facilitadores físicos anulará la vulnerabilidad del sector ante la delincuencia de oportunidad.",
    "Ejecutar acciones tácticas inmediatas en 0-30 días y preventivas en 30-90 días según el dictamen."
  );

  return {
    projectName,
    projectId,
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
    visualEvidenceMatrix: visualMatrix
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
      `Número de Expediente: ${payload.projectId}`,
      `Fecha: ${payload.date}`,
      `Analista Responsable: ${payload.analyst}`,
      `Geometría de Cobertura: ${payload.geometryType.toUpperCase()}`,
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
      osintText = `RECOMENDACIÓN INSTITUCIONAL DE DESCARTE:\n\nEl análisis del Capítulo 7 (OSINT) para el expediente ${payload.projectId} ha sido SUSPENDIDO de forma oficial. Las fuentes de datos abiertas recopiladas no superaron los criterios de consistencia analítica, madurez técnica o trazabilidad digital de la gobernanza de la SSPE.\n\nEVIDENCIA:\nNo certificada por inconsistencia de procedencia o violación de estilo.\n\nANÁLISIS:\nAnálisis suspendido temporalmente por inconsistencia metodológica o lingüística.\n\nIMPLICACIÓN OPERATIVA:\nNo habilitado para visualización o publicación oficial. Se requiere auditoría del lote original.`;
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
      pandillasText = `RECOMENDACIÓN INSTITUCIONAL DE DESCARTE:\n\nEl análisis territorial del Capítulo 8 para el expediente ${payload.projectId} ha sido SUSPENDIDO de forma oficial. Los datos levantados en campo no superaron los criterios de consistencia analítica o neutralidad lingüística establecidos por la gobernanza de la SSPE.\n\nEVIDENCIA:\nNo certificada por inconsistencia o violación de estilo.\n\nANÁLISIS:\n${certifiedGim.analyticalFindings[0]}\n\nIMPLICACIÓN OPERATIVA:\n${certifiedGim.limitations[0]}`;
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

  return {
    title: 'INFORME DE GEOINTELIGENCIA OPERATIVA',
    fileNumber: payload.projectId,
    generatedAt: new Date().toISOString(),
    classification: 'CONFIDENCIAL - EXCLUSIVO SSPE-CEIPOL',
    globalRisk,
    pages
  };
};
