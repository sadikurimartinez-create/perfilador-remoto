export interface HIEInput {
  tceData?: any;
  sieData?: any;
  rawInput?: any;
}

export interface HIEResult {
  evidence: number; // Número canónico de eventos analizados
  centralHypothesis: {
    queOcurre: string;
    dondeOcurre: string;
    porQueOcurre: string;
    summary: string;
  };
  supportingEvidence: { component: string; description: string; weight: number }[];
  territorialEvidence: { component: string; description: string; weight: number }[];
  criminalEvidence: { component: string; description: string; weight: number }[];
  environmentalEvidence: { component: string; description: string; weight: number }[];
  urbanEvidence: { component: string; description: string; weight: number }[];
  osintEvidence: { component: string; description: string; weight: number }[];
  contradictoryEvidence: string[];
  missingEvidence: string[];
  confidence: {
    score: number; // 0 to 100
    level: string; // CRÍTICO, ALTO, MEDIO, BAJO
    description: string;
  };
  confidenceFactors: {
    qualityScore: number;
    quantityScore: number;
    convergenceScore: number;
    consistencyScore: number;
  };
  validationMatrix: {
    hasUniqueHypothesis: boolean;
    hasSufficientEvidence: boolean;
    hasContradictoryEvidence: boolean;
    hasConfidenceLevel: boolean;
    hasTraceability: boolean;
    isValidated: boolean;
  };
  recommendedVerificationActions: string[];
  traceability: {
    [key: string]: {
      source: string;
      engine: string;
      variable: string;
      availability: string;
      date: string;
    };
  };
}

export class HypothesisIntelligenceEngine {
  /**
   * Construye la hipótesis criminológica estructurada y calcula el índice de confianza (HIE)
   */
  public static build(input: HIEInput): HIEResult {
    const tce = input.tceData || {};
    const sie = input.sieData || {};
    const rawInput = input.rawInput || {};

    const supportingEvidence: { component: string; description: string; weight: number }[] = [];
    const territorialEvidence: { component: string; description: string; weight: number }[] = [];
    const criminalEvidence: { component: string; description: string; weight: number }[] = [];
    const environmentalEvidence: { component: string; description: string; weight: number }[] = [];
    const urbanEvidence: { component: string; description: string; weight: number }[] = [];
    const osintEvidence: { component: string; description: string; weight: number }[] = [];
    const contradictoryEvidence: string[] = [];
    const missingEvidence: string[] = [];
    const recommendedVerificationActions: string[] = [];
    const dateStr = new Date().toLocaleDateString("es-MX");

    // ==========================================
    // MÓDULO 1: Territorial Evidence Engine (TCE)
    // ==========================================
    const tContext = tce.territorialContext || {};
    const instContext = tce.institutionalContext || {};
    let territorialScore = 0;

    if (tContext.latitude && tContext.longitude && tContext.radiusMetros) {
      const description = `Delimitación perimetral de tipo ${tContext.geometryType || "individual"} con un radio táctico de ${tContext.radiusMetros} metros con centro en (${tContext.latitude}, ${tContext.longitude}).`;
      const item = {
        component: "Territorial",
        description,
        weight: 10
      };
      supportingEvidence.push(item);
      territorialEvidence.push(item);
      territorialScore = 10;
    } else {
      missingEvidence.push("Falta delimitar las coordenadas geográficas de origen del buffer.");
      territorialScore = 0;
    }

    // ==========================================
    // MÓDULO 2: Criminal Evidence Engine (SIE)
    // ==========================================
    // Soporte transparente para el motor estadístico v1 y v2 (SIE / SIE v2)
    const rawTemporal = sie.temporal || sie.temporalAnalysis || {};
    const rawEspacial = sie.espacial || sie.spatialAnalysis || {};
    const rawPredictivo = sie.predictivo || sie.predictiveAnalysis || {};

    const totalEventos = typeof sie.metadata?.totalEvents === "number"
      ? sie.metadata.totalEvents
      : typeof rawTemporal.totalEventos === "number"
        ? rawTemporal.totalEventos
        : 0;

    const hotspotsCount = typeof rawEspacial.hotspotsCount === "number"
      ? rawEspacial.hotspotsCount
      : Array.isArray(rawEspacial.hotspots)
        ? rawEspacial.hotspots.length
        : 0;

    const desviacionEstandarEspacialMetros = typeof rawEspacial.desviacionEstandarEspacialMetros === "number"
      ? rawEspacial.desviacionEstandarEspacialMetros
      : typeof rawEspacial.dispersionMeters === "number"
        ? rawEspacial.dispersionMeters
        : 0;

    const centroGravedad = rawEspacial.centroGravedad || rawEspacial.centerOfGravity || null;

    const persistencia = typeof sie.criminologico?.indicadores?.persistencia === "number"
      ? sie.criminologico.indicadores.persistencia
      : typeof rawTemporal.trendConfidence === "number"
        ? Math.round(rawTemporal.trendConfidence)
        : 50;

    const especializacion = typeof sie.criminologico?.indicadores?.especializacion === "number"
      ? sie.criminologico.indicadores.especializacion
      : typeof rawTemporal.seasonalityIndex === "number"
        ? Math.round(rawTemporal.seasonalityIndex * 100)
        : 0;

    const ventanaOportunidad = rawTemporal.ventanaOportunidad || 
      (Array.isArray(rawTemporal.seasonalRiskPeriods) && rawTemporal.seasonalRiskPeriods.length > 0
        ? rawTemporal.seasonalRiskPeriods.join(", ")
        : undefined);

    const primaryCrimeType = rawTemporal.primaryCrimeType || tContext.primaryCrimeType || "delito de oportunidad";

    // Reconstruir objetos compatibles con el esquema clásico del HIE
    const temporal = {
      totalEventos,
      ventanaOportunidad,
      primaryCrimeType
    };

    const espacial = {
      hotspotsCount,
      desviacionEstandarEspacialMetros,
      centroGravedad
    };

    const crimIndicadores = {
      persistencia,
      especializacion
    };

    const predictivo = rawPredictivo;
    let criminalScore = 0;

    const hasSieData = totalEventos > 0;
    if (hasSieData) {
      // 1. Volumen de Incidencia
      const volItem = {
        component: "Incidencia Criminal (SIE)",
        description: `Volumen de incidencia criminal histórica de ${temporal.totalEventos} incidentes registrados en el radio táctico.`,
        weight: 15
      };
      supportingEvidence.push(volItem);
      criminalEvidence.push(volItem);

      // 2. Concentración Espacial
      const spaceItem = {
        component: "Concentración Espacial (SIE)",
        description: `Concentración espacial identificada en ${espacial.hotspotsCount || 1} hotspot(s) activos, con una desviación estándar espacial de ${Math.round(espacial.desviacionEstandarEspacialMetros || 0)} metros.`,
        weight: 10
      };
      supportingEvidence.push(spaceItem);
      criminalEvidence.push(spaceItem);

      // 3. Persistencia y Especialización
      const persistItem = {
        component: "Especialización Criminológica (SIE)",
        description: `Persistencia delictiva evaluada en ${crimIndicadores.persistencia || 50}% y especialización de tipo ${crimIndicadores.especializacion || 0}% de Shannon.`,
        weight: 10
      };
      supportingEvidence.push(persistItem);
      criminalEvidence.push(persistItem);

      criminalScore = 35;
    } else {
      missingEvidence.push("Datos históricos de incidencia delictiva para el análisis espacio-temporal.");
      contradictoryEvidence.push("No se registran eventos criminales históricos dentro del radio de análisis.");
      criminalScore = 0;
    }

    // ==========================================
    // MÓDULO 3: Environmental Evidence Engine
    // ==========================================
    const urban = tce.urbanContext || {};
    const photos = rawInput.photos || [];
    const sweeps = rawInput.sweeps || [];
    const rawStreetViews = rawInput.streetViews || [];
    const vulnerabilities: string[] = [];

    if (Array.isArray(urban.vulnerabilitiesDetected)) {
      vulnerabilities.push(...urban.vulnerabilitiesDetected);
    }
    if (Array.isArray(photos)) {
      photos.forEach((p: any) => {
        if (p.comentario) vulnerabilities.push(p.comentario);
      });
    }
    if (Array.isArray(rawStreetViews)) {
      rawStreetViews.forEach((sv: any) => {
        const desc = sv.observed || sv.comentario || sv.description || sv.observacion;
        if (desc) vulnerabilities.push(desc);
      });
    }

    let environmentalScore = 0;
    const detectedFactors: { category: string; description: string; weight: number }[] = [];

    const hasPhotosOrStreetViews = rawStreetViews.length > 0 || photos.length > 0;
    if (hasPhotosOrStreetViews) {
      detectedFactors.push({
        category: "Auditoría Visual",
        description: `Presencia de ${rawStreetViews.length} capturas de Street View y ${photos.length} registros fotográficos de campo.`,
        weight: 10
      });
      environmentalScore += 10;
    }

    // Clasificar factores específicos por palabras clave
    const categoriesList = [
      { key: "Iluminación", keywords: ["iluminación", "luz", "luminaria", "obscur", "oscur", "noche", "farol", "lámpara"], label: "Iluminación Deficiente", desc: "Presencia de zonas con baja iluminación pública o luminarias inactivas que facilitan el acecho." },
      { key: "Vegetación", keywords: ["vegetación", "maleza", "hierba", "árbol", "arbusto", "limpieza", "poda", "ramas"], label: "Exceso de Vegetación", desc: "Malezas u obstáculos forestales que reducen la visibilidad y la vigilancia natural del entorno." },
      { key: "Predios", keywords: ["baldío", "predio", "terreno", "abandonado", "desocupado", "inmueble", "finca", "casa abandonada"], label: "Predios de Riesgo", desc: "Presencia de lotes baldíos, fincas abandonadas o predios sin delimitación perimetral." },
      { key: "Ocultamiento", keywords: ["ocultamiento", "acecho", "punto ciego", "escondite", "cámara", "esconder"], label: "Puntos de Ocultamiento", desc: "Zonas ciegas o barreras físicas que facilitan el ocultamiento de agresores y dificultan la vigilancia." },
      { key: "Movilidad", keywords: ["movilidad", "huida", "escape", "callejón", "vía", "tránsito", "ruta", "peatonal"], label: "Vías de Escape", desc: "Corredores de escape rápido y callejones interconectados que facilitan la huida rápida de agresores." },
      { key: "Infraestructura", keywords: ["infraestructura", "barda", "malla", "cerca", "reja", "deterioro", "pavimento", "grafiti", "banqueta"], label: "Deficiencias de Infraestructura", desc: "Falta de cercamientos adecuados, bardas caídas o deterioro severo del mobiliario urbano." }
    ];

    const matchedKeys = new Set<string>();
    vulnerabilities.forEach(v => {
      const vLower = v.toLowerCase();
      categoriesList.forEach(cat => {
        if (cat.keywords.some(kw => vLower.includes(kw))) {
          matchedKeys.add(cat.key);
        }
      });
    });

    const categoryWeight = matchedKeys.size > 0 ? Math.min(5, Math.floor(15 / matchedKeys.size)) : 0;
    let factorPoints = 0;

    categoriesList.forEach(cat => {
      if (matchedKeys.has(cat.key) && factorPoints < 15) {
        const pts = Math.min(5, 15 - factorPoints);
        detectedFactors.push({
          category: cat.label,
          description: cat.desc,
          weight: pts
        });
        factorPoints += pts;
      }
    });

    environmentalScore += factorPoints;

    if (environmentalScore > 0) {
      detectedFactors.forEach(f => {
        const item = {
          component: `Ambiental - ${f.category}`,
          description: f.description,
          weight: f.weight
        };
        supportingEvidence.push(item);
        environmentalEvidence.push(item);
      });
    } else {
      missingEvidence.push("Evidencia fotográfica in-situ o análisis de Street View del entorno.");
      contradictoryEvidence.push("No se registraron vulnerabilidades de infraestructura física en el cuadrante.");
      environmentalScore = 0;
    }

    // ==========================================
    // MÓDULO 4: Urban Evidence Engine
    // ==========================================
    const commercial = tce.commercialContext || {};
    const demographic = tce.demographicContext || {};
    let urbanScore = 0;

    if (commercial.hasCommercialData && commercial.atractoresComercialesCount > 0) {
      const item = {
        component: "Atractores de Oportunidad (DENUE)",
        description: `Presencia comercial activa de ${commercial.atractoresComercialesCount} establecimientos (ej: ${commercial.atractoresTipos.slice(0, 3).join(", ")}).`,
        weight: 10
      };
      supportingEvidence.push(item);
      urbanEvidence.push(item);
      urbanScore += 10;
    } else {
      missingEvidence.push("Datos de actividad comercial municipal (DENUE).");
    }

    if (demographic.hasDemographics) {
      const item = {
        component: "Entorno Demográfico (SCINCE)",
        description: `Dinámica de densidad habitacional y residencial en el radio de interés: ${demographic.demographicsSummary}`,
        weight: 5
      };
      supportingEvidence.push(item);
      urbanEvidence.push(item);
      urbanScore += 5;
    } else {
      missingEvidence.push("Datos censales y demográficos locales (SCINCE).");
    }

    // ==========================================
    // MÓDULO 5: OSINT Evidence Engine
    // ==========================================
    let osintScore = 0;
    const hasSweeps = Array.isArray(sweeps) && sweeps.length > 0;
    const linkedGangReport = rawInput.linkedGangReport || tce.linkedGangReport || null;

    if (hasSweeps) {
      const item = {
        component: "Inteligencia Social (OSINT/Sweeps)",
        description: `Monitoreo social y barridos tácticos de conflictividad pública en fuentes abiertas (${sweeps.length} barridos).`,
        weight: 10
      };
      supportingEvidence.push(item);
      osintEvidence.push(item);
      osintScore += 10;
    } else {
      missingEvidence.push("Censo social de pandillas, conflictividad u OSINT local.");
    }

    if (linkedGangReport && Array.isArray(linkedGangReport.matched_gangs) && linkedGangReport.matched_gangs.length > 0 && (linkedGangReport.confidence_score || linkedGangReport.confidence) > 0) {
      const confidenceVal = linkedGangReport.confidence_score || linkedGangReport.confidence || 50;
      const item = {
        component: "Actores Territoriales (Pandillas)",
        description: `Presencia territorial activa y vinculación delictiva confirmada de pandillas locales (${linkedGangReport.matched_gangs.join(", ")}) con confianza de ${confidenceVal}%.`,
        weight: 5
      };
      supportingEvidence.push(item);
      osintEvidence.push(item);
      osintScore += 5;
    } else if (linkedGangReport) {
      contradictoryEvidence.push("El barrido de pandillas en el cuadrante no registró agrupaciones activas georreferenciadas.");
    }

    // ==========================================
    // MÓDULO 6: Evidence Weighting Engine & Confianza
    // ==========================================
    const confidenceScore = territorialScore + criminalScore + environmentalScore + urbanScore + osintScore; // Máximo 100

    let confidenceLevel = "BAJO";
    let confidenceDescription = "Evidencia insuficiente o dispersa. La hipótesis no puede ser validada científicamente.";

    if (confidenceScore >= 80) {
      confidenceLevel = "CRÍTICO";
      confidenceDescription = "Convergencia total de evidencia delictiva, ambiental, urbana y OSINT. Nivel de certeza científica muy alto.";
    } else if (confidenceScore >= 60) {
      confidenceLevel = "ALTO";
      confidenceDescription = "Consistencia de evidencia delictiva y ambiental. Suficiente para sustentar patrullaje focalizado y medidas de prevención situacional CPTED.";
    } else if (confidenceScore >= 35) {
      confidenceLevel = "MEDIO";
      confidenceDescription = "Presencia de indicios delictivos básicos y delimitación perimetral, pero con vacíos en la evidencia de campo o comercial.";
    }

    // Calcular factores de confianza cuantitativos
    const qualityScore = Math.round(((environmentalScore + urbanScore) / 40) * 100);
    const quantityScore = Math.round((criminalScore / 35) * 100);
    
    // Contar cuántos de los 5 motores/componentes aportaron evidencia
    let activeComponentsCount = 0;
    if (territorialScore > 0) activeComponentsCount++;
    if (criminalScore > 0) activeComponentsCount++;
    if (environmentalScore > 0) activeComponentsCount++;
    if (urbanScore > 0) activeComponentsCount++;
    if (osintScore > 0) activeComponentsCount++;
    
    const convergenceScore = activeComponentsCount * 20;
    const consistencyScore = Math.round((confidenceScore / 100) * 100);

    // ==========================================
    // MÓDULO 7: Hypothesis Builder
    // ==========================================
    const hasSufficientEvidence = confidenceScore >= 35;
    let queOcurre = "Información no disponible";
    let dondeOcurre = "Información no disponible";
    let porQueOcurre = "Información no disponible";
    let summary = "Evidencia insuficiente para construir una hipótesis criminológica ambiental con respaldo metodológico.";

    if (hasSufficientEvidence) {
      const typeDelito = (crimIndicadores.especializacion || 0) > 50 
        ? `conductas focalizadas de ${temporal.primaryCrimeType || tContext.primaryCrimeType || "delitos de alto impacto"}`
        : "conductas delictivas de oportunidad multivariable";

      const timePeak = temporal.ventanaOportunidad || tContext.temporalPeak || "horarios nocturnos de oportunidad";
      const countDelitos = temporal.totalEventos || 0;

      queOcurre = `Se hipotetiza un fenómeno recurrente de ${typeDelito} con un acumulado de ${countDelitos} eventos registrados en el cuadrante, operando bajo un patrón temporal principalmente en horarios de ${timePeak}.`;
      
      const hotspotsText = espacial.hotspotsCount > 0 
        ? `concentrado en ${espacial.hotspotsCount} nodo(s) crítico(s) de calor` 
        : "disperso de forma uniforme";

      const latVal = espacial.centroGravedad?.lat ?? tContext.latitude;
      const lngVal = espacial.centroGravedad?.lng ?? tContext.longitude;

      const latText = typeof latVal === "number" && isFinite(latVal) ? latVal.toFixed(6) : "0.000000";
      const lngText = typeof lngVal === "number" && isFinite(lngVal) ? lngVal.toFixed(6) : "0.000000";
      const centroText = `${latText}, ${lngText}`;

      dondeOcurre = `El fenómeno se encuentra geográficamente ${hotspotsText} alrededor del centro de gravedad situado en las coordenadas ${centroText}, abarcando una dispersión de ${tContext.radiusMetros || 250} metros.`;
      
      const vDetected = vulnerabilities || [];
      const vText = vDetected.length > 0 
        ? `por facilitadores urbanos detectados en campo: ${vDetected.slice(0, 2).join(" y ")}`
        : "por la pérdida general de vigilancia natural en el espacio público";

      const attractorsText = commercial.hasCommercialData && commercial.atractoresComercialesCount > 0
        ? `, potencializado por la cercanía a atractores comerciales de tipo ${commercial.atractoresTipos.slice(0, 2).join(", ")}`
        : "";

      porQueOcurre = `La ocurrencia se ve favorecida ambientalmente ${vText}${attractorsText}, lo que genera un escenario óptimo para el anonimato y escape rápido de los agresores.`;

      summary = `${queOcurre} ${dondeOcurre} ${porQueOcurre}`;
      
      recommendedVerificationActions.push(
        "Realizar patrullaje dinámico orientado en las horas pico identificadas.",
        "Coordinar con servicios municipales para mitigar los facilitadores físicos específicos (cerramientos/luminarias).",
        "Efectuar encuestas de percepción local en los nodos de calor mapeados."
      );
      if (linkedGangReport && Array.isArray(linkedGangReport.matched_gangs) && linkedGangReport.matched_gangs.length > 0) {
        recommendedVerificationActions.push(
          `Monitorear puntos de reunión y grafitis de la pandilla ${linkedGangReport.matched_gangs.join(", ")}.`
        );
      }
    } else {
      recommendedVerificationActions.push(
        "Cargar la base de datos de incidencia delictiva del cuadrante para habilitar el análisis estadístico.",
        "Capturar y documentar fotografías de campo o Street View de las vialidades principales.",
        "Integrar información de atractores comerciales (DENUE) para contextualizar el desorden urbano."
      );
    }

    const validationMatrix = {
      hasUniqueHypothesis: true,
      hasSufficientEvidence,
      hasContradictoryEvidence: contradictoryEvidence.length > 0,
      hasConfidenceLevel: true,
      hasTraceability: true,
      isValidated: hasSufficientEvidence
    };

    // Trazabilidad
    const traceability: Record<string, any> = {
      delimitacionTerritorial: {
        source: "TCE - Territorial Context",
        engine: "Territorial Context Engine",
        variable: "tceData.territorialContext",
        availability: tContext.latitude ? "Completa" : "No disponible",
        date: dateStr
      },
      vulnerabilidadesFisicas: {
        source: "TCE - Urban Context / Street View / Fotos",
        engine: "Territorial Context Engine & Fotografías de Campo",
        variable: "tceData.urbanContext.vulnerabilitiesDetected",
        availability: vulnerabilities.length > 0 ? "Completa" : "No disponible",
        date: dateStr
      },
      incidenciaTemporal: {
        source: "SIE - Temporal Module",
        engine: "Statistical Intelligence Engine",
        variable: "sieData.temporal",
        availability: hasSieData ? "Completa" : "No disponible",
        date: dateStr
      },
      incidenciaEspacial: {
        source: "SIE - Spatial Module",
        engine: "Statistical Intelligence Engine",
        variable: "sieData.espacial",
        availability: hasSieData ? "Completa" : "No disponible",
        date: dateStr
      },
      atractoresComerciales: {
        source: "TCE - Commercial Context / DENUE",
        engine: "Territorial Context Engine & DENUE",
        variable: "tceData.commercialContext",
        availability: commercial.hasCommercialData ? "Completa" : "No disponible",
        date: dateStr
      },
      entornoDemografico: {
        source: "TCE - Demographic Context / SCINCE",
        engine: "Territorial Context Engine & SCINCE",
        variable: "tceData.demographicContext",
        availability: demographic.hasDemographics ? "Completa" : "No disponible",
        date: dateStr
      },
      barridosOsint: {
        source: "TCE - Sources List / OSINT Sweeps",
        engine: "OSINT Sweeps Engine",
        variable: "rawInput.sweeps",
        availability: hasSweeps ? "Completa" : "No disponible",
        date: dateStr
      }
    };

    return {
      evidence: totalEventos,
      centralHypothesis: {
        queOcurre,
        dondeOcurre,
        porQueOcurre,
        summary
      },
      supportingEvidence,
      territorialEvidence,
      criminalEvidence,
      environmentalEvidence,
      urbanEvidence,
      osintEvidence,
      contradictoryEvidence,
      missingEvidence,
      confidence: {
        score: confidenceScore,
        level: confidenceLevel,
        description: confidenceDescription
      },
      confidenceFactors: {
        qualityScore,
        quantityScore,
        convergenceScore,
        consistencyScore
      },
      validationMatrix,
      recommendedVerificationActions,
      traceability
    };
  }
}
