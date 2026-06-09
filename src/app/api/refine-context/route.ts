import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatCoord(n: number | null | undefined): string {
  return typeof n === "number" ? n.toFixed(5) : "N/A";
}

export async function POST(req: Request) {
  let requestMode: string | undefined;
  try {
    const body = await req.json();
    const { context, photos, mode, geometryType, projectDescription, region } = body;
    requestMode = mode;

    // ============================================================================
    // MÓDULO 1: FUSIÓN OSINT RSS (Bypass)
    // ============================================================================
    if (mode === "rss-news") {
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

      const promptRss = `
Eres un Analista de Inteligencia OSINT adscrito al CEIPOL.
Tu tarea es correlacionar las noticias recientes de seguridad con la hipótesis operativa del investigador.

Hipótesis del Investigador:
"""
${context || "Sin contexto proporcionado."}
"""

Titulares de Noticias Recientes (RSS Extraído):
"""
${rssText || "Busca en la web las noticias policiales más recientes de " + (region || "Aguascalientes") + "."}
"""

Analiza estrictamente si los eventos recientes en las noticias confirman o agravan los riesgos descritos en la hipótesis.

Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura exacta:
{ "success": true, "data": { "eventosCriticos": [ { "titulo": "Título de la noticia", "fuente": "Medio", "resumenTactico": "Por qué es relevante para el polígono" } ], "totalNoticiasLeidas": 15, "correlacionPlataforma": { "conexionDenue": "Relación con negocios", "conexionScince": "Relación demográfica", "conexionHistorica": "Relación historial" }, "conclusionOperativa": "Conclusión en 2 líneas." } }
`.trim();

      if (!GCP_PROJECT_ID) throw new Error("GCP_PROJECT_ID no está configurado.");
      const authOptions = GCP_PRIVATE_KEY ? { credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n") } } : undefined;
      const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
      const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL, tools: [{ googleSearch: {} } as any] });
      
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: promptRss }] }], generationConfig: { temperature: 0.2 } });
      const cleanText = (result.response.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let parsed = JSON.parse(cleanText);
      if (parsed.eventosCriticos && !parsed.data) parsed = { success: true, data: parsed };
      if (parsed.data && parsed.success === undefined) parsed.success = true;
      
      return NextResponse.json(parsed);
    }

    // ============================================================================
    // MÓDULO 2: AUDITORÍA Y SUGERENCIAS TÁCTICAS
    // ============================================================================
    const coordsText = photos && photos.length > 0
      ? photos.map((p: any, i: number) => `Foto ${i + 1}: [Lat: ${formatCoord(p.lat)}, Lng: ${formatCoord(p.lng)}] - Tipo: ${p.tipo} - Comentario: ${p.comentario}`).join("\n")
      : "Sin coordenadas/fotos enviadas.";

    let sysPrompt = "";
    if (mode === "hypothesis-qa") {
      sysPrompt = `Eres un sinodal y analista experto de la policía.
Evalúa la siguiente hipótesis del investigador. Si es muy básica, otórgale una calificación menor a 80 y genera 5 preguntas clave (questions) que el investigador debería responder para mejorarla. Si la hipótesis y el contexto agregado tienen buena lógica táctica, otorga 80 o más.
Geometría: ${geometryType} | Hipótesis actual:\n"""\n${context}\n"""
Devuelve ÚNICA Y EXCLUSIVAMENTE un JSON con: {"score": <número 0-100>, "suggestions": "<evaluación>", "questions": ["pregunta 1", "pregunta 2", "pregunta 3", "pregunta 4", "pregunta 5"]}`;
    } else if (mode === "validate-photos") {
      sysPrompt = `Eres un auditor táctico. Verifica si la selección de fotos es coherente con el análisis.
Contexto: """${context}""" \nCoordenadas:\n${coordsText}
Devuelve un JSON con: {"score": <0-100>, "suggestions": "<crítica constructiva>"}`;
    } else {
      sysPrompt = `Eres un analista de inteligencia redactando informes tácticos.
Mejora la redacción del siguiente contexto de evidencia de campo, dándole un tono profesional, policial y analítico.
Texto original: """${context}""" \nCoordenadas:\n${coordsText}
Devuelve un JSON con: {"score": <0-100 evaluando lógica original>, "suggestions": "<texto mejorado>"}`;
    }

    if (!GCP_PROJECT_ID) throw new Error("GCP_PROJECT_ID no está configurado.");
    const authOptions = GCP_PRIVATE_KEY ? { credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n") } } : undefined;
    
    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: sysPrompt.trim() }] }], generationConfig: { temperature: 0.2 } });
    const cleanText = (result.response.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return NextResponse.json(JSON.parse(cleanText));
  } catch (error: any) {
    console.error("[RSS Parser API] Error:", error);
    if (requestMode === "rss-news") {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ score: 0, suggestions: `Error del Servidor: ${error.message}` }, { status: 500 });
  }
}
