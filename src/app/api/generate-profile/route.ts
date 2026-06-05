export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { buildStrategiesSummaryForTags } from "@/lib/tagStrategies";

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

    const prompt = `
INSTRUCCIONES DE SISTEMA:
${systemPrompt}

ESTRATEGIAS APLICABLES (CRIMINOLOGÍA AMBIENTAL):
${strategies}

DATOS DEL PROYECTO (EVIDENCIA DE CAMPO):
${JSON.stringify(body, null, 2)}

INSTRUCCIÓN FINAL: Genera el Perfil Criminológico Ambiental detallado. 
Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido con la estructura correspondiente.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      console.error("[api/generate-profile] Error parseando JSON de Gemini:", e);
      // Fallback a un objeto que el frontend pueda intentar procesar en caso de fallo
      parsed = { unifiedProfile: text }; 
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[api/generate-profile] Error:", err);
    return NextResponse.json(
      { error: "Error al generar el perfil de IA.", details: err.message },
      { status: 500 }
    );
  }
}