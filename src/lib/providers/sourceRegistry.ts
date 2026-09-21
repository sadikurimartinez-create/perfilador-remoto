export type SourceFamily =
  | "DENUE"
  | "SCINCE"
  | "TELEGRAM"
  | "X"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "OSINT_CONNECTIVITY";

export type SourceOperationalMode =
  | "AUTHORITATIVE_PRODUCTIVE"
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
