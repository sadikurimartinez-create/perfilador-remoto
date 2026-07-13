import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import {
  ReportContext,
  ExecutiveSummaryPrompt,
  TerritorialAnalysisPrompt,
  HypothesisPrompt,
  MapsInterpretationPrompt,
  GraphAnalysisPrompt,
  EvidenceAnalysisPrompt,
  StreetViewIntelligencePrompt,
  OSINTAnalysisPrompt,
  GangAnalysisPrompt,
  HIGGraphPrompt,
  OperationalConclusionPrompt
} from "@/prompts/reportEnginePrompts";
import { StatisticalIntelligenceEngine } from "@/utils/statisticalIntelligenceEngine";

export const runtime = "nodejs";
export const maxDuration = 60;

function simplifyOsintData(data: any): any {
  if (!data) return "Sin información OSINT.";
  if (typeof data === "string") return data.slice(0, 1000);
  if (Array.isArray(data)) {
    return data.slice(0, 3).map((item: any) => ({
      title: item.title || item.titulo || "",
      snippet: item.snippet || item.resumen || item.description || ""
    }));
  }
  if (typeof data === "object") {
    const list = data.results || data.articles || data.news || data.items;
    if (Array.isArray(list)) {
      return list.slice(0, 3).map((item: any) => ({
        title: item.title || item.titulo || "",
        snippet: item.snippet || item.resumen || item.description || ""
      }));
    }
  }
  return JSON.stringify(data).slice(0, 1000);
}

function simplifySweeps(sweeps: any[]): any[] {
  if (!Array.isArray(sweeps)) return [];
  return sweeps.slice(0, 5).map(s => ({
    engine: s.engine || "",
    source: s.source || "",
    data: typeof s.data === "string" ? s.data.slice(0, 300) : ""
  }));
}

