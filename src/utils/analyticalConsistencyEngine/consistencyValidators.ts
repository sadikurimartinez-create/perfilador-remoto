import { ACEAlert, ACEBlockingReason, ACEPayload } from "./models/aceTypes";
import { ConsistencyRules } from "./consistencyRules";

export class ConsistencyValidators {
  /**
   * Valida la coherencia cuantitativa de eventos entre todos los motores.
   */
  public static validateQuantitative(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED"; maxDifference: number } {
    const semEvents = payload.semContext.criminalEvidence.totalEvents;
    
    const targets = [
      { name: "SIE Core", count: payload.sieEventsCount, source: "SIE" },
      { name: "CIE GIS Engine", count: payload.cieContext.eventsCount, source: "CIE" },
      { name: "Report Engine", count: payload.reportContext.eventsCount, source: "Report Engine" }
    ];

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    let maxDifference = 0;

    for (const target of targets) {
      const evaluation = ConsistencyRules.evaluateQuantitativeDeviation(semEvents, target.count);
      const diff = Math.abs(target.count - semEvents);
      if (diff > maxDifference) maxDifference = diff;

      if (evaluation.status !== "PASS") {
        if (evaluation.status === "FAILED") overallStatus = "FAILED";
        else if (overallStatus !== "FAILED") overallStatus = "WARNING";

        const alertSeverity = evaluation.status === "FAILED" ? "HIGH" : "MEDIUM";
        
        alerts.push({
          type: "QUANTITATIVE",
          category: "TECHNICAL", // Ajuste 2
          message: `Discrepancia cuantitativa: ${target.name} utiliza ${target.count} eventos, pero SEM certifica ${semEvents} (Desviación: ${evaluation.deviationPercentage}%)`,
          severity: alertSeverity,
          source: target.source,
          expected: semEvents,
          received: target.count
        });

        if (evaluation.status === "FAILED") {
          blockingReasons.push({
            module: "QUANTITATIVE",
            variable: `${target.source.toLowerCase()}EventsCount`,
            expected: semEvents,
            received: target.count,
            message: `Desviación cuantitativa crítica de ${evaluation.deviationPercentage}% entre ${target.name} y SEM. Se supera el umbral permitido del 10%.`
          });
        }
      }
    }

    return { status: overallStatus, maxDifference };
  }

