export interface CIEInput {
  tceData?: any;
  sieData?: any;
  rawInput?: any;
  historicalIncidents?: any[];
}

export interface CIEResult {
  totalEvents: number; // Número canónico de eventos
  spatialPattern: {
    geometryType: string;
    center: { lat: number; lng: number };
    radiusMetros: number;
    areaM2: number;
    perimeterM: number;
    classification: string;
  };
  densityAnalysis: {
    totalEvents: number;
    hotspotsCount: number;
    densityScore: number;
    dispersionMeters: number;
    classification: string;
  };
  hotspots: {
    id: string;
    center: { lat: number; lng: number };
    incidentsCount: number;
    primaryIncidentType: string;
    radiusMetros: number;
    spatialWeight: number;
  }[];
  mobilityAnalysis: {
    corridors: {
      id: string;
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      direction: string;
      riskLevel: string;
      description: string;
    }[];
    accessibilityScore: number;
  };
  attractorAnalysis: {
    totalAttractors: number;
    criticalAttractors: number;
    proximityScore: number;
    criticalEstablishments: {
      name: string;
      type: string;
      location: { lat: number; lng: number };
      distanceMetros: number;
    }[];
  };
  environmentalRisk: {
    vulnerabilitiesCount: number;
    riskScore: number;
    detectedFacilitators: string[];
  };
  priorityZones: {
    baricenter: { lat: number; lng: number };
    criticalHotspotsIds: string[];
    recommendedPatrolSectors: {
      sectorName: string;
      coordinates: { lat: number; lng: number }[];
      criticalWindow: string;
    }[];
  };
  spatialEvidenceMatrix: {
    evidence: {
      finding: string;
      source: string;
      variable: string;
      confidence: number;
    }[];
  };
  confidence: {
    score: number; // 0 to 100
    level: string; // CRÍTICO, ALTO, MEDIO, BAJO
    description: string;
  };
  traceability: {
    source: string;
    date: string;
    motor: string;
    variable: string;
    version: string;
  };
  mapMetadata: {
    densityMapGenerated: boolean;
    mobilityMapGenerated: boolean;
    attractorsMapGenerated: boolean;
    predictiveMapGenerated: boolean;
    zoomLevel: number;
  };
}

export class CartographicIntelligenceEngine {
  private tceData: any;
  private sieData: any;
  private rawInput: any;

  constructor(input: CIEInput) {
    this.tceData = input.tceData || {};
    this.rawInput = input.rawInput || {};

    const sie = input.sieData || {};
    
    // Validar esquema SIE para gobernanza y telemetría
    this.validateSIESchema(sie);

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

    const temporal = {
      totalEventos,
      ventanaOportunidad: rawTemporal.ventanaOportunidad || 
        (Array.isArray(rawTemporal.seasonalRiskPeriods) && rawTemporal.seasonalRiskPeriods.length > 0
          ? rawTemporal.seasonalRiskPeriods.join(", ")
          : undefined),
      primaryCrimeType: rawTemporal.primaryCrimeType || "delito de oportunidad"
    };

    const espacial = {
      hotspotsCount,
      desviacionEstandarEspacialMetros,
      centroGravedad,
      topHotspotCoords: rawEspacial.topHotspotCoords || (Array.isArray(rawEspacial.hotspots)
        ? rawEspacial.hotspots.map((h: any) => ({ 
            lat: h.center?.lat || h.lat, 
            lng: h.center?.lng || h.lng, 
            count: h.incidentsCount || h.count 
          }))
        : [])
    };

    this.sieData = {
      temporal,
      espacial,
      predictivo: rawPredictivo
    };
  }

  /**
   * Validador de Gobernanza y Esquema de Datos Estadísticos (SIE)
   * Detecta y registra la versión de estructura de datos provista al ecosistema.
   */
  private validateSIESchema(sie: any): string {
    if (!sie || typeof sie !== "object") {
      console.log("[CIE GOVERNANCE] SIE Schema detected: Unknown (No data provided)");
      return "Unknown";
    }

    const hasV1 = sie.temporal !== undefined || sie.espacial !== undefined;
    const hasV2 = sie.temporalAnalysis !== undefined || sie.spatialAnalysis !== undefined;

    if (hasV1 && hasV2) {
      console.log("[CIE GOVERNANCE] SIE Schema detected: Hybrid (Coexistence v1 and v2 active)");
      return "Hybrid";
    } else if (hasV2) {
      console.log("[CIE GOVERNANCE] SIE Schema detected: V2 (Statistical Intelligence Engine V2)");
      return "V2";
    } else if (hasV1) {
      console.log("[CIE GOVERNANCE] SIE Schema detected: V1 (Statistical Intelligence Engine Classic)");
      return "V1";
    } else {
      console.log("[CIE GOVERNANCE] SIE Schema detected: Unknown (Unrecognized property mapping)");
      return "Unknown";
    }
  }

  /**
   * Ejecuta el pipeline completo de análisis cartográfico táctico
   */
  public static build(input: CIEInput): CIEResult {
    const engine = new CartographicIntelligenceEngine(input);
    
    const spatialPattern = engine.analyzeSpatialPattern();
    const densityAnalysis = engine.analyzeDensity();
    const hotspots = engine.extractHotspots();
    const mobilityAnalysis = engine.analyzeMobility(hotspots, spatialPattern.center);
    const attractorAnalysis = engine.analyzeAttractors(spatialPattern.center);
    const environmentalRisk = engine.analyzeEnvironmentalRisk();
    const priorityZones = engine.determinePriorityZones(hotspots, spatialPattern.center);
    const spatialEvidenceMatrix = engine.generateSpatialEvidenceMatrix(densityAnalysis, attractorAnalysis, environmentalRisk);
    const confidence = engine.calculateSpatialConfidence(hotspots, spatialPattern.radiusMetros);
    const traceability = engine.generateTraceability();
    const mapMetadata = engine.generateMapMetadata();

    const result: CIEResult = {
      totalEvents: engine.sieData.temporal.totalEventos || 0,
      spatialPattern,
      densityAnalysis,
      hotspots,
      mobilityAnalysis,
      attractorAnalysis,
      environmentalRisk,
      priorityZones,
      spatialEvidenceMatrix,
      confidence,
      traceability,
      mapMetadata
    };

    // FASE 5: CIE protection & Tolerance (Resilience Layer v9.0)
    const historicalIncidents = input.historicalIncidents || [];
    if (historicalIncidents.length > 0 && result.densityAnalysis.totalEvents === 0) {
      console.warn("[CIE GOVERNANCE WARNING] totalEvents is 0 but historicalIncidents has records. This usually indicates that all incidents were excluded geographically or temporally. Graceful degradation active.");
    }

    engine.validate(result);
    return engine.export(result);
  }

  /**
   * Módulo 1: Identificación de distribución espacial
   */
  private analyzeSpatialPattern(): any {
    const tContext = this.tceData.territorialContext || {};
    const lat = tContext.latitude ?? null;
    const lng = tContext.longitude ?? null;
    const radiusMetros = tContext.radiusMetros || 250;
    const geomType = tContext.geometryType || "individual";

    const areaM2 = Math.round(Math.PI * Math.pow(radiusMetros, 2));
    const perimeterM = Math.round(2 * Math.PI * radiusMetros);

    const hotspotsCount = this.sieData.espacial?.hotspotsCount || 0;
    let classification = "Dispersión uniforme";
    if (hotspotsCount >= 3) {
      classification = "Concentración focalizada";
    } else if (hotspotsCount > 0) {
      classification = "Distribución sectorizada";
    }

    return {
      geometryType: geomType,
      center: { lat, lng },
      radiusMetros,
      areaM2,
      perimeterM,
      classification
    };
  }

  /**
   * Módulo 2: Análisis de Densidad (Hotspots)
   */
  private analyzeDensity(): any {
    const temporal = this.sieData.temporal || {};
    const espacial = this.sieData.espacial || {};
    const totalEvents = temporal.totalEventos || 0;
    const hotspotsCount = espacial.hotspotsCount || 0;
    const dispersionMeters = Math.round(espacial.desviacionEstandarEspacialMetros || 0);

    let densityScore = 0;
    if (totalEvents > 0) {
      densityScore = Math.min(100, Math.round((totalEvents / 20) * 50 + (hotspotsCount * 25)));
    }

    let classification = "Baja densidad";
    if (densityScore >= 75) {
      classification = "Densidad crítica";
    } else if (densityScore >= 40) {
      classification = "Densidad moderada";
    }

    return {
      totalEvents,
      hotspotsCount,
      densityScore,
      dispersionMeters,
      classification
    };
  }

  /**
   * Helper para extraer hotspots tipados
   */
  private extractHotspots(): any[] {
    const topHotspots = this.sieData.espacial?.topHotspotCoords || [];
    const tContext = this.tceData.territorialContext || {};
    const primaryIncidentType = this.sieData.temporal?.primaryCrimeType || "Incidente de oportunidad";

    if (topHotspots.length === 0 || tContext.latitude == null || tContext.longitude == null) {
      return [];
    }

    const totalWeight = topHotspots.reduce((sum: number, hs: any) => sum + (hs.count || 1), 0);

    return topHotspots.map((hs: any, idx: number) => ({
      id: `HS-00${idx + 1}`,
      center: { lat: hs.lat, lng: hs.lng },
      incidentsCount: hs.count || 3,
      primaryIncidentType,
      radiusMetros: 30 + (hs.count || 0) * 2,
      spatialWeight: Number(((hs.count || 1) / totalWeight).toFixed(2))
    }));
  }

  /**
   * Módulo 3: Análisis de Movilidad y Corredores
   */
  private analyzeMobility(hotspots: any[], center: { lat: number; lng: number }): any {
    const corridors = hotspots.map((hs, idx) => {
      const dist = this.calculateHaversine(center.lat, center.lng, hs.center.lat, hs.center.lng);
      const dLat = hs.center.lat - center.lat;
      const dLng = hs.center.lng - center.lng;

      let direction = "Centro";
      if (Math.abs(dLng) > Math.abs(dLat)) {
        direction = dLng > 0 ? "Oeste-Este" : "Este-Oeste";
      } else {
        direction = dLat > 0 ? "Sur-Norte" : "Norte-Sur";
      }

      const riskLevel = hs.incidentsCount > 8 ? "CRÍTICO" : hs.incidentsCount > 4 ? "ALTO" : "MEDIO";

      return {
        id: `CORR-00${idx + 1}`,
        origin: center,
        destination: hs.center,
        direction,
        riskLevel,
        description: `Corredor de movilidad delictiva radial de ${Math.round(dist)} metros hacia el sector ${direction.split("-")[1]}.`
      };
    });

    const accessibilityScore = Math.max(10, 100 - (corridors.length * 15));

    return {
      corridors,
      accessibilityScore
    };
  }

  /**
   * Módulo 4: Cruce de Atractores y Delitos (DENUE)
   */
  private analyzeAttractors(center: { lat: number; lng: number }): any {
    const commercial = this.tceData.commercialContext || {};
    const totalAttractors = commercial.atractoresComercialesCount || 0;
    const activeTypes = commercial.atractoresTipos || [];
    
    const criticalEstablishments: any[] = [];
    let proximityScore = 100;

    // Buscar si existen establecimientos de muestra
    const sampleEsts = this.tceData.commercialContext?.criticalEstablishments || [];
    if (sampleEsts.length > 0) {
      sampleEsts.forEach((e: any) => {
        criticalEstablishments.push({
          name: e.name || e.nombre || "Establecimiento de oportunidad",
          type: e.type || e.categoria || "Comercial",
          location: e.location || { lat: center.lat, lng: center.lng },
          distanceMetros: Math.round(e.distanceMetros || 50)
        });
      });
      proximityScore = Math.max(20, Math.round(100 - (criticalEstablishments.length * 10)));
    } else if (totalAttractors > 0) {
      // Simular basados en conteo
      criticalEstablishments.push({
        name: "Establecimiento Comercial en Radio",
        type: activeTypes[0] || "Comercio",
        location: { lat: center.lat + 0.0002, lng: center.lng + 0.0002 },
        distanceMetros: 60
      });
      proximityScore = 80;
    }

    return {
      totalAttractors,
      criticalAttractors: criticalEstablishments.length,
      proximityScore,
      criticalEstablishments
    };
  }

  /**
   * Módulo 5: Riesgo Ambiental (Vulnerabilidades)
   */
  private analyzeEnvironmentalRisk(): any {
    const urban = this.tceData.urbanContext || {};
    const vulnerabilities = urban.vulnerabilitiesDetected || [];
    const vulnerabilitiesCount = vulnerabilities.length;

    const detectedFacilitators: string[] = [];
    vulnerabilities.forEach((v: string) => {
      const vLower = v.toLowerCase();
      if (vLower.includes("iluminación") || vLower.includes("luz") || vLower.includes("oscur")) {
        detectedFacilitators.push("Iluminación Deficiente");
      }
      if (vLower.includes("maleza") || vLower.includes("vegetación") || vLower.includes("árbol")) {
        detectedFacilitators.push("Maleza y Obstrucción Visual");
      }
      if (vLower.includes("baldío") || vLower.includes("predio") || vLower.includes("abandon")) {
        detectedFacilitators.push("Predio o Inmueble Vulnerable");
      }
    });

    // Asegurar valores únicos
    const uniqueFacilitators = Array.from(new Set(detectedFacilitators));
    if (uniqueFacilitators.length === 0 && vulnerabilitiesCount > 0) {
      uniqueFacilitators.push("Facilitadores de Oportunidad Ambiental");
    }

    const riskScore = Math.min(100, vulnerabilitiesCount * 20);

    return {
      vulnerabilitiesCount,
      riskScore,
      detectedFacilitators: uniqueFacilitators
    };
  }

  /**
   * Determinación de zonas prioritarias y baricentro
   */
  private determinePriorityZones(hotspots: any[], center: { lat: number; lng: number }): any {
    const temporal = this.sieData.temporal || {};
    const criticalWindow = temporal.ventanaOportunidad || "20:00 - 23:00 hrs";

    // Calcular el baricentro real de los hotspots (promedio de coordenadas)
    let baricenter = center;
    if (hotspots.length > 0) {
      const sumLat = hotspots.reduce((sum, hs) => sum + hs.center.lat, 0);
      const sumLng = hotspots.reduce((sum, hs) => sum + hs.center.lng, 0);
      baricenter = {
        lat: Number((sumLat / hotspots.length).toFixed(6)),
        lng: Number((sumLng / hotspots.length).toFixed(6))
      };
    }

    const criticalHotspotsIds = hotspots.filter(hs => hs.incidentsCount > 5).map(hs => hs.id);
    
    // Generar polígono delimitador de patrullaje recomendado
    const recommendedPatrolSectors = [
      {
        sectorName: "Sector de Patrullaje Dinámico Prioritario",
        coordinates: hotspots.map(hs => hs.center),
        criticalWindow
      }
    ];

    return {
      baricenter,
      criticalHotspotsIds,
      recommendedPatrolSectors
    };
  }

  /**
   * Módulo 6: Matriz de Evidencia Espacial
   */
  private generateSpatialEvidenceMatrix(density: any, attractors: any, environmental: any): any {
    const evidence: any[] = [];
    const dateStr = new Date().toLocaleDateString("es-MX");

    if (density.totalEvents > 0) {
      evidence.push({
        finding: `Concentración delictiva de ${density.totalEvents} incidentes históricos en el sector.`,
        source: "SIE - Base de Datos Histórica",
        variable: "sieData.temporal.totalEventos",
        confidence: 95
      });
    }

    if (attractors.totalAttractors > 0) {
      evidence.push({
        finding: `Presencia de ${attractors.totalAttractors} atractores comerciales del DENUE en el radio.`,
        source: "TCE - Módulo DENUE",
        variable: "tceData.commercialContext.atractoresComercialesCount",
        confidence: 90
      });
    }

    if (environmental.vulnerabilitiesCount > 0) {
      evidence.push({
        finding: `Identificación de ${environmental.vulnerabilitiesCount} vulnerabilidades físicas del entorno urbano.`,
        source: "TCE - Street View / Fotos",
        variable: "tceData.urbanContext.vulnerabilitiesDetected",
        confidence: 85
      });
    }

    return { evidence };
  }

