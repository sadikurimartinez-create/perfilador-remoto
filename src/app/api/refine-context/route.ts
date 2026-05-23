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
  mode?: "suggest" | "audit";
  geometryType?: "individual" | "lineal" | "poligono";
  projectDescription?: string;
};

function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(6);
}

export async function POST(req: Request) {
  try {
    const { context, photos, mode, geometryType, projectDescription } = (await req.json()) as RefineBody;

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
Eres un Analista de Inteligencia Táctica Senior adscrito al CEIPOL.
El investigador de campo ha redactado la siguiente hipótesis operativa:
"${cleanedContext}"

${descContext}
${geoInstruction}

Instrucción:
Audita, pule y mejora radicalmente esta hipótesis. Eleva el nivel técnico, corrige redacción, asegura que suene altamente profesional, AGRESIVO, PROFUNDO y estrictamente enfocado en Criminología Ambiental.
Asegúrate de que la hipótesis auditada integre la directriz de voz y la directriz geométrica sin desviarse.
Devuelve ÚNICAMENTE el texto mejorado, sin preámbulos, listo para ser copiado y pegado en el informe final.
`.trim();
    } else {
      prompt = `
Eres un Analista de Inteligencia Táctica Senior adscrito al CEIPOL. Un investigador de campo necesita contexto operacional para un Perfil Criminológico Ambiental.

Contexto preliminar del analista (si existe):
"${cleanedContext || "(El analista aún no ha redactado una hipótesis, genera sugerencias de enfoque táctico a partir de la geografía y teoría criminológica)"}"

Coordenadas aproximadas de las fotos:
${coordsText}

${descContext}
${geoInstruction}

Instrucción:
Proporciona 3 o 4 sugerencias PROFUNDAS, TÁCTICAS, AGRESIVAS y SEVERAS basadas en la Criminología Ambiental.
Instruye al analista con mandatos estrictos sobre qué DEBE observar e incluir en su hipótesis basándose en la geometría (${geometryType || "individual"}).

Responde en español, usando viñetas directas, con lenguaje de inteligencia policial/táctico. NO repitas el contexto original, indícale qué agregar para robustecer su hipótesis.
`.trim();
    }

    // Si no hay clave de Gemini, devolvemos sugerencias genéricas para no romper el flujo de la UI.
    if (!apiKey) {
      if (mode === "audit") {
        return NextResponse.json({ suggestions: cleanedContext + "\n\n(Nota: Auditoría no disponible por falta de API Key)" });
      }
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
    if ((req as any).mode === "audit") {
      return NextResponse.json({ suggestions: "Error al auditar. Intente de nuevo." });
    }
    const fallback =
      "• Evalúe las vulnerabilidades espaciales basándose en las Actividades Rutinarias de la zona (flujos de víctimas e infractores).\n" +
      "• Considere la Teoría de Elección Racional: describa qué elementos del entorno facilitan la decisión delictiva.\n" +
      "• Determine la conectividad del sitio con posibles rutas de huida o zonas de impunidad.";
    return NextResponse.json({ suggestions: fallback });
  }
}
