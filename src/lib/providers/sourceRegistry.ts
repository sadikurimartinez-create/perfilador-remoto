export type SourceFamily =
  | "DENUE"
  | "SCINCE"
  | "TELEGRAM"
  | "X"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "NEWS_API"
  | "GDELT_DOC"
  | "GDELT_CONTEXT"
  | "GDELT_GEO"
  | "BLUESKY"
  | "FEDIVERSE"
  | "OFFICIAL_CEIPOL"
  | "OSINT_CONNECTIVITY";

export type SourceOperationalMode =
  | "AUTHORITATIVE_PRODUCTIVE"
  | "PRODUCTIVE_OBSERVED"
  | "SIMULATED"
  | "AI_GENERATED"
  | "CONNECTIVITY_ONLY"
  | "LEGACY"
  | "DEPRECATED"
  | "NOT_CONFIGURED";

export type SourceAvailability = "AVAILABLE" | "NOT_CONFIGURED" | "UNAVAILABLE";

export interface SourceRouteDescriptor {
  sourceFamily: SourceFamily;
  routeId: string;
  providerId: string;
  action?: string;
  sourceType: string;
  providerName: string;
  authoritative: boolean;
  operationalMode: SourceOperationalMode;
  availability: SourceAvailability;
  selectedForProductiveAcquisition: boolean;
  notes: string;
}

export interface ScinceRouteReadiness {
  ready: boolean;
  datasetId?: string;
}

function configured(value: string | undefined): SourceAvailability {
  return value ? "AVAILABLE" : "NOT_CONFIGURED";
}

