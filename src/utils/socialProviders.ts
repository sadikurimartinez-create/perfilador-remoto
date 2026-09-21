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
  process.env.PGP_REDDIT_USER_AGENT || process.env.REDDIT_USER_AGENT || "";

const X_BEARER =
  process.env.PGP_X_BEARER_TOKEN || process.env.PGP_X_ACCESS_TOKEN || process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";

const TELEGRAM_TOKEN =
  process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";

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
      if (!tokenResponse.token) throw new Error("TOKEN_UNAVAILABLE");
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
  } catch {
    console.error("[Street View] Image acquisition failed.");
    throw new Error("STREET_VIEW_IMAGE_REQUEST_FAILED");
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

  if (!REDDIT_USER_AGENT) {
    console.warn("REDDIT_USER_AGENT no configurado. Omitiendo búsqueda en Reddit.");
    return [];
  }

  try {

    const response =
      await axios.get(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              REDDIT_USER_AGENT,
          },
        }
      );

    return (
      response.data?.data?.children || []
    );

  } catch {
    console.error("[Reddit] Provider request failed.");

    throw new Error("REDDIT_REQUEST_FAILED");

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
    // Nota: La API oficial de Bots de Telegram lee mensajes de grupos/canales donde el bot es miembro.
    // Utilizamos getUpdates para recuperar los mensajes recientes que el bot ha captado.
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`
    );

    const updates = response.data?.result || [];

    // Filtramos localmente por la palabra clave (query) proporcionada
    const filtered = updates.filter((update: any) => {
      const text = update.message?.text || update.channel_post?.text || "";
      return text.toLowerCase().includes(query.toLowerCase());
    });

    return filtered.map((update: any) => {
      const msg = update.message || update.channel_post || {};
      return {
        texto: msg.text || "",
        chat: msg.chat?.title || msg.chat?.username || "Chat Monitorizado",
        fecha: new Date((msg.date || Math.floor(Date.now() / 1000)) * 1000).toLocaleString("es-MX")
      };
    });

  } catch {
    console.error("[Telegram] Provider request failed.");
    throw new Error("TELEGRAM_REQUEST_FAILED");
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

    return (
      response.data?.data || []
    );

  } catch {
    console.error("[X API] Provider request failed.");
    throw new Error("X_REQUEST_FAILED");

  }

};
