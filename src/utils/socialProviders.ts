"use server";

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const REDDIT_USER_AGENT =
  process.env.PGP_REDDIT_USER_AGENT || process.env.NEXT_PUBLIC_PGP_REDDIT_USER_AGENT || "";

const X_BEARER =
  process.env.PGP_X_BEARER_TOKEN || process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN || process.env.PGP_X_ACCESS_TOKEN || process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN || "";

const TELEGRAM_TOKEN =
  process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_PGP_TELEGRAM_BOT_TOKEN || "";

// Claves para Vertex AI Search (Discovery Engine)
const DISCOVERY_PROJECT_ID = process.env.PGP_DISCOVERY_PROJECT_ID || process.env.NEXT_PUBLIC_PGP_DISCOVERY_PROJECT_ID || "";
const DISCOVERY_LOCATION = process.env.PGP_DISCOVERY_LOCATION || process.env.NEXT_PUBLIC_PGP_DISCOVERY_LOCATION || "";
const DISCOVERY_ENGINE_ID = process.env.PGP_DISCOVERY_ENGINE_ID || process.env.NEXT_PUBLIC_PGP_DISCOVERY_ENGINE_ID || "";
const DISCOVERY_API_KEY = process.env.PGP_DISCOVERY_API_KEY || process.env.NEXT_PUBLIC_PGP_DISCOVERY_API_KEY || "";

// Claves para Vertex AI (Análisis de Inteligencia)
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_GCP_PROJECT_ID || "";
const GCP_LOCATION = process.env.GCP_LOCATION || process.env.NEXT_PUBLIC_GCP_LOCATION || "us-central1";
const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export const buscarEnWebOSINT = async (query: string) => {
  if (!DISCOVERY_PROJECT_ID || !DISCOVERY_LOCATION || !DISCOVERY_ENGINE_ID || !DISCOVERY_API_KEY) {
    console.warn("Configuración de Vertex AI Search (Discovery Engine) incompleta. Omitiendo búsqueda OSINT web. El semáforo debe estar en rojo o amarillo.");
    return { resultadosWeb: [], analisisInteligencia: null };
  }

  // La API Key se pasa como parámetro `key` en la URL, que es el método estándar para REST APIs de Google.
  const url = `https://discoveryengine.googleapis.com/v1/projects/${DISCOVERY_PROJECT_ID}/locations/${DISCOVERY_LOCATION}/engines/${DISCOVERY_ENGINE_ID}/servingConfigs/default_search:search?key=${DISCOVERY_API_KEY}`;

  const payload = {
    query,
    pageSize: 10,
    queryExpansionSpec: { condition: "AUTO" },
    spellCorrectionSpec: { mode: "AUTO" },
    contentSearchSpec: {
      summaryResultCount: 3,
      extractiveContentSpec: { maxExtractiveAnswerCount: 1 },
    },
  };

  try {
    console.log(`[WEB OSINT] 🚀 Buscando en Discovery Engine: "${query}"`);
    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });

    const results = response.data?.results || [];
    console.log(`[WEB OSINT] ✅ Búsqueda completada. ${results.length} resultados obtenidos. El semáforo se puede poner en verde.`);

    const formattedResults = results.map((res: any) => {
      const doc = res.document?.derivedStructData?.fields || {};
      const snippet = doc.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet?.stringValue || "No hay resumen disponible.";
      return { title: doc.title?.stringValue || "Sin título", link: doc.link?.stringValue || "#", snippet };
    });

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
      } catch (vertexError: any) {
        console.error("ERROR EN ANÁLISIS VERTEX AI:", vertexError.response?.data?.error?.message || vertexError.message);
      }
    }

    return { resultadosWeb: formattedResults, analisisInteligencia };
  } catch (error: any) {
    console.error("DISCOVERY ENGINE ERROR:", error.response?.data?.error?.message || error.message);
    return { resultadosWeb: [], analisisInteligencia: null };
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

  } catch (error) {

    console.error(
      'REDDIT ERROR',
      error
    );

    return [];

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

  } catch (error) {
    console.error(
      'TELEGRAM ERROR',
      error
    );
    return [];
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

  } catch (error) {

    console.error(
      'X/TWITTER ERROR',
      error
    );

    return [];

  }

};