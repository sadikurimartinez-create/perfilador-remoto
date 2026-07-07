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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const safeBody = { ...body };

    const projectName = safeBody.projectName || "EXPEDIENTE TÁCTICO INDETERMINADO";
    const projectId = safeBody.projectId || "EXP-2026-XXXXX";
    const projectDescription = safeBody.projectDescription || "Aguascalientes, Ags";
    const radius = safeBody.analysisRadius || 250;
    const geometry = safeBody.geometryType || "individual";

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

    // 2. Construir el contexto para los prompts modulares
    const ctx: ReportContext = {
      projectName,
      projectId,
      projectDescription,
      analysisRadius: radius,
      geometryType: geometry,
      focusAreas: safeBody.focusAreas,
      incidenciaLocal: safeBody.incidenciaLocal,
      bibliografiaLocal: safeBody.bibliografiaLocal,
      multimodalContext: safeBody.multimodalContext,
      osintEngineData: safeBody.osintEngineData,
      streetViews: safeBody.streetViews,
      datosGobMxData: safeBody.datosGobMxData,
      linkedGangReport: safeBody.linkedGangReport,
      sweeps: safeBody.sweeps,
      sweepsComments: safeBody.sweepsComments,
      photos: safeBody.photos,
      analysisContext: safeBody.analysisContext
    };

    // 3. Obtener cada uno de los prompts modulares
    const p1 = ExecutiveSummaryPrompt(ctx);
    const p2 = TerritorialAnalysisPrompt(ctx);
    const p3 = HypothesisPrompt(ctx);
    const p4 = MapsInterpretationPrompt(ctx);
    const p5 = GraphAnalysisPrompt(ctx);
    const p6 = EvidenceAnalysisPrompt(ctx);
    const p7 = StreetViewIntelligencePrompt(ctx);
    const p8 = OSINTAnalysisPrompt(ctx);
    const p9 = GangAnalysisPrompt(ctx);
    const p10 = HIGGraphPrompt(ctx);
    const p11 = OperationalConclusionPrompt(ctx);

    // 4. Armar el System Prompt / Prompt Maestro
    const systemPrompt = `
Actúa como el motor Antigravity de geointeligencia institucional de la SSPE-CEIPOL.
Tu objetivo es transformar los datos de campo, barridos y análisis del expediente en un INFORME EJECUTIVO DE GEOINTELIGENCIA integrado y depurado.

REGLAS EDITORIALES GENERALES:
1. Divide claramente las afirmaciones entre: Hecho observado, Inferencia analítica y Recomendación operativa.
2. Utiliza un lenguaje estrictamente formal e institucional. Queda terminantemente prohibido incluir nombres de procesos técnicos internos, APIs, PowerUps, logs, scripts o instrucciones de programación.
3. Todas las conclusiones deben poder justificarse con las fuentes del expediente (mapas, fotos, incidencias, OSINT).
4. El reporte debe estructurarse en 11 apartados utilizando títulos numerados con "##".

Escribe el informe siguiendo exactamente esta estructura de secciones:

## 1. PORTADA Y EXECUTIVE SUMMARY
${p1}

---

## 2. CAPÍTULO 1: CONTEXTO DEL ANÁLISIS
${p2}

---

## 3. CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL
${p3}

---

## 4. CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO
${p4}

---

## 5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO
${p5}

---

## 6. CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA
${p6}

---

## 7. CAPÍTULO 6: STREET VIEW INTELLIGENCE
${p7}

---

## 8. CAPÍTULO 7: INTELIGENCIA OSINT
${p8}

---

## 9. CAPÍTULO 8: ACTORES TERRITORIALES Y PANDILLAS
${p9}

---

## 10. CAPÍTULO 9: GRAFO DE HIPÓTESIS HIG 2.0
${p10}

---

## 11. CAPÍTULO 10: CONCLUSIONES OPERATIVAS
${p11}

---

Escribe la salida en formato Markdown limpio. Devuelve ÚNICA Y EXCLUSIVAMENTE el documento en Markdown, sin agregar explicaciones previas ni encerrarlo en bloques de código triple comilla (\`\`\`).
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
    
    // Limpieza de formato markdown de la respuesta si es necesario
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