  /**
   * Valida la coherencia espacial (centroides y radios).
   */
  public static validateSpatial(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED"; centroidDistanceMeters: number; radiusDifferencePercentage: number } {
    const semLat = payload.semContext.metadata.centerLat;
    const semLng = payload.semContext.metadata.centerLng;
    const semRadius = payload.semContext.metadata.analysisRadiusMeters;

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    
    // Tolerancia espacial permitida: 10% del radio del proyecto
    const spatialToleranceMeters = 0.1 * semRadius;

    // 1. Validar centroide del TCE
    const distTce = ConsistencyRules.calculateHaversineDistance(
      semLat,
      semLng,
      payload.tceContext.centroid.lat,
      payload.tceContext.centroid.lng
    );

    if (distTce > spatialToleranceMeters) {
      overallStatus = "FAILED";
      const devPct = parseFloat(((distTce / semRadius) * 100).toFixed(2));
      
      alerts.push({
        type: "SPATIAL",
        category: "TECHNICAL",
        message: `Desplazamiento geográfico del TCE de ${distTce.toFixed(1)}m respecto a la SEM (Representa ${devPct}% del radio; límite permitido: 10%)`,
        severity: "HIGH",
        source: "TCE",
        expected: { lat: semLat, lng: semLng },
        received: payload.tceContext.centroid
      });

      blockingReasons.push({
        module: "SPATIAL",
        variable: "tceCentroid",
        expected: { lat: semLat, lng: semLng },
        received: payload.tceContext.centroid,
        message: `El centroide del TCE difiere en ${distTce.toFixed(1)} metros respecto a la SEM, superando la tolerancia institucional del 10% (${spatialToleranceMeters}m).`
      });
    }

    // 2. Validar centroide del CIE
    const distCie = ConsistencyRules.calculateHaversineDistance(
      semLat,
      semLng,
      payload.cieContext.centroid.lat,
      payload.cieContext.centroid.lng
    );

    if (distCie > spatialToleranceMeters) {
      overallStatus = "FAILED";
      const devPct = parseFloat(((distCie / semRadius) * 100).toFixed(2));

      alerts.push({
        type: "SPATIAL",
        category: "TECHNICAL",
        message: `Desplazamiento geográfico del CIE de ${distCie.toFixed(1)}m respecto a la SEM (Representa ${devPct}% del radio; límite permitido: 10%)`,
        severity: "HIGH",
        source: "CIE",
        expected: { lat: semLat, lng: semLng },
        received: payload.cieContext.centroid
      });

      blockingReasons.push({
        module: "SPATIAL",
        variable: "cieCentroid",
        expected: { lat: semLat, lng: semLng },
        received: payload.cieContext.centroid,
        message: `El centroide geográfico del CIE difiere en ${distCie.toFixed(1)} metros respecto a la SEM, superando la tolerancia institucional del 10% (${spatialToleranceMeters}m).`
      });
    }

    // 3. Validar diferencia de radios geográficos
    const tceRadDiff = Math.abs(payload.tceContext.radiusMeters - semRadius);
    const tceRadPct = (tceRadDiff / semRadius) * 100;

    const cieRadDiff = Math.abs(payload.cieContext.radiusMeters - semRadius);
    const cieRadPct = (cieRadDiff / semRadius) * 100;

    const maxRadPct = Math.max(tceRadPct, cieRadPct);

    if (maxRadPct > 10) {
      overallStatus = "FAILED";
      alerts.push({
        type: "SPATIAL",
        category: "TECHNICAL",
        message: `Discrepancia en radios de análisis: Desviación máxima detectada del ${maxRadPct.toFixed(1)}% (Límite permitido: 10%)`,
        severity: "HIGH",
        source: tceRadPct > cieRadPct ? "TCE" : "CIE",
        expected: semRadius,
        received: tceRadPct > cieRadPct ? payload.tceContext.radiusMeters : payload.cieContext.radiusMeters
      });

      blockingReasons.push({
        module: "SPATIAL",
        variable: "analysisRadius",
        expected: semRadius,
        received: tceRadPct > cieRadPct ? payload.tceContext.radiusMeters : payload.cieContext.radiusMeters,
        message: `El radio de análisis difiere en ${maxRadPct.toFixed(1)}% respecto a la SEM, superando la tolerancia del 10%.`
      });
    }

    return {
      status: overallStatus,
      centroidDistanceMeters: Math.max(distTce, distCie),
      radiusDifferencePercentage: maxRadPct
    };
  }