async function callGeminiRestApi(prompt: string, modelName: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15 }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini REST API returned ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini REST API.");
  return text;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const safeBody = { ...body };

    const projectName = safeBody.projectName || "EXPEDIENTE TÁCTICO INDETERMINADO";
    const projectId = safeBody.projectId || "EXP-2026-XXXXX";
    const projectDescription = safeBody.projectDescription || "Aguascalientes, Ags";
    const radius = safeBody.analysisRadius || 250;
    const geometry = safeBody.geometryType || "individual";
    const chapter = safeBody.chapter || 1;
    const lat = parseFloat(String(safeBody.lat ?? safeBody.latitude ?? "0"));
    const lng = parseFloat(String(safeBody.lng ?? safeBody.longitude ?? "0"));

    // Calcular SIE
    const sieData = StatisticalIntelligenceEngine.analyze(
      safeBody.incidenciaCompleta || [],
      lat,
      lng,
      radius
    );

    // 1. Deducir riesgo general a nivel de código basado en el riesgo territorial del SIE
    let generalRisk = "MEDIO";
    if (sieData.predictivo.indiceRiesgoTerritorial >= 75) {
      generalRisk = "CRÍTICO";
    } else if (sieData.predictivo.indiceRiesgoTerritorial >= 50) {
      generalRisk = "ALTO";
    } else if (sieData.predictivo.indiceRiesgoTerritorial >= 20) {
      generalRisk = "MEDIO";
    } else {
      generalRisk = "BAJO";
    }

    // 2. Construir el contexto simplificado para los prompts modulares
    const ctx: ReportContext = {
      projectName,
      projectId,
      projectDescription,
      analysisRadius: radius,
      geometryType: geometry,
      focusAreas: safeBody.focusAreas,
      incidenciaLocal: safeBody.incidenciaLocal
        ? safeBody.incidenciaLocal.slice(0, 45).map((c: any) => ({
            delito: c.INCIDENTE || c.tipo || c.delito || "Delito",
            distancia: c.distancia_m || c.distancia || 0,
            fecha: c.FECHA || c.fecha || ""
          }))
        : [],
      bibliografiaLocal: typeof safeBody.bibliografiaLocal === "string" ? safeBody.bibliografiaLocal.slice(0, 500) : "",
      multimodalContext: typeof safeBody.multimodalContext === "string" ? safeBody.multimodalContext.slice(0, 500) : "",
      osintEngineData: simplifyOsintData(safeBody.osintEngineData),
      streetViews: safeBody.streetViews ? safeBody.streetViews.slice(0, 5) : [],
      datosGobMxData: null,
      linkedGangReport: safeBody.linkedGangReport,
      sweeps: simplifySweeps(safeBody.sweeps),
      sweepsComments: typeof safeBody.sweepsComments === "string" ? safeBody.sweepsComments.slice(0, 500) : "",
      photos: safeBody.photos ? safeBody.photos.slice(0, 5).map((p: any) => ({ ...p, dataUrl: "" })) : [],
      analysisContext: typeof safeBody.analysisContext === "string" ? safeBody.analysisContext.slice(0, 800) : "",
      sieData
    };

    // 3. Obtener el prompt del capítulo específico
    let sectionPrompt = "";
    if (chapter === 1) {
      sectionPrompt = ExecutiveSummaryPrompt(ctx);
    } else if (chapter === 2) {
      sectionPrompt = TerritorialAnalysisPrompt(ctx);
    } else if (chapter === 3) {
      sectionPrompt = HypothesisPrompt(ctx);
    } else if (chapter === 4) {
      sectionPrompt = MapsInterpretationPrompt(ctx);
    } else if (chapter === 5) {
      sectionPrompt = GraphAnalysisPrompt(ctx);
    } else if (chapter === 6) {
      sectionPrompt = EvidenceAnalysisPrompt(ctx);
    } else if (chapter === 7) {
      sectionPrompt = StreetViewIntelligencePrompt(ctx);
    } else if (chapter === 8) {
      sectionPrompt = OSINTAnalysisPrompt(ctx);
    } else if (chapter === 9) {
      sectionPrompt = GangAnalysisPrompt(ctx);
    } else if (chapter === 10) {
      sectionPrompt = HIGGraphPrompt(ctx);
    } else {
      sectionPrompt = OperationalConclusionPrompt(ctx);
    }

    // 4. Armar el System Prompt / Prompt Maestro para el capítulo
    const currentChapterLabel = 
      chapter === 1 ? 'PORTADA Y EXECUTIVE SUMMARY' :
      chapter === 2 ? 'CAPÍTULO 1: CONTEXTO DEL ANÁLISIS' :
      chapter === 3 ? 'CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL' :
      chapter === 4 ? 'CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO' :
      chapter === 5 ? 'CAPÍTULO 4: ANÁLISIS ESTADÍSTICO' :
      chapter === 6 ? 'CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA' :
      chapter === 7 ? 'CAPÍTULO 6: STREET VIEW INTELLIGENCE' :
      chapter === 8 ? 'CAPÍTULO 7: INTELIGENCIA OSINT' :
      chapter === 9 ? 'CAPÍTULO 8: ACTORES TERRITORIALES Y PANDILLAS' :
      chapter === 10 ? 'CAPÍTULO 9: GRAFO DE HIPÓTESIS HIG 2.0' :
      'CAPÍTULO 10: CONCLUSIONES OPERATIVAS';

    const systemPrompt = `
Actúa como el motor Antigravity de geointeligencia institucional de la SSPE-CEIPOL.
Tu objetivo es generar la sección **${currentChapterLabel}** (Sección ${chapter} de 11) del INFORME EJECUTIVO DE GEOINTELIGENCIA.

REGLAS EDITORIALES:
1. Divide claramente las afirmaciones entre: Hecho observado, Inferencia analítica y Recomendación operativa.
2. Utiliza un lenguaje estrictamente formal e institucional. Queda terminantemente prohibido incluir nombres de procesos técnicos internos, APIs, PowerUps, logs, scripts o instrucciones de programación.
3. Todas las conclusiones deben poder justificarse con las fuentes del expediente (mapas, fotos, incidencias, OSINT).
4. El reporte debe estructurarse con títulos numerados con "##".

Escribe el informe siguiendo exactamente esta sección:
## ${chapter}. ${currentChapterLabel}

${sectionPrompt}

Escribe la salida en formato Markdown limpio. Devuelve ÚNICA Y EXCLUSIVAMENTE esta sección en Markdown, sin agregar explicaciones previas ni encerrarlo en bloques de código triple comilla (\`\`\`).
`.trim();

    // 5. Llamada a VertexAI (Gemini) en modo Streaming
    const useVertexAI = !!GCP_PRIVATE_KEY && GCP_PRIVATE_KEY.trim() !== "";
    let streamingResp: any = null;
    
    if (useVertexAI) {
      try {
        const authOptions = {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        };
        const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
        const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
        streamingResp = await model.generateContentStream({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.15 }
        });
      } catch (vertexInitErr: any) {
        console.warn("[api/generate-profile] Vertex AI initialization failed, falling back to REST API:", vertexInitErr.message);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Enviar un espacio en blanco inmediatamente para evitar el Timeout (504) de Vercel
        controller.enqueue(encoder.encode(" "));

        const metaPart = JSON.stringify({
          riskLevel: generalRisk.toLowerCase(),
          summary: `Dictamen táctico del expediente con enfoque en Criminología Ambiental. Nivel de riesgo sugerido: ${generalRisk}.`,
          incidenciaDetalles: safeBody.incidenciaLocal || [],
          pois: [],
          inegiDemographics: null,
          tacticalStreetViews: safeBody.streetViews || [],
          sieData: sieData
        });
        
        // Enviar el inicio del JSON (el navegador tolera el espacio en blanco inicial)
        const jsonStart = `{"meta":${metaPart},"markdown":"`;
        controller.enqueue(encoder.encode(jsonStart));

        // Mantener activo el stream enviando pulsos en caso de cualquier micro-retraso
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(" "));
          } catch {}
        }, 3000);

        try {
          if (streamingResp) {
            let hasCleanedMarkdownHeader = false;
            for await (const item of streamingResp.stream) {
              if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                let text = item.candidates[0].content.parts[0].text;
                
                if (!hasCleanedMarkdownHeader) {
                  if (text.startsWith("```markdown")) {
                    text = text.replace(/^```markdown\s*/i, "");
                    hasCleanedMarkdownHeader = true;
                  } else if (text.startsWith("```")) {
                    text = text.replace(/^```\s*/, "");
                    hasCleanedMarkdownHeader = true;
                  }
                }

                const escapedText = JSON.stringify(text).slice(1, -1);
                controller.enqueue(encoder.encode(escapedText));
              }
            }
          } else {
            // Fallback to REST API
            const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
            if (!apiKey) {
              throw new Error("No se configuró la variable GEMINI_API_KEY ni credenciales válidas de Vertex AI.");
            }
            console.log("[api/generate-profile] Calling Gemini REST API...");
            const textResult = await callGeminiRestApi(systemPrompt, GEMINI_MODEL, apiKey);
            let cleanedText = textResult;
            if (cleanedText.startsWith("```markdown")) {
              cleanedText = cleanedText.replace(/^```markdown\s*/i, "");
            } else if (cleanedText.startsWith("```")) {
              cleanedText = cleanedText.replace(/^```\s*/, "");
            }
            if (cleanedText.endsWith("```")) {
              cleanedText = cleanedText.slice(0, -3);
            }
            const escapedText = JSON.stringify(cleanedText).slice(1, -1);
            controller.enqueue(encoder.encode(escapedText));
          }
        } catch (e: any) {
          console.error("Error generating AI content:", e);
          const errorMsg = "\\n\\n[Error de generación: " + e.message + "]";
          controller.enqueue(encoder.encode(errorMsg));
        } finally {
          clearInterval(keepAlive);
          // Cerrar el string del markdown y el JSON
          controller.enqueue(encoder.encode('"}'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform, must-revalidate"
      }
    });
  } catch (err: any) {
    console.error("[api/generate-profile] General error:", err);
    return NextResponse.json(
      { error: "Error al generar el dictamen táctico con inteligencia artificial.", details: err.message },
      { status: 500 }
    );
  }
}
