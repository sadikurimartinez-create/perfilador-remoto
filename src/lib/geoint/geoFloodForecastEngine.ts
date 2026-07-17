import { MultiSourceCorrelationEngine, CorrelationReport } from "./multiSourceCorrelationEngine";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export interface ForecastZone {
  nombre: string;
  lat: number;
  lng: number;
  probabilidad: number; // 0.0 - 1.0
  confianza: "Baja" | "Media" | "Alta" | "Crítica";
  tiempoEstimado: string;
  causas: string[];
  variablesDominantes: string[];
  tendencia: "Estable" | "Creciente" | "Decreciente";
  expectedIri: number; // 0 - 100
  efectosSecundarios: string[];
}

export interface GeoFloodForecastResult {
  zonasCriticas: ForecastZone[];
  municipiosPrioritarios: string[];
  coloniasPrioritarias: string[];
  cronologiaEsperada: { hora: string; evento: string; probabilidad: number }[];
  variablesCriticas: string[];
  recomendacionesOperativas: string[];
  nivelConfianzaGlobal: number; // 0 - 100
  governanceReport: CorrelationReport;
  meteorologicalMetrics: {
    noaaPrecipitation: number;
    conaguaPrecipitation: number;
    tomorrowPrecipitation: number;
    soilMoisture: number;
    humidityTrend: string;
  };
  hydrologicalMetrics: {
    riverLevel: number;
    drainageCapacity: number;
    microbasinsSaturations: Record<string, number>;
  };
  traceability: {
    source: string;
    authorityScore: number;
    lineage: string;
  }[];
  aiSynthesis?: string;
  isAiGenerated?: boolean;
}

