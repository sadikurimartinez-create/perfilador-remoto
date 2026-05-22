import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY as GEMINI_KEY, GEMINI_MODEL } from "@/lib/geminiEnv";
function getGeminiKey(): string {
  const fromModule = (GEMINI_KEY && GEMINI_KEY.trim()) || "";
  const fromProcess =
    (typeof process.env.NEXT_PUBLIC_GEMINI_API_KEY === "string" && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim()) ||
    (typeof process.env.GEMINI_API_KEY === "string" && process.env.GEMINI_API_KEY.trim()) ||
    "";
  return fromModule || fromProcess;
}

type RefineBody = {
  context: string;
  photos?: { lat: number | null; lng: number | null }[];
};

function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(6);
}

export async function POST(req: Request) {
  try {
    const { context, photos } = (await req.json()) as RefineBody;

    const apiKey = getGeminiKey();
    const coordsText =
      photos && photos.length > 0
        ? photos
            .map(
              (p, i) =>
                `Foto ${i + 1}: lat ${formatCoord(p.lat)}, lng ${formatCoord(p.lng)}`
            )
            .join("\n")
        : "No se proporcionaron coordenadas de fotos.";

    const cleanedContext = (context ?? "").trim();

    const prompt = `
Eres un Analista de Inteligencia Senior adscrito al CEIPOL. Un investigador de campo está redactando la hipótesis o contexto operacional para un Perfil Criminológico Ambiental.

Contexto preliminar del analista:
"${cleanedContext || "(El analista aún no ha redactado una hipótesis, genera sugerencias de enfoque táctico a partir de la geografía y teoría criminológica)"}"

Coordenadas aproximadas de las fotos:
${coordsText}

Instrucción:
Proporciona 3 o 4 sugerencias PROFUNDAS, TÁCTICAS y SEVERAS basadas en la Criminología Ambiental (Actividades Rutinarias, Ventanas Rotas, Elección Racional, Patrón Delictivo).
Indícale al analista qué elementos clave DEBE observar e incluir en su contexto (ej. cruce con OSINT, rutas de escape, atractores de riesgo, barreras físicas, nivel de vigilancia natural, presencia de halconeo o deterioro urbano).

Responde en español, usando viñetas cortas, con lenguaje policial/táctico. NO repitas el contexto original, solo dile qué agregar o en qué enfocarse para robustecer su hipótesis.
`.trim();

    // Si no hay clave de Gemini, devolvemos sugerencias genéricas para no romper el flujo de la UI.
    if (!apiKey) {
      const fallback =
        "• Analice e integre los vectores de movilidad táctica (rutas de aproximación y escape) y la presencia de barreras físicas.\n" +
        "• Evalúe el nivel de deterioro urbano (Ventanas Rotas) y su correlación con la percepción de impunidad en el polígono.\n" +
        "• Identifique atractores delictivos cercanos (giros negros, zonas de abandono) y cruce con Inteligencia de Fuentes Abiertas (OSINT).\n" +
        "• Describa la presencia o ausencia de guardianes formales e informales (Cámaras C5i, iluminación, vigilancia vecinal).";
      return NextResponse.json({ suggestions: fallback });
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ suggestions: text });
  } catch (err) {
    console.error("[api/refine-context] Error:", err);
    // Degradación elegante: si Gemini falla, devolvemos sugerencias genéricas en vez de 500.
    const fallback =
      "• Evalúe las vulnerabilidades espaciales basándose en las Actividades Rutinarias de la zona (flujos de víctimas e infractores).\n" +
      "• Considere la Teoría de Elección Racional: describa qué elementos del entorno facilitan la decisión delictiva.\n" +
      "• Determine la conectividad del sitio con posibles rutas de huida o zonas de impunidad.";
    return NextResponse.json({ suggestions: fallback });
  }
}
