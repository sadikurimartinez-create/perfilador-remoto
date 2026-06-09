export const runtime = "nodejs";
export const maxDuration = 60; // Permitir hasta 60s en Vercel

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

type RefineBody = {
  context: string;
  photos?: { lat: number | null; lng: number | null; tipo?: string; comentario?: string }[];
  mode?: "suggest" | "audit" | "validate-photos" | "hypothesis-qa" | "rss-news";
  geometryType?: "individual" | "lineal" | "poligono";
  projectDescription?: string;
  region?: string;
};

function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(6);
}

export async function POST(req: Request) {
  let requestMode: string | undefined;
  try {
    const { context, photos, mode, geometryType, projectDescription, region } = (await req.json()) as RefineBody;
    requestMode = mode;

    // ============================================================================
    // MÓDULO DE FUSIÓN OSINT RSS (Integrado aquí para evitar errores 404 de Vercel)
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
      
      try {
        const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
        const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL, tools: [{ googleSearchRetrieval: {} }] });
        
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: promptRss }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } });
        const cleanText = (result.response.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let parsed = JSON.parse(cleanText);
        
        // En caso de que la IA olvide envolverlo en "data" y "success"
        if (parsed.eventosCriticos && !parsed.data) {
          parsed = { success: true, data: parsed };
        }
        if (parsed.data && parsed.success === undefined) {
          parsed.success = true;
        }
        return NextResponse.json(parsed);
        
      } catch (err: any) {
        return NextResponse.json({ success: false, error: "Error en IA OSINT: " + err.message }, { status: 500 });
      }
    }

    const coordsText =
      photos && photos.length > 0
        ? photos
            .map(
              (p, i) =>
                `Foto ${i + 1} [${p.tipo || "Sin tipo"}]: ${p.comentario || "Sin comentario"} - lat ${formatCoord(p.lat)}, lng ${formatCoord(p.lng)}`
            )
            .join("\n")
        : "No se proporcionaron coordenadas de fotos.";

    const cleanedContext = (context ?? "").trim();

    let geoInstruction = "";
    if (geometryType === "individual") {
      geoInstruction = "REGLA OPERACIONAL: El análisis es INDIVIDUAL (Nodal). Toda la atención, teorías y deducciones deben concentrarse ESTRICTAMENTE en el nodo principal de análisis. Busca atractores de riesgo, rutas hacia y desde el nodo, rutas de escape, lugares de acecho y fronteras directamente relacionadas.";
    } else if (geometryType === "lineal") {
      geoInstruction = "REGLA OPERACIONAL: El análisis es LINEAL (Corredor). Se enfoca en un TRAYECTO (ej. desde un origen a un destino). Identifica agresivamente riesgos a lo largo del corredor, incidentes de movilidad, cruce de vulnerabilidades (lotes baldíos, cantinas, pandillas) y dinámica temporal del desplazamiento.";
    } else if (geometryType === "poligono") {
      geoInstruction = "REGLA OPERACIONAL: El análisis es POLIGONAL (Zona). Se requiere un barrido intensivo y exhaustivo dentro del perímetro definido. Establece de manera particular los riesgos internos, dinámica de fronteras y focos de infección criminal contenidos en la zona.";
    }

    const descContext = projectDescription 
      ? `Directriz Inicial del Investigador (Dictado de voz - PUNTO DE PARTIDA OBLIGATORIO):\n"${projectDescription}"\n` 
      : "";

    let prompt = "";
    
    if (mode === "audit") {
      prompt = `
Eres un Auditor Experto en Criminología Ambiental adscrito al CEIPOL.
El investigador ha redactado la siguiente contextualización / hipótesis operativa:
"${cleanedContext.replace(/\n\n\(MUY IMPORTANTE: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO.*?\)/g, '')}"

${descContext}
${geoInstruction}

Instrucción:
Audita la lógica, objetividad y utilidad operativa de esta contextualización para un dictamen de Criminología Ambiental.
Evalúa de 0 a 100 qué tan técnica, lógica y aplicable es. Si el usuario señala cosas subjetivas, vagas, o sin contexto táctico, el score debe ser menor a 80.
Devuelve un objeto JSON estrictamente con este formato:
{
  "score": <número de 0 a 100 evaluando la efectividad>,
  "suggestions": "<Si score < 80: explica detalladamente por qué es deficiente y qué datos o teorías faltan de forma tajante. Si score >= 80: devuelve ÚNICAMENTE la versión auditada y mejorada, lista para ser insertada.>"
}
`.trim();
    } else if (mode === "validate-photos") {
      prompt = `
Eres un Auditor Experto en Criminología Ambiental.
El investigador ha capturado evidencia fotográfica y las ha contextualizado con los siguientes comentarios:
"${cleanedContext.replace(/\n\n\(MUY IMPORTANTE: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO.*?\)/g, '')}"

Instrucción:
Evalúa la lógica, utilidad operativa y objetividad de estas contextualizaciones fotográficas.
Si las descripciones son vagas, subjetivas o carecen de valor técnico (ej. "Aquí hay un ladrón", "lugar feo"), el score debe ser menor a 80.
Si las descripciones aportan datos sobre deterioro urbano, falta de controles, atractores de riesgo, o flujos de movilidad, el score será 80 o mayor.
Devuelve un objeto JSON estrictamente con este formato:
{
  "score": <número de 0 a 100 evaluando la efectividad de la contextualización>,
  "suggestions": "<Si score < 80: explica detalladamente por qué la evidencia falla y qué debe mejorar de forma tajante. Si score >= 80: indica brevemente 'Validación fotográfica exitosa.'>"
}
`.trim();
    } else if (mode === "hypothesis-qa") {
      const isSecondIteration = cleanedContext.includes("Respuestas a preguntas previas:");
      
      if (isSecondIteration) {
        // Bypass de IA para evitar bucles y ahorrar tiempo: Si ya respondió, aprobamos automáticamente.
        return NextResponse.json({ score: 90, questions: [] });
      }

      prompt = `
Eres un Auditor Experto en Criminología Ambiental adscrito al CEIPOL.
El analista redactó la siguiente hipótesis operativa:
"${cleanedContext.replace(/\n\n\(MUY IMPORTANTE:.*?\)/g, '')}"

Coordenadas aproximadas de las fotos:
${coordsText}

${descContext}
${geoInstruction}

Instrucción OBLIGATORIA:
Asigna siempre un score de 50. Genera EXACTAMENTE 5 preguntas enfocadas en solicitar precisiones descriptivas (cómo, cuándo, dónde) sobre el entorno que el analista observa.
REGLAS ESTRICTAS PARA LAS PREGUNTAS:
1. NO pidas estadísticas, estudios ni bases de datos. Deben ser sobre lo que el humano puede ver, oler o percibir.
2. NO repitas lo que ya se dijo en la hipótesis.
3. Formula las preguntas de tal modo que el analista pueda responder libremente, incluso si la respuesta es "No lo sé", "No aplica" o "No se observó".
Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido con este formato:
{"score": 50, "questions": ["pregunta 1", "pregunta 2", "pregunta 3", "pregunta 4", "pregunta 5"]}
`.trim();
    } else {
      prompt = `
Eres un Auditor Experto en Criminología Ambiental adscrito al CEIPOL. Un investigador necesita contexto operacional para un Perfil Criminológico Ambiental.

Contexto preliminar del analista:
"${cleanedContext.replace(/\n\n\(INSTRUCCIÓN DEL SISTEMA:.*?DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO.*?\)/g, '') || "(Vacío)"}"

Coordenadas aproximadas de las fotos:
${coordsText}

${descContext}
${geoInstruction}

Instrucción del sistema:
Evalúa de 0 a 100 qué tan útil y lógica es la contextualización.
Si detectas que el usuario solicita preguntas para refinar la hipótesis, devuelve las claves "score" y "questions" (arreglo de strings).
De lo contrario, devuelve "score" y "suggestions" (string con sugerencias profundas, tácticas y severas).
Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido.
`.trim();
    }

    if (!GCP_PROJECT_ID) {
      return NextResponse.json({ score: 100, suggestions: cleanedContext + "\n\n(Nota: Auditoría no disponible por falta de GCP_PROJECT_ID)" });
    }

    const authOptions = GCP_PRIVATE_KEY
      ? {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        }
      : undefined;

    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    // Extracción segura para Vertex AI
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      parsed = { score: 0, suggestions: "La respuesta de la IA no pudo ser interpretada. Revise su redacción: " + text };
    }
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[api/refine-context] Error:", err);
    
    const isAuthError = err.message?.includes("could not load the default credentials") || err.message?.includes("permission denied");
    
    if (requestMode === "rss-news") {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }

    return NextResponse.json({ 
      score: 0, 
      suggestions: `Error del Servidor: ${isAuthError ? "Problema con las credenciales de Google Cloud (GOOGLE_APPLICATION_CREDENTIALS)." : err.message || "Fallo en la comunicación con Vertex AI."} Verifique la terminal local para más detalles.`
    });
  }
}
