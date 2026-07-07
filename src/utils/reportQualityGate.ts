import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';

/**
 * ReportQualityGate - Validador de consistencia y calidad institucional SSPE-CEIPOL
 */
export class ReportQualityGate {
  /**
   * Valida los requisitos de calidad institucionales antes de permitir la exportación.
   * Lanza un error detallado si falla alguna regla.
   */
  public static validate(
    payload: IntelligenceReportPayload,
    briefing: IntelligenceBriefing
  ): void {
    // 1. Falta Street View
    const hasStreetView = !!payload.streetViewAnalysis && payload.streetViewAnalysis.length > 0;
    if (!hasStreetView) {
      throw new Error("ReportQualityGate: El informe requiere obligatoriamente integrar análisis visual de Street View.");
    }

    // 2. Faltan mapas
    const hasMaps = !!payload.maps && payload.maps.length > 0;
    if (!hasMaps) {
      throw new Error("ReportQualityGate: El informe requiere obligatoriamente integrar el Atlas Cartográfico (Mapas).");
    }

    // 3. Faltan gráficas
    const hasGraphs = !!payload.graphs && payload.graphs.length > 0;
    if (!hasGraphs) {
      throw new Error("ReportQualityGate: El informe requiere obligatoriamente integrar Modelos Analíticos (Gráficas).");
    }

    // Unir todo el texto del informe para auditoría profunda
    const allText = JSON.stringify(payload);

    // 4. Hay Markdown residual (negritas, cursivas o backticks)
    const markdownPatterns = [
      /\*\*[^*]+\*\*/,
      /_[^_]+_/,
      /`[^`]+`/
    ];
    const hasMarkdown = markdownPatterns.some(pattern => pattern.test(allText));
    if (hasMarkdown) {
      throw new Error("ReportQualityGate: Se detectó formato Markdown residual. El informe debe presentarse en texto plano depurado.");
    }

    // 5. Hay texto crudo o etiquetas técnicas prohibidas
    const forbiddenPatterns = [
      /\[Hecho observado\]/i,
      /\[Inferencia analítica\]/i,
      /\[Sintetizado\]/i,
      /PowerUp/i,
      /OCR/i,
      /st_dwithin/i,
      /discovery\s+engine/i,
      /grounding/i
    ];
    const hasForbidden = forbiddenPatterns.some(pattern => pattern.test(allText));
    if (hasForbidden) {
      throw new Error("ReportQualityGate: El informe contiene etiquetas técnicas de desarrollo o comandos internos prohibidos.");
    }

    // 6. Hay más de 12 páginas principales (páginas analíticas)
    // Las páginas analíticas tienen modos que no son 'single' ni 'double' (los anexos independientes)
    const analyticalPageCount = briefing.pages.filter((p: any) =>
      p.mode === 'cover' || p.mode === 'hypothesis' || p.mode === 'executive' || p.mode === 'text' || p.mode === 'conclusions'
    ).length || 0;
    
    if (analyticalPageCount > 12) {
      throw new Error(`ReportQualityGate: El informe excede las 12 páginas analíticas reglamentarias (Páginas actuales: ${analyticalPageCount}).`);
    }

    // 7. Hay hipótesis múltiples
    const rawHypothesis = payload.finalHypothesis || "";
    const hypothesisCount = (rawHypothesis.match(/hipótesis|hipotesis/gi) || []).length;
    if (rawHypothesis.match(/hipótesis\s+1|hipótesis\s+2/i) || hypothesisCount > 5) {
      throw new Error("ReportQualityGate: Se identificaron múltiples hipótesis delictivas. Debe definirse una hipótesis central única.");
    }

    // 8. Existen afirmaciones no sustentadas
    const unverifiedPatterns = [
      /especulación/i,
      /sin sustento/i,
      /no sustentable/i,
      /sin justificación/i,
      /se asume sin/i
    ];
    const hasUnverified = unverifiedPatterns.some(pattern => pattern.test(allText));
    if (hasUnverified) {
      throw new Error("ReportQualityGate: El informe contiene afirmaciones no sustentadas o especulaciones sin respaldo de evidencias.");
    }
  }
}
