export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { queryTelegram } = body;

    if (!queryTelegram) {
      return NextResponse.json({ success: false, error: "Falta la consulta de Telegram OSINT." }, { status: 400 });
    }

    const authOptions = GCP_PRIVATE_KEY
      ? {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        }
      : undefined;

    const vertexAI = new VertexAI({ project: GCP_PROJECT_ID as string, location: GCP_LOCATION as string, googleAuthOptions: authOptions });
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL as string });

    // Prompt táctico para simular/procesar la extracción OSINT de los conceptos
    const prompt = `
Eres un analista experto en Inteligencia de Fuentes Abiertas (OSINT) y minería de datos adscrito a CEIPOL.
Se ha solicitado un barrido de inteligencia con los siguientes parámetros/entidades extraídos en campo (y expandidos por IA):
"${queryTelegram}"

Genera un resumen analítico táctico estructurado (OSINT Summary) que describa las posibles implicaciones de riesgo o vínculos de estas entidades con actividades ilícitas (narcotráfico, extorsión, halconeo, mercado negro, etc.) basándote en patrones de criminología ambiental.

Estructura tu respuesta en un solo párrafo contundente o en 3 viñetas cortas. NO menciones que eres una IA. Escribe el reporte directamente como un hallazgo de inteligencia táctica listo para inyectarse en un dictamen.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    });

    const osintSummary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "No se detectaron patrones anómalos en el análisis OSINT de estos conceptos.";

    return NextResponse.json({ success: true, osintSummary: osintSummary.trim() });
  } catch (error: any) {
    console.error("[api/telegram-osint] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor al ejecutar el barrido OSINT." }, { status: 500 });
  }
}