  /**
   * Valida la coherencia temporal (periodos de cobertura).
   */
  public static validateTemporal(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED"; coverageInconsistent: boolean } {
    const semStart = payload.semContext.temporalEvidence.temporalCoverage.startDate;
    const semEnd = payload.semContext.temporalEvidence.temporalCoverage.endDate;

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    let coverageInconsistent = false;

    // 1. Comparar con TCE
    if (payload.tceContext.startDate !== semStart || payload.tceContext.endDate !== semEnd) {
      overallStatus = "FAILED";
      coverageInconsistent = true;
      alerts.push({
        type: "TEMPORAL",
        category: "TECHNICAL",
        message: `Inconsistencia temporal con TCE: Cobertura declarada [${payload.tceContext.startDate} a ${payload.tceContext.endDate}], pero SEM certifica [${semStart} a ${semEnd}]`,
        severity: "HIGH",
        source: "TCE",
        expected: { start: semStart, end: semEnd },
        received: { start: payload.tceContext.startDate, end: payload.tceContext.endDate }
      });

      blockingReasons.push({
        module: "TEMPORAL",
        variable: "tceDateRange",
        expected: `${semStart} a ${semEnd}`,
        received: `${payload.tceContext.startDate} a ${payload.tceContext.endDate}`,
        message: `El rango temporal de análisis configurado en el TCE no coincide con la cobertura de datos reales certificada por la SEM.`
      });
    }

    // 2. Comparar con Reporte
    if (payload.reportContext.startDate !== semStart || payload.reportContext.endDate !== semEnd) {
      overallStatus = "FAILED";
      coverageInconsistent = true;
      alerts.push({
        type: "TEMPORAL",
        category: "TECHNICAL",
        message: `Inconsistencia temporal con Report Engine: El reporte abarca [${payload.reportContext.startDate} a ${payload.reportContext.endDate}], pero SEM certifica [${semStart} a ${semEnd}]`,
        severity: "HIGH",
        source: "Report Engine",
        expected: { start: semStart, end: semEnd },
        received: { start: payload.reportContext.startDate, end: payload.reportContext.endDate }
      });

      blockingReasons.push({
        module: "TEMPORAL",
        variable: "reportDateRange",
        expected: `${semStart} a ${semEnd}`,
        received: `${payload.reportContext.startDate} a ${payload.reportContext.endDate}`,
        message: `El periodo temporal impreso en el reporte difiere del periodo analizado estadísticamente por la SEM.`
      });
    }

    return { status: overallStatus, coverageInconsistent };
  }

  /**
   * Valida la consistencia criminológica mediante vectores de análisis semántico (Ajuste 3).
   */
  public static validateCriminological(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED"; hypothesisContradictory: boolean } {
    const semPattern = payload.semContext.spatialEvidence.spatialPattern;
    const hiePattern = payload.hieContext.validationVector.spatialPattern;

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    let hypothesisContradictory = false;

    // Detectar contradicciones de patrones espaciales cuantitativos vs cualitativos
    const isSemConcentrated = semPattern.includes("CONCENTRACIÓN") || semPattern.includes("AGRUPACIÓN");
    const isHieDispersed = hiePattern === "DISPERSED";

    const isSemDispersed = semPattern.includes("DISPERSO") || semPattern.includes("DISPERSIÓN");
    const isHieConcentrated = hiePattern === "CONCENTRATED";

    if (isSemConcentrated && isHieDispersed) {
      overallStatus = "WARNING"; // Las discrepancias interpretativas generan WARNING, no bloquean (Ajuste 5)
      hypothesisContradictory = true;
      alerts.push({
        type: "CRIMINOLOGICAL",
        category: "ANALYTICAL", // Alerta de discrepancia analítica (Ajuste 2)
        message: `Contradicción analítica: La hipótesis cualitativa del HIE es DISPERSA, pero la SEM evidencia un patrón CONCENTRADO (Entropía: ${payload.semContext.spatialEvidence.entropy})`,
        severity: "MEDIUM",
        source: "HIE-SEM-CROSS",
        expected: "CONCENTRATED",
        received: "DISPERSED"
      });
    } else if (isSemDispersed && isHieConcentrated) {
      overallStatus = "WARNING";
      hypothesisContradictory = true;
      alerts.push({
        type: "CRIMINOLOGICAL",
        category: "ANALYTICAL",
        message: `Contradicción analítica: La hipótesis cualitativa del HIE es CONCENTRADA, pero la SEM evidencia un patrón DISPERSO sin clústeres.`,
        severity: "MEDIUM",
        source: "HIE-SEM-CROSS",
        expected: "DISPERSED",
        received: "CONCENTRATED"
      });
    }

    // Detectar contradicciones de patrones predictivos (WARNING predictivo)
    const semPoisson = payload.semContext.predictiveEvidence.poissonProbability;
    const hieOpportunity = payload.hieContext.validationVector.criticalOpportunity;

    if (semPoisson < 0.30 && hieOpportunity === "HIGH") {
      overallStatus = "WARNING";
      hypothesisContradictory = true;
      alerts.push({
        type: "CRIMINOLOGICAL",
        category: "ANALYTICAL",
        message: `Contradicción predictiva: El HIE califica la oportunidad crítica como ALTA (HIGH), pero el modelo predictivo Poisson de la SEM estima una probabilidad de evento muy baja (${(semPoisson * 100).toFixed(1)}%).`,
        severity: "MEDIUM",
        source: "HIE-SEM-PREDICTIVE-CROSS",
        expected: "LOW/MEDIUM",
        received: "HIGH"
      });
    }

    return { status: overallStatus, hypothesisContradictory };

  }

