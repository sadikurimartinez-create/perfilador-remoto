export interface HIEInput {
  tceData?: any;
  sieData?: any;
  rawInput?: any;
}

export interface HIEResult {
  centralHypothesis: {
    queOcurre: string;
    dondeOcurre: string;
    porQueOcurre: string;
    summary: string;
  };
  supportingEvidence: {
    component: string;
    description: string;
    weight: number;
  }[];
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

    const supportingEvidence: { component: string; description: string; weight: number }[] = [];
    const contradictoryEvidence: string[] = [];
    const missingEvidence: string[] = [];
    const recommendedVerificationActions: string[] = [];
    const dateStr = new Date().toLocaleDateString("es-MX");

    // 1. Módulo 1: Territorial Evidence Engine (TCE)
    const tContext = tce.territorialContext || {};
    const instContext = tce.institutionalContext || {};
    let territorialScore = 0;
    if (tContext.latitude && tContext.longitude && tContext.radiusMetros) {
      supportingEvidence.push({
        component: "Territorial",
        description: `Delimitación perimetral de tipo ${tContext.geometryType} con un radio táctico de ${tContext.radiusMetros} metros.`,
        weight: 10
      });
      territorialScore = 10;
    } else {
      missingEvidence.push("Falta delimitar las coordenadas geográficas de origen del buffer.");
    }

    // 2. Módulo 2: Criminal Evidence Engine (SIE)
    let criminalScore = 0;
    const temporal = sie.temporal || {};
    const espacial = sie.espacial || {};
    const crimIndicadores = sie.criminologico?.indicadores || {};
    
    const hasSieData = temporal.totalEventos > 0;
    if (hasSieData) {
      supportingEvidence.push({
        component: "Incidencia Criminal (SIE)",
        description: `Concentración delictiva de ${temporal.totalEventos} incidentes históricos en el área.`,
        weight: 15
      });
      supportingEvidence.push({
        component: "Concentración Espacial (SIE)",
        description: `Identificación de ${espacial.hotspotsCount || 1} hotspot(s) activos de concentración espacial.`,
        weight: 10
      });
      supportingEvidence.push({
        component: "Especialización Criminológica (SIE)",
        description: `Índice de persistencia delictiva evaluado en ${crimIndicadores.persistencia || 50}% y especialización de ${crimIndicadores.especializacion || 0}%.`,
        weight: 10
      });
      criminalScore = 35;
    } else {
      missingEvidence.push("Base de datos de incidencia delictiva local.");
      contradictoryEvidence.push("Inexistencia de reportes policiales históricos cargados en el radio de interés.");
    }

    // 3. Módulo 3: Environmental Evidence Engine
    const urban = tce.urbanContext || {};
    let environmentalScore = 0;
    const totalVulnerabilities = Array.isArray(urban.vulnerabilitiesDetected) ? urban.vulnerabilitiesDetected.length : 0;
    
    if (urban.streetViewsCount > 0 && totalVulnerabilities > 0) {
      supportingEvidence.push({
        component: "Vulnerabilidades Urbanas (TCE/Street View)",
        description: `Identificación de ${totalVulnerabilities} facilitadores físicos del entorno (baldíos, deficiencia de iluminación).`,
        weight: 15
      });
      supportingEvidence.push({
        component: "Indicadores de Oportunidad",
        description: `Evidencia física de pérdida de vigilancia natural confirmada por Street View.`,
        weight: 10
      });
      environmentalScore = 25;
    } else {
      missingEvidence.push("Evidencia fotográfica in-situ o análisis de Street View del entorno.");
      contradictoryEvidence.push("No se registraron vulnerabilidades de infraestructura física en el cuadrante.");
    }

    // 4. Módulo 4: Urban Evidence Engine
    const commercial = tce.commercialContext || {};
    const demographic = tce.demographicContext || {};
    let urbanScore = 0;
    
    if (commercial.hasCommercialData && commercial.atractoresComercialesCount > 0) {
      supportingEvidence.push({
        component: "Atractores de Oportunidad (DENUE)",
        description: `Presencia comercial activa con ${commercial.atractoresComercialesCount} establecimientos (ej: ${commercial.atractoresTipos.join(", ")}).`,
        weight: 10
      });
      urbanScore += 10;
    } else {
      missingEvidence.push("Datos de actividad comercial municipal (DENUE).");
    }

    if (demographic.hasDemographics) {
      supportingEvidence.push({
        component: "Entorno Demográfico (SCINCE)",
        description: `Dinámica de densidad habitacional: ${demographic.demographicsSummary}`,
        weight: 5
      });
      urbanScore += 5;
    } else {
      missingEvidence.push("Datos censales y demográficos locales (SCINCE).");
    }

    // 5. Módulo 5: OSINT Evidence Engine
    let osintScore = 0;
    const hasSweeps = Array.isArray(tce.sources?.list) && tce.sources.list.some((s: any) => s.name.includes("Barrido") || s.name.includes("OSINT"));
    if (hasSweeps) {
      supportingEvidence.push({
        component: "Inteligencia Social (OSINT/Sweeps)",
        description: "Monitoreo social y barridos tácticos integrados al expediente.",
        weight: 15
      });
      osintScore = 15;
    } else {
      missingEvidence.push("Censo social de pandillas, conflictividad u OSINT local.");
    }

