import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectContext, region } = body;

    // 1. Obtener noticias locales vía Google News RSS
    const query = encodeURIComponent(`seguridad OR policia OR crimen OR violencia ${region || "Aguascalientes"}`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=es-419&gl=MX&ceid=MX:es-419`;
    
    let rssText = "";
    try {
      const rssRes = await fetch(rssUrl);
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        rssText = items.slice(0, 15).map(item => {
          const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
          const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
          const source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "";
          return `- ${title.replace(/<!\[CDATA\[|\]\]>/g, '')} (${source} - ${pubDate})`;
        }).join("\n");
      }
    } catch (e) {
      console.warn("Fallo al obtener RSS local.", e);
    }

    // 2. Preparar el Prompt para la IA
    const prompt = `
Eres un Analista de Inteligencia OSINT adscrito al CEIPOL.
Tu tarea es correlacionar las noticias recientes de seguridad con la hipótesis operativa del investigador.

Hipótesis del Investigador (Contexto del Proyecto):
"""
${projectContext || "Sin contexto proporcionado."}
"""

Titulares de Noticias Recientes (RSS Extraído):
"""
${rssText || "Busca en la web las noticias policiales más recientes de " + (region || "Aguascalientes") + "."}
"""

Analiza estrictamente si los eventos recientes en las noticias confirman o agravan los riesgos descritos en la hipótesis.

Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura exacta:
{
  "success": true,
  "data": {
    "eventosCriticos": [
      { "titulo": "Título de la noticia", "fuente": "Medio", "resumenTactico": "Por qué es relevante para el polígono" }
    ],
    "totalNoticiasLeidas": <numero de noticias procesadas>,
    "correlacionPlataforma": {
      "conexionDenue": "Relación con negocios/giros mencionados en la hipótesis",
      "conexionScince": "Relación con la demografía de la zona",
      "conexionHistorica": "Relación con el historial delictivo"
    },
    "conclusionOperativa": "Conclusión táctica directa en 2 líneas."
  }
}
`.trim();

    if (!GCP_PROJECT_ID) throw new Error("GCP_PROJECT_ID no está configurado.");
    const authOptions = GCP_PRIVATE_KEY ? { credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n") } } : undefined;
    
    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL, tools: [{ googleSearch: {} } as any] });
    
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } });
    const cleanText = (result.response.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return NextResponse.json(JSON.parse(cleanText));
  } catch (error: any) {
    console.error("[RSS Parser API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