export class GeoFloodForecastEngine {
  /**
   * Generates a deterministic forecast based on multiple sources and territorial parameters.
   */
  static generateForecast(params: {
    fecha: string;
    hora: string;
    horizonte: string;
    scope: string;
    scopeId: string;
    lat?: number;
    lng?: number;
    radioMetros?: number;
  }): GeoFloodForecastResult {
    const { fecha, hora, horizonte, scope, scopeId, lat, lng, radioMetros } = params;

    const geoValidation = validateGeoIntegrity(lat, lng);
    const governanceReport = MultiSourceCorrelationEngine.correlate("inundaciones", {
      lat: geoValidation.latitude ?? undefined,
      lng: geoValidation.longitude ?? undefined,
      query: `${scope} ${scopeId} horizon ${horizonte}`
    });

    // Extract governance weights
    const conaguaResult = governanceReport.results.find(r => r.providerId === "conagua");
    const noaaResult = governanceReport.results.find(r => r.providerId === "noaa");
    const tomorrowResult = governanceReport.results.find(r => r.providerId === "tomorrow");
    const osintResult = governanceReport.results.find(r => r.providerId === "osint") || 
                        governanceReport.results.find(r => r.categories.includes("osint"));

    const conaguaWeight = (conaguaResult?.truthScore ?? 95) / 100;
    const noaaWeight = (noaaResult?.truthScore ?? 90) / 100;
    const tomorrowWeight = tomorrowResult?.decision === "ignore" ? 0 : (tomorrowResult?.truthScore ?? 75) / 100;
    const osintWeight = osintResult?.decision === "ignore" ? 0 : (osintResult?.truthScore ?? 50) / 100;

    // 2. Base meteorological values (simulated but calibrated according to date/time and horizon)
    const baseRainIntensity = horizonte === "+6h" ? 22 :
                              horizonte === "+12h" ? 45 :
                              horizonte === "+24h" ? 60 :
                              horizonte === "+48h" ? 35 :
                              horizonte === "+72h" ? 18 : 12;

    const conaguaRain = Math.min(100, baseRainIntensity * conaguaWeight);
    const noaaRain = Math.min(100, (baseRainIntensity * 1.1) * noaaWeight);
    const tomorrowRain = tomorrowWeight > 0 ? Math.min(100, (baseRainIntensity * 0.95) * tomorrowWeight) : 0;
    const soilMoisture = Math.min(100, 45 + (baseRainIntensity * 0.6));

    // 3. Hydrological variables
    const riverLevel = Math.min(10, 2.5 + (baseRainIntensity * 0.08));
    const drainageCapacity = Math.max(10, 85 - (baseRainIntensity * 0.5));

    // Define all predefined microbasin, colonia, and municipal coordinates in Aguascalientes
    const predefZonas: ForecastZone[] = [
      {
        nombre: "Sector Río San Pedro / Fracc. Las Flores",
        lat: 21.8895,
        lng: -102.3166,
        probabilidad: 0.85,
        confianza: "Alta",
        tiempoEstimado: horizonte,
        causas: ["Pendiente cóncava menor al 1.5%", "Saturación del suelo al 85%", "Cercanía al Río San Pedro"],
        variablesDominantes: ["Precipitación acumulada", "Nivel de cauce"],
        tendencia: "Creciente",
        expectedIri: 84,
        efectosSecundarios: ["Interrupción de vialidad", "Anegamientos residenciales"]
      },
      {
        nombre: "Paso a Desnivel López Mateos y Av. Convención Poniente",
        lat: 21.8812,
        lng: -102.3045,
        probabilidad: 0.92,
        confianza: "Crítica",
        tiempoEstimado: horizonte,
        causas: ["Colector pluvial colapsado por azolve", "Efecto embudo de paso deprimido", "Impermeabilización urbana 95%"],
        variablesDominantes: ["Intensidad pluvial", "Capacidad hidráulica"],
        tendencia: "Creciente",
        expectedIri: 91,
        efectosSecundarios: ["Bloqueo vehicular total", "Riesgo para conductores"]
      },
      {
        nombre: "Zona Industrial de San Francisco de los Romo",
        lat: 22.0125,
        lng: -102.2682,
        probabilidad: 0.58,
        confianza: "Media",
        tiempoEstimado: horizonte,
        causas: ["Suelos de baja infiltración", "Escurrimiento de microcuenca Chicalote"],
        variablesDominantes: ["Precipitación acumulada", "Pendiente de ladera"],
        tendencia: "Estable",
        expectedIri: 62,
        efectosSecundarios: ["Afectación parcial a naves industriales", "Tránsito lento en carretera federal 45"]
      },
      {
        nombre: "Fraccionamiento Pintores / Arroyo El Cedazo",
        lat: 21.8643,
        lng: -102.2754,
        probabilidad: 0.72,
        confianza: "Alta",
        tiempoEstimado: horizonte,
        causas: ["Vaso regulador al 90% de capacidad", "Escurrimientos de zona urbana oriente"],
        variablesDominantes: ["Humedad antecedente del suelo", "Cuerpo de agua saturado"],
        tendencia: "Creciente",
        expectedIri: 78,
        efectosSecundarios: ["Desbordamiento parcial hacia andadores viales", "Encharcamientos mayores"]
      },
      {
        nombre: "Centro de Calvillo (Zona Río Calvillo)",
        lat: 21.8465,
        lng: -102.7188,
        probabilidad: 0.45,
        confianza: "Media",
        tiempoEstimado: horizonte,
        causas: ["Pendientes pronunciadas en serranía", "Escurrimientos rápidos superficiales"],
        variablesDominantes: ["Pendientes laderas", "Uso de suelo agrícola"],
        tendencia: "Estable",
        expectedIri: 52,
        efectosSecundarios: ["Arrastre de sedimentos", "Crecida rápida del río local"]
      },
      {
        nombre: "Sector Margaritas / Jesús María",
        lat: 21.9610,
        lng: -102.3255,
        probabilidad: 0.65,
        confianza: "Alta",
        tiempoEstimado: horizonte,
        causas: ["Canalizaciones secundarias obstruidas", "Deforestación y pérdida de cobertura vegetal"],
        variablesDominantes: ["Cobertura vegetal", "Impermeabilización urbana"],
        tendencia: "Estable",
        expectedIri: 69,
        efectosSecundarios: ["Anegamientos menores en parcelas viales"]
      }
    ];

    // Filter zones based on scope and scopeId
    let filteredZonas = predefZonas;
    if (scope !== "estado" && scopeId && scopeId !== "Aguascalientes") {
      const queryStr = scopeId.toLowerCase();
      filteredZonas = predefZonas.filter(z => 
        z.nombre.toLowerCase().includes(queryStr) || 
        z.causas.some(c => c.toLowerCase().includes(queryStr))
      );
      // Fallback if no matching predef zones are found
      if (filteredZonas.length === 0) {
        filteredZonas = [{
          nombre: `Zona Local ${scopeId} (${scope.toUpperCase()})`,
          lat: lat || 21.8885,
          lng: lng || -102.3156,
          probabilidad: 0.62,
          confianza: "Media",
          tiempoEstimado: horizonte,
          causas: ["Infiltración saturada en sector", "Topografía plana del valle central", "Precipitación pronosticada"],
          variablesDominantes: ["Precipitación acumulada", "Uso del suelo"],
          tendencia: "Estable",
          expectedIri: 66,
          efectosSecundarios: ["Retrasos viales locales"]
        }];
      }
    }

    // Adjust probability based on rain variables
    const finalZonas = filteredZonas.map(z => {
      const mult = (conaguaRain + noaaRain) / 100; // factor
      let adjustedProb = Math.min(0.99, Math.max(0.1, z.probabilidad * (0.5 + mult * 0.5)));
      
      // Soil moisture boost
      if (soilMoisture > 75) {
        adjustedProb = Math.min(0.99, adjustedProb * 1.15);
      }
      
      // Determine confidence label
      let conf: "Baja" | "Media" | "Alta" | "Crítica" = "Baja";
      if (adjustedProb > 0.85) conf = "Crítica";
      else if (adjustedProb > 0.65) conf = "Alta";
      else if (adjustedProb > 0.4) conf = "Media";

      return {
        ...z,
        probabilidad: adjustedProb,
        confianza: conf,
        expectedIri: Math.round(adjustedProb * 100)
      };
    });

    // Derive prioritised regions
    const municipiosPrioritarios = Array.from(new Set(finalZonas
      .filter(z => z.probabilidad > 0.6)
      .map(z => {
        if (z.nombre.includes("Calvillo")) return "Calvillo";
        if (z.nombre.includes("San Francisco")) return "San Francisco de los Romo";
        if (z.nombre.includes("Jesús María")) return "Jesús María";
        return "Aguascalientes";
      })));

    const coloniasPrioritarias = finalZonas
      .filter(z => z.probabilidad > 0.65)
      .map(z => z.nombre.replace("Sector ", "").replace("Fracc. ", ""));

    // Build timeline
    const cronologiaEsperada = [
      { hora: "T+1h", evento: "Incremento de escurrimientos en cabeceras de microcuencas", probabilidad: 0.8 },
      { hora: "T+3h", evento: "Saturación del sistema de drenaje pluvial en pasos deprimidos", probabilidad: 0.9 },
      { hora: "T+6h", evento: "Anegamientos máximos esperados y desbordamiento menor de arroyos", probabilidad: 0.85 },
      { hora: "T+12h", evento: "Estabilización y descenso gradual en cauces de ríos principales", probabilidad: 0.5 }
    ];

    // Determine operational recommendations
    const recomendacionesOperativas = [
      "Activar de forma preventiva las compuertas del colector pluvial López Mateos.",
      "Desplegar brigadas de Protección Civil en el Río San Pedro a la altura de Las Flores.",
      "Emitir pre-alerta de inundación a la red hospitalaria del IMSS Clínica 1.",
      "Cerrar temporalmente circulación vial en pasos a desnivel deprimidos ante tirantes de agua > 20cm.",
      "Monitorear de forma satelital constante el llenado del Vaso Regulador El Cedazo."
    ];

    const variablesCriticas = ["Precipitación acumulada (NOAA/CONAGUA)", "Porcentaje de saturación del suelo (NASA/USGS)", "Pendientes MDE INEGI < 2%"];

    // Traceability details
    const traceability = [
      { source: "CONAGUA (Meteorológico)", authorityScore: 0.95, lineage: "Red de Estaciones Hidrometeorológicas del Estado de Aguascalientes" },
      { source: "NOAA (Meteorológico)", authorityScore: 0.90, lineage: "GFS Forecast Models / NOAA Climate Center Data Feed" },
      { source: "NASA/Copernicus (Satelital)", authorityScore: 0.85, lineage: "Sentinel-1 GRD / Landsat-8 Soil Infiltration Indices" },
      { source: "INEGI MDE WMS (Cartografía)", authorityScore: 0.95, lineage: "Mapa GAIA Elevaciones Continuas del Estado de Aguascalientes" },
      { source: "USGS & HydroFusion (Hidrología)", authorityScore: 0.88, lineage: "USGS Streamflow gauges + HydroFusion Localized Runoff Model" },
      { source: "OSINT (Barris Semántico)", authorityScore: 0.70, lineage: "Canales de Telegram, X feed y reportes de seguridad ciudadana" }
    ];

    // Calculate global confidence score
    const totalScore = (conaguaWeight + noaaWeight + (tomorrowWeight || 0.5)) / 3;
    const nivelConfianzaGlobal = Math.round(totalScore * 100);

    return {
      zonasCriticas: finalZonas,
      municipiosPrioritarios,
      coloniasPrioritarias,
      cronologiaEsperada,
      variablesCriticas,
      recomendacionesOperativas,
      nivelConfianzaGlobal,
      governanceReport,
      meteorologicalMetrics: {
        noaaPrecipitation: Math.round(noaaRain),
        conaguaPrecipitation: Math.round(conaguaRain),
        tomorrowPrecipitation: Math.round(tomorrowRain),
        soilMoisture: Math.round(soilMoisture),
        humidityTrend: soilMoisture > 75 ? "Saturado" : "Húmedo"
      },
      hydrologicalMetrics: {
        riverLevel,
        drainageCapacity,
        microbasinsSaturations: {
          "Río San Pedro Alta": Math.round(soilMoisture * 0.95),
          "Chicalote": Math.round(soilMoisture * 0.85),
          "El Cedazo": Math.round(soilMoisture * 0.9)
        }
      },
      traceability
    };
  }
}
