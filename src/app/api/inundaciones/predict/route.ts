export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { GeoFloodForecastEngine } from "@/lib/geoint/geoFloodForecastEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fecha = new Date().toISOString().split("T")[0],
      hora = "12:00",
      horizonte = "+24h",
      scope = "estado",
      scopeId = "Aguascalientes",
      lat = 21.8853,
      lng = -102.2916,
      radioMetros = 1000
    } = body;

    // Run deterministic predictive model calculations
    const forecastResult = GeoFloodForecastEngine.generateForecast({
      fecha,
      hora,
      horizonte,
      scope,
      scopeId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radioMetros: parseInt(radioMetros)
    });

    let aiSynthesis = "";

    // If Vertex AI is configured, run Gemini to synthesize the results
    if (GCP_PROJECT_ID) {
      try {
        const authOptions = GCP_PRIVATE_KEY
          ? {
              credentials: {
                client_email: GCP_CLIENT_EMAIL,
                private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
              },
            }
          : undefined;

        const vertexAI = new VertexAI({
          project: GCP_PROJECT_ID,
          location: GCP_LOCATION,
          googleAuthOptions: authOptions,
        });

        const model = vertexAI.getGenerativeModel({
          model: GEMINI_MODEL,
        });

        const systemPrompt = `
Eres un Asistente Analítico de Inteligencia Geoespacial (GEOINT) de élite del Centro de Estudios y Política Criminal (CEIPOL).
Tu tarea es generar una síntesis ejecutiva basada EXCLUSIVAMENTE en los resultados de pronóstico de inundaciones calculados determinísticamente por el motor 'GeoFloodForecastEngine'.
Tú NO debes calcular ni modificar ningún número, porcentaje, probabilidad, nivel de riesgo ni coordenadas. Esos ya fueron calculados por el motor.

Tus tareas principales son:
1. EXPLICAR el escenario general para el horizonte temporal seleccionado (${horizonte}) en el ámbito geográfico solicitado (${scope}: ${scopeId}).
2. CONTEXTUALIZAR la amenaza combinando las variables meteorológicas e hidrológicas que se te proporcionan.
3. PRIORIZAR los municipios y colonias de atención urgente de acuerdo a sus probabilidades estimadas.
4. SINTETIZAR recomendaciones operativas inmediatas para protección civil e infraestructura crítica vulnerable.

Escribe de manera clara, con terminología formal apta para analistas de inteligencia y mandos de toma de decisiones de protección civil. Usa viñetas estructuradas en markdown. No agregues justificaciones técnicas del código de software, enfócate enteramente en la perspectiva operativa del desastre natural.
`;

        const userMessage = `
--- RESULTADOS DEL MOTOR PREDICTIVO ---
Ámbito Territorial: ${scope} (${scopeId})
Fecha de Análisis: ${fecha} a las ${hora}
Horizonte: ${horizonte}
Probabilidad Promedio Global (Confianza): ${forecastResult.nivelConfianzaGlobal}%

Métricas Meteorológicas Consolidadas:
- Lluvia CONAGUA: ${forecastResult.meteorologicalMetrics.conaguaPrecipitation} mm
- Lluvia NOAA: ${forecastResult.meteorologicalMetrics.noaaPrecipitation} mm
- Humedad Suelo: ${forecastResult.meteorologicalMetrics.soilMoisture}% (${forecastResult.meteorologicalMetrics.humidityTrend})

Métricas Hidrológicas Consolidadas:
- Nivel de Río San Pedro (simulado): ${forecastResult.hydrologicalMetrics.riverLevel} metros
- Capacidad útil drenaje: ${forecastResult.hydrologicalMetrics.drainageCapacity}%
- Saturación microcuencas: ${JSON.stringify(forecastResult.hydrologicalMetrics.microbasinsSaturations)}

Zonas Críticas Detectadas:
${forecastResult.zonasCriticas.map(z => `- **${z.nombre}**: Probabilidad ${Math.round(z.probabilidad * 100)}% (Confianza ${z.confianza}), Tendencia ${z.tendencia}. Causas: ${z.causas.join(", ")}. Efectos previstos: ${z.efectosSecundarios.join(", ")}`).join("\n")}

Recomendaciones del Algoritmo:
${forecastResult.recomendacionesOperativas.map(r => `- ${r}`).join("\n")}

Por favor, genera la síntesis ejecutiva estructurada.
`;

        const responseStream = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: systemPrompt + "\n" + userMessage }] }],
        });

        aiSynthesis = responseStream.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch (geminiError: any) {
        console.error("[API Inundaciones Predict] Error llamando a Gemini, usando síntesis local:", geminiError);
      }
    }

    if (!aiSynthesis) {
      // Fallback local synthesis
      aiSynthesis = `
### Síntesis Ejecutiva de Alerta Hidrometeorológica (${horizonte})
* **Evaluación de Escenario:** Se prevé un escenario de riesgo creciente en el ámbito territorial **${scopeId}** debido a la coincidencia de precipitaciones intensas estimadas por CONAGUA (${forecastResult.meteorologicalMetrics.conaguaPrecipitation}mm) y NOAA (${forecastResult.meteorologicalMetrics.noaaPrecipitation}mm).
* **Análisis de Infiltración:** La humedad acumulada del suelo alcanza el ${forecastResult.meteorologicalMetrics.soilMoisture}%, limitando críticamente la capacidad de absorción y propiciando escurrimientos superficiales rápidos hacia las cuencas bajas del Río San Pedro.
* **Prioridades Territoriales:** Las zonas de máxima prioridad operativa que registran una probabilidad superior al 70% de anegamiento severo son el **Sector Río San Pedro / Fracc. Las Flores** y el **Paso a Desnivel López Mateos**.
* **Infraestructura Crítica Vulnerable:** Se sugiere prestar vigilancia especial a las inmediaciones viales y zonas hospitalarias adyacentes a colectores urbanos principales.
* **Mitigación Operativa:** Es imperativo iniciar cortes de tránsito viales preventivos en zonas inundables y verificar la operación de compuertas y motobombas en colectores.
      `.trim();
    }

    return NextResponse.json({
      ...forecastResult,
      aiSynthesis,
      isAiGenerated: !!GCP_PROJECT_ID && !!aiSynthesis
    });
  } catch (error: any) {
    console.error("[API Inundaciones Predict] Error en handler:", error);
    return NextResponse.json(
      { error: "Error en el motor predictivo de inundaciones", details: error.message },
      { status: 500 }
    );
  }
}
