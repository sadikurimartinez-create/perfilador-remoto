import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';
// Trigger Vercel deploy webhook manually via new commit

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
    // SANITIZACIÓN ACTIVA: Limpiar programáticamente cualquier caracter de formato Markdown (*, _, `) en todos los textos del reporte
    const sanitizeText = (text: string): string => {
      if (!text) return "";
      return text.replace(/[\*_`]/g, "").trim();
    };

    const cleanObjectMarkdown = (obj: any) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          if (typeof item === 'string') {
            obj[idx] = sanitizeText(item);
          } else if (item && typeof item === 'object') {
            cleanObjectMarkdown(item);
          }
        });
      } else if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (key !== 'id' && key !== 'dataUrl' && key !== 'url' && key !== 'storagePath' && key !== 'projectId') {
            if (typeof obj[key] === 'string') {
              obj[key] = sanitizeText(obj[key]);
            } else if (obj[key] && typeof obj[key] === 'object') {
              cleanObjectMarkdown(obj[key]);
            }
          }
        });
      }
    };

    cleanObjectMarkdown(payload);
    cleanObjectMarkdown(briefing);

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

    // 3.5. Extraer únicamente los campos de texto de contenido editorial (capítulos de IA) para la auditoría
    const getEditorialTextValues = (obj: IntelligenceReportPayload): string[] => {
      const values: string[] = [];
      
      const add = (val: any) => {
        if (typeof val === 'string') {
          values.push(val);
        } else if (Array.isArray(val)) {
          val.forEach(add);
        } else if (val && typeof val === 'object') {
          Object.values(val).forEach(add);
        }
      };

      // Agregar solo los campos de contenido editorial generados por la IA
      add(obj.contextoTerritorial);
      add(obj.executiveSummary);
      add(obj.finalHypothesis);
      add(obj.osintSynthesized);
      add(obj.pandillasAnalysis);
      add(obj.conclusiones);
      
      if (obj.maps) {
        obj.maps.forEach(m => add(m.interpretation));
      }
      if (obj.graphs) {
        obj.graphs.forEach(g => {
          add(g.explanation);
          add(g.finding);
          add(g.relation);
        });
      }
      if (obj.streetViewAnalysis) {
        obj.streetViewAnalysis.forEach(s => {
          add(s.observed);
          add(s.criminologicalAnalysis);
          add(s.relation);
        });
      }
      if (obj.photoEvidence) {
        obj.photoEvidence.forEach(p => {
          add(p.caption);
          add(p.criminologicalInterpretation);
          add(p.relation);
        });
      }

      return values;
    };

    const textValues = getEditorialTextValues(payload);
    const allText = textValues.join(" ");

    // 4. Hay Markdown residual (negritas, cursivas o backticks) - Evaluado por cada valor de texto de forma aislada
    const markdownPatterns = [
      /\*\*[^*]+\*\*/,
      /_[^_]+_/,
      /`[^`]+`/
    ];
    const hasMarkdown = textValues.some(val => markdownPatterns.some(pattern => pattern.test(val)));
    if (hasMarkdown) {
      throw new Error("ReportQualityGate: Se detectó formato Markdown residual. El informe debe presentarse en texto plano depurado.");
    }

    // 5. Hay texto crudo o etiquetas técnicas prohibidas
    const forbiddenPatterns = [
      /\[Hecho observado\]/i,
      /\[Inferencia analítica\]/i,
      /\[Sintetizado\]/i,
      /\bPowerUp\b/i,
      /\bOCR\b/i,
      /\bst_dwithin\b/i,
      /\bdiscovery\s+engine\b/i,
      /\bgrounding\b/i
    ];
    const hasForbidden = textValues.some(val => forbiddenPatterns.some(pattern => pattern.test(val)));
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
    const hasUnverified = textValues.some(val => unverifiedPatterns.some(pattern => pattern.test(val)));
    if (hasUnverified) {
      throw new Error("ReportQualityGate: El informe contiene afirmaciones no sustentadas o especulaciones sin respaldo de evidencias.");
    }
  }
}
