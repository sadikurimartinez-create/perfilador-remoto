import { ConsolidatedReport } from '../types/Report';

export type IntelligenceVisualType =
  | 'map'
  | 'graph'
  | 'streetView'
  | 'photo'
  | 'chart';

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
  mode: 'single' | 'double';
  visuals: IntelligenceVisualProduct[];
  interpretation: string;
}

export interface IntelligenceBriefing {
  title: string;
  fileNumber: string;
  generatedAt: string;
  classification: string;
  globalRisk: string;
  executiveBullets: string[];
  criticalFindings: string[];
  riskZones: string[];
  relevantActors: string[];
  immediateRecommendation: string;
  finalHypothesis: string[];
  conclusions: string[];
  pages: IntelligenceLayoutPage[];
}

const PRIORITY: Record<IntelligenceVisualType, number> = {
  map: 1,
  graph: 2,
  streetView: 3,
  photo: 4,
  chart: 5,
};

const normalizeRisk = (risk?: string): string => {
  const value = (risk || '').toLowerCase();
  if (value === 'high' || value === 'alto') return 'ALTO';
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

const compactText = (text: string, maxLength = 170): string => {
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
    'Evidencia visual incorporada al expediente.'
  );
  const type = firstNonEmpty(finding.tipo, finding.photoType, 'punto documentado');

  return compactText(
    `Se observa ${type}. Relevancia operativa: ${observation}. Relacion con hipotesis: aporta evidencia visual del patron territorial. Nivel de riesgo: ${risk}.`,
    260
  );
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

export const buildIntelligenceBriefing = (
  report: ConsolidatedReport,
  visuals: IntelligenceVisualProduct[]
): IntelligenceBriefing => {
  const sortedVisuals = [...visuals]
    .filter((visual) => Boolean(visual.dataUrl))
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);

  const pages: IntelligenceLayoutPage[] = [];
  for (let i = 0; i < sortedVisuals.length; i += 2) {
    const chunk = sortedVisuals.slice(i, i + 2);
    const types = chunk.map((visual) => visual.title).join(' / ');
    pages.push({
      id: `ile-page-${Math.floor(i / 2) + 1}`,
      title: chunk.length === 1 ? chunk[0].title : types,
      mode: chunk.length === 1 ? 'single' : 'double',
      visuals: chunk,
      interpretation: compactText(
        chunk.map((visual) => visual.caption).join(' '),
        chunk.length === 1 ? 220 : 180
      ),
    });
  }

  const globalRisk = getGlobalRiskLabel(report);
  const highRiskFindings = report.findings.filter(
    (finding: any) => normalizeRisk(finding.riskLevel) === 'ALTO'
  );
  const actorNotes = [...report.textNotes, ...report.voiceNotes].filter(Boolean);

  return {
    title: 'INFORME DE GEOINTELIGENCIA',
    fileNumber: report.projectId || 'SIN EXPEDIENTE',
    generatedAt: report.createdAt,
    classification: (report as any).classification || 'USO INSTITUCIONAL',
    globalRisk,
    executiveBullets: [
      `Riesgo global: ${globalRisk}.`,
      `Productos visuales integrados: ${sortedVisuals.length}.`,
      `Hallazgos documentados: ${report.findings.length}.`,
      `Geometria operativa: ${(report as any).geometryType || 'no especificada'}.`,
      `Zonas prioritarias: ${highRiskFindings.length || report.findings.length}.`,
      `Recomendacion inmediata: priorizar verificacion y patrullaje dirigido.`,
    ],
    criticalFindings: highRiskFindings.slice(0, 3).map((finding: any, index) =>
      compactText(`${index + 1}. ${finding.note || 'Hallazgo critico visual.'}`, 120)
    ),
    riskZones: report.findings.slice(0, 4).map((finding: any, index) => {
      const lat = finding.latitude ?? (finding as any).lat;
      const lng = finding.longitude ?? (finding as any).lng;
      return lat && lng ? `Zona ${index + 1}: ${lat}, ${lng}` : `Zona ${index + 1}: evidencia ${index + 1}`;
    }),
    relevantActors: actorNotes.length
      ? actorNotes.slice(0, 3).map((note) => compactText(note, 100))
      : ['Actores no determinados en productos consolidados.'],
    immediateRecommendation:
      'Activar verificacion territorial, resguardar evidencia visual y orientar despliegue a los puntos de mayor riesgo.',
    finalHypothesis: [
      `Que ocurre: concentracion de condiciones territoriales compatibles con riesgo ${globalRisk}.`,
      `Donde ocurre: ${report.projectName}.`,
      'Quien participa: actores relevantes consignados en OSINT/evidencia consolidada, sin atribucion directa.',
      'Por que ocurre: convergencia de oportunidad espacial, accesos, visibilidad y patrones registrados.',
      `Evidencia: ${sortedVisuals.map((visual) => visual.title).slice(0, 5).join(', ') || 'productos visuales existentes'}.`,
      'Implicacion operativa: requiere priorizacion inmediata de vigilancia, contraste en campo y acciones preventivas focalizadas.',
    ],
    conclusions: [
      'Priorizar intervencion en zonas con visuales de mayor riesgo.',
      'Mantener lectura operativa por evidencia, no por narrativa extendida.',
      'Asignar patrullaje y verificacion conforme a mapas, Street View y fotografias integradas.',
      'Actualizar el briefing cuando se incorporen nuevos productos visuales validados.',
    ],
    pages,
  };
};