  /**
   * Módulo 7: Confidence Engine (Independiente de Poisson)
   */
  private calculateSpatialConfidence(hotspots: any[], radius: number): any {
    // 1. Disponibilidad de datos
    let dataAvailability = 0;
    if (this.tceData.territorialContext) dataAvailability += 50;
    if (this.sieData.temporal) dataAvailability += 50;

    // 2. Consistencia espacial (hotspots deben estar dentro del radio)
    let spatialConsistency = 100;
    const tContext = this.tceData.territorialContext || {};
    const center = { lat: tContext.latitude ?? null, lng: tContext.longitude ?? null };

    if (center.lat !== null && center.lng !== null) {
      hotspots.forEach(hs => {
        const dist = this.calculateHaversine(center.lat!, center.lng!, hs.center.lat, hs.center.lng);
        if (dist > radius) {
          spatialConsistency = Math.max(0, spatialConsistency - 30);
        }
      });
    } else {
      spatialConsistency = 0;
    }

    // 3. Convergencia de fuentes (tenemos datos de delincuencia y datos urbanos en el buffer)
    let convergence = 0;
    const hasIncidents = (this.sieData.temporal?.totalEventos || 0) > 0;
    const hasUrban = (this.tceData.urbanContext?.streetViewsCount || 0) > 0 || (this.tceData.commercialContext?.atractoresComercialesCount || 0) > 0;
    
    if (hasIncidents) convergence += 50;
    if (hasUrban) convergence += 50;

    const score = Math.round((dataAvailability + spatialConsistency + convergence) / 3);

    let level = "BAJO";
    let description = "Evidencia espacial insuficiente para realizar inferencias territoriales seguras.";

    if (score >= 80) {
      level = "CRÍTICO";
      description = "Consistencia y convergencia geoespacial óptima. Hotspots completamente validados.";
    } else if (score >= 60) {
      level = "ALTO";
      description = "Consistencia espacial alta. Suficiente para fundamentar operativos de patrullaje de sector.";
    } else if (score >= 35) {
      level = "MEDIO";
      description = "Datos espaciales parciales. Requiere corroboración en campo por unidades tácticas.";
    }

    return {
      score,
      level,
      description
    };
  }

  /**
   * Módulo 8: Matriz de Trazabilidad
   */
  private generateTraceability(): any {
    const dateStr = new Date().toLocaleDateString("es-MX");
    return {
      source: "Cartographic Intelligence Engine (CIE)",
      date: dateStr,
      motor: "Ecosistema SAI - CIE",
      variable: "CIEResult",
      version: "1.0.0"
    };
  }

  /**
   * Metadatos de Mapas de Salida
   */
  private generateMapMetadata(): any {
    return {
      densityMapGenerated: true,
      mobilityMapGenerated: true,
      attractorsMapGenerated: true,
      predictiveMapGenerated: true,
      zoomLevel: 15
    };
  }

  /**
   * Módulo 9: Validación de Consistencia Geográfica
   */
  private validate(result: CIEResult): void {
    // 1. Hotspots dentro del radio
    const center = result.spatialPattern.center;
    const radius = result.spatialPattern.radiusMetros;

    result.hotspots.forEach(hs => {
      const dist = this.calculateHaversine(center.lat, center.lng, hs.center.lat, hs.center.lng);
      if (dist > radius + 100) { // Tolerancia menor de 100m por precisión de borde
        console.warn(`[CIE Validation Warning]: Hotspot ${hs.id} a ${Math.round(dist)}m está fuera del radio del buffer (${radius}m).`);
      }
    });

    // 2. Consistencia de fuentes (No declarar atractores si no existen)
    if (result.attractorAnalysis.totalAttractors === 0 && result.attractorAnalysis.criticalAttractors > 0) {
      throw new Error("Consistencia espacial fallida: se declararon atractores críticos pero totalAttractors es cero.");
    }

    // 3. Consistencia matemática (No generar distancias negativas)
    result.attractorAnalysis.criticalEstablishments.forEach(e => {
      if (e.distanceMetros < 0) {
        throw new Error(`Consistencia matemática fallida: distancia negativa detectada en establecimiento ${e.name}.`);
      }
    });

    result.mobilityAnalysis.corridors.forEach(c => {
      const dist = this.calculateHaversine(c.origin.lat, c.origin.lng, c.destination.lat, c.destination.lng);
      if (dist < 0) {
        throw new Error("Consistencia matemática fallida: distancia de corredor negativa detectada.");
      }
    });
  }

  /**
   * Módulo 10: Exportación de CIEResult
   */
  private export(result: CIEResult): CIEResult {
    return result;
  }

  /**
   * Cálculo de Distancia Haversine en metros
   */
  private calculateHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
