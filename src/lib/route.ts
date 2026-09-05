export const runtime = "nodejs";
export const maxDuration = 60; // 60s para lectura y análisis pesado

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { getRegionalRSSFeeds } from "@/lib/osintSources";

export const LEGACY_OSINT_ROUTE_METADATA = {
  acquisitionMode: "LEGACY",
  acquisitionStatus: "ACQUIRED",
  semanticRole: "DIAGNOSTIC",
  validationStatus: "PENDING_REVIEW",
  isDerived: true,
  providerId: "LEGACY_OSINT_ROUTE",
  sourceId: "src-lib-route",
  sourceType: "EXPERIMENTAL_OSINT_AI_CORRELATION",
  sourceReference: "src/lib/route.ts",
  lineage: [],
};

// Función ultra-rápida para extraer títulos y descripciones de un XML crudo sin librerías pesadas
function parseRawRss(xmlText: string, sourceName: string, maxItems = 15) {
  const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
  return items.slice(0, maxItems).map(item => {
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || item.match(/<title>([\s\S]*?)<\/title>/i);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || item.match(/<description>([\s\S]*?)<\/description>/i);
    
    return {
      source: sourceName,
      title: titleMatch ? titleMatch[1].trim() : "Sin título",
      description: descMatch ? descMatch[1].replace(/(<([^>]+)>)/gi, "").trim().substring(0, 300) : "Sin descripción",
      acquisitionMode: "LEGACY",
      semanticRole: "DIAGNOSTIC",
      validationStatus: "PENDING_REVIEW",
      providerId: "LEGACY_OSINT_ROUTE_RSS",
      sourceId: sourceName,
      epistemicIntegrity: {
        ...LEGACY_OSINT_ROUTE_METADATA,
        providerId: "LEGACY_OSINT_ROUTE_RSS",
        sourceId: sourceName,
        providerName: sourceName,
        sourceType: "RSS_LEGACY_ROUTE_ITEM",
        generatedAt: new Date().toISOString(),
      },
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectContext, scinceData, denueData, historicalCrimes, region = "Aguascalientes" } = body;

    // 1. Recolectar feeds RSS regionales y nacionales relevantes
    const sources = getRegionalRSSFeeds(region);
    const fetchPromises = sources.map(async (src) => {
      try {
        const res = await fetch(src.url, { next: { revalidate: 300 } }); // Cache de 5 min
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRawRss(xml, src.name);
      } catch (err) {
        console.warn(`[OSINT] Falló lectura de RSS: ${src.name}`);
        return [];
      }
    });

    const resultsArray = await Promise.all(fetchPromises);
    const allNews = resultsArray.flat();

    if (allNews.length === 0) {
      return NextResponse.json({ success: false, message: "No se pudieron obtener noticias recientes." });
    }

    // Convertir a texto limpio para el prompt
    const newsText = allNews.map((n, i) => `Noticia ${i+1} [${n.source}]: ${n.title}\nDetalle: ${n.description}`).join("\n\n");

    // 2. FUSIÓN INTENSIVA EN VERTEX AI (GEMINI)
    // Aquí ocurre la interrelación e interconexión ordenada.
    const prompt = `
Eres el Motor Central de Fusión OSINT del Centro de Estudios en Seguridad Pública y Política Criminal (CEIPOL).
Tu tarea es realizar una CORRELACIÓN PROFUNDA (Deep Correlation) entre el flujo de noticias de código abierto (RSS) recientes y las bases de datos tácticas de la plataforma (SCINCE, DENUE, Crímenes).

--- BASES DE DATOS OPERACIONALES DEL POLÍGONO ---
CONTEXTO DEL PROYECTO:
${projectContext || "Sin contexto adicional"}

VULNERABILIDAD SOCIAL (INEGI SCINCE):
${JSON.stringify(scinceData || { info: "No provisto" })}

ATRACTORES ECONÓMICOS (INEGI DENUE):
${JSON.stringify(denueData || { info: "No provisto" })}

INCIDENCIA DELICTIVA HISTÓRICA:
${JSON.stringify(historicalCrimes || { info: "No provisto" })}

--- FLUJO OSINT RECIENTE (RSS) ---
${newsText}

INSTRUCCIÓN ESTRICTA:
1. Analiza TODAS las noticias y extrae únicamente los eventos vinculados a Seguridad, Violencia, Política Criminal, Riesgos Ambientales o Accidentes Graves.
2. Busca INTERCONEXIONES: ¿Alguna de estas noticias ocurre cerca de los negocios del DENUE? ¿Coincide con el tipo de incidencia histórica de la zona? ¿Se agrava por los datos de marginación del SCINCE?
3. Extrae Entidades Clave de las noticias: Ubicaciones (municipios/colonias), Personas, Vehículos.

DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN JSON VÁLIDO CON EL SIGUIENTE FORMATO:
{
  "totalNoticiasLeidas": ${allNews.length},
  "eventosCriticos": [
    { "titulo": "...", "fuente": "...", "entidadesDetectadas": ["lugar", "persona"], "resumenTactico": "..." }
  ],
  "correlacionPlataforma": {
    "conexionDenue": "Explica si las noticias tienen relación con los giros económicos presentes.",
    "conexionScince": "Explica cómo la marginación de la zona cruza con los eventos recientes.",
    "conexionHistorica": "Compara las noticias de hoy con los delitos pasados en la zona."
  },
  "conclusionOperativa": "Un párrafo tajante sobre el riesgo actual combinando todo."
}
`;

    const authOptions = GCP_PRIVATE_KEY ? { credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n") } } : undefined;
    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    });

    const rawResponse = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedResponse = JSON.parse(rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim());

    return NextResponse.json({
      success: true,
      institutionalUse: "BLOCKED_LEGACY_DIAGNOSTIC_NO_LINEAGE",
      epistemicIntegrity: {
        ...LEGACY_OSINT_ROUTE_METADATA,
        providerName: "Legacy OSINT RSS Parser",
        generatedAt: new Date().toISOString(),
        resultCount: allNews.length,
      },
      data: {
        ...parsedResponse,
        institutionalUse: "BLOCKED_LEGACY_DIAGNOSTIC_NO_LINEAGE",
        epistemicIntegrity: {
          ...LEGACY_OSINT_ROUTE_METADATA,
          providerName: "Legacy OSINT RSS Parser Gemini Output",
          generatedAt: new Date().toISOString(),
          resultCount: Array.isArray(parsedResponse?.eventosCriticos) ? parsedResponse.eventosCriticos.length : null,
        },
      },
      rawNews: allNews,
    });

  } catch (error: any) {
    console.error("[OSINT RSS Parser] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      institutionalUse: "BLOCKED_LEGACY_DIAGNOSTIC_NO_LINEAGE",
      epistemicIntegrity: {
        ...LEGACY_OSINT_ROUTE_METADATA,
        acquisitionStatus: "FAILED",
        providerName: "Legacy OSINT RSS Parser",
        generatedAt: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
