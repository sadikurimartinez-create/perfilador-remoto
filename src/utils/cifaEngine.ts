"use server";

import { searchSerpAPI, searchYouTubeOSINT } from "./osintProviders";
import {
  analyzeStreetViewWithGemini,
  buscarEnWebOSINT,
  searchReddit,
  searchTelegram,
  searchX,
} from "./socialProviders";
import { getOverpassSourceReference, searchGooglePlaces, searchOverpass } from "./urbanProviders";
import { DriveIngestionEngine } from "../modules/drive-ingestion/drive-ingestion.engine";
import { runMultiSourceCorrelation } from "./mcmCorrelation";
import { autoDiscoverSource, logLearningAction } from "./imfoService";
import { getRegionalRSSFeeds } from "@/lib/osintSources";
import { getDenueData } from "@/lib/osintActions";
import { resolveCanonicalAcquisitionGeography } from "./canonicalProjectGeography";
import {
  executeCifaBatch,
  executeCifaSource,
  summarizeCifaSourceCoverage,
  type CifaSourceDefinition,
  type CifaSourceEnvelope,
} from "./cifaAcquisition";
import {
  ExternalProviderError,
  classifyExternalFailure,
  classifyHttpFailure,
  type ExternalFailureReason,
} from "./externalProviderError";

function envConfigured(...values: Array<string | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

function textFromXml(fragment: string, tag: string): string {
  const cdata = fragment.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  const plain = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (cdata?.[1] ?? plain?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
}

async function fetchRssFeedData(url: string, name: string, query: string): Promise<any[]> {
  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) throw classifyHttpFailure(response.status);
  const acquiredAt = new Date().toISOString();
  const xmlText = await response.text();
  const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  return items.slice(0, 15).map((item) => ({
    source: name,
    feedUrl: url,
    title: textFromXml(item, "title") || "Sin título",
    description: textFromXml(item, "description").substring(0, 500),
    link: textFromXml(item, "link") || null,
    publishedAt: textFromXml(item, "pubDate") || null,
    acquiredAt,
    query,
  }));
}

async function fetchRegionalRss(location: string, query: string): Promise<any[]> {
  const feeds = getRegionalRSSFeeds(location);
  const settled = await Promise.allSettled(feeds.map((feed) => fetchRssFeedData(feed.url, feed.name, query)));
  const successful = settled.filter((result): result is PromiseFulfilledResult<any[]> => result.status === "fulfilled");
  if (feeds.length > 0 && successful.length === 0) {
    const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw classifyExternalFailure(firstFailure?.reason);
  }
  return successful.flatMap((result) => result.value);
}

function hasCoordinates(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null;
}

function observedData(envelope: CifaSourceEnvelope | undefined): unknown {
  if (!envelope || envelope.acquisitionMode !== "OBSERVED") return [];
  if (envelope.acquisitionStatus !== "ACQUIRED" && envelope.acquisitionStatus !== "PARTIAL") return [];
  return envelope.data;
}

function countGeoreferenced(data: unknown): number {
  const values = Array.isArray(data) ? data : data ? [data] : [];
  return values.filter((item: any) => {
    const coordinates = item?.geometry?.coordinates ?? item?.location?.coordinates;
    const placesLocation = item?.geometry?.location;
    const center = item?.center;
    return (Array.isArray(coordinates) && coordinates.length >= 2) ||
      (Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng))) ||
      (Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon))) ||
      (Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude))) ||
      (Number.isFinite(Number(placesLocation?.lat)) && Number.isFinite(Number(placesLocation?.lng))) ||
      (Number.isFinite(Number(center?.lat)) && Number.isFinite(Number(center?.lon ?? center?.lng)));
  }).length;
}