  /**
   * Valida la consistencia de recursos e integridad del documento.
   */
  public static validateDocument(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED"; mapsOrChartsInconsistent: boolean } {
    const semHotspotsCount = payload.semContext.spatialEvidence.hotspots.length;
    const reportMapsCount = payload.reportContext.mapCount;

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    let mapsOrChartsInconsistent = false;

    // Regla de Pérdida Documental (Prueba 6):
    // Si hay hotspots activos detectados en la SEM pero el reporte no contiene mapas para ilustrarlos.
    if (semHotspotsCount > 0 && reportMapsCount === 0) {
      overallStatus = "FAILED";
      mapsOrChartsInconsistent = true;
      
      alerts.push({
        type: "DOCUMENT",
        category: "TECHNICAL",
        message: `Pérdida documental: Se detectaron ${semHotspotsCount} hotspots activos, pero el reporte tiene 0 mapas insertados.`,
        severity: "HIGH",
        source: "Report Engine",
        expected: ">= 1 Mapa",
        received: "0 Mapas"
      });

      blockingReasons.push({
        module: "DOCUMENT",
        variable: "mapCount",
        expected: ">= 1 Mapa",
        received: 0,
        message: `Se detectaron ${semHotspotsCount} hotspots en la SEM. El dictamen final no puede ser exportado sin mapas para su representación cartográfica.`
      });
    }

    // Regla menor: si el reporte no tiene gráficas insertadas
    if (payload.reportContext.chartsCount === 0) {
      if (overallStatus !== "FAILED") overallStatus = "WARNING";
      alerts.push({
        type: "DOCUMENT",
        category: "TECHNICAL",
        message: "El reporte actual no contiene gráficas estadísticas. Se recomienda incluirlas para robustecer la visualización temporal.",
        severity: "LOW",
        source: "Report Engine"
      });
    }

    return { status: overallStatus, mapsOrChartsInconsistent };
  }

