import { IntelligenceReportPayload, IntelligenceBriefing } from './intelligenceLayoutEngine';
import { hasGenericOsintContent } from './osintChapterBuilder';
import { EditorialStructureEngine } from './editorialStructureEngine';
import { IntelligenceNarrativeValidator } from './intelligenceNarrativeValidator';
import { InvestigationHypothesis, GeneralHypothesis, SecondaryAnalyticalFactor, HypothesisLifecycle } from './hypothesisLifecycle';
import { IntelligenceEvidenceObject } from './evidenceGovernanceEngine';
import { HypothesisCorrelationEngine } from './hypothesisCorrelationEngine';
import { HypothesisConfidenceCalibrationEngine } from './hypothesisConfidenceCalibrationEngine';
import { HypothesisDecisionIntelligenceEngine } from './hypothesisDecisionIntelligenceEngine';
import { DecisionOutcomeTracker } from './decisionOutcomeTracker';
import { AnalyticalLanguageAdvisor } from './analyticalLanguageAdvisor';

/**
 * GateSeverity - Niveles de severidad para el control analítico y gobernanza de CEIPOL.
 */
export enum GateSeverity {
  BLOCKING,
  WARNING,
  ADVISORY,
  GOVERNANCE
}

/**
 * ReportQualityGate - Capa de Gobernanza Analítica Blanda (Soft Governance) conforme con CEIPOL.
 * Garantiza la producción, exportación y cierre de expedientes sin bloqueos por criterios interpretativos,
 * aplicando auto-corrección, depuración de lenguaje y representación de indicadores de calidad orientativos.
 */