export function getSourceRoutes(options?: { scinceReadiness?: ScinceRouteReadiness }): SourceRouteDescriptor[] {
  const denueAvailability = configured(process.env.INEGI_DENUE_TOKEN);
  const telegramAvailability = configured(process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const xAvailability = configured(
    process.env.PGP_X_BEARER_TOKEN ||
      process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN ||
      process.env.PGP_X_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN
  );
  const scinceReady = options?.scinceReadiness?.ready === true && Boolean(options.scinceReadiness.datasetId);
  const newsApiAvailability = configured(process.env.NEWS_API_TOKEN);

  return [
    {
      sourceFamily: "DENUE",
      routeId: "inegi.denue.search",
      providerId: "inegi",
      action: "denue",
      sourceType: "DENUE",
      providerName: "INEGI DENUE API Publica",
      authoritative: true,
      operationalMode: denueAvailability === "AVAILABLE" ? "AUTHORITATIVE_PRODUCTIVE" : "NOT_CONFIGURED",
      availability: denueAvailability,
      selectedForProductiveAcquisition: denueAvailability === "AVAILABLE",
      notes: "Ruta productiva DENUE: consulta real INEGI mediante INEGI_DENUE_TOKEN, sin fallback sintetico.",
    },
    {
      sourceFamily: "DENUE",
      routeId: "inegi.denue.healthcheck",
      providerId: "inegi",
      action: "healthCheck",
      sourceType: "DENUE_CONNECTIVITY",
      providerName: "INEGI DENUE API Publica",
      authoritative: false,
      operationalMode: "CONNECTIVITY_ONLY",
      availability: denueAvailability,
      selectedForProductiveAcquisition: false,
      notes: "Diagnostico de conectividad/autenticacion; no reemplaza adquisicion DENUE.",
    },
    {
      sourceFamily: "SCINCE",
      routeId: "inegi.territorial.local-postgis",
      providerId: "inegi",
      action: "scince",
      sourceType: "INEGI_TERRITORIAL_CPV2020",
      providerName: "INEGI Censo 2020 / Marco Geoestadistico (PostGIS local)",
      authoritative: scinceReady,
      operationalMode: scinceReady ? "AUTHORITATIVE_PRODUCTIVE" : "NOT_CONFIGURED",
      availability: scinceReady ? "AVAILABLE" : "NOT_CONFIGURED",
      selectedForProductiveAcquisition: scinceReady,
      notes: scinceReady
        ? `Dataset oficial local verificado: ${options?.scinceReadiness?.datasetId}.`
        : "Requiere PostGIS y un dataset INEGI READY con URLs oficiales, conteos y SHA-256 completos.",
    },
    {
      sourceFamily: "SCINCE",
      routeId: "osint.scince.local-simulator",
      providerId: "SCINCE_LOCAL_SIMULATOR",
      sourceType: "SCINCE",
      providerName: "SCINCE Local Simulator",
      authoritative: false,
      operationalMode: "SIMULATED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: false,
      notes: "Simulador local de diagnostico; no constituye SCINCE real.",
    },
    {
      sourceFamily: "SCINCE",
      routeId: "inegi.indicators.demographics",
      providerId: "inegi",
      action: "scince",
      sourceType: "INEGI_INDICATORS",
      providerName: "INEGI Indicadores",
      authoritative: false,
      operationalMode: "LEGACY",
      availability: configured(process.env.INEGI_API_TOKEN),
      selectedForProductiveAcquisition: false,
      notes: "Ruta historica de indicadores demograficos; no se declara SCINCE autoritativo.",
    },
    {
      sourceFamily: "TELEGRAM",
      routeId: "telegram.bot.search",
      providerId: "telegram",
      action: "search",
      sourceType: "TELEGRAM_BOT_UPDATES",
      providerName: "Telegram Bot API (updates recibidos)",
      authoritative: false,
      operationalMode: telegramAvailability === "AVAILABLE" ? "LEGACY" : "NOT_CONFIGURED",
      availability: telegramAvailability,
      selectedForProductiveAcquisition: false,
      notes: "Lectura Bot API limitada a updates entregados al bot en chats, grupos o canales donde participa; no es busqueda publica global.",
    },
    {
      sourceFamily: "TELEGRAM",
      routeId: "gemini.telegram-context-synthesis",
      providerId: "GEMINI",
      sourceType: "TELEGRAM_CONTEXT",
      providerName: "Google Vertex AI Gemini",
      authoritative: false,
      operationalMode: "AI_GENERATED",
      availability: configured(process.env.GCP_PROJECT_ID || process.env.GEMINI_MODEL),
      selectedForProductiveAcquisition: false,
      notes: "Sintesis sobre contexto Telegram; no es observacion directa de Telegram.",
    },
    {
      sourceFamily: "X",
      routeId: "x.recent-search",
      providerId: "x",
      action: "search",
      sourceType: "X_DIRECT_OBSERVATION",
      providerName: "X / Twitter API",
      authoritative: false,
      operationalMode: xAvailability === "AVAILABLE" ? "LEGACY" : "NOT_CONFIGURED",
      availability: xAvailability,
      selectedForProductiveAcquisition: false,
      notes: "Ruta social real condicionada a credenciales; no se declara autoritativa en ADR-020.20.",
    },
    {
      sourceFamily: "FACEBOOK",
      routeId: "facebook.connectivity",
      providerId: "facebook",
      action: "health_check",
      sourceType: "FACEBOOK_CONNECTIVITY",
      providerName: "Facebook OSINT Connection",
      authoritative: false,
      operationalMode: "CONNECTIVITY_ONLY",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: false,
      notes: "Alcance de red; no produce observacion Facebook.",
    },
    {
      sourceFamily: "INSTAGRAM",
      routeId: "instagram.connectivity",
      providerId: "instagram",
      action: "health_check",
      sourceType: "INSTAGRAM_CONNECTIVITY",
      providerName: "Instagram OSINT Connection",
      authoritative: false,
      operationalMode: "CONNECTIVITY_ONLY",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: false,
      notes: "Alcance de red; no produce observacion Instagram.",
    },
    {
      sourceFamily: "NEWS_API",
      routeId: "newsapi.everything",
      providerId: "NEWS_API",
      action: "search",
      sourceType: "NEWS_ARTICLE",
      providerName: "NewsAPI - Radar de Medios",
      authoritative: false,
      operationalMode: newsApiAvailability === "AVAILABLE" ? "PRODUCTIVE_OBSERVED" : "NOT_CONFIGURED",
      availability: newsApiAvailability,
      selectedForProductiveAcquisition: newsApiAvailability === "AVAILABLE",
      notes: "Adquisicion observada server-side mediante /v2/everything con limite por barrido.",
    },
    {
      sourceFamily: "GDELT_DOC",
      routeId: "gdelt.doc.v2",
      providerId: "GDELT_DOC_2",
      action: "search",
      sourceType: "NEWS_DOCUMENT",
      providerName: "GDELT Document Intelligence",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Busqueda documental publica GDELT DOC 2.0; no sintetiza articulos.",
    },
    {
      sourceFamily: "GDELT_CONTEXT",
      routeId: "gdelt.context.v2",
      providerId: "GDELT_CONTEXT_2",
      action: "search",
      sourceType: "NEWS_CONTEXT",
      providerName: "GDELT Context Intelligence",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Contexto textual entregado por GDELT; no completa ni reconstruye contenido.",
    },
    {
      sourceFamily: "GDELT_GEO",
      routeId: "gdelt.geo.v2",
      providerId: "GDELT_GEO_2",
      action: "search",
      sourceType: "MENTIONED_LOCATION",
      providerName: "GDELT GEO Intelligence",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Geografia mencionada en cobertura; no se promueve automaticamente a ubicacion del evento.",
    },
    {
      sourceFamily: "BLUESKY",
      routeId: "bluesky.search-posts",
      providerId: "BLUESKY_PUBLIC_APPVIEW",
      action: "search",
      sourceType: "SOCIAL_POST",
      providerName: "Bluesky Public Intelligence",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Lectura publica oficial de app.bsky.feed.searchPosts sin inferencia geografica.",
    },
    {
      sourceFamily: "FEDIVERSE",
      routeId: "fediverse.governed-instances",
      providerId: "FEDIVERSE_MASTODON",
      action: "search",
      sourceType: "FEDIVERSE_STATUS",
      providerName: "Fediverse Intelligence",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Consulta por instancia gobernada; no declara una busqueda global de Mastodon.",
    },
    {
      sourceFamily: "OFFICIAL_CEIPOL",
      routeId: "ceipol.official-sources",
      providerId: "CEIPOL_OFFICIAL_SOURCES",
      action: "search",
      sourceType: "OFFICIAL_PUBLICATION",
      providerName: "Fuentes Oficiales CEIPOL",
      authoritative: false,
      operationalMode: "PRODUCTIVE_OBSERVED",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: true,
      notes: "Registro explicito de endpoints oficiales publicos verificables, sin autenticacion ni evasion.",
    },
    {
      sourceFamily: "OSINT_CONNECTIVITY",
      routeId: "osint.ping",
      providerId: "CEIPOL_OSINT_CONNECTIVITY",
      sourceType: "CONNECTIVITY_HEALTHCHECK",
      providerName: "CEIPOL OSINT Connectivity Healthcheck",
      authoritative: false,
      operationalMode: "CONNECTIVITY_ONLY",
      availability: "AVAILABLE",
      selectedForProductiveAcquisition: false,
      notes: "Ping tecnico; nunca es inteligencia observada.",
    },
  ];
}

export function getSourceFamilyRoutes(
  sourceFamily: SourceFamily,
  options?: { scinceReadiness?: ScinceRouteReadiness }
): SourceRouteDescriptor[] {
  return getSourceRoutes(options).filter((route) => route.sourceFamily === sourceFamily);
}

export function selectAuthoritativeRoute(
  sourceFamily: SourceFamily,
  options?: { scinceReadiness?: ScinceRouteReadiness }
): SourceRouteDescriptor | null {
  return (
    getSourceFamilyRoutes(sourceFamily, options).find(
      (route) =>
        route.authoritative &&
        route.operationalMode === "AUTHORITATIVE_PRODUCTIVE" &&
        route.availability === "AVAILABLE" &&
        route.selectedForProductiveAcquisition
    ) ?? null
  );
}

export function classifyEpistemicSource(params: {
  providerId?: string | null;
  sourceType?: string | null;
  acquisitionMode?: string | null;
}): SourceRouteDescriptor | null {
  const providerId = params.providerId ?? "";
  const sourceType = params.sourceType ?? "";
  const acquisitionMode = params.acquisitionMode ?? "";

  if (providerId === "INEGI_DENUE" || sourceType === "DENUE") {
    return selectAuthoritativeRoute("DENUE") ?? getSourceFamilyRoutes("DENUE")[0] ?? null;
  }
  if (providerId === "INEGI" && sourceType === "INEGI_TERRITORIAL_CPV2020" && acquisitionMode === "OBSERVED") {
    return getSourceFamilyRoutes("SCINCE")
      .find((route) => route.routeId === "inegi.territorial.local-postgis") ?? null;
  }
  if (providerId === "SCINCE_LOCAL_SIMULATOR" || acquisitionMode === "SIMULATED") {
    return getSourceFamilyRoutes("SCINCE").find((route) => route.operationalMode === "SIMULATED") ?? null;
  }
  if (providerId === "GEMINI" && sourceType === "TELEGRAM_CONTEXT") {
    return getSourceFamilyRoutes("TELEGRAM").find((route) => route.operationalMode === "AI_GENERATED") ?? null;
  }
  if (providerId === "CEIPOL_OSINT_CONNECTIVITY" || acquisitionMode === "CONNECTIVITY_ONLY") {
    return getSourceFamilyRoutes("OSINT_CONNECTIVITY")[0] ?? null;
  }

  return null;
}
