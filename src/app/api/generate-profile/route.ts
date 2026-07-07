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

    // 1. Deducir riesgo general a nivel de código para el metadato
    let generalRisk = "MEDIO";
    const contextText = safeBody.analysisContext || "";
    if (contextText.toLowerCase().match(/(arma|homicidio|droga|violencia|disputa|cartel)/)) {
      generalRisk = "CRÍTICO";
    } else if (contextText.toLowerCase().match(/(lesiones|narcomenudeo|asalto)/)) {
      generalRisk = "ALTO";
    } else if (contextText.toLowerCase().match(/(robo|grafiti|pandilla)/)) {
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
      incidenciaLocal: safeBody.incidenciaLocal ? new Array(safeBody.incidenciaLocal.length).fill({}) : [],
      bibliografiaLocal: typeof safeBody.bibliografiaLocal === "string" ? safeBody.bibliografiaLocal.slice(0, 500) : "",
      multimodalContext: typeof safeBody.multimodalContext === "string" ? safeBody.multimodalContext.slice(0, 500) : "",
      osintEngineData: simplifyOsintData(safeBody.osintEngineData),
      streetViews: safeBody.streetViews ? safeBody.streetViews.slice(0, 5) : [],
      datosGobMxData: null,
      linkedGangReport: safeBody.linkedGangReport,
      sweeps: simplifySweeps(safeBody.sweeps),
      sweepsComments: typeof safeBody.sweepsComments === "string" ? safeBody.sweepsComments.slice(0, 500) : "",
      photos: safeBody.photos ? safeBody.photos.slice(0, 5).map((p: any) => ({ ...p, dataUrl: "" })) : [],
      analysisContext: typeof safeBody.analysisContext === "string" ? safeBody.analysisContext.slice(0, 800) : ""
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
    const systemPrompt = `
Actúa como el motor Antigravity de geointeligencia institucional de la SSPE-CEIPOL.
Tu objetivo es generar el **Capítulo ${chapter}** (Sección ${chapter} de 11) del INFORME EJECUTIVO DE GEOINTELIGENCIA.

REGLAS EDITORIALES:
1. Divide claramente las afirmaciones entre: Hecho observado, Inferencia analítica y Recomendación operativa.
2. Utiliza un lenguaje estrictamente formal e institucional. Queda terminantemente prohibido incluir nombres de procesos técnicos internos, APIs, PowerUps, logs, scripts o instrucciones de programación.
3. Todas las conclusiones deben poder justificarse con las fuentes del expediente (mapas, fotos, incidencias, OSINT).
4. El reporte debe estructurarse con títulos numerados con "##".

Escribe el informe siguiendo exactamente esta sección:
## ${chapter === 1 ? '1. PORTADA Y EXECUTIVE SUMMARY' :
      chapter === 2 ? '2. CAPÍTULO 1: CONTEXTO DEL ANÁLISIS' :
      chapter === 3 ? '3. CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL' :
      chapter === 4 ? '4. CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO' :
      chapter === 5 ? '5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO' :
      chapter === 6 ? '6. CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA' :
      chapter === 7 ? '7. CAPÍTULO 6: STREET VIEW INTELLIGENCE' :
      chapter === 8 ? '8. CAPÍTULO 7: INTELIGENCIA OSINT' :
      chapter === 9 ? '9. CAPÍTULO 8: ACTORES TERRITORIALES Y PANDILLAS' :
      chapter === 10 ? '10. CAPÍTULO 9: GRAFO DE HIPÓTESIS HIG 2.0' :
      '11. CAPÍTULO 10: CONCLUSIONES OPERATIVAS'}

${sectionPrompt}

Escribe la salida en formato Markdown limpio. Devuelve ÚNICA Y EXCLUSIVAMENTE esta sección en Markdown, sin agregar explicaciones previas ni encerrarlo en bloques de código triple comilla (\`\`\`).
`.trim();

    // 5. Llamada a VertexAI (Gemini)
    if (!GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID no está configurado en las variables de entorno.");
    }

    const authOptions = GCP_PRIVATE_KEY
      ? { credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n") } }
      : undefined;

    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      generationConfig: { temperature: 0.15 }
    });

    let markdown = (result.response.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    
    // Limpieza de formato markdown de la respuesta
    if (markdown.startsWith("```markdown")) {
      markdown = markdown.replace(/^```markdown\s*/i, "").replace(/\s*```$/g, "").trim();
    } else if (markdown.startsWith("```")) {
      markdown = markdown.replace(/^```\s*/, "").replace(/\s*```$/g, "").trim();
    }

    const parsed = {
      markdown,
      meta: {
        riskLevel: generalRisk.toLowerCase(),
        summary: `Dictamen táctico del expediente con enfoque en Criminología Ambiental. Nivel de riesgo sugerido: ${generalRisk}.`,
        incidenciaDetalles: safeBody.incidenciaLocal || [],
        pois: [],
        inegiDemographics: null,
        tacticalStreetViews: safeBody.streetViews || [],
      }
    };

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[api/generate-profile] Error:", err);
    return NextResponse.json(
      { error: "Error al generar el dictamen táctico con inteligencia artificial.", details: err.message },
      { status: 500 }
    );
  }
}
