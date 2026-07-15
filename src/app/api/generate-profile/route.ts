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
import { StatisticalIntelligenceEngineV2 } from "@/utils/statisticalIntelligenceEngineV2";
import { StatisticalEvidenceMatrixManager } from "@/utils/statisticalEvidenceMatrix";
import { AnalyticalConsistencyEngine } from "@/utils/analyticalConsistencyEngine";
import { HIEValidationVectorAdapter } from "@/utils/analyticalConsistencyEngine/hieValidationVectorAdapter";
import { TerritorialContextEngine } from "@/utils/territorialContextEngine";
import { HypothesisIntelligenceEngine } from "@/utils/hypothesisIntelligenceEngine";
import { CartographicIntelligenceEngine } from "@/utils/cartographicIntelligenceEngine";
import { VisualEvidenceEngine } from "@/utils/visualEvidenceEngine";
import { TerritorialIntelligenceEngine } from "@/utils/territorialIntelligenceEngine";
import { IntelligenceContextBuilder } from "@/utils/intelligenceIntegrationContract/intelligenceContextBuilder";
import { ReportContextAdapter } from "@/utils/intelligenceIntegrationContract/reportContextAdapter";

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

async function streamGeminiRestApi(
  prompt: string,
  modelName: string,
  apiKey: string,
  onChunk: (text: string) => void
): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`;
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
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body stream available.");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const regex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(buffer)) !== null) {
      const escapedText = match[1];
      try {
        const unescaped = JSON.parse(`"${escapedText}"`);
        if (unescaped) onChunk(unescaped);
      } catch {
        onChunk(escapedText);
      }
      lastIndex = regex.lastIndex;
    }
    buffer = buffer.slice(lastIndex);
  }
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

    const rawIncidents = Array.isArray(safeBody.historicalIncidents)
      ? safeBody.historicalIncidents
      : Array.isArray(safeBody.incidenciaCompleta)
        ? safeBody.incidenciaCompleta
        : [];

    // Optimización: Calcular SIE solo si es necesario (Capítulo 2 o Capítulo 4)
    let sieData: any = null;
    let sem: any = null;
    let generalRisk = "MEDIO";

    if (chapter === 3 || chapter === 4 || chapter === 5 || chapter === 6 || chapter === 7) {
      sieData = StatisticalIntelligenceEngineV2.analyze(
        rawIncidents,
        lat,
        lng,
        radius
      );
      const semResult = StatisticalEvidenceMatrixManager.process(
        projectId,
        rawIncidents,
        sieData
      );
      sem = semResult.sem;

      // =======================================================================
      // ADAPTADOR ALGORÍTMICO HÍBRIDO (Gobernanza del Ecosistema SAI)
      // Mapea de forma segura el nivel de riesgo de acuerdo al esquema provisto.
      // Si se ejecuta bajo SIE v2, se utiliza la probabilidad semanal de Poisson 
      // como un estimador probabilístico auxiliar, normalizado a escala de 0-100.
      // =======================================================================
      const rawPredictivo = sieData.predictivo || sieData.predictiveAnalysis || {};
      const poissonProb = typeof rawPredictivo.poissonProbabilityWeekly === "number"
        ? rawPredictivo.poissonProbabilityWeekly
        : 0;

      const normalizedRiskScore = typeof rawPredictivo.indiceRiesgoTerritorial === "number"
        ? rawPredictivo.indiceRiesgoTerritorial
        : poissonProb <= 1.0 
          ? Math.round(poissonProb * 100) 
          : Math.round(poissonProb);

      if (normalizedRiskScore >= 75) {
        generalRisk = "CRÍTICO";
      } else if (normalizedRiskScore >= 50) {
        generalRisk = "ALTO";
      } else if (normalizedRiskScore >= 20) {
        generalRisk = "MEDIO";
      } else {
        generalRisk = "BAJO";
      }
    } else {
      // Estimación liviana basada en total de incidentes para otros capítulos
      const incCount = rawIncidents.length;
      if (incCount >= 20) {
        generalRisk = "CRÍTICO";
      } else if (incCount >= 10) {
        generalRisk = "ALTO";
      } else if (incCount >= 3) {
        generalRisk = "MEDIO";
      } else {
        generalRisk = "BAJO";
      }
    }

    // Instanciar TCE si se genera el Capítulo 1, Capítulo 2 o Capítulo 3 (para alimentar al HIE / CIE)
    let tceData: any = null;
    if (chapter === 2 || chapter === 3 || chapter === 4) {
      tceData = TerritorialContextEngine.generate({
        projectName,
        projectId,
        projectDescription,
        analysisRadius: radius,
        geometryType: geometry,
        lat,
        lng,
        incidenciaCompleta: rawIncidents,
        streetViews: safeBody.streetViews,
        datosGobMxData: safeBody.datosGobMxData,
        sweeps: safeBody.sweeps,
        analysisContext: safeBody.analysisContext
      });
    }

    // Instanciar HIE únicamente para el Capítulo 2 (chapter === 3)
    let hieData: any = null;
    if (chapter === 3) {
      hieData = HypothesisIntelligenceEngine.build({
        tceData,
        sieData,
        rawInput: safeBody
      });
    }

    // Instanciar CIE únicamente para el Capítulo 3 (chapter === 4)
    let cieData: any = null;
    if (chapter === 4) {
      cieData = CartographicIntelligenceEngine.build({
        tceData,
        sieData,
        rawInput: safeBody
      });
    }

    let validationVector: any = null;
    let aceReport: any = null;
    let visualEvidenceMatrix: any = null;
    let territorialEvidenceMatrix: any = null;

    if (chapter === 6 && sem) {
      visualEvidenceMatrix = VisualEvidenceEngine.process(
        projectId,
        safeBody.photos || [],
        lat,
        lng,
        radius,
        sem.spatialEvidence?.hotspots || []
      );
    }

    if (chapter === 7 && sem) {
      const rawAttractors = safeBody.osintEngineData?.denue || safeBody.denueData || safeBody.attractors || [];
      territorialEvidenceMatrix = TerritorialIntelligenceEngine.process(
        { id: projectId, nombre: projectName, lat, lng, radio: radius },
        tceData,
        rawAttractors,
        safeBody.inegiData,
        safeBody.photos || [],
        sem.spatialEvidence?.hotspots || []
      );
    }

    if (chapter === 5 && sem) {
      validationVector = HIEValidationVectorAdapter.adapt(
        typeof safeBody.analysisContext === "string" ? safeBody.analysisContext : "",
        projectDescription
      );
      const acePayload = {
        projectId,
        tceContext: {
          centroid: { lat, lng },
          radiusMeters: radius,
          startDate: sem.temporalEvidence.temporalCoverage.startDate,
          endDate: sem.temporalEvidence.temporalCoverage.endDate
        },
        sieEventsCount: rawIncidents.length,
        semContext: sem,
        cieContext: {
          centroid: { lat, lng },
          radiusMeters: radius,
          eventsCount: rawIncidents.length,
          hotspotsCount: sem.spatialEvidence.hotspots.length
        },
        hieContext: {
          validationVector
        },
        reportContext: {
          mapCount: 4,
          chartsCount: 3,
          startDate: sem.temporalEvidence.temporalCoverage.startDate,
          endDate: sem.temporalEvidence.temporalCoverage.endDate,
          eventsCount: rawIncidents.length
        }
      };
      aceReport = AnalyticalConsistencyEngine.audit(acePayload, "VALIDATE");
    }

    // 2. Construir el IntelligenceIntegrationContext unificado (IIC) antes del motor editorial
    const safeAceReport = aceReport || {
      globalStatus: "PASS",
      overallConfidence: 100,
      alerts: [],
      metadata: { auditedAt: new Date().toISOString() }
    };

    const safeSem = sem || {
      metadata: { projectId, totalCanonicalIncidents: 0, analysisRadiusMeters: radius },
      criminalEvidence: { totalEvents: 0, dominantCrime: "Ninguno" },
      temporalEvidence: { temporalCoverage: { startDate: "", endDate: "" } },
      spatialEvidence: { hotspots: [], hotspotsCount: 0 }
    };

    const iic = IntelligenceContextBuilder.build(
      projectId,
      safeSem,
      visualEvidenceMatrix,
      territorialEvidenceMatrix,
      hieData,
      safeAceReport,
      cieData
    );

    const ctx = ReportContextAdapter.adapt(iic, {
      chapterId: String(chapter),
      reportMode: "FULL",
      includeOsintAppendix: true,
      sweeps: simplifySweeps(safeBody.sweeps),
      linkedGangReport: safeBody.linkedGangReport,
      osintEngineData: simplifyOsintData(safeBody.osintEngineData)
    });

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
      chapter === 7 ? 'CAPÍTULO 6: ANÁLISIS TERRITORIAL OPERACIONAL Y CONTEXTO DE OPORTUNIDAD' :
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

    // =======================================================================
    // TELEMETRÍA DE SOLICITUD DE IA (Gobernanza del Ecosistema SAI)
    // Registro detallado del contexto, capítulo y modelo despachado.
    // =======================================================================
    console.log(`\n[AI REQUEST] -----------------------------------------`);
    console.log(`Capítulo: ${chapter} - ${currentChapterLabel}`);
    console.log(`Modelo: ${GEMINI_MODEL}`);
    console.log(`Tamaño de Contexto del Expediente: ${systemPrompt.length} caracteres`);
    console.log(`------------------------------------------------------\n`);

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
        const streamPromise = model.generateContentStream({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.15 }
        });
        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout en inicialización de Vertex AI (2s)")), 2000)
        );
        streamingResp = await Promise.race([streamPromise, timeoutPromise]);
      } catch (vertexInitErr: any) {
        console.warn("[api/generate-profile] Vertex AI initialization failed, falling back to REST API:", vertexInitErr.message);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Enviar un espacio en blanco inmediatamente para evitar el Timeout (504) de Vercel
        controller.enqueue(encoder.encode(" "));

        let safeSieDataForClient = null;
        if (sieData) {
          const { exclusionLogs, ...rest } = sieData;
          safeSieDataForClient = rest;
        }

        const metaPart = JSON.stringify({
          riskLevel: generalRisk.toLowerCase(),
          summary: `Dictamen táctico del expediente con enfoque en Criminología Ambiental. Nivel de riesgo sugerido: ${generalRisk}.`,
          incidenciaDetalles: safeBody.incidenciaLocal || [],
          pois: [],
          inegiDemographics: null,
          tacticalStreetViews: safeBody.streetViews || [],
          sieData: safeSieDataForClient,
          tceData: tceData,
          hieData: hieData
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

        let accumulatedText = "";

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

                accumulatedText += text;
                const escapedText = JSON.stringify(text).slice(1, -1);
                controller.enqueue(encoder.encode(escapedText));
              }
            }

            // =======================================================================
            // TELEMETRÍA DE RESPUESTA IA (Streaming)
            // =======================================================================
            console.log(`\n[AI RESPONSE] ----------------------------------------`);
            console.log(`Capítulo: ${chapter} - ${currentChapterLabel}`);
            console.log(`Status: Completado (Streaming exitoso)`);
            console.log(`Longitud del Markdown generado: ${accumulatedText.length} caracteres`);
            console.log(`Formato estructurado válido: ${accumulatedText.includes("##") ? "SÍ" : "NO"}`);
            console.log(`------------------------------------------------------\n`);

          } else {
            // Fallback to REST API
            const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
            if (!apiKey) {
              throw new Error("No se configuró la variable GEMINI_API_KEY ni credenciales válidas de Vertex AI.");
            }
            console.log("[api/generate-profile] Calling Gemini REST API with Streaming Fallback...");
            let isFirstChunk = true;
            let totalLength = 0;
            await streamGeminiRestApi(systemPrompt, GEMINI_MODEL, apiKey, (chunkText) => {
              let cleanedChunk = chunkText;
              if (isFirstChunk) {
                if (cleanedChunk.startsWith("```markdown")) {
                  cleanedChunk = cleanedChunk.replace(/^```markdown\s*/i, "");
                } else if (cleanedChunk.startsWith("```")) {
                  cleanedChunk = cleanedChunk.replace(/^```\s*/, "");
                }
                isFirstChunk = false;
              }
              totalLength += cleanedChunk.length;
              const escapedChunk = JSON.stringify(cleanedChunk).slice(1, -1);
              controller.enqueue(encoder.encode(escapedChunk));
            });

            console.log(`\n[AI RESPONSE] ----------------------------------------`);
            console.log(`Capítulo: ${chapter} - ${currentChapterLabel}`);
            console.log(`Status: Completado (REST API Streaming Fallback exitoso)`);
            console.log(`Longitud del Markdown generado: ${totalLength} caracteres`);
            console.log(`------------------------------------------------------\n`);
          }
        } catch (e: any) {
          const escapedErr = (e.message || "Error desconocido")
            .replace(/\\/g, "\\\\")
            .replace(/\"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r");
          const errorMsg = "\\n\\n[Error de generación: " + escapedErr + "]";
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
