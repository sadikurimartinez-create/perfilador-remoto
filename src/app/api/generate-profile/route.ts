export const runtime = "nodejs";
export const maxDuration = 60; // Regresado a 60 para evitar error de Build en Vercel Hobby

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

    const prompt = `
INSTRUCCIONES DE SISTEMA:
${systemPrompt}

ESTRATEGIAS APLICABLES (CRIMINOLOGÍA AMBIENTAL):
${strategies}

DATOS DEL PROYECTO (EVIDENCIA DE CAMPO):
${JSON.stringify(safeBody, null, 2)}

INSTRUCCIÓN FINAL: Genera el Perfil Criminológico Ambiental como un PRODUCTO EDITORIAL PROFESIONAL de Alta Calidad Institucional.
Es OBLIGATORIO que uses EXACTAMENTE la siguiente estructura de Markdown.
Usa los caracteres de bloque de cita (>) para simular recuadros y cuadros de texto en las lecturas analíticas, vulnerabilidades y hallazgos. Llenarás los datos utilizando la información demográfica (SCINCE), comercial (DENUE) e incidencia. Usa viñetas (■) donde corresponda.

ESTRUCTURA OBLIGATORIA A REPLICAR:

# DICTAMEN TÁCTICO
## PERFIL CRIMINOLÓGICO AMBIENTAL
**EXPEDIENTE:** DICTAMEN_CRIMINOLOGICO_AMBIENTAL
**FECHA DE EMISIÓN:** (Fecha actual)
**NIVEL DE RIESGO:** (Determinar BAJO, MEDIO o ALTO)

---

### PERFIL SOCIODEMOGRÁFICO DEL ÁREA DE ANÁLISIS
Caracterización sociodemográfica obtenida mediante integración de información censal INEGI correspondiente al área geográfica analizada.

(Generar Tabla Markdown con Ícono, Indicador y Valor. Ej: 👥 Población Total, 👨 Hombres, 👩 Mujeres, 🎂 Edad Promedio, 🎓 Escolaridad, 🏠 Viviendas Habitadas, 📉 Grado de Marginación)

> **LECTURA SOCIODEMOGRÁFICA**
> (Párrafo analítico)

> **EVALUACIÓN DE VULNERABILIDAD SOCIODEMOGRÁFICA (CENSINT)**
> (Párrafo indicando el SVS y nivel de riesgo)

---

### PERFIL CRIMINOLÓGICO AMBIENTAL: (Nombre de la zona o proyecto)

#### 1. EXPLICACIÓN DEL ANÁLISIS
> (Párrafo descriptivo)

#### 2. SÍNTESIS DE RIESGO
> (Párrafo indicando riesgo ALTO/MEDIO/BAJO y resumen)

#### 3. INFORMACIÓN PREDICTIVA INICIAL
> (Proyección a 6 meses)

---

### INFORMACIÓN SOCIO-DEMOGRÁFICA
(Párrafo)

### ANÁLISIS DEL CONTEXTO ESPACIAL
(Párrafo)

### DETERIORO FÍSICO Y VENTANAS ROTAS
> **Hallazgos Críticos:**
> ■ (Hallazgos en viñetas)

### ATRACTORES Y DINÁMICA DELICTIVA
> **Puntos de Vulnerabilidad:**
> ■ (Hallazgos en viñetas)

### LÍNEAS CRONOLÓGICAS GEOESPACIALES
> **Proyección Evolutiva:**
> ■ (Proyección en viñetas)

### CONCLUSIONES TÁCTICAS (Riesgo a 6 meses)
> **Recomendaciones Operacionales:**
> ■ (Recomendaciones en viñetas)

Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido. Asegúrate de incluir la clave "markdown" con todo este contenido estructurado.
MUY IMPORTANTE: Escapa los saltos de línea con \\n. NO uses saltos de línea reales dentro de la cadena JSON. Ejemplo:
{
  "markdown": "# DICTAMEN TÁCTICO\\n## PERFIL CRIMINOLÓGICO...",
  "meta": {
    "riskLevel": "alto"
  }
}
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
      // Extractor de emergencia a prueba de balas si la IA rompe el JSON con saltos de línea reales
      let rawMarkdown = text;
      const match = text.match(/"markdown"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"meta"|}$)/);
      if (match && match[1]) {
         rawMarkdown = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else {
         // Limpieza bruta
         rawMarkdown = text.replace(/^[\s\S]*?"markdown"\s*:\s*"/, '').replace(/"\s*}\s*$/, '').replace(/\\n/g, '\n');
      }
      parsed = { markdown: rawMarkdown }; 
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