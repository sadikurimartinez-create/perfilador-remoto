"use server";

import {

  searchSerpAPI,

  searchNewsAPI,

  searchGNews,

  searchNewsData,

  searchTheNewsAPI,

  searchDENUE,

} from './osintProviders';

import {
  searchReddit,
  searchX,
  buscarEnWebOSINT,
  searchTelegram,
  analyzeStreetViewWithGemini,
} from './socialProviders';

import {
  searchOverpass,
  searchGooglePlaces,
} from './urbanProviders';

import { processEvidences } from './evidenceProcessor';

import { analyzeAndLogToBigQuery } from './nlpBigQuery';

export const runOSINTScan = async (
  project: any
) => {

  const location =
    project?.locationName ||
    'Aguascalientes';

  const query = `
    ${location} (Aguascalientes OR Ags OR "Calvillo" OR "Jesús María" OR "Pabellón de Arteaga" OR "Asientos" OR "Rincón de Romos" OR "San Francisco de los Romo" OR "Tepezalá" OR "Cosío" OR "El Llano" OR "San José de Gracia" OR "Fiscalía Aguascalientes" OR "FGE Ags" OR "SSPE Ags")
    crimen OR violencia OR droga OR homicidio OR robo OR cateo OR detención
  `;

  const [serp, news, gnews, newsdata, thenews, reddit, x, webOSINT, telegram] = await Promise.all([
    searchSerpAPI(query).catch((e) => { console.warn("SerpAPI failed:", e); return []; }),
    searchNewsAPI(query).catch((e) => { console.warn("NewsAPI failed:", e); return []; }),
    searchGNews(query).catch((e) => { console.warn("GNews failed:", e); return []; }),
    searchNewsData(query).catch((e) => { console.warn("NewsData failed:", e); return []; }),
    searchTheNewsAPI(query).catch((e) => { console.warn("TheNewsAPI failed:", e); return []; }),
    searchReddit(query).catch((e) => { console.warn("Reddit failed:", e); return []; }),
    searchX(query).catch((e) => { console.warn("X failed:", e); return []; }),
    buscarEnWebOSINT(query).catch((e) => { console.warn("WebOSINT failed:", e); return null; }),
    searchTelegram(query).catch((e) => { console.warn("Telegram failed:", e); return []; })
  ]);

  let denue: any[] = [];
  let overpass: any[] = [];
  let googlePlaces: any[] = [];
  let streetViewAnalysis: any = null;

  if (project?.latitude && project?.longitude) {
    const [denueRes, overpassRes, googlePlacesRes, streetViewRes] = await Promise.all([
      searchDENUE(project.latitude, project.longitude).catch((e) => { console.warn("DENUE failed:", e); return []; }),
      searchOverpass(project.latitude, project.longitude).catch((e) => { console.warn("Overpass failed:", e); return []; }),
      searchGooglePlaces(project.latitude, project.longitude).catch((e) => { console.warn("Google Places failed:", e); return []; }),
      analyzeStreetViewWithGemini(project.latitude, project.longitude).catch((e) => { console.warn("StreetView Analysis failed:", e); return null; })
    ]);
    denue = denueRes;
    overpass = overpassRes;
    googlePlaces = googlePlacesRes;
    streetViewAnalysis = streetViewRes;
  }

  // Procesamiento NLP Pro y Guardado en BigQuery (Histórico de Vínculos)
  // Esto se ejecuta en segundo plano para no demorar la respuesta principal a la interfaz
  analyzeAndLogToBigQuery(location, webOSINT?.resultadosWeb || [], webOSINT?.analisisInteligencia).catch(e => {
    console.error("Error logging to BigQuery in background:", e);
  });

  // Procesamiento Multimodal de Evidencias (Vision API + Cloud Storage)
  const processedEvidences = await processEvidences(project?.photos || []);

  // Construcción del Mapa de Vínculos (Grafo Interactivo)
  const graphData = { nodes: [] as any[], links: [] as any[] };
  const mainNodeId = location.substring(0, 25);
  
  graphData.nodes.push({ id: mainNodeId, group: 'TARGET', label: `Objetivo: ${location}` });

  // Vínculos extraídos de Vertex AI (Web OSINT)
  if (webOSINT?.analisisInteligencia) {
    const ai = webOSINT.analisisInteligencia;
    (ai.vinculos || []).forEach((v: string) => {
      if (!graphData.nodes.find(n => n.id === v)) graphData.nodes.push({ id: v, group: 'PERSONA', label: v });
      graphData.links.push({ source: mainNodeId, target: v, label: 'Vínculo Detectado' });
    });
    (ai.organizacionesVinculadas || []).forEach((org: string) => {
      if (!graphData.nodes.find(n => n.id === org)) graphData.nodes.push({ id: org, group: 'ORGANIZACIÓN', label: org });
      graphData.links.push({ source: mainNodeId, target: org, label: 'Organización' });
    });
  }

  // Vínculos extraídos de Vision AI (Evidencias)
  processedEvidences.forEach((ev: any) => {
    if (ev.isHighPriority) {
      const evId = `Evidencia_${ev.id}`;
      graphData.nodes.push({ id: evId, group: 'EVIDENCIA_CRÍTICA', label: 'Evidencia Alta Prioridad', url: ev.storageUrl });
      graphData.links.push({ source: mainNodeId, target: evId, label: 'Alerta Visual' });
      
      ev.labels.slice(0, 3).forEach((label: string) => {
        if (!graphData.nodes.find(n => n.id === label)) graphData.nodes.push({ id: label, group: 'ETIQUETA_VISUAL', label });
        graphData.links.push({ source: evId, target: label, label: 'Contiene' });
      });
    }
  });

  return {

    serp,

    news,

    gnews,

    newsdata,

    thenews,

    denue,

    reddit,

    x,

    webOSINT,

    telegram,

    overpass,

    googlePlaces,
    
    streetViewAnalysis,

    evidenciasProcesadas: processedEvidences,

    mapaVinculos: graphData,

    totalResults:
      (serp?.length || 0) +
      (news?.length || 0) +
      (gnews?.length || 0) +
      (newsdata?.length || 0) +
      (thenews?.length || 0) +
      (denue?.length || 0) +
      (reddit?.length || 0) +
      (x?.length || 0) +
      (webOSINT?.resultadosWeb?.length || 0) +
      (telegram?.length || 0) +
      (overpass?.length || 0) +
      (googlePlaces?.length || 0),

  };

};