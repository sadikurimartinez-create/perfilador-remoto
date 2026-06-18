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
} from './socialProviders';

"use server";

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

  const serp =
    await searchSerpAPI(query);

  const news =
    await searchNewsAPI(query);

  const gnews =
    await searchGNews(query);

  const newsdata =
    await searchNewsData(query);

  const thenews =
    await searchTheNewsAPI(query);

  const reddit =
    await searchReddit(query);

  const x =
    await searchX(query);

  const webOSINT =
    await buscarEnWebOSINT(query);

  const telegram =
    await searchTelegram(query);

  let denue: any[] = [];

  let overpass: any[] = [];

  let googlePlaces: any[] = [];

  if (
    project?.latitude &&
    project?.longitude
  ) {

    denue =
      await searchDENUE(
        project.latitude,
        project.longitude
      );

    overpass =
      await searchOverpass(
        project.latitude,
        project.longitude
      );

    googlePlaces =
      await searchGooglePlaces(
        project.latitude,
        project.longitude
      );

  }

  // Procesamiento NLP Pro y Guardado en BigQuery (Histórico de Vínculos)
  // Esto se ejecuta en segundo plano para no demorar la respuesta principal a la interfaz
  await analyzeAndLogToBigQuery(location, webOSINT?.resultadosWeb || [], webOSINT?.analisisInteligencia);

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