"use server";

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import {
  ExternalProviderError,
  classifyExternalFailure,
  classifyHttpFailure,
  invalidProviderResponse,
} from './externalProviderError';

const REDDIT_USER_AGENT =
  process.env.PGP_REDDIT_USER_AGENT || process.env.REDDIT_USER_AGENT || "PERFILADOR-REMOTO-SSPE-CEIPOL/1.0";
const REDDIT_BEARER =
  process.env.PGP_REDDIT_BEARER_TOKEN || process.env.REDDIT_BEARER_TOKEN || "";

const X_BEARER =
  process.env.PGP_X_BEARER_TOKEN || process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";

function sanitizeXProviderDescription(value: unknown, token: string): string | undefined {
  if (typeof value !== "string") return undefined;
  let sanitized = value.replace(/(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._~+/=-]+/gi, "[REDACTED_CREDENTIAL]");
  if (token.length >= 4) sanitized = sanitized.split(token).join("[REDACTED]");
  sanitized = sanitized.replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, 300) : undefined;
}

function xNativeErrorCode(data: any): string | undefined {
  const value = data?.errors?.[0]?.code ?? data?.code;
  const normalized = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof normalized !== "string" || !/^[A-Za-z0-9_.:-]{1,96}$/.test(normalized)) return undefined;
  return normalized;
}

function xApiFailure(error: unknown): ExternalProviderError {
  if (error instanceof ExternalProviderError) return error;

  const classified = classifyExternalFailure(error);
  const response = (error as any)?.response;
  const status = Number(response?.status);
  if (!Number.isFinite(status) || status <= 0) return classified;

  const data = response?.data;
  const providerDescription = sanitizeXProviderDescription(
    data?.detail ?? data?.errors?.[0]?.message ?? data?.title ?? data?.error?.message ?? data?.error,
    X_BEARER
  );
  return new ExternalProviderError({
    ...classified.failure,
    reason: status === 402 ? "ACCESS_RESTRICTED" : classified.failure.reason,
    httpStatus: status,
    technicalCode: `X_RECENT_SEARCH_${status}`,
    nativeErrorCode: xNativeErrorCode(data) ?? classified.failure.nativeErrorCode,
    providerDescription,
  });
}

const TELEGRAM_TOKEN =
  process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";

type TelegramBotOperation = "getMe" | "getWebhookInfo" | "getUpdates";

export interface TelegramBotRuntimeStatus {
  botTokenStatus: "BOT_TOKEN_MISSING" | "BOT_TOKEN_VALID";
  webhookStatus: "UNKNOWN" | "WEBHOOK_INACTIVE" | "WEBHOOK_ACTIVE";
  longPollingStatus: "NOT_CONFIGURED" | "LONG_POLLING_AVAILABLE" | "LONG_POLLING_BLOCKED";
}

function sanitizeTelegramDescription(value: unknown, token: string): string | undefined {
  if (typeof value !== "string") return undefined;
  let sanitized = value.replace(/https?:\/\/api\.telegram\.org\/bot[^\s/]+/gi, "[REDACTED_TELEGRAM_API]");
  sanitized = sanitized.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]");
  sanitized = sanitized.replace(/(TELEGRAM_(?:BOT_TOKEN|SESSION|API_HASH)\s*[=:]\s*)\S+/gi, "$1[REDACTED]");
  const sensitiveValues = [token, process.env.TELEGRAM_SESSION, process.env.TELEGRAM_API_HASH]
    .filter((secret): secret is string => Boolean(secret && secret.length >= 4));
  for (const secret of sensitiveValues) sanitized = sanitized.split(secret).join("[REDACTED]");
  sanitized = sanitized.replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, 300) : undefined;
}

function telegramApiFailure(
  operation: TelegramBotOperation,
  httpStatus: number,
  data: any,
  token: string
): ExternalProviderError {
  const telegramErrorCode = Number(data?.error_code);
  const hasTelegramErrorCode = Number.isFinite(telegramErrorCode) && telegramErrorCode > 0;
  const effectiveStatus = hasTelegramErrorCode ? telegramErrorCode : httpStatus;
  const providerDescription = sanitizeTelegramDescription(data?.description, token);

  if (operation === "getUpdates" && effectiveStatus === 409) {
    return new ExternalProviderError({
      reason: "WEBHOOK_CONFLICT",
      httpStatus,
      technicalCode: "TELEGRAM_WEBHOOK_CONFLICT",
      nativeErrorCode: hasTelegramErrorCode ? String(telegramErrorCode) : undefined,
      providerDescription,
    });
  }

  if (effectiveStatus >= 400) {
    const classified = classifyHttpFailure(effectiveStatus).failure;
    return new ExternalProviderError({
      ...classified,
      httpStatus,
      technicalCode: `TELEGRAM_${operation.toUpperCase()}_${effectiveStatus}`,
      nativeErrorCode: hasTelegramErrorCode ? String(telegramErrorCode) : undefined,
      providerDescription,
    });
  }

  return new ExternalProviderError({
    reason: "INVALID_RESPONSE",
    httpStatus,
    technicalCode: `TELEGRAM_${operation.toUpperCase()}_INVALID_RESPONSE`,
    nativeErrorCode: hasTelegramErrorCode ? String(telegramErrorCode) : undefined,
    providerDescription,
  });
}

async function callTelegramBotApi(operation: TelegramBotOperation): Promise<unknown> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${operation}`,
      { timeout: 10_000, validateStatus: () => true }
    );
    const httpStatus = Number(response.status ?? 200);
    if (httpStatus < 200 || httpStatus >= 300 || response.data?.ok === false) {
      throw telegramApiFailure(operation, httpStatus, response.data, TELEGRAM_TOKEN);
    }
    if (!response.data || typeof response.data !== "object" || response.data.ok !== true) {
      throw invalidProviderResponse();
    }
    return response.data.result;
  } catch (error) {
    if (error instanceof ExternalProviderError) throw error;
    const response = (error as any)?.response;
    const httpStatus = Number(response?.status);
    if (Number.isFinite(httpStatus) && httpStatus > 0) {
      throw telegramApiFailure(operation, httpStatus, response?.data, TELEGRAM_TOKEN);
    }
    throw classifyExternalFailure(error);
  }
}

export const inspectTelegramBotRuntime = async (): Promise<TelegramBotRuntimeStatus> => {
  if (!TELEGRAM_TOKEN) {
    return {
      botTokenStatus: "BOT_TOKEN_MISSING",
      webhookStatus: "UNKNOWN",
      longPollingStatus: "NOT_CONFIGURED",
    };
  }

  const bot = await callTelegramBotApi("getMe");
  if (!bot || typeof bot !== "object") throw invalidProviderResponse();
  const webhook = await callTelegramBotApi("getWebhookInfo");
  if (!webhook || typeof webhook !== "object" || typeof (webhook as any).url !== "string") {
    throw invalidProviderResponse();
  }
  const webhookActive = (webhook as any).url.trim().length > 0;
  return {
    botTokenStatus: "BOT_TOKEN_VALID",
    webhookStatus: webhookActive ? "WEBHOOK_ACTIVE" : "WEBHOOK_INACTIVE",
    longPollingStatus: webhookActive ? "LONG_POLLING_BLOCKED" : "LONG_POLLING_AVAILABLE",
  };
};

// Claves para Vertex AI Search (Discovery Engine)
const DISCOVERY_PROJECT_ID = process.env.PGP_DISCOVERY_PROJECT_ID || "";
const DISCOVERY_LOCATION = process.env.PGP_DISCOVERY_LOCATION || "";
const DISCOVERY_ENGINE_ID = process.env.PGP_DISCOVERY_ENGINE_ID || "";
const DISCOVERY_SERVING_CONFIG = process.env.PGP_DISCOVERY_SERVING_CONFIG || "default_search";
// Claves para Vertex AI (Análisis de Inteligencia)
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";

const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function discoveryText(value: any): string {
  return typeof value === "string" ? value : value?.stringValue || "";
}

function discoveryList(value: any): any[] {
  if (Array.isArray(value)) return value;
  return value?.listValue?.values || [];
}

function formatExtractiveAnswers(derived: any): any[] {
  const fields = derived.fields || {};
  const answers = discoveryList(derived.extractive_answers).length > 0
    ? discoveryList(derived.extractive_answers)
    : discoveryList(fields.extractive_answers);
  return answers.flatMap((answer: any) => {
    const fields = answer?.structValue?.fields || answer?.fields || {};
    const content = discoveryText(answer?.content) || discoveryText(fields.content) || discoveryText(answer?.pageContent) || discoveryText(fields.pageContent);
    const pageNumber = answer?.pageNumber ?? fields.pageNumber?.numberValue ?? fields.pageNumber?.integerValue ?? null;
    return content ? [{ content, pageNumber }] : [];
  });
}

function formatDiscoveryResults(results: any[], query: string, timestamp: string): any[] {
  return results.flatMap((result: any) => {
    const document = result?.document;
    if (!document || typeof document !== "object") return [];
    const derived = document.derivedStructData || {};
    const fields = derived.fields || {};
    const snippets = Array.isArray(derived.snippets) ? derived.snippets : null;
    const protobufSnippet = fields.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet;
    const title = discoveryText(derived.title) || discoveryText(fields.title) || "Sin título";
    const link = discoveryText(derived.link) || discoveryText(fields.link) || null;
    const extractiveAnswers = formatExtractiveAnswers(derived);
    return [{
      id: document.id || document.name || null,
      source: "Google Discovery Engine",
      title,
      link,
      snippet: discoveryText(snippets?.[0]?.snippet) || discoveryText(protobufSnippet) || "",
      extractiveAnswers,
      extractive_answers: extractiveAnswers,
      rankSignals: result.rankSignals ?? null,
      retrievalSignals: result.retrievalSignals ?? null,
      provenance: {
        project: DISCOVERY_PROJECT_ID,
        location: DISCOVERY_LOCATION,
        engine: DISCOVERY_ENGINE_ID,
        servingConfig: DISCOVERY_SERVING_CONFIG,
        query,
        timestamp,
        sourceUrl: link,
        documentName: document.name || null,
        documentId: document.id || null,
      },
    }];
  });
}

export const buscarEnWebOSINT = async (query: string) => {
  if (!DISCOVERY_PROJECT_ID || !DISCOVERY_LOCATION || !DISCOVERY_ENGINE_ID) {
    console.warn("Configuración de Vertex AI Search (Discovery Engine) incompleta. Omitiendo búsqueda OSINT web. El semáforo debe estar en rojo o amarillo.");
    return { resultadosWeb: [], analisisInteligencia: null };
  }

  const payload = {
    query,
    pageSize: 10,
    queryExpansionSpec: { condition: "AUTO" },
    spellCorrectionSpec: { mode: "AUTO" },
    contentSearchSpec: {
      summarySpec: { summaryResultCount: 3 },
      extractiveContentSpec: { maxExtractiveAnswerCount: 1 },
    },
  };

  try {
    console.log(`[WEB OSINT] 🚀 Generando token de acceso para Discovery Engine...`);
    
    // Autenticación con Google Cloud para Vertex AI Search
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    };
    if (GCP_CLIENT_EMAIL && GCP_PRIVATE_KEY) {
      authOptions.credentials = {
        client_email: GCP_CLIENT_EMAIL,
        private_key: GCP_PRIVATE_KEY,
      };
      authOptions.projectId = DISCOVERY_PROJECT_ID;
    }

    let token: string;
    try {
      const auth = new GoogleAuth(authOptions);
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) {
        throw new ExternalProviderError({ reason: "AUTH_FAILED", technicalCode: "GOOGLE_OAUTH_TOKEN_UNAVAILABLE" });
      }
      token = tokenResponse.token;
    } catch (error) {
      const oauthFailure = classifyExternalFailure(error).failure;
      const rejectedCredentials = oauthFailure.reason === "AUTH_FAILED" ||
        oauthFailure.reason === "INVALID_REQUEST" ||
        ["invalid_grant", "invalid_client", "unauthorized_client"].includes(oauthFailure.nativeErrorCode || "");
      throw new ExternalProviderError({
        ...oauthFailure,
        reason: rejectedCredentials ? "AUTH_FAILED" : oauthFailure.reason,
        technicalCode: rejectedCredentials ? "GOOGLE_OAUTH_REJECTED" : oauthFailure.technicalCode,
      });
    }

    if (!["global", "us", "eu"].includes(DISCOVERY_LOCATION)) {
      throw new ExternalProviderError({ reason: "INVALID_REQUEST", technicalCode: "INVALID_DISCOVERY_LOCATION" });
    }
    const discoveryHost = DISCOVERY_LOCATION === "global"
      ? "discoveryengine.googleapis.com"
      : `${DISCOVERY_LOCATION}-discoveryengine.googleapis.com`;
    const url = `https://${discoveryHost}/v1/projects/${DISCOVERY_PROJECT_ID}/locations/${DISCOVERY_LOCATION}/collections/default_collection/engines/${DISCOVERY_ENGINE_ID}/servingConfigs/${DISCOVERY_SERVING_CONFIG}:search`;

    console.log(`[WEB OSINT] 🚀 Buscando en Discovery Engine: "${query}"`);
    const response = await axios.post(url, payload, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      timeout: 15_000,
      validateStatus: () => true,
    });
    if (response.status < 200 || response.status >= 300) throw classifyHttpFailure(response.status);

    const responseData = response.data;
    if (!responseData || typeof responseData !== "object" || Array.isArray(responseData)) throw invalidProviderResponse();
    const rawResults = responseData.results;
    if (rawResults != null && !Array.isArray(rawResults)) throw invalidProviderResponse();
    const results = rawResults ?? [];
    console.log(`[WEB OSINT] ✅ Búsqueda completada. ${results.length} resultados obtenidos. El semáforo se puede poner en verde.`);

    const acquiredAt = new Date().toISOString();
    const formattedResults = formatDiscoveryResults(results, query, acquiredAt);
    const discoveryMetadata = {
      semanticState: responseData.semanticState ?? null,
      summary: responseData.summary ?? null,
      totalSize: responseData.totalSize ?? null,
      attributionToken: responseData.attributionToken ?? null,
      nextPageToken: responseData.nextPageToken ?? null,
      queryExpansionInfo: responseData.queryExpansionInfo ?? null,
      summaryEpistemicIntegrity: responseData.summary == null ? null : {
        providerId: "GOOGLE_DISCOVERY_ENGINE",
        acquisitionMode: "AI_GENERATED",
        semanticRole: "SYNTHESIS",
        isSimulated: false,
      },
    };

    let analisisInteligencia = null;

    if (formattedResults.length > 0 && GCP_PROJECT_ID) {
      console.log(`[WEB OSINT] 🧠 Enviando ${formattedResults.length} fragmentos a Vertex AI (${GEMINI_MODEL}) para análisis de inteligencia...`);
      try {
        const snippetsText = formattedResults.map((r: any) => `- ${r.snippet}`).join('\n');
        const prompt = `
Actúas como un analista de inteligencia. Realiza un análisis sobre el objetivo principal de búsqueda: "${query}", basado EXCLUSIVAMENTE en los siguientes fragmentos de texto obtenidos de la web:

--- FRAGMENTOS ---
${snippetsText}
------------------

Instrucciones:
1. Extrae nombres de personas mencionadas que no sean el objetivo principal (posibles vínculos).
2. Identifica menciones de antecedentes penales, procesos judiciales o noticias policiales.
3. Detecta organizaciones o empresas vinculadas al sujeto.
4. Genera un breve resumen de 'Perfil de Riesgo' basado exclusivamente en los hallazgos de la búsqueda.
5. Si no hay información para alguno de los puntos, devuelve un arreglo vacío [] o "Sin datos encontrados." según corresponda.

Devuelve la información ESTRICTAMENTE en formato JSON válido con esta estructura, sin bloques de código markdown:
{
  "vinculos": ["Nombre 1", "Nombre 2"],
  "antecedentesPoliciales": ["Mención 1", "Mención 2"],
  "organizacionesVinculadas": ["Org 1", "Empresa 2"],
  "perfilRiesgo": "Resumen del perfil..."
}
`;

        // Autenticación con Google Cloud para Vertex AI
        const authOptions: any = {
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        };
        // Usa las credenciales del env.local si existen, de lo contrario usará GOOGLE_APPLICATION_CREDENTIALS
        if (GCP_CLIENT_EMAIL && GCP_PRIVATE_KEY) {
          authOptions.credentials = {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY,
          };
          authOptions.projectId = GCP_PROJECT_ID;
        }

        const auth = new GoogleAuth(authOptions);
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse.token;

        const vertexUrl = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
        const vertexPayload = { 
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [
            {
              googleSearchRetrieval: {
                dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 }
              }
            }
          ],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        };

        const vertexResponse = await axios.post(vertexUrl, vertexPayload, { 
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } 
        });

        const geminiText = vertexResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        // Limpiamos los bloques ```json que Gemini a veces devuelve para parsearlo correctamente
        const cleanJsonText = geminiText.replace(/```json/g, "").replace(/```/g, "").trim();
        analisisInteligencia = JSON.parse(cleanJsonText);
        console.log(`[WEB OSINT] ✅ Análisis de inteligencia generado correctamente con Vertex AI.`);
      } catch (error) {
        const failure = classifyExternalFailure(error).failure;
        console.error(`[Discovery Engine] Vertex AI analysis failed (${failure.reason}); observed search results are preserved.`);
      }
    }

    return { resultadosWeb: formattedResults, analisisInteligencia, discoveryMetadata };
  } catch (error) {
    const classified = classifyExternalFailure(error);
    console.error(`[Discovery Engine] Provider request failed (${classified.failure.reason}).`);
    throw classified;
  }
};

export const analyzeStreetViewWithGemini = async (lat: number, lng: number) => {
  const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  if (!MAPS_KEY) return null;

  const headings = [0, 90, 180, 270];
  const svImages: string[] = [];
  
  try {
    for (const h of headings) {
      const url = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${h}&key=${MAPS_KEY}`;
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(res.data, 'binary').toString('base64');
      // Validamos que no sea la imagen genérica gris de "No image available"
      if (base64.length > 10000) svImages.push(base64);
    }
  } catch (error) {
    console.error("[Street View] Image acquisition failed.");
    throw classifyExternalFailure(error);
  }

  if (svImages.length === 0) return { analisis: null, imagenesBase64: [] };
  if (!GCP_PROJECT_ID) return { analisis: null, imagenesBase64: svImages };

  try {
    const authOptions: any = { scopes: ['https://www.googleapis.com/auth/cloud-platform'] };
    if (GCP_CLIENT_EMAIL && GCP_PRIVATE_KEY) {
      authOptions.credentials = { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY };
      authOptions.projectId = GCP_PROJECT_ID;
    }
    const auth = new GoogleAuth(authOptions);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const prompt = `Actúas como un perfilador criminológico analizando el entorno físico. Analiza estas imágenes de Street View capturadas en las coordenadas ${lat}, ${lng}. Identifica detalladamente: grafitis, zonas de abandono, poca iluminación, rutas de escape, o deterioro urbano (Teoría de las Ventanas Rotas). Redacta un reporte táctico conciso sobre los hallazgos visuales y cómo podrían facilitar oportunidades delictivas.`;

    const parts: any[] = [{ text: prompt }];
    svImages.forEach(img => {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
    });

    const vertexUrl = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
    const payload = { contents: [{ role: "user", parts }] };
    const response = await axios.post(vertexUrl, payload, { headers: { 'Authorization': `Bearer ${token}` } });
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se detectaron hallazgos relevantes en el entorno visual.";
    
    return { analisis: text, imagenesBase64: svImages };
  } catch {
    console.error("[Street View] Gemini analysis failed; observed images are preserved.");
    return { analisis: null, imagenesBase64: svImages };
  }
};

export const searchReddit = async (
  query: string
) => {

  if (!REDDIT_BEARER) {
    console.warn("REDDIT_BEARER_TOKEN no configurado. Omitiendo búsqueda en Reddit.");
    return [];
  }

  try {

    const response =
      await axios.get(
        `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': REDDIT_USER_AGENT,
            Authorization: `Bearer ${REDDIT_BEARER}`,
          },
        }
      );

    const children = response.data?.data?.children;
    if (!Array.isArray(children)) throw invalidProviderResponse();
    return children;

  } catch (error) {
    console.error("[Reddit] Provider request failed.");
    throw classifyExternalFailure(error);

  }

};

export const searchTelegram = async (
  query: string
) => {

  if (!TELEGRAM_TOKEN) {
    console.warn("Token de Telegram no configurado. Omitiendo búsqueda en Telegram.");
    return [];
  }

  try {
    const runtimeStatus = await inspectTelegramBotRuntime();
    if (runtimeStatus.longPollingStatus === "LONG_POLLING_BLOCKED") {
      throw new ExternalProviderError({
        reason: "WEBHOOK_CONFLICT",
        technicalCode: "TELEGRAM_WEBHOOK_ACTIVE",
        providerDescription: "Telegram reporta un webhook activo; getUpdates no está disponible.",
      });
    }

    // Bot API only exposes updates delivered to this bot; it is not a global Telegram search.
    const updates = await callTelegramBotApi("getUpdates");
    if (!Array.isArray(updates)) throw invalidProviderResponse();
    const queryTerms = query
      .split(/\s+OR\s+/i)
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);

    // Filtramos localmente por la palabra clave (query) proporcionada
    const filtered = updates.filter((update: any) => {
      const text = update.message?.text || update.channel_post?.text || "";
      const normalizedText = text.toLowerCase();
      return queryTerms.some((term) => normalizedText.includes(term));
    });

    return filtered.map((update: any) => {
      const msg = update.message || update.channel_post || {};
      return {
        texto: msg.text || "",
        chat: msg.chat?.title || msg.chat?.username || "Chat Monitorizado",
        fecha: Number.isFinite(Number(msg.date)) ? new Date(Number(msg.date) * 1000).toISOString() : null,
      };
    });

  } catch (error) {
    const classified = classifyExternalFailure(error);
    console.error("[Telegram] Provider request failed.", {
      reason: classified.failure.reason,
      status: classified.failure.httpStatus ?? null,
      telegramErrorCode: classified.failure.nativeErrorCode ?? null,
      technicalCode: classified.failure.technicalCode ?? null,
      description: classified.failure.providerDescription ?? null,
    });
    throw classified;
  }

};

export const searchX = async (
  query: string
) => {

  if (!X_BEARER) {
    console.warn("Tokens de X no configurados. Omitiendo búsqueda en X.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://api.twitter.com/2/tweets/search/recent',
        {
          headers: {
            Authorization:
              `Bearer ${X_BEARER}`,
          },

          params: {
            query,
            max_results: 10,
          },
        }
      );

    if (!response.data || typeof response.data !== "object" || Array.isArray(response.data)) throw invalidProviderResponse();
    const tweets = response.data.data;
    if (tweets != null && !Array.isArray(tweets)) throw invalidProviderResponse();
    return tweets ?? [];

  } catch (error) {
    const classified = xApiFailure(error);
    console.error("[X API] Provider request failed.", {
      reason: classified.failure.reason,
      status: classified.failure.httpStatus ?? null,
      technicalCode: classified.failure.technicalCode ?? null,
      nativeErrorCode: classified.failure.nativeErrorCode ?? null,
      providerDescription: classified.failure.providerDescription ?? null,
    });
    throw classified;

  }

};