  /**
   * FASE 3: Valida la gobernanza, lenguaje y consistencia metodológica de la GangEvidenceMatrix adaptada (GIM).
   * No emite juicios criminológicos directos, evaluando únicamente la coherencia institucional del lenguaje
   * y la proporcionalidad de las conclusiones de acuerdo con la Regla ACE-GIM-003.
   */
  public static validateGangConsistency(
    payload: ACEPayload,
    alerts: ACEAlert[],
    blockingReasons: ACEBlockingReason[]
  ): { status: "PASS" | "WARNING" | "FAILED" } {
    const gim = payload.gimContext;
    if (!gim) {
      // Expedientes históricos sin GIM pasan de forma retrocompatible
      return { status: "PASS" };
    }

    let overallStatus: "PASS" | "WARNING" | "FAILED" = "PASS";

    // 1. Lenguaje Institucional y Neutralidad (Presunción de Inocencia)
    const forbiddenPhrasesFailed = ["pertenece a la pandilla", "miembro confirmado"];
    const forbiddenPhrasesWarning = ["controla territorio", "zona dominada"];

    // Inspeccionar descripciones analíticas y factuales
    const allTexts = [...gim.evidenceDescriptions, ...gim.analyticalObservations];

    for (const text of allTexts) {
      const lowerText = text.toLowerCase();
      
      // Buscar violaciones críticas (FAILED)
      for (const phrase of forbiddenPhrasesFailed) {
        if (lowerText.includes(phrase)) {
          overallStatus = "FAILED";
          alerts.push({
            type: "CRIMINOLOGICAL",
            category: "ANALYTICAL",
            message: `Violación de neutralidad lingüística: Se identificó la expresión restrictiva '${phrase}' en las aserciones de GIM, violando la presunción de inocencia de la SSPE.`,
            severity: "HIGH",
            source: "GIM-ACE Auditor",
            expected: "Lenguaje descriptivo e institucional neutro",
            received: text
          });

          // Agregar razón de bloqueo si no está duplicada
          if (!blockingReasons.some(r => r.variable === "styleJargonConstraint")) {
            blockingReasons.push({
              module: "CRIMINOLOGICAL",
              variable: "styleJargonConstraint",
              expected: "Uso de lenguaje de grupo de atención especial y presunción de inocencia",
              received: text,
              message: `El dictamen contiene juicios penales incriminatorios prohibidos por la SSPE ('${phrase}'). Debe ajustarse el texto antes de certificar el expediente.`
            });
          }
        }
      }

      // Buscar advertencias (WARNING)
      for (const phrase of forbiddenPhrasesWarning) {
        if (lowerText.includes(phrase)) {
          if (overallStatus !== "FAILED") overallStatus = "WARNING";
          alerts.push({
            type: "CRIMINOLOGICAL",
            category: "ANALYTICAL",
            message: `Advertencia de neutralidad: Se detectó jerga de dominación física '${phrase}'. Se recomienda reemplazar por 'zona de influencia analítica' o 'factores de oportunidad'.`,
            severity: "MEDIUM",
            source: "GIM-ACE Auditor",
            expected: "Neutralidad de control físico perimetral",
            received: text
          });
        }
      }
    }

    // 2. Proporcionalidad Evidencia-Conclusión
    // Si tenemos un grafiti aislado (<= 1) pero el texto describe un control territorial absoluto
    const hasAbsoluteNarrative = allTexts.some(text => {
      const lower = text.toLowerCase();
      return lower.includes("control absoluto") || lower.includes("hegemonía") || lower.includes("controla la zona") || lower.includes("control absoluto de zona");
    });

    if (gim.evidenceCount.graffiti <= 1 && hasAbsoluteNarrative) {
      overallStatus = "FAILED";
      alerts.push({
        type: "CRIMINOLOGICAL",
        category: "ANALYTICAL",
        message: `Falta de proporcionalidad analítica: Se declara control territorial absoluto o hegemonía grupal teniendo solamente ${gim.evidenceCount.graffiti} grafiti(s) registrados como sustento.`,
        severity: "HIGH",
        source: "GIM-ACE Auditor",
        expected: "Proporcionalidad entre volumen de indicios y aserciones territoriales",
        received: `Grafitis: ${gim.evidenceCount.graffiti}, Conclusión: Control territorial absoluto`
      });

      if (!blockingReasons.some(r => r.variable === "analyticalProportionality")) {
        blockingReasons.push({
          module: "CRIMINOLOGICAL",
          variable: "analyticalProportionality",
          expected: "Aserción proporcional al volumen de indicios físicos",
          received: `Grafitis: ${gim.evidenceCount.graffiti}`,
          message: "No se puede declarar hegemonía o control territorial basándose en un grafiti aislado. Se requiere corroboración adicional o suavizar la conclusión descriptiva."
        });
      }
    }

    // 3. Calibración Epistémica (Confianza vs. Limitaciones)
    if (gim.confidenceScore < 80 && gim.limitationsCount === 0) {
      if (overallStatus !== "FAILED") overallStatus = "WARNING";
      alerts.push({
        type: "CRIMINOLOGICAL",
        category: "ANALYTICAL",
        message: `Falta de calibración epistémica: El nivel de confianza de GIM es bajo (${gim.confidenceScore}/100) pero no se declararon limitaciones metodológicas ni reservas analíticas.`,
        severity: "MEDIUM",
        source: "GIM-ACE Auditor",
        expected: "Limitaciones declaradas cuando la confianza analítica es menor a 80/100",
        received: `Confianza: ${gim.confidenceScore}, Limitaciones: 0`
      });
    }

    // 4. Certificación de Trazabilidad
    if (!gim.hasTraceability) {
      const isOfficialReport = payload.projectId?.startsWith("EXP-") || false;
      if (isOfficialReport) {
        overallStatus = "FAILED";
        alerts.push({
          type: "CRIMINOLOGICAL",
          category: "TECHNICAL",
          message: "Falta de trazabilidad: El expediente oficial requiere bitácora de procedencia completa de GIM para sustento legal.",
          severity: "HIGH",
          source: "GIM-ACE Auditor",
          expected: "traceabilityLog poblado con indicios verificados",
          received: "traceabilityLog vacío o inactivo"
        });

        if (!blockingReasons.some(r => r.variable === "traceabilityAudit")) {
          blockingReasons.push({
            module: "CRIMINOLOGICAL",
            variable: "traceabilityAudit",
            expected: "Historial de procedencia e identificadores de indicios válidos",
            received: "hasTraceability = false",
            message: "Los expedientes institucionales oficiales de CEIPOL requieren trazabilidad rigurosa al 100% de la GEM."
          });
        }
      } else {
        if (overallStatus !== "FAILED") overallStatus = "WARNING";
        alerts.push({
          type: "CRIMINOLOGICAL",
          category: "TECHNICAL",
          message: "Trazabilidad ausente en modo exploratorio: Se recomienda poblar el registro de trazas de GIM antes de proceder a la exportación oficial.",
          severity: "MEDIUM",
          source: "GIM-ACE Auditor",
          expected: "hasTraceability = true",
          received: "false"
        });
      }
    }

    // 5. Validación de Madurez OSINT y Calibración Metodológica (OBS-009.10.1.2-001)
    if (gim.osintMaturity && gim.osintMaturity.totalEventsCount > 0) {
      const maturity = gim.osintMaturity;
      const ratioLimited = maturity.limitedEventsCount / maturity.totalEventsCount;

      if (ratioLimited > 0.50 && gim.confidenceScore >= 80) {
        if (overallStatus !== "FAILED") overallStatus = "WARNING";
        alerts.push({
          type: "CRIMINOLOGICAL",
          category: "ANALYTICAL",
          message: `Descalibración Metodológica OSINT: Más de la mitad de los indicios OSINT (${(ratioLimited * 100).toFixed(0)}%) tienen calidad LIMITADA, pero el nivel de confianza de GIM es inusualmente alto (${gim.confidenceScore}/100). Se requiere calibrar el optimismo analítico.`,
          severity: "MEDIUM",
          source: "GIM-ACE Auditor",
          expected: "Nivel de confianza de GIM < 80/100 cuando predomina OSINT de baja calidad",
          received: `Confianza: ${gim.confidenceScore}, OSINT Limitados: ${maturity.limitedEventsCount}/${maturity.totalEventsCount}`
        });
      }

      // Registrar limitaciones globales heredadas de OSINT de forma directa en las alertas para asegurar visibilidad en Report Engine
      if (maturity.globalLimitations.length > 0) {
        alerts.push({
          type: "CRIMINOLOGICAL",
          category: "ANALYTICAL",
          message: `Limitaciones OSINT Detectadas: El pipeline de procedencia reporta restricciones: ${maturity.globalLimitations.join(" | ")}`,
          severity: "LOW",
          source: "GIM-ACE Auditor"
        });
      }
    }

    return { status: overallStatus };
  }
}
