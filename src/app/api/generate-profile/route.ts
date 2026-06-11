export const runtime = "nodejs";
export const maxDuration = 60; // Regresado a 60 para evitar error de Build en Vercel Hobby

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { buildStrategiesSummaryForTags } from "@/lib/tagStrategies";
import { generarPromptInformeFinal } from "@/prompts/informe-final";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!GCP_PROJECT_ID) {
      console.warn("[api/generate-profile] Falta GCP_PROJECT_ID");
      return NextResponse.json({ error: "Falta configuración de GCP (GCP_PROJECT_ID)" }, { status: 500 });
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
    
    const systemPrompt = buildSystemPrompt();
    
    // Extraer etiquetas/tipos de las fotos para inyectar estrategias
    const tags = body.album?.map((p: any) => p.tipo) || [];
    const strategies = buildStrategiesSummaryForTags(tags);

    // Limpieza de seguridad extrema para evitar que textos masivos ahoguen el modelo y causen 504 Timeout
    const safeBody = { ...body };
    if (Array.isArray(safeBody.photos)) {
      safeBody.photos = safeBody.photos.map((p: any) => {
        const { imageBase64, file, ...rest } = p;
        return rest;
      });
    }
    // Truncar arreglos gigantes de incidencia para no exceder tokens
    if (Array.isArray(safeBody.incidenciaLocal) && safeBody.incidenciaLocal.length > 30) {
      safeBody.incidenciaLocal = safeBody.incidenciaLocal.slice(0, 30);
    }

    // Extraer y formatear datos para el nuevo Prompt Maestro
    const datosVisionExtraidos = safeBody.photos?.map((p: any) => `[${p.tipo || 'Punto'}] ${p.comentario || 'Sin comentario'}`).join(" | ") || "Sin evidencia visual.";
    const incidenciaStr = Array.isArray(safeBody.incidenciaLocal) ? JSON.stringify(safeBody.incidenciaLocal) : "Sin datos de incidencia cercanos.";
    const osintRepuveData = safeBody.analysisContext || "Sin datos OSINT/Inteligencia registrados.";
    const clasificacionRiesgo = safeBody.projectDescription || "Pendiente de evaluación";
    
    const osintEngineStr = safeBody.osintEngineData 
      ? JSON.stringify({
          serp: safeBody.osintEngineData.serp?.slice(0, 3),
          news: safeBody.osintEngineData.news?.slice(0, 3),
          x: safeBody.osintEngineData.x?.slice(0, 3),
          reddit: safeBody.osintEngineData.reddit?.slice(0, 3),
          denue: safeBody.osintEngineData.denue?.length,
          places: safeBody.osintEngineData.googlePlaces?.length
        }) 
      : "Sin datos OSINT automáticos.";
    const streetViewsStr = (safeBody.streetViews && safeBody.streetViews.length > 0)
      ? safeBody.streetViews.map((sv: any) => `[StreetView] Ubicación: ${sv.name} | Coordenadas: ${sv.lat}, ${sv.lng}`).join(" | ")
      : "Sin barrido de StreetView.";

    const promptEstructura = generarPromptInformeFinal({
      visionAPI: datosVisionExtraidos,
      incidenciaCSV: incidenciaStr,
      placesVsDenue: "Comercios base (evaluar en terreno frente a registros).",
      osintRepuve: osintRepuveData,
      clasificacionRiesgo: clasificacionRiesgo,
      osintAutomatedSweep: osintEngineStr,
      streetViewsSweep: streetViewsStr
    });

    const prompt = `
INSTRUCCIONES DE SISTEMA (ADR):
${systemPrompt}

ESTRATEGIAS APLICABLES (CRIMINOLOGÍA AMBIENTAL):
${strategies}

INFORMACIÓN ADICIONAL DE CAMPO:
${JSON.stringify(safeBody, null, 2)}

INSTRUCCIÓN MAESTRA DEL INFORME:
${promptEstructura}

Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido. Asegúrate de incluir la clave "markdown" con todo este contenido estructurado.
MUY IMPORTANTE: Escapa los saltos de línea con \\n. NO uses saltos de línea reales dentro de la cadena JSON. Ejemplo:
{
  "markdown": "# RESUMEN EJECUTIVO\\n- Clasificación...",
  "meta": {
    "riskLevel": "alto"
  }
}
`;

    const streamingResp = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const stream = new ReadableStream({
      async start(controller) {
        // Pulso de vida para evitar el error 504 Timeout de Vercel
        controller.enqueue(new TextEncoder().encode(" "));
        const keepAlive = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(" "));
        }, 4000);

        try {
          let fullText = "";
          for await (const item of streamingResp.stream) {
            if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
              fullText += item.candidates[0].content.parts[0].text;
            }
          }
          
          let parsed;
          try {
            const cleanText = fullText.replace(/```json/gi, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanText);
          } catch (e) {
            console.error("[api/generate-profile] Error parseando JSON de Gemini:", e);
            let rawMarkdown = fullText;
            const match = fullText.match(/"markdown"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"meta"|}$)/);
            if (match && match[1]) {
               rawMarkdown = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            } else {
               rawMarkdown = fullText.replace(/^[\s\S]*?"markdown"\s*:\s*"/, '').replace(/"\s*}\s*$/, '').replace(/\\n/g, '\n');
            }
            parsed = { markdown: rawMarkdown }; 
          }

          controller.enqueue(new TextEncoder().encode(JSON.stringify(parsed)));
        } catch (err: any) {
          console.error("[api/generate-profile] Error AI Stream:", err);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ markdown: "Error interno de IA: " + err.message })));
        } finally {
          clearInterval(keepAlive);
          controller.close();
        }
      }
    });

    return new Response(stream, { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[api/generate-profile] Error:", err);
    return NextResponse.json(
      { error: "Error al generar el perfil de IA.", details: err.message },
      { status: 500 }
    );
  }
}