import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';
import { hasGenericOsintContent } from './osintChapterBuilder';
import { EditorialStructureEngine } from './editorialStructureEngine';
import { IntelligenceNarrativeValidator } from './intelligenceNarrativeValidator';
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

    // 1. Falta Street View o tiene referencias vacías
    const hasStreetView = !!payload.streetViewAnalysis && payload.streetViewAnalysis.length > 0;
    if (!hasStreetView) {
      throw new Error("ReportQualityGate: El informe requiere obligatoriamente integrar análisis visual de Street View.");
    }

    // Validar procedencia y presencia real de imagen en Street View
    for (const sv of payload.streetViewAnalysis) {
      if (!sv.dataUrl || sv.dataUrl.trim() === "") {
        throw new Error("Informe no autorizado para exportación: existen referencias documentales de Street View sin evidencia visual asociada.");
      }
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

    // Validar presencia de imagen real en fotos de campo
    if (payload.photoEvidence) {
      for (const photo of payload.photoEvidence) {
        if (!photo.dataUrl || photo.dataUrl.trim() === "") {
          throw new Error("Informe no autorizado para exportación: existen referencias documentales de fotos de campo sin evidencia visual asociada.");
        }
      }
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

    // Additional Street View Narrative quality gate (Requisito 6)
    if (!payload.streetViewAnalysis || payload.streetViewAnalysis.length === 0) {
      const narrativeHasReferences = textValues.some(val => 
        val.includes("Street View") || 
        val.includes("EVIDENCIA VIRTUAL") || 
        val.includes("Barrido vial")
      );
      if (narrativeHasReferences) {
        throw new Error("ERROR CRÍTICO: La narrativa contiene referencias Street View sin evidencia visual asociada.");
      }
    }

    // 4. Hay Markdown residual (negritas, cursivas o backticks) - Evaluado por cada valor de texto de forma aislada
    const markdownPatterns = [
      /\*\*[^*]+\*\*/,
      /_[^_]+_/,
      /`[^`]+`/
    ];
    const hasMarkdown = textValues.some(val => markdownPatterns.some(pattern => pattern.test(val)));
    if (hasMarkdown) {
      console.warn("ReportQualityGate [WARNING]: Se detectó formato Markdown residual. El informe debe presentarse en texto plano depurado.");
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
      console.warn("ReportQualityGate [WARNING]: El informe contiene etiquetas técnicas de desarrollo o comandos internos prohibidos.");
    }

    // 6. Hay más de 12 páginas principales (páginas analíticas)
    // Las páginas analíticas tienen modos que no son 'single' ni 'double' (los anexos independientes)
    const analyticalPageCount = briefing.pages.filter((p: any) =>
      p.mode === 'cover' || p.mode === 'hypothesis' || p.mode === 'executive' || p.mode === 'text' || p.mode === 'conclusions'
    ).length || 0;
    
    if (analyticalPageCount > 12) {
      console.warn(`ReportQualityGate [WARNING]: El informe excede las 12 páginas analíticas reglamentarias (Páginas actuales: ${analyticalPageCount}).`);
    }

    // 7. Hay hipótesis múltiples
    const rawHypothesis = payload.finalHypothesis || "";
    const hypothesisCount = (rawHypothesis.match(/hipótesis|hipotesis/gi) || []).length;
    if (rawHypothesis.match(/hipótesis\s+1|hipótesis\s+2/i) || hypothesisCount > 5) {
      console.warn("ReportQualityGate [WARNING]: Se identificaron múltiples hipótesis delictivas. Debe definirse una hipótesis central única.");
      
      // Sanitizar activamente el texto del payload para remover o unificar "Hipótesis 1" o "Hipótesis 2" a "Hipótesis principal"
      if (payload.finalHypothesis) {
        payload.finalHypothesis = payload.finalHypothesis
          .replace(/hipótesis\s+1/gi, "línea de análisis principal")
          .replace(/hipótesis\s+2/gi, "línea de análisis secundaria")
          .replace(/hipótesis\s+múltiples/gi, "línea de análisis integrada");
      }
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
      console.warn("ReportQualityGate [WARNING]: El informe contiene afirmaciones no sustentadas o especulaciones sin respaldo de evidencias.");
    }

    // 9. Capítulo 7 OSINT: prohibir contenido genérico
    if (payload.osintSynthesized && hasGenericOsintContent(payload.osintSynthesized)) {
      throw new Error("ReportQualityGate: El Capítulo 7 (OSINT) contiene afirmaciones genéricas prohibidas. Debe incluir fuentes nombradas, ubicaciones específicas y acciones operativas concretas.");
    }
    if (payload.osintSynthesized && !payload.osintSynthesized.includes("HALLAZGO")) {
      throw new Error("ReportQualityGate: El Capítulo 7 (OSINT) debe estructurarse en bloques HALLAZGO, EVIDENCIA, ANÁLISIS e IMPLICACIÓN OPERATIVA.");
    }

    // --- QUALITY GATE EDITORIAL ---
    const checkChapterStructure = (text: string, chapterName: string) => {
      if (!text) return;
      if (text.length > 2500) {
        const blocks = EditorialStructureEngine.parse(text);
        if (blocks.length < 3 || (blocks.length === 1 && blocks[0].type === "PARAGRAPH")) {
          throw new Error(`[QUALITY GATE EDITORIAL] ${chapterName} contiene estructura semántica detectada pero composición editorial perdida.`);
        }
      }
    };

    const checkMergedAnalyticalLabels = (text: string, chapterName: string) => {
      if (!text) return;
      const lower = text.toLowerCase();
      if (lower.includes("hecho observado") && lower.includes("inferencia analítica")) {
        const lines = text.split(/\n+/);
        const hasSeparateLines = lines.some(l => l.toLowerCase().includes("hecho observado")) && 
                                 lines.some(l => l.toLowerCase().includes("inferencia analítica"));
        if (!hasSeparateLines) {
          throw new Error(`[QUALITY GATE EDITORIAL] ${chapterName} contiene etiquetas analíticas fusionadas sin segmentación editorial.`);
        }
      }
    };

    checkChapterStructure(payload.contextoTerritorial, "Capítulo 1");
    checkChapterStructure(payload.finalHypothesis, "Capítulo 2");
    checkChapterStructure(payload.osintSynthesized, "Capítulo 7");
    checkChapterStructure(payload.pandillasAnalysis, "Capítulo 8");

    checkMergedAnalyticalLabels(payload.finalHypothesis, "Capítulo 2");
    checkMergedAnalyticalLabels(payload.osintSynthesized, "Capítulo 7");

    // 10. Cross Chapter Consistency Check (Calidad de consistencia intercapítulos)
    const hieEvents = payload.hieData?.evidence ?? 0;
    const cieEvents = payload.cieData?.totalEvents ?? 0;
    const sieEvents = payload.sieData?.temporal?.totalEventos ?? 0;

    if (hieEvents !== cieEvents || cieEvents !== sieEvents) {
      throw new Error(`INCONSISTENCIA ANALÍTICA: Los capítulos utilizan diferentes bases criminales (HIE: ${hieEvents}, CIE: ${cieEvents}, SIE: ${sieEvents}).`);
    }

    // 11. Narrative INDE Quality Gate (ADR-010)
    const narrativeResult = IntelligenceNarrativeValidator.validateReport(payload, briefing);
    if (narrativeResult.status === "REJECTED") {
      const errorMsg = `[INTELLIGENCE QUALITY GATE REJECTED] IDS: ${narrativeResult.idsScore}/100. Clasificación: ${narrativeResult.classification}.\nMotivo:\n- ${narrativeResult.reasons.join("\n- ")}\nViolaciones:\n- ${narrativeResult.violations.join("\n- ")}`;
      throw new Error(errorMsg);
    }
  }
}