    // 6. Módulo 6: Evidence Weighting Engine & Matriz de Confianza
    const confidenceScore = territorialScore + criminalScore + environmentalScore + urbanScore + osintScore; // Máximo 100
    
    let confidenceLevel = "BAJO";
    let confidenceDescription = "Evidencia insuficiente o dispersa. La hipótesis no puede ser validada científicamente.";
    
    if (confidenceScore >= 80) {
      confidenceLevel = "CRÍTICO";
      confidenceDescription = "Convergencia total de evidencia delictiva, ambiental, urbana y OSINT. Nivel de certeza científica muy alto.";
    } else if (confidenceScore >= 60) {
      confidenceLevel = "ALTO";
      confidenceDescription = "Consistencia de evidencia delictiva y ambiental. Suficiente para sustentar patrullaje focalizado y medidas CPTED.";
    } else if (confidenceScore >= 35) {
      confidenceLevel = "MEDIO";
      confidenceDescription = "Presencia de indicios delictivos básicos y descripción perimetral, pero con vacíos en la evidencia de campo o comercial.";
    }

    // Calcular sub-scores detallados para la visualización del radar o índices
    const qualityScore = Math.round((environmentalScore / 25) * 100);
    const quantityScore = Math.round((criminalScore / 35) * 100);
    const convergenceScore = Math.round((urbanScore / 15) * 100);
    const consistencyScore = Math.round((confidenceScore / 100) * 100);

    // 7. Módulo 7: Hypothesis Builder
    // Determinar si la evidencia es suficiente
    const hasSufficientEvidence = confidenceScore >= 35; // Umbral de suficiencia metodológica
    
    let queOcurre = "Información no disponible";
    let dondeOcurre = "Información no disponible";
    let porQueOcurre = "Información no disponible";
    let summary = "Evidencia insuficiente para construir una hipótesis criminológica ambiental con respaldo metodológico.";

    if (hasSufficientEvidence) {
      const typeDelito = sie.criminologico?.indicadores?.especializacion > 50 
        ? `conductas focalizadas de ${sie.temporal.primaryCrimeType || tce.criminalContext.primaryCrimeType}`
        : "conductas delictivas de oportunidad multivariable";

      const timePeak = sie.temporal?.ventanaOportunidad || tce.criminalContext.temporalPeak;
      const countDelitos = sie.temporal?.totalEventos || tce.criminalContext.totalIncidents;

      queOcurre = `Se hipotetiza un fenómeno recurrente de ${typeDelito} con un acumulado de ${countDelitos} eventos registrados en el cuadrante, operando bajo un patrón temporal principalmente en horarios de ${timePeak}.`;
      
      const hotspotsText = espacial.hotspotsCount > 0 
        ? `concentrado en ${espacial.hotspotsCount} nodo(s) crítico(s) de calor` 
        : "disperso de forma uniforme";
      const centroText = espacial.centroGravedad 
        ? `${espacial.centroGravedad.lat.toFixed(4)}, ${espacial.centroGravedad.lng.toFixed(4)}`
        : `${tContext.latitude.toFixed(4)}, ${tContext.longitude.toFixed(4)}`;

      dondeOcurre = `El fenómeno se encuentra geográficamente ${hotspotsText} alrededor del centro de gravedad situado en las coordenadas ${centroText}, abarcando una dispersión de ${tContext.radiusMetros} metros.`;
      
      const vDetected = urban.vulnerabilitiesDetected || [];
      const vText = vDetected.length > 0 
        ? `por facilitadores urbanos detectados en campo: ${vDetected.slice(0, 2).join(" y ")}`
        : "por la pérdida general de vigilancia natural en el espacio público";

      const attractorsText = commercial.hasCommercialData && commercial.atractoresComercialesCount > 0
        ? `, potencializado por la cercanía a atractores comerciales de tipo ${commercial.atractoresTipos.slice(0, 2).join(", ")}`
        : "";

      porQueOcurre = `La ocurrencia se ve favorecida ambientalmente ${vText}${attractorsText}, lo que genera un escenario óptimo para el anonimato y escape rápido de los agresores.`;

      summary = `${queOcurre} ${dondeOcurre} ${porQueOcurre}`;
      
      // Acciones de verificación recomendadas
      recommendedVerificationActions.push(
        "Realizar patrullaje dinámico orientado en las horas pico identificadas.",
        "Coordinar con servicios municipales para mitigar los facilitadores físicos específicos (cerramientos/luminarias).",
        "Efectuar encuestas de percepción local en los nodos de calor mapeados."
      );
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
        availability: tContext.availability || "Completa",
        date: dateStr
      },
      vulnerabilidadesFisicas: {
        source: "TCE - Urban Context",
        engine: "Territorial Context Engine / Street View",
        variable: "tceData.urbanContext.vulnerabilitiesDetected",
        availability: urban.availability || "Parcial",
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
      }
    };

    return {
      centralHypothesis: {
        queOcurre,
        dondeOcurre,
        porQueOcurre,
        summary
      },
      supportingEvidence,
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