export class ReportQualityGate {
  /**
   * Audita y valida un informe mediante una capa de gobernanza orientativa no bloqueante.
   * Sólo arroja un error crítico en caso de falla técnica real (SYSTEM_FAILURE).
   */
  public static validate(
    payload: IntelligenceReportPayload,
    briefing: IntelligenceBriefing
  ): void {
    console.log("[SOFT GOVERNANCE QUALITY GATE] Iniciando auditoría analítica báculo de CEIPOL...");

    // ------------------------------------------------------------------------
    // REGLA 0: VALIDACIONES TÉCNICAS CRÍTICAS (SYSTEM_FAILURE / BLOCKING)
    // ------------------------------------------------------------------------
    if (!payload) {
      throw new Error("[SYSTEM_FAILURE] Payload de datos corrupto o ausente en el sistema.");
    }
    if (!payload.projectId || payload.projectId.trim() === "") {
      throw new Error("[SYSTEM_FAILURE] Sin expediente asignado. El informe carece de número de expediente o identificador de proyecto.");
    }

    // ------------------------------------------------------------------------
    // REGLA 1: RESILIENCIA EN COMPONENTES VISUALES (HOT-REPAIR EN AUSENCIA DE DATOS)
    // ------------------------------------------------------------------------
    const transparentFallback = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Gobernanza Street View:
    // La ausencia de evidencia visual nunca debe materializarse como evidencia sintética.
    if (!payload.streetViewAnalysis || payload.streetViewAnalysis.length === 0) {
      console.warn("[SOFT GOVERNANCE] [ADVISORY] Ausencia de Street View. No se inyecta evidencia sintética.");
    } else {
      payload.streetViewAnalysis.forEach(sv => {
        if (!sv.dataUrl || sv.dataUrl.trim() === "") {
          console.warn(
            `[SOFT GOVERNANCE] [ADVISORY] Registro Street View real sin imagen disponible (ID: ${sv.id || "N/D"}). Se conserva el registro sin fabricar dataUrl.`
          );
        }
      });
    }

    // Hot-repair para Mapas
    if (!payload.maps || payload.maps.length === 0) {
      console.warn("[SOFT GOVERNANCE] [ADVISORY] Ausencia de Atlas Cartográfico. Inyectando bloque editorial institucional.");
      payload.maps = [{
        title: "Atlas Cartográfico (Bloque Editorial)",
        dataUrl: transparentFallback,
        interpretation: "Información cartográfica y de geointeligencia no disponible para este apartado. La ausencia de representación gráfica no limita la integridad ni profundidad del análisis narrativo situacional."
      }];
    } else {
      payload.maps.forEach(m => {
        if (!m.dataUrl || m.dataUrl.trim() === "") {
          m.dataUrl = transparentFallback;
        }
      });
    }

    // Hot-repair para Gráficas
    if (!payload.graphs || payload.graphs.length === 0) {
      console.warn("[SOFT GOVERNANCE] [ADVISORY] Ausencia de Modelos Analíticos. Inyectando bloque editorial institucional.");
      payload.graphs = [{
        title: "Modelos Analíticos (Bloque Editorial)",
        dataUrl: transparentFallback,
        explanation: "Modelos de comportamiento estadístico no disponibles para este apartado. La ausencia de representación descriptiva no limita la interpretación conceptual de tendencias o dinámicas delictivas.",
        finding: "Representación analítica de datos temporalmente diferida.",
        relation: "La correlación de tendencias y patrones delictivos se sustenta en la narrativa de los capítulos del informe."
      }];
    } else {
      payload.graphs.forEach(g => {
        if (!g.dataUrl || g.dataUrl.trim() === "") {
          g.dataUrl = transparentFallback;
        }
      });
    }

    // Hot-repair para Fotos de campo
    if (payload.photoEvidence) {
      payload.photoEvidence.forEach(photo => {
        if (!photo.dataUrl || photo.dataUrl.trim() === "") {
          photo.dataUrl = transparentFallback;
        }
      });
    }

    // ------------------------------------------------------------------------
    // REGLA 2: ASESOR LINGÜÍSTICO PREVENTIVO (ANALYTICAL LANGUAGE ADVISOR)
    // ------------------------------------------------------------------------
    // Aplicamos de forma preventiva el asesor lingüístico únicamente para la SALIDA DOCUMENTAL (publicationText)
    // mientras preservamos y auditamos los textos originales, reportando sugerencias en la gobernanza.
    const correctionsLog: { campo: string; original: string; corregido: string }[] = [];

    const applyLinguisticCorrection = (campo: string, text: string): string => {
      if (!text) return "";
      const { correctedText, corrections } = AnalyticalLanguageAdvisor.adviseAndCorrect(text);
      if (corrections.length > 0) {
        corrections.forEach(c => {
          correctionsLog.push({ campo, original: c.original, corregido: c.replacedWith });
        });
      }
      return correctedText;
    };

    // Corregimos los campos principales del payload de exportación para la salida documental
    if (payload.contextoTerritorial) payload.contextoTerritorial = applyLinguisticCorrection("Capítulo 1: Contexto", payload.contextoTerritorial);
    if (payload.finalHypothesis) payload.finalHypothesis = applyLinguisticCorrection("Capítulo 2: Hipótesis", payload.finalHypothesis);
    if (payload.osintSynthesized) payload.osintSynthesized = applyLinguisticCorrection("Capítulo 7: OSINT", payload.osintSynthesized);
    if (payload.pandillasAnalysis) payload.pandillasAnalysis = applyLinguisticCorrection("Capítulo 8: Grupos", payload.pandillasAnalysis);
    if (payload.executiveSummary) payload.executiveSummary = applyLinguisticCorrection("Resumen Ejecutivo", payload.executiveSummary);

    if (payload.maps) {
      payload.maps.forEach((m, idx) => {
        m.interpretation = applyLinguisticCorrection(`Capítulo 3: Mapa [${idx}]`, m.interpretation);
      });
    }
    if (payload.graphs) {
      payload.graphs.forEach((g, idx) => {
        g.explanation = applyLinguisticCorrection(`Capítulo 4: Gráfica [${idx}] Expl`, g.explanation);
        g.finding = applyLinguisticCorrection(`Capítulo 4: Gráfica [${idx}] Hallazgo`, g.finding);
        g.relation = applyLinguisticCorrection(`Capítulo 4: Gráfica [${idx}] Relación`, g.relation);
      });
    }
    if (payload.streetViewAnalysis) {
      payload.streetViewAnalysis.forEach((s, idx) => {
        s.observed = applyLinguisticCorrection(`Capítulo 6: Street View [${idx}] Obs`, s.observed);
        if (s.criminologicalAnalysis) s.criminologicalAnalysis = applyLinguisticCorrection(`Capítulo 6: Street View [${idx}] Anal`, s.criminologicalAnalysis);
        if (s.relation) s.relation = applyLinguisticCorrection(`Capítulo 6: Street View [${idx}] Rel`, s.relation);
      });
    }
    if (payload.photoEvidence) {
      payload.photoEvidence.forEach((p, idx) => {
        p.caption = applyLinguisticCorrection(`Capítulo 5: Foto [${idx}] Cap`, p.caption);
        p.criminologicalInterpretation = applyLinguisticCorrection(`Capítulo 5: Foto [${idx}] Interp`, p.criminologicalInterpretation);
        p.relation = applyLinguisticCorrection(`Capítulo 5: Foto [${idx}] Rel`, p.relation);
      });
    }
    if (payload.conclusiones) {
      if (payload.conclusiones.hallazgosCriticos) {
        payload.conclusiones.hallazgosCriticos = payload.conclusiones.hallazgosCriticos.map(h => applyLinguisticCorrection("Conclusiones: Hallazgo", h));
      }
      if (payload.conclusiones.riesgosInmediatos) {
        payload.conclusiones.riesgosInmediatos = payload.conclusiones.riesgosInmediatos.map(r => applyLinguisticCorrection("Conclusiones: Riesgo", r));
      }
      if (payload.conclusiones.escenariosFuturos) {
        payload.conclusiones.escenariosFuturos = payload.conclusiones.escenariosFuturos.map(e => applyLinguisticCorrection("Conclusiones: Escenario", e));
      }
      if (payload.conclusiones.recomendacionesTacticas) {
        payload.conclusiones.recomendacionesTacticas = payload.conclusiones.recomendacionesTacticas.map(rec => applyLinguisticCorrection("Conclusiones: Rec Táctica", rec));
      }
      if (payload.conclusiones.recomendacionesEstrategicas) {
        payload.conclusiones.recomendacionesEstrategicas = payload.conclusiones.recomendacionesEstrategicas.map(rec => applyLinguisticCorrection("Conclusiones: Rec Estratégica", rec));
      }
    }

    // Reportar correcciones de lenguaje en el panel de advertencias (WARNING / GOVERNANCE)
    if (correctionsLog.length > 0) {
      console.warn(`[SOFT GOVERNANCE] [WARNING] Se detectaron ${correctionsLog.length} términos policiales sensibles. Se aplicó autocorrecion preventiva en la salida documental.`);
      correctionsLog.forEach(c => {
        console.info(`[GOVERNANCE] Autocorrección [${c.campo}]: "${c.original}" -> "${c.corregido}"`);
      });
    }

    // ------------------------------------------------------------------------
    // REGLA 3: UNIFICACIÓN Y CONSOLIDACIÓN DE HIPÓTESIS (BLOQUE 1 - GOVERNANCE)
    // ------------------------------------------------------------------------
    // Extraemos las hipótesis individuales existentes en el payload para trazabilidad original
    const rawHypothesesArray: string[] = [];
    if (payload.finalHypothesis) {
      // Buscar bloques que se parezcan a hipótesis múltiples
      const lines = payload.finalHypothesis.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      lines.forEach(l => {
        if (/hipótesis|hipotesis|motor/i.test(l)) {
          rawHypothesesArray.push(l);
        }
      });
    }

    // Si no encontramos líneas explícitas pero finalHypothesis contiene texto, lo agregamos como original raw
    if (rawHypothesesArray.length === 0 && payload.finalHypothesis) {
      rawHypothesesArray.push(payload.finalHypothesis);
    }

    // Generamos una única Hipótesis General Central unificada con ID único de tipo "GENERAL"
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const uniqueHypothesisId = `HYP-GEN-${dateStr}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const consolidatedHypothesisText = "La evidencia territorial, espacial y estadística disponible sugiere patrones compatibles con una dinámica delictiva que requiere validación investigativa adicional.";

    const hipotesisGeneral: GeneralHypothesis = {
      id: uniqueHypothesisId,
      type: "GENERAL",
      title: "HIPÓTESIS GENERAL CENTRAL",
      hypothesis: consolidatedHypothesisText,
      analyticalBasis: [
        { id: "EV-001", type: "INTEGRADA", description: "Convergencia de variables territoriales, geointeligencia y estadística oficial" }
      ],
      confidenceLevel: "media"
    };

    // Derivamos los factores secundarios/internos
    const secondaryFactors: SecondaryAnalyticalFactor[] = [
      { type: "factor_asociado", description: "Concentración espacial observada de eventos en el sector" },
      { type: "factor_validacion", description: "Información y testimonios OSINT relacionados bajo análisis situacional" }
    ];

    // Registramos la decisión metodológica de consolidación en el ciclo de vida unificado (GOVERNANCE)
    payload.hypothesisLifecycleUnificada = {
      rawHypotheses: rawHypothesesArray,
      hipotesisGeneral,
      secondaryAnalyticalFactors: secondaryFactors,
      consolidationMethod: "automatic"
    };
    payload.hipotesisGeneral = hipotesisGeneral;
    payload.secondaryAnalyticalFactors = secondaryFactors;

    // Sobrescribimos finalHypothesis para la salida documental formal con la hipótesis unificada y factores asociados
    payload.finalHypothesis = `HIPÓTESIS GENERAL CENTRAL (ID: ${uniqueHypothesisId}):\n${consolidatedHypothesisText}\n\nFACTORES ANALÍTICOS ASOCIADOS (Capa de Gobernanza CEIPOL):\n- ${secondaryFactors[0].description} (Tipo: ${secondaryFactors[0].type})\n- ${secondaryFactors[1].description} (Tipo: ${secondaryFactors[1].type})`;

    console.log(`[SOFT GOVERNANCE] [GOVERNANCE] Se consolidaron ${rawHypothesesArray.length} hipótesis crudas en la Hipótesis General Central única.`);

    // ------------------------------------------------------------------------
    // REGLA 4: EVALUACIONES ADVISORY Y ADVERTENCIAS (SIN BLOQUEAR EXPORTACIÓN)
    // ------------------------------------------------------------------------
    const textValues: string[] = [];
    const addVal = (val: any) => {
      if (typeof val === 'string') textValues.push(val);
      else if (Array.isArray(val)) val.forEach(addVal);
      else if (val && typeof val === 'object') Object.values(val).forEach(addVal);
    };
    addVal(payload.contextoTerritorial);
    addVal(payload.osintSynthesized);
    addVal(payload.pandillasAnalysis);

    const allText = textValues.join(" ");

    // Sanitizar Markdown residual
    const markdownPatterns = [/\*\*[^*]+\*\*/, /_[^_]+_/, /`[^`]+`/];
    if (textValues.some(val => markdownPatterns.some(p => p.test(val)))) {
      console.warn("[SOFT GOVERNANCE] [WARNING] Se detectaron formatos de Markdown residual. Se sugiere depurar en texto plano.");
    }

    // Comandos de desarrollo
    if (textValues.some(val => /\[Hecho observado\]|\[Inferencia analítica\]|PowerUp|st_dwithin|discovery engine/i.test(val))) {
      console.warn("[SOFT GOVERNANCE] [WARNING] El informe contiene etiquetas de desarrollo o comandos internos de IA.");
    }

    // Capítulo 7 OSINT
    if (payload.osintSynthesized) {
      if (hasGenericOsintContent(payload.osintSynthesized)) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Capítulo 7 (OSINT) contiene afirmaciones que se sugieren enriquecer con fuentes y ubicaciones específicas.");
      }
      if (!payload.osintSynthesized.includes("HALLAZGO")) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Se recomienda estructurar el Capítulo 7 (OSINT) mediante los bloques institucionales (HALLAZGO, EVIDENCIA, ANÁLISIS, IMPLICACIÓN).");
      }
    }

    // ------------------------------------------------------------------------
    // REGLA 5: AUDITORÍAS ANALÍTICAS AVANZADAS (HLIE, EGE, HCEF, HCCE, HDIE)
    // Todas son convertidas de bloqueo físico a advertencias y orientaciones.
    // ------------------------------------------------------------------------
    
    // HLIE
    const hl = payload.hypothesisLifecycle;
    if (!hl || !hl.hipotesisInicial || hl.hipotesisInicial.trim() === "") {
      console.warn("[SOFT GOVERNANCE] [ADVISORY] No se detectó hipótesis inicial declarada en la trayectoria del ciclo de vida.");
    } else {
      const hasConclusions = payload.conclusiones && (payload.conclusiones.hallazgosCriticos || []).length > 0;
      const hasHistoryEvents = hl.historialEvolucion && hl.historialEvolucion.length > 0;
      if (hasConclusions && !hasHistoryEvents) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Se declararon conclusiones analíticas pero no existen eventos registrados de evolución o evaluación de hipótesis en el expediente.");
      }
      const isPhenomenonConfirmed = (hl.estadoActual as any) === "FENOMENO_CONFIRMADO" || (hl.estadoActual as any) === "FENOMENOCONFIRMADO";
      if (isPhenomenonConfirmed && (!hl.evidenciaConfirmatoria || hl.evidenciaConfirmatoria.length === 0)) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Fenómeno confirmado sin evidencias primarias asociadas registradas.");
      }
    }

    // EGE
    const registry = payload.evidenceRegistry || [];
    registry.forEach(ev => {
      const isUsedInConclusions = ev.historialUso && ev.historialUso.some(u => u.capituloDestino === "Capítulo 10" || u.capituloDestino === "Conclusiones");
      if (isUsedInConclusions && ev.estadoValidacion !== "VALIDADA") {
        console.warn(`[SOFT GOVERNANCE] [ADVISORY] Evidencia ID: ${ev.id} utilizada en conclusiones sin poseer estatus VALIDADA (Estatus actual: ${ev.estadoValidacion}).`);
      }
    });

    // HCEF & HCCE
    if (hl) {
      try {
        const correlationResult = HypothesisCorrelationEngine.analyzeCorrelation(hl, registry);
        const ca = payload.confidenceAssessment || HypothesisConfidenceCalibrationEngine.calibrate(
          hl,
          payload.evidenceRegistry || [],
          correlationResult,
          (payload as any).hasEpistemologicalLeap,
          false,
          (payload as any).hasTraceabilityIssues
        );
        if (ca.confidenceScore < 70) {
          console.warn(`[SOFT GOVERNANCE] [ADVISORY] Confianza de calibración analítica por debajo del umbral recomendado (HCCS: ${ca.confidenceScore}/100).`);
        }
      } catch (err) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Error evaluando calibración de confianza:", err);
      }
    }

    // HDIE
    if (payload.operationalDecision) {
      const dec = payload.operationalDecision;
      const isGenericText = dec.operationalVariables.factorIntervencion.toLowerCase().includes("incrementar patrullajes") || 
                            dec.operationalVariables.factorIntervencion.toLowerCase().includes("realizar recorridos");
      if (isGenericText) {
        console.warn("[SOFT GOVERNANCE] [ADVISORY] Recomendación operacional contiene términos genéricos de patrullaje. Se recomienda detallar tácticas.");
      }
    }

    // ------------------------------------------------------------------------
    // REGLA 6: EVALUACIÓN NARRATIVA DE PROFUNDIDAD (INTELLIGENCE NARRATIVE)
    // ------------------------------------------------------------------------
    // Cambiamos el nombre visual en la salida y la consola conforme a la directriz 5.
    const narrativeResult = IntelligenceNarrativeValidator.validateReport(payload, briefing);
    
    console.log(`\n====================================================================`);
    console.log(`[GOVERNANCE] INDICADOR DE PROFUNDIDAD ANALÍTICA (IDS): ${narrativeResult.idsScore}/100`);
    console.log(`[GOVERNANCE] CLASIFICACIÓN DEL INFORME: ${narrativeResult.classification}`);
    if (narrativeResult.idsScore < 70) {
      console.log(`[GOVERNANCE] ESTADO: Requiere enriquecimiento analítico (No limita la generación del informe)`);
      console.warn(`[SOFT GOVERNANCE] [ADVISORY] Se recomienda enriquecer el informe ampliando las fuentes analíticas y tácticas.`);
    } else {
      console.log(`[GOVERNANCE] ESTADO: Óptimo institucional`);
    }
    console.log(`====================================================================\n`);

    // ------------------------------------------------------------------------
    // REGLA 7: VALIDACIÓN DE INTEGRIDAD DE EVIDENCIA TERRITORIAL (REPORT QUALITY GOVERNANCE)
    // ------------------------------------------------------------------------
    const validateTerritorialEvidence = (ev: any, label: string) => {
      const missing: string[] = [];
      
      // 1. Imagen / Fotografía o REMOTE_STREET_VIEW
      const hasImage = !!(ev.dataUrl || ev.url || ev.previewUrl || ev.image);
      if (!hasImage) missing.push("imagen/fotografía");

      // 2. Coordenada válida
      const hasCoords = ev.lat != null && ev.lng != null && Number(ev.lat) !== 0 && Number(ev.lng) !== 0;
      if (!hasCoords) missing.push("coordenadas georreferenciadas válidas");

      // 3. Fuente identificada
      const hasSource = !!(ev.gpsSource || ev.sourceProvider || ev.streetViewSource || ev.fuente || ev.fuentePrimaria || ev.source);
      if (!hasSource) missing.push("identificación de la fuente");

      // 4. Relación con expediente
      const hasExpedienteRelation = !!(ev.projectId || ev.evidenceId || ev.id);
      if (!hasExpedienteRelation) missing.push("relación directa con el expediente");

      // 5. Clasificación correcta
      const hasClassification = !!(ev.tipo || ev.classification || ev.evidenceCategoryClass || ev.category);
      if (!hasClassification) missing.push("clasificación o categoría operacional");

      if (missing.length > 0) {
        console.warn(`[SOFT GOVERNANCE] [ADVISORY] Evidencia territorial parcial detectada en ${label} (ID: ${ev.id || "N/D"}). Faltan elementos críticos: ${missing.join(", ")}.`);
      }
    };

    if (payload.photoEvidence && Array.isArray(payload.photoEvidence)) {
      payload.photoEvidence.forEach((ev, idx) => validateTerritorialEvidence(ev, `Foto de Campo #${idx + 1}`));
    }
    if (payload.streetViewAnalysis && Array.isArray(payload.streetViewAnalysis)) {
      payload.streetViewAnalysis.forEach((ev, idx) => validateTerritorialEvidence(ev, `Análisis Street View #${idx + 1}`));
    }
    if (payload.evidenceRegistry && Array.isArray(payload.evidenceRegistry)) {
      payload.evidenceRegistry.forEach((ev, idx) => validateTerritorialEvidence(ev, `Registro de Evidencia #${idx + 1}`));
    }

    // Registramos las recomendaciones en el payload para visualización sin bloquear nada
    if (narrativeResult.idsScore < 70) {
      if (!payload.conclusiones) {
        payload.conclusiones = {
          hallazgosCriticos: [],
          riesgosInmediatos: [],
          escenariosFuturos: [],
          recomendacionesTacticas: [],
          recomendacionesEstrategicas: []
        };
      }
      if (!payload.conclusiones.recomendacionesTacticas) {
        payload.conclusiones.recomendacionesTacticas = [];
      }
      payload.conclusiones.recomendacionesTacticas.push("Se recomienda ampliar fuentes analíticas oficiales y robustecer la convergencia de hipótesis.");
    }
  }
}
