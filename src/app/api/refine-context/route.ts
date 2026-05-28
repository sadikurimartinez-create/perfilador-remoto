import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

type RefineBody = {
  context: string;
  photos?: { lat: number | null; lng: number | null }[];
  mode?: "suggest" | "audit" | "validate-photos";
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
Eres un Auditor Experto en Criminología Ambiental adscrito al CEIPOL.
El investigador ha redactado la siguiente contextualización / hipótesis operativa:
"${cleanedContext}"

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
"${cleanedContext}"

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
    } else {
      prompt = `
Eres un Auditor Experto en Criminología Ambiental adscrito al CEIPOL. Un investigador necesita contexto operacional para un Perfil Criminológico Ambiental.

Contexto preliminar del analista:
"${cleanedContext || "(Vacío)"}"

Coordenadas aproximadas de las fotos:
${coordsText}

${descContext}
${geoInstruction}

Instrucción:
Evalúa de 0 a 100 qué tan útil y lógica es la contextualización actual. Si está vacía o es muy pobre, el score será muy bajo.
Proporciona 3 o 4 sugerencias PROFUNDAS, TÁCTICAS y SEVERAS basadas en la Criminología Ambiental.
Devuelve un objeto JSON estrictamente con este formato:
{
  "score": <número de 0 a 100>,
  "suggestions": "<Si score < 80: provee las sugerencias en viñetas directas con lenguaje policial/táctico sobre QUÉ debe agregar para llegar al 80%. Si score >= 80: provee complementos avanzados.>"
}
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
    const result = await model.generateContent(prompt);
    
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
  } catch (err) {
    console.error("[api/refine-context] Error:", err);
    return NextResponse.json({ score: 0, suggestions: "Error interno al auditar. Intente de nuevo." });
  }
}
