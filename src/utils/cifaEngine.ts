"use server";

import { 
  searchSerpAPI, 
  searchNewsAPI, 
  searchGNews, 
  searchNewsData, 
  searchTheNewsAPI, 
  searchDENUE, 
  searchYouTubeOSINT 
} from './osintProviders';

import { 
  searchReddit, 
  searchX, 
  buscarEnWebOSINT, 
  searchTelegram, 
  analyzeStreetViewWithGemini 
} from './socialProviders';

import { 
  searchOverpass, 
  searchGooglePlaces 
} from './urbanProviders';

import { DriveIngestionEngine } from '../modules/drive-ingestion/drive-ingestion.engine';
import { runMultiSourceCorrelation } from './mcmCorrelation';
import { logLearningAction, autoDiscoverSource } from './imfoService';
import { getRegionalRSSFeeds } from '@/lib/osintSources';
import { validateGeoIntegrity } from './geoIntegrityEngine';

const CIFA_LEGACY_DIAGNOSTIC_METADATA = {
  acquisitionMode: "MOCK",
  acquisitionStatus: "ACQUIRED",
  semanticRole: "DIAGNOSTIC",
  validationStatus: "PENDING_REVIEW",
  isSimulated: true,
  providerId: "CIFA_LEGACY_DIAGNOSTIC",
  sourceId: "cifa-legacy-mock",
  sourceType: "LEGACY_MOCK_DIAGNOSTIC",
  sourceReference: "src/utils/cifaEngine.ts",
  geolocationSource: "SIMULATED_INPUT_COORDINATES",
};

function markCifaMockItem<T extends Record<string, any>>(item: T, sourceId: string, providerId: string, sourceName: string): T {
  return {
    ...item,
    acquisitionMode: "MOCK",
    semanticRole: "DIAGNOSTIC",
    isSimulated: true,
    providerId,
    sourceId,
    validationStatus: "PENDING_REVIEW",
    sourceName,
    epistemicIntegrity: {
      ...CIFA_LEGACY_DIAGNOSTIC_METADATA,
      providerId,
      sourceId,
      providerName: sourceName,
      generatedAt: new Date().toISOString(),
      query: null,
      resultCount: 1,
    },
  };
}

function markCifaMockOutput(output: any, sourceId: string, providerId: string, sourceName: string): any {
  if (Array.isArray(output)) {
    return output.map((item) =>
      item && typeof item === "object"
        ? markCifaMockItem(item, sourceId, providerId, sourceName)
        : item
    );
  }
  if (output && typeof output === "object") {
    const marked: any = markCifaMockItem(output, sourceId, providerId, sourceName);
    for (const [key, value] of Object.entries(output)) {
      if (Array.isArray(value)) {
        marked[key] = value.map((item) =>
          item && typeof item === "object"
            ? markCifaMockItem(item, sourceId, providerId, sourceName)
            : item
        );
      }
    }
    return marked;
  }
  return output;
}

// Fast parser for RSS feeds from the server (similar to Next.js route)
async function fetchRssFeedData(url: string, name: string): Promise<any[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xmlText = await res.text();
    const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
    return items.slice(0, 15).map(item => {
      const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || item.match(/<title>([\s\S]*?)<\/title>/i);
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || item.match(/<description>([\s\S]*?)<\/description>/i);
      return {
        source: name,
        title: titleMatch ? titleMatch[1].trim() : "Sin título",
        description: descMatch ? descMatch[1].replace(/(<([^>]+)>)/gi, "").trim().substring(0, 300) : "Sin descripción"
      };
    });
  } catch (err) {
    console.warn(`[CIFA RSS] Falló lectura de feed: ${name}`);
    return [];
  }
}

// SIMULATORS FOR FALLBACKS TO PREVENT "DISCONNECTED / EMPTY" FIELDS IN DEV ENVIRONMENT
function getMockTelegram(location: string): any[] {
  return [
    {
      texto: `[ALERTA GRUPO VNSA] Reportan camioneta Toyota Tacoma color gris con vidrios oscuros merodeando por el sector norte de ${location}. Varios sujetos sospechosos a bordo portando lo que parecen radios de comunicación. Eviten confrontar y marquen al 911.`,
      chat: "Ags Seguridad & Vialidad",
      fecha: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      texto: `[LEAKS POLICIAL] Detienen a alias 'El Cholo' tras fuerte operativo de la Policía Ministerial en cruce de las calles de la col. Insurgentes de ${location}. Se le aseguraron envoltorios de cristal, dinero y un teléfono celular con contactos criminales de Aguascalientes.`,
      chat: "Leaks Aguascalientes",
      fecha: new Date(Date.now() - 3600000 * 8).toISOString()
    }
  ];
}

function getMockX(location: string): any[] {
  return [
    {
      id: "tweet1",
      text: `Movilización de patrullas de la SSPE en el perímetro de ${location} por presunto robo de vehículo con violencia. Reportan detonaciones de arma de fuego. Cuidado en la zona. #Ags #Seguridad`,
      created_at: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    {
      id: "tweet2",
      text: `Se quejan vecinos de los grafitis de pandillas en las bardas perimetrales de VNSA en ${location}. Nadie hace nada, mucha oscuridad por las noches. #DenunciaCiudadana`,
      created_at: new Date(Date.now() - 3600000 * 12).toISOString()
    }
  ];
}

function getMockReddit(location: string): any[] {
  return [
    {
      data: {
        title: `¿Qué tan seguro es vivir cerca de la zona norte de ${location}?`,
        selftext: `Hola, me ofrecen rentar una casa por el fraccionamiento Villas de Nuestra Señora de la Asunción pero me da miedo el tema de las pandillas (Los Cholos 13) y los robos constantes que reportan en las noticias de Aguascalientes. ¿Alguien tiene experiencias recientes?`,
        subreddit: "Aguascalientes",
        created_utc: Math.floor((Date.now() - 3600000 * 24) / 1000),
        permalink: "/r/Aguascalientes/comments/123"
      }
    }
  ];
}

function getMockYouTube(location: string): any[] {
  return [
    {
      videoId: "yt_mock_1",
      title: `Operativo Policial Sorpresa en Punto de Venta en ${location}`,
      description: `Elementos de la SSPE de Aguascalientes y Guardia Nacional reventaron un domicilio utilizado para venta de enervantes tras denuncias anónimas. Reportaje especial de nota roja local.`,
      channelTitle: "Nota Roja Ags",
      channelId: "ch_mock_1",
      publishedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      views: 12500,
      likes: 340,
      commentCount: 45,
      comments: [
        "Por fin limpian esa calle, era insoportable el humo de droga en las noches.",
        "Alias 'El Cholo' siempre operaba por ahí.",
        "Se necesita más patrullaje perimetral constante."
      ],
      location: null
    }
  ];
}

function getMockRSS(location: string): any[] {
  return [
    {
      source: "BI Noticias",
      title: `Fuerte despliegue operativo en ${location} tras detonaciones`,
      description: `Reportan balacera entre sujetos armados a bordo de dos vehículos sospechosos en inmediaciones del sector. Policía Estatal de Aguascalientes y Guardia Nacional resguardan la escena. No se reportan heridos graves.`
    },
    {
      source: "El Sol del Centro",
      title: `Aseguran punto de narcomenudeo en Aguascalientes`,
      description: `Fiscalía del Estado ejecutó un cateo judicial autorizado en un predio abandonado de la colonia. Se detuvo a dos personas en posesión de dosis de presunta droga cristal y un arma corta.`
    }
  ];
}

function getMockDrive(location: string): any[] {
  return [
    {
      fileId: "drive_mock_1",
      fileName: "Reporte_Pandilla_Los_Cholos_13.pdf",
      logicalCategory: "Pandillas",
      extractedText: `Expediente Criminal CEIPOL. Grupo delictivo: Los Cholos 13. Territorio principal: VNSA, Insurgentes y Las Huertas en ${location}. Integrantes clave identificados: alias 'El Cholo', alias 'El Muerto'. Modus operandi: Narcomenudeo, extorsión a pequeños comercios y robo de autopartes. Teléfono de contacto registrado para entrega de dosis: 4491234567.`,
      summary: "Análisis táctico de la pandilla Los Cholos 13 con listado de integrantes y teléfonos.",
      riskLevel: "Alto",
      createdAt: new Date(Date.now() - 3600000 * 100).toISOString()
    },
    {
      fileId: "drive_mock_2",
      fileName: "Evidencia_Vehiculos_Sospechosos_Tacoma.doc",
      logicalCategory: "Evidencia",
      extractedText: `Archivo de Incidencia Aguascalientes. Placa sospechosa detectada: ABC-1234. Marca: Toyota Tacoma gris. Vinculada a robos con violencia perpetrados por la clica local de VNSA.`,
      summary: "Ficha de vehículo de interés con placa ABC-1234 reportado en VNSA.",
      riskLevel: "Medio",
      createdAt: new Date(Date.now() - 3600000 * 50).toISOString()
    }
  ];
}

function getMockDENUE(lat: number, lng: number): any[] {
  return [
    { id: "denue_1", nombre: "Modelorama VNSA", actividad: "Comercio de Cerveza", lat, lng },
    { id: "denue_2", nombre: "Taller Mecánico El Chuy", actividad: "Taller Reparación Vehículos", lat, lng },
    { id: "denue_3", nombre: "Bar El Callejón", actividad: "Cantina / Bar", lat, lng }
  ];
}

export const runUnifiedCifaScan = async (
  project: any,
  selectedSources: string[],
  customQuery?: string
) => {
  const startTime = Date.now();
  const location = project?.locationName || "Aguascalientes";
  const geoValidation = validateGeoIntegrity(project?.latitude, project?.longitude);
  const lat = geoValidation.latitude;
  const lng = geoValidation.longitude;

  // Build standard query keywords for security investigations
  const query = customQuery || `${location} operativo OR balacera OR robo OR detención OR cartel`;
  
  console.log(`🚀 [CIFA-CEIPOL] Iniciando Barrido Unificado. Fuentes: [${selectedSources.join(", ")}] para query: "${query}"`);

  // Tasks mapped to promises with individual latency logging
  const promises: Record<string, Promise<any>> = {};

  const executeWithLearning = async (sourceId: string, sourceName: string, searchFunc: () => Promise<any>, mockGenerator: () => any) => {
    const sTime = Date.now();
    console.log(`[CIFA Engine] LEGACY DIAGNOSTIC MOCK source: ${sourceName}`);
    const providerId = `CIFA_MOCK_${sourceName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    const res = markCifaMockOutput(mockGenerator(), sourceId, providerId, sourceName);
    const duration = Date.now() - sTime;
    const count = Array.isArray(res) ? res.length : res?.resultadosWeb ? res.resultadosWeb.length : res ? 1 : 0;
    try {
      await logLearningAction(sourceId, sourceName, duration, true, count, "Util").catch(() => {});
    } catch (e) {}
    return res;
  };

  // 1. OSINT Territorial v2.0
  if (selectedSources.includes("osint_territorial")) {
    promises.osintTerritorial = executeWithLearning("tg_ceipol_bot", "OSINT Territorial Core", async () => {
      return [
        { title: `Monitoreo perimetral en ${location}`, content: `Presencia policiaca y recorrido preventivo en zona conflictiva de ${location}.`, source: "Policía Estatal", date: new Date().toISOString() }
      ];
    }, () => [
      { title: `Monitoreo perimetral en ${location}`, content: `Presencia policiaca y recorrido preventivo en zona conflictiva de ${location}.`, source: "Policía Estatal", date: new Date().toISOString() }
    ]);
  }

  // 2. RSS Regional Feeds
  if (selectedSources.includes("rss_regional")) {
    promises.rssData = executeWithLearning("rss_sol_centro", "Radar OSINT Regional (RSS)", async () => {
      const feeds = getRegionalRSSFeeds(location);
      const results = await Promise.all(feeds.map(feed => fetchRssFeedData(feed.url, feed.name)));
      return results.flat();
    }, () => getMockRSS(location));
  }

  // 3. Google Dorks
  if (selectedSources.includes("google_dorks")) {
    promises.googleDorks = executeWithLearning("rss_sol_centro", "Google Dorks Engine", async () => {
      const dorkQuery = `site:gob.mx OR site:fge.ags.gob.mx "balacera" OR "homicidio" "${location}"`;
      return searchSerpAPI(dorkQuery);
    }, () => getMockRSS(location));
  }

  // 4. Discovery Engine (Vertex AI Search)
  if (selectedSources.includes("discovery_engine")) {
    promises.discoveryEngine = executeWithLearning("tg_ceipol_bot", "Discovery Engine Search", async () => {
      return buscarEnWebOSINT(query);
    }, () => ({ resultadosWeb: getMockRSS(location), analisisInteligencia: { vinculos: ["El Cholo", "El Muerto"], organizacionesVinculadas: ["Los Cholos 13"], perfilRiesgo: "Riesgo alto de disputas territoriales de pandillas locales en Aguascalientes." } }));
  }

  // 5. Telegram Leaks & Monitor
  if (selectedSources.includes("telegram")) {
    promises.telegram = executeWithLearning("tg_leaks_ags", "Telegram Bot & Channels", async () => {
      return searchTelegram(query);
    }, () => getMockTelegram(location));
  }

  // 6. X (Twitter) Search
  if (selectedSources.includes("x_twitter")) {
    promises.x = executeWithLearning("tg_ceipol_bot", "X Twitter Feed", async () => {
      return searchX(query);
    }, () => getMockX(location));
  }

  // 7. Reddit Mexico / Local
  if (selectedSources.includes("reddit")) {
    promises.reddit = executeWithLearning("tg_ceipol_bot", "Reddit Communities", async () => {
      return searchReddit(query);
    }, () => getMockReddit(location));
  }

  // 8. YouTube OSINT Video API
  if (selectedSources.includes("youtube")) {
    promises.youtube = executeWithLearning("yt_ags_noticias", "YouTube API Scan", async () => {
      return searchYouTubeOSINT(query);
    }, () => getMockYouTube(location));
  }

  // 9. Google Drive (Perfilador Ingesta)
  if (selectedSources.includes("drive_intelligence")) {
    promises.driveData = executeWithLearning("tg_ceipol_bot", "Drive Ingesta Intelligence", async () => {
      const intel = await DriveIngestionEngine.getIngestedIntelligence();
      return intel.filter(item => 
        item.extractedText.toLowerCase().includes(location.toLowerCase()) ||
        item.summary.toLowerCase().includes(location.toLowerCase())
      );
    }, () => getMockDrive(location));
  }

  // 10. Google Maps & Overpass APIs
  if (selectedSources.includes("google_maps") && lat !== null && lng !== null) {
    promises.googlePlaces = executeWithLearning("tg_ceipol_bot", "Google Places", async () => {
      return searchGooglePlaces(lat, lng);
    }, () => getMockDENUE(lat, lng));
  }
  if (selectedSources.includes("apis_gubernamentales") && lat !== null && lng !== null) {
    promises.denue = executeWithLearning("tg_ceipol_bot", "INEGI DENUE", async () => {
      return searchDENUE(lat, lng);
    }, () => getMockDENUE(lat, lng));
  }
  if (lat !== null && lng !== null) {
    promises.overpass = executeWithLearning("tg_ceipol_bot", "OpenStreetMap Overpass", async () => {
      return searchOverpass(lat, lng);
    }, () => []);
  }

  // 11. Street View
  if (selectedSources.includes("street_view") && lat !== null && lng !== null) {
    promises.streetViewAnalysis = executeWithLearning("tg_ceipol_bot", "Gemini Street View Analysis", async () => {
      return analyzeStreetViewWithGemini(lat, lng);
    }, () => ({ analisis: "Entorno urbano de riesgo: Presencia de grafitis en fachadas residenciales y barda de cemento, iluminación nocturna precaria y callejones sin salida que propician el narcomenudeo perimetral en la zona de Aguascalientes.", imagenesBase64: [] }));
  }

  // 12. Facebook / Instagram Public simulated (under permission check)
  if (selectedSources.includes("facebook_public")) {
    promises.facebook = executeWithLearning("fb_vecinos_vigilantes", "Facebook Pages Scan", async () => {
      return [
        { source: "Facebook Grupo Público", content: `Reporte vecinal en ${location}: Incidente de vandalismo y presencia sospechosa de vehículos reportado en cruce vial central.`, date: new Date().toISOString() }
      ];
    }, () => [
      { source: "Facebook Grupo Público", content: `Reporte vecinal en ${location}: Incidente de vandalismo y presencia sospechosa de vehículos reportado en cruce vial central.`, date: new Date().toISOString() }
    ]);
  }
  if (selectedSources.includes("instagram_public")) {
    promises.instagram = executeWithLearning("yt_ags_noticias", "Instagram Hashtags Scan", async () => {
      return [
        { source: "Instagram Geotag", content: `Publicación pública con etiqueta en ${location}: Fotografía nocturna que retrata grafitis urbanos nuevos del grupo 'Cholos 13'.`, date: new Date().toISOString() }
      ];
    }, () => [
      { source: "Instagram Geotag", content: `Publicación pública con etiqueta en ${location}: Fotografía nocturna que retrata grafitis urbanos nuevos del grupo 'Cholos 13'.`, date: new Date().toISOString() }
    ]);
  }

  // Await all parallel sweeps
  const keys = Object.keys(promises);
  const values = await Promise.all(Object.values(promises));
  const rawResults: any = {};
  
  keys.forEach((key, idx) => {
    rawResults[key] = values[idx];
  });

  // Calculate platform coverage
  let totalPublications = 0;
  let totalVideos = 0;
  let totalDocuments = 0;
  let totalImages = 0;
  let totalFindings = 0;

  keys.forEach(key => {
    const data = rawResults[key];
    let count = 0;
    if (Array.isArray(data)) {
      count = data.length;
    } else if (data && typeof data === "object") {
      count = Object.keys(data).length;
    }

    if (key === "youtube") {
      totalVideos += count;
    } else if (key === "driveData") {
      totalDocuments += count;
    } else if (key === "streetViewAnalysis") {
      totalImages += data?.imagenesBase64?.length || 0;
    } else {
      totalPublications += count;
    }
    
    // Auto-discover new sources based on news/web links
    if (key === "rssData" || key === "googleDorks" || key === "discoveryEngine") {
      const items = Array.isArray(data) ? data : data?.resultadosWeb || [];
      items.slice(0, 2).forEach((item: any) => {
        if (item.source && item.link && item.link.startsWith("http")) {
          // Send to pending source discovery queue in IMFO (Super Admin approval rule)
          autoDiscoverSource(item.source, "RSS", "Feed RSS", item.link, location, "Prensa");
        }
      });
    }
  });

  // 13. Run multi-source correlation engine (MCM)
  const correlationResult = await runMultiSourceCorrelation(rawResults, project);

  const endTime = Date.now();
  const totalProcessingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

  totalFindings = correlationResult.correlatedEntities.length;

  // Calculate OSINT coverage index
  const activeSourcesCount = selectedSources.length;
  const platformCoverage = Math.min(100, Math.round((activeSourcesCount / 14) * 100));
  
  // Territorial coverage (simulated based on georreferenciations found)
  const territorialPoints = correlationResult.correlatedEntities.filter(e => e.type === "COORDENADAS" || e.type === "DOMICILIO").length;
  const territorialCoverage = Math.min(100, Math.round(50 + (territorialPoints * 10)));

  const globalOsintCoverageIndex = Math.min(99, Math.round(
    (platformCoverage * 0.4) + 
    (territorialCoverage * 0.3) + 
    (Math.min(100, (totalFindings * 10)) * 0.3)
  ));

  const coveragePanel = {
    sourcesConsulted: selectedSources,
    totalProcessingTime,
    publicationsAnalyzed: totalPublications,
    documentsConsulted: totalDocuments,
    videosProcessed: totalVideos,
    imagesAnalyzed: totalImages,
    findingsObtained: totalFindings,
    platformCoverage,
    territorialCoverage,
    globalOsintCoverageIndex
  };

  // Generate tactical recommendations (Copiloto)
  const recommendations: string[] = [];
  if (totalFindings === 0) {
    recommendations.push("No se encontraron correlaciones multifuente de impacto. Se recomienda ampliar el radio de búsqueda o la query.");
  } else {
    recommendations.push(`Se detectaron ${totalFindings} correlaciones críticas en el cuadrante. Verifique la red de vínculos táctica.`);
  }

  const hasHighRisk = correlationResult.correlatedEntities.some(e => e.confidence > 80);
  if (hasHighRisk) {
    recommendations.push("ATENCIÓN: Existen alias o números de teléfono correlacionados con alto nivel de confianza. Considere coordinar operativos.");
  }
  
  if (totalDocuments > 0) {
    recommendations.push(`Se reutilizó información de ${totalDocuments} expedientes/documentos históricos indexados en Google Drive.`);
  } else {
    recommendations.push("Vacío de información histórica: No se encontraron coincidencias en las carpetas de Google Drive (OSINT, Inundaciones, Pandillas, Desaparecidos).");
  }

  if (rawResults.streetViewAnalysis) {
    recommendations.push("Análisis visual de Street View completado. Se sugieren mejoras de iluminación perimetral.");
  }

  return {
    success: true,
    institutionalUse: "BLOCKED_LEGACY_MOCK_DIAGNOSTIC",
    epistemicIntegrity: {
      ...CIFA_LEGACY_DIAGNOSTIC_METADATA,
      providerId: "CIFA_LEGACY_DIAGNOSTIC",
      sourceId: "runUnifiedCifaScan",
      providerName: "CIFA-CEIPOL Legacy Diagnostic Mock",
      generatedAt: new Date().toISOString(),
      query,
      resultCount: totalPublications + totalDocuments + totalVideos + totalImages,
    },
    correlation: correlationResult,
    coveragePanel,
    recommendations,
    rawResults
  };
};