export async function runUnifiedCifaScan(project: any, selectedSources: string[], customQuery?: string) {
  const startedAt = Date.now();
  const location = project?.locationName || "Aguascalientes";
  const geographyContext = resolveCanonicalAcquisitionGeography(project ?? {});
  const lat = geographyContext?.queryPoint.lat ?? null;
  const lng = geographyContext?.queryPoint.lng ?? null;
  const coordinatesReady = hasCoordinates(lat, lng);
  const query = customQuery?.trim() || `${location} operativo OR balacera OR robo OR detención OR cartel`;
  const definitions: CifaSourceDefinition[] = [];
  const add = (selectedKey: string, definition: CifaSourceDefinition) => {
    if (selectedSources.includes(selectedKey)) definitions.push(definition);
  };

  add("osint_territorial", {
    sourceKey: "osint_territorial",
    sourceId: "osint-territorial-group",
    providerId: "NO_PROVIDER",
    providerName: "OSINT Territorial (agrupador)",
    sourceType: "ORCHESTRATION_GROUP",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "OBSERVATION",
    applicable: false,
    sourceReference: "src/utils/cifaEngine.ts:runUnifiedCifaScan",
    readiness: () => ({ ready: false, status: "UNAVAILABLE", code: "NOT_APPLICABLE_AGGREGATOR", message: "OSINT Territorial es un agrupador y no produce evidencia autónoma." }),
    execute: async () => [],
  });

  add("rss_regional", {
    sourceKey: "rss_regional",
    sourceId: "regional-rss-feeds",
    providerId: "REGIONAL_RSS",
    providerName: "Fuentes RSS regionales registradas",
    sourceType: "RSS",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/lib/osintSources.ts:getRegionalRSSFeeds",
    rawSourceReference: "rss:regional:http",
    execute: () => fetchRegionalRss(location, query),
    failureCode: "RSS_REQUEST_FAILED",
    failureMessage: "Ningún feed RSS respondió correctamente.",
  });

  add("google_dorks", {
    sourceKey: "google_dorks",
    sourceId: "serpapi-google-search",
    providerId: "SERPAPI",
    providerName: "SerpAPI Google Search",
    sourceType: "WEB_SEARCH",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/osintProviders.ts:searchSerpAPI",
    sourceUrl: "https://serpapi.com/search.json",
    rawSourceReference: "serpapi:google:organic_results",
    readiness: () => ({ ready: envConfigured(process.env.PGP_SERPAPI_API_KEY) }),
    execute: () => searchSerpAPI(`site:gob.mx OR site:fge.ags.gob.mx (balacera OR homicidio) ${location}`),
    failureCode: "SERPAPI_REQUEST_FAILED",
  });

  add("telegram", {
    sourceKey: "telegram",
    sourceId: "telegram-bot-updates",
    providerId: "TELEGRAM_BOT_API",
    providerName: "Telegram Bot API (updates recibidos)",
    sourceType: "TELEGRAM_BOT_RECEIVED_UPDATES",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/socialProviders.ts:searchTelegram",
    sourceUrl: "https://api.telegram.org/",
    rawSourceReference: "telegram:getUpdates:configured-chats-only",
    readiness: () => ({
      ready: envConfigured(process.env.PGP_TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN),
      code: "SOURCE_NOT_CONFIGURED",
      message: "Telegram requiere un token de bot y sólo analiza updates entregados a ese bot.",
    }),
    execute: () => searchTelegram(query),
    failureCode: "TELEGRAM_REQUEST_FAILED",
  });

  add("x_twitter", {
    sourceKey: "x_twitter",
    sourceId: "x-recent-search",
    providerId: "X_API_V2",
    providerName: "X API v2",
    sourceType: "X_DIRECT_OBSERVATION",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/socialProviders.ts:searchX",
    sourceUrl: "https://api.twitter.com/2/tweets/search/recent",
    rawSourceReference: "x:v2:recent-search",
    readiness: () => ({ ready: envConfigured(process.env.PGP_X_BEARER_TOKEN, process.env.PGP_X_ACCESS_TOKEN, process.env.X_BEARER_TOKEN, process.env.TWITTER_BEARER_TOKEN) }),
    execute: () => searchX(query),
    failureCode: "X_REQUEST_FAILED",
  });

  add("reddit", {
    sourceKey: "reddit",
    sourceId: "reddit-public-search",
    providerId: "REDDIT_DATA_API",
    providerName: "Reddit Data API OAuth",
    sourceType: "REDDIT_DIRECT_OBSERVATION",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/socialProviders.ts:searchReddit",
    sourceUrl: "https://oauth.reddit.com/search",
    rawSourceReference: "reddit:oauth:search",
    readiness: () => ({ ready: envConfigured(process.env.PGP_REDDIT_BEARER_TOKEN, process.env.REDDIT_BEARER_TOKEN) }),
    execute: () => searchReddit(query),
    failureCode: "REDDIT_REQUEST_FAILED",
  });

  add("youtube", {
    sourceKey: "youtube",
    sourceId: "youtube-data-search",
    providerId: "YOUTUBE_DATA_API_V3",
    providerName: "YouTube Data API v3",
    sourceType: "VIDEO_SEARCH",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/osintProviders.ts:searchYouTubeOSINT",
    sourceUrl: "https://www.googleapis.com/youtube/v3/search",
    rawSourceReference: "youtube:v3:search",
    readiness: () => ({ ready: envConfigured(process.env.YOUTUBE_API_KEY, process.env.YPU_TUBE_API_KEY) }),
    execute: () => searchYouTubeOSINT(query),
    failureCode: "YOUTUBE_REQUEST_FAILED",
  });

  add("drive_intelligence", {
    sourceKey: "drive_intelligence",
    sourceId: "drive-ingested-intelligence",
    providerId: "CEIPOL_DRIVE_INGESTION",
    providerName: "Google Drive institucional indexado",
    sourceType: "INTERNAL_DOCUMENT_AI_EXTRACTION",
    classification: "AI_DERIVED",
    acquisitionMode: "AI_GENERATED",
    semanticRole: "SYNTHESIS",
    sourceReference: "src/modules/drive-ingestion/drive-ingestion.engine.ts:getIngestedIntelligence",
    rawSourceReference: "postgres:drive_ingested_intelligence",
    readiness: () => ({ ready: envConfigured(process.env.DATABASE_URL) }),
    execute: async () => {
      const intelligence = await DriveIngestionEngine.getIngestedIntelligence();
      const target = location.toLowerCase();
      return intelligence.filter((item) => item.extractedText.toLowerCase().includes(target) || item.summary.toLowerCase().includes(target));
    },
    failureCode: "DRIVE_INTELLIGENCE_FAILED",
  });

  add("google_maps", {
    sourceKey: "google_maps",
    sourceId: "google-places-nearby-search",
    providerId: "GOOGLE_PLACES",
    providerName: "Google Places API",
    sourceType: "POINT_OF_INTEREST",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/urbanProviders.ts:searchGooglePlaces",
    sourceUrl: "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    rawSourceReference: "google-places:nearbysearch",
    geographyContext: geographyContext ?? undefined,
    readiness: () => {
      const configured = envConfigured(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, process.env.PGP_GOOGLE_BROWSER_KEY, process.env.PGP_GOOGLE_SERVER_KEY);
      return coordinatesReady
        ? { ready: configured, configured }
        : { ready: false, configured, status: "UNAVAILABLE", code: "INVALID_COORDINATES", message: "El expediente no tiene coordenadas válidas." };
    },
    execute: () => searchGooglePlaces(lat as number, lng as number),
    failureCode: "GOOGLE_PLACES_REQUEST_FAILED",
  });

  add("apis_gubernamentales", {
    sourceKey: "apis_gubernamentales",
    sourceId: "inegi-denue-api",
    providerId: "INEGI_DENUE",
    providerName: "INEGI DENUE API Pública",
    sourceType: "DENUE",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    authoritative: true,
    sourceReference: "src/lib/osintActions.ts:getDenueData",
    sourceUrl: "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar",
    rawSourceReference: "denue:v1:consulta:Buscar:todos",
    geographyContext: geographyContext ?? undefined,
    readiness: () => {
      const configured = envConfigured(process.env.INEGI_DENUE_TOKEN);
      return coordinatesReady
        ? { ready: configured, configured }
        : { ready: false, configured, status: "UNAVAILABLE", code: "INVALID_COORDINATES", message: "DENUE requiere coordenadas válidas." };
    },
    execute: async () => {
      const result = await getDenueData(lat as number, lng as number);
      if (!result.exito && result.denueStatus !== "EMPTY") {
        throw new ExternalProviderError({
          reason: (result.sanitizedFailureReason || "UNKNOWN_FAILURE") as ExternalFailureReason,
          technicalCode: result.providerErrorCode,
          httpStatus: result.httpStatus,
          nativeErrorCode: result.nativeErrorCode,
          nativeCauseCode: result.nativeCauseCode,
        });
      }
      return result.pois ?? [];
    },
    failureCode: "DENUE_REQUEST_FAILED",
  });

  add("openstreetmap", {
    sourceKey: "openstreetmap",
    sourceId: "openstreetmap-overpass",
    providerId: "OPENSTREETMAP_OVERPASS",
    providerName: "OpenStreetMap Overpass API",
    sourceType: "OPEN_GEODATA",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/urbanProviders.ts:searchOverpass",
    sourceUrl: getOverpassSourceReference(),
    rawSourceReference: "overpass:interpreter",
    geographyContext: geographyContext ?? undefined,
    readiness: () => coordinatesReady
      ? { ready: true }
      : { ready: false, configured: true, status: "UNAVAILABLE", code: "INVALID_COORDINATES", message: "Overpass requiere coordenadas válidas." },
    execute: () => searchOverpass(lat as number, lng as number),
    failureCode: "OVERPASS_REQUEST_FAILED",
  });

  for (const sourceKey of ["facebook_public", "instagram_public"] as const) {
    add(sourceKey, {
      sourceKey,
      sourceId: sourceKey.replace("_", "-"),
      providerId: "NO_AUTHORIZED_PROVIDER",
      providerName: sourceKey === "facebook_public" ? "Facebook público" : "Instagram público",
      sourceType: sourceKey === "facebook_public" ? "FACEBOOK_PUBLIC" : "INSTAGRAM_PUBLIC",
      classification: "OBSERVED_REAL",
      acquisitionMode: "OBSERVED",
      semanticRole: "SOURCE_FACT",
      applicable: false,
      sourceReference: "src/utils/cifaEngine.ts:runUnifiedCifaScan",
      readiness: () => ({ ready: false, status: "UNAVAILABLE", code: "UNSUPPORTED_PROVIDER", message: `No existe un proveedor ${sourceKey === "facebook_public" ? "Facebook" : "Instagram"} autorizado para búsqueda pública general productiva.` }),
      execute: async () => [],
    });
  }

  const sourceResults = await executeCifaBatch(definitions, query);

  if (selectedSources.includes("discovery_engine")) {
    let analysis: unknown = null;
    let providerMetadata: unknown = null;
    const discovery = await executeCifaSource({
      sourceKey: "discovery_engine",
      sourceId: "vertex-ai-search",
      providerId: "GOOGLE_DISCOVERY_ENGINE",
      providerName: "Google Vertex AI Search",
      sourceType: "WEB_SEARCH",
      classification: "OBSERVED_REAL",
      acquisitionMode: "OBSERVED",
      semanticRole: "SOURCE_FACT",
      sourceReference: "src/utils/socialProviders.ts:buscarEnWebOSINT",
      sourceUrl: "https://discoveryengine.googleapis.com/",
      rawSourceReference: "discovery-engine:default_search",
      readiness: () => ({ ready: envConfigured(process.env.PGP_DISCOVERY_PROJECT_ID) && envConfigured(process.env.PGP_DISCOVERY_LOCATION) && envConfigured(process.env.PGP_DISCOVERY_ENGINE_ID) }),
      execute: async () => {
        const result = await buscarEnWebOSINT(query);
        analysis = result.analisisInteligencia;
        providerMetadata = result.discoveryMetadata ?? null;
        return result.resultadosWeb;
      },
      failureCode: "DISCOVERY_ENGINE_FAILED",
    }, query);
    discovery.providerMetadata = providerMetadata;
    sourceResults.push(discovery);
    if (analysis) {
      sourceResults.push(await executeCifaSource({
        sourceKey: "discovery_engine_analysis",
        sourceId: "vertex-ai-search-analysis",
        providerId: "GOOGLE_VERTEX_AI",
        providerName: "Google Vertex AI Gemini",
        sourceType: "WEB_SEARCH_AI_ANALYSIS",
        classification: "AI_DERIVED",
        acquisitionMode: "AI_GENERATED",
        semanticRole: "SYNTHESIS",
        sourceReference: "src/utils/socialProviders.ts:buscarEnWebOSINT",
        rawSourceReference: "discovery-engine:observed-results:ai-analysis",
        execute: async () => analysis,
      }, query));
    }
  }

  if (selectedSources.includes("street_view")) {
    let analysis: unknown = null;
    const evidence = await executeCifaSource({
      sourceKey: "street_view",
      sourceId: "google-street-view-images",
      providerId: "GOOGLE_STREET_VIEW",
      providerName: "Google Street View Static API",
      sourceType: "STREET_VIEW_IMAGE_EVIDENCE",
      classification: "OBSERVED_REAL",
      acquisitionMode: "OBSERVED",
      semanticRole: "OBSERVATION",
      sourceReference: "src/utils/socialProviders.ts:analyzeStreetViewWithGemini",
      sourceUrl: "https://maps.googleapis.com/maps/api/streetview",
      rawSourceReference: "street-view:headings:0,90,180,270",
      geographyContext: geographyContext ?? undefined,
      readiness: () => {
        const configured = envConfigured(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, process.env.GOOGLE_MAPS_API_KEY);
        return coordinatesReady && configured
          ? { ready: true, configured: true }
          : {
              ready: false,
              configured,
              status: coordinatesReady ? "NOT_CONFIGURED" : "UNAVAILABLE",
              code: coordinatesReady ? "SOURCE_NOT_CONFIGURED" : "INVALID_COORDINATES",
              message: coordinatesReady
                ? "Street View requiere una API key configurada."
                : "Street View requiere una geografía canónica válida.",
            };
      },
      execute: async () => {
        const result = await analyzeStreetViewWithGemini(lat as number, lng as number);
        analysis = result?.analisis ?? null;
        return (result?.imagenesBase64 ?? []).map((imageBase64: string, imageIndex: number) => ({
          imageBase64,
          imageIndex,
          requestedLocation: { lat, lng },
        }));
      },
      failureCode: "STREET_VIEW_REQUEST_FAILED",
    }, query);
    sourceResults.push(evidence);
    if (analysis) {
      sourceResults.push(await executeCifaSource({
        sourceKey: "street_view_analysis",
        sourceId: "street-view-gemini-analysis",
        providerId: "GOOGLE_VERTEX_AI",
        providerName: "Google Vertex AI Gemini",
        sourceType: "STREET_VIEW_AI_ANALYSIS",
        classification: "AI_DERIVED",
        acquisitionMode: "AI_GENERATED",
        semanticRole: "SYNTHESIS",
        sourceReference: "src/utils/socialProviders.ts:analyzeStreetViewWithGemini",
        rawSourceReference: "google-street-view-images:ai-analysis",
        execute: async () => analysis,
      }, query));
    }
  }

  await Promise.all(sourceResults.map((result) =>
    logLearningAction(result.sourceId, result.providerName, result.durationMs, result.acquisitionStatus === "ACQUIRED", result.resultCount, result.resultCount > 0 ? "Util" : "Neutro").catch(() => undefined)
  ));

  const byKey = new Map(sourceResults.map((result) => [result.sourceKey, result]));
  const rawResults = {
    rssData: observedData(byKey.get("rss_regional")),
    serp: observedData(byKey.get("google_dorks")),
    discoveryEngine: observedData(byKey.get("discovery_engine")),
    telegram: observedData(byKey.get("telegram")),
    x: observedData(byKey.get("x_twitter")),
    reddit: observedData(byKey.get("reddit")),
    youtube: observedData(byKey.get("youtube")),
    driveData: [],
    googlePlaces: observedData(byKey.get("google_maps")),
    denue: observedData(byKey.get("apis_gubernamentales")),
    overpass: observedData(byKey.get("openstreetmap")),
  };

  for (const key of ["rss_regional", "google_dorks", "discovery_engine"]) {
    const envelope = byKey.get(key);
    const data = observedData(envelope);
    const items = Array.isArray(data) ? data : [];
    for (const item of items.slice(0, 2) as any[]) {
      const url = item.link || item.url;
      if (typeof url === "string" && url.startsWith("http")) {
        await autoDiscoverSource(item.source || item.title || envelope?.providerName || "Fuente web", "Web", "Resultado observado", url, location, "Prensa").catch(() => undefined);
      }
    }
  }

  const correlation = await runMultiSourceCorrelation(rawResults, project);
  const primaryResults = sourceResults.filter((result) => selectedSources.includes(result.sourceKey));
  const observed = sourceResults.filter((result) => result.acquisitionMode === "OBSERVED" && result.acquisitionStatus === "ACQUIRED");
  const aiDerived = sourceResults.filter((result) => result.acquisitionMode === "AI_GENERATED" && result.acquisitionStatus === "ACQUIRED");
  const failed = primaryResults.filter((result) => result.acquisitionStatus === "FAILED");
  const notConfigured = primaryResults.filter((result) => result.acquisitionStatus === "NOT_CONFIGURED");
  const unavailable = primaryResults.filter((result) => result.acquisitionStatus === "UNAVAILABLE");
  const noData = primaryResults.filter((result) => result.acquisitionStatus === "NO_DATA");
  const notApplicable = primaryResults.filter((result) => result.applicable === false);
  const applicablePrimaryResults = primaryResults.filter((result) => result.applicable !== false);
  const validResponses = primaryResults.filter((result) =>
    result.acquisitionStatus === "ACQUIRED" || result.acquisitionStatus === "NO_DATA" || result.acquisitionStatus === "PARTIAL"
  );
  const resultsAcquired = primaryResults.reduce((sum, result) => sum + result.resultCount, 0);
  const georeferencedResults = primaryResults.reduce((sum, result) => sum + countGeoreferenced(result.data), 0);
  const unavailableApplicable = unavailable.filter((result) => !notApplicable.includes(result));
  const degradedCount = failed.length + notConfigured.length + unavailableApplicable.length;

  const institutionalUse = observed.length > 0
    ? (degradedCount > 0 ? "PARTIAL_PRODUCTIVE" : "PRODUCTIVE_OBSERVED")
    : aiDerived.length > 0
      ? "AI_DERIVED_ONLY"
      : failed.length > 0 && failed.length === applicablePrimaryResults.length
        ? "FAILED"
        : applicablePrimaryResults.length > 0 && notConfigured.length === applicablePrimaryResults.length
          ? "NOT_CONFIGURED"
          : applicablePrimaryResults.length === 0 || unavailableApplicable.length === applicablePrimaryResults.length
            ? "UNAVAILABLE"
          : "NO_DATA";

  const totalProcessingTime = Number(((Date.now() - startedAt) / 1000).toFixed(2));
  const coverageSummary = summarizeCifaSourceCoverage(primaryResults, selectedSources.length);
  const coveragePanel = {
    sourcesConsulted: selectedSources,
    totalProcessingTime,
    ...coverageSummary,
    sourcesObserved: observed.length,
    sourcesAiDerived: aiDerived.length,
    sourcesNoData: noData.length,
    sourcesFailed: failed.length,
    sourcesNotConfigured: notConfigured.length,
    sourcesUnavailable: coverageSummary.sourcesUnavailable,
    resultsAcquired,
    georeferencedResults,
    territorialCoverage: null,
    territorialCoverageStatus: "NOT_COMPUTABLE",
    publicationsAnalyzed: observed.reduce((sum, result) => sum + (result.sourceType === "VIDEO_SEARCH" || result.sourceType === "POINT_OF_INTEREST" ? 0 : result.resultCount), 0),
    documentsConsulted: byKey.get("drive_intelligence")?.resultCount ?? 0,
    videosProcessed: byKey.get("youtube")?.resultCount ?? 0,
    imagesAnalyzed: byKey.get("street_view")?.resultCount ?? 0,
    findingsObtained: correlation.correlatedEntities.length,
  };

  const recommendations: string[] = [];
  if (observed.length === 0) recommendations.push("No hay evidencia observada adquirida; revise configuración, disponibilidad y alcance de las fuentes.");
  if (failed.length > 0) recommendations.push(`${failed.length} fuente(s) fallaron y requieren revisión técnica; el resto del barrido se conservó.`);
  if (correlation.correlatedEntities.length > 0) recommendations.push(`Se detectaron ${correlation.correlatedEntities.length} menciones correlacionadas que requieren validación analista.`);

  return {
    success: validResponses.length > 0 || aiDerived.length > 0,
    institutionalUse,
    orchestrator: {
      engine: "CIFA-CEIPOL",
      role: "MULTISOURCE_ORCHESTRATOR",
      generatedAt: new Date().toISOString(),
      query,
      isSimulated: false,
      geographyContext,
    },
    correlation,
    coveragePanel,
    recommendations,
    sourceResults,
    rawResults,
  };
}
