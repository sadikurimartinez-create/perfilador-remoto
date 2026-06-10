"use server";

import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { searchDatosGobMx, type DatosGobMxResult } from "./datosGobMx";

// Ping silencioso para la telemetría (Centro de Conexiones)
export async function pingOsint() {
  return { status: "ok" };
}

// Obtener la URL de Ngrok rápidamente para conexión directa desde el cliente
export async function getNgrokUrl() {
  return (process.env.MORELOGIN_API_URL || "http://127.0.0.1:3005").trim().replace(/\/$/, "");
}

export async function getScinceData(lat: number, lng: number) {
  try {
    if (!lat || !lng) throw new Error("Faltan coordenadas");
    
    // Simulador de datos demográficos para pruebas
    const seed = Math.abs(Math.sin(lat * lng)) * 10000;
    const poblacion = Math.floor(100 + (seed % 400));
    const viviendas = Math.floor(poblacion / 3.5);
    const deshabitadas = Math.floor((seed % 15));
    const marginacion = (seed % 100) > 80 ? "Alto" : (seed % 100) > 40 ? "Medio" : "Bajo";

    return {
      exito: true,
      coordenadas: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      poblacionTotal: poblacion.toString(), 
      viviendasTotales: viviendas.toString(),
      viviendasDeshabitadas: deshabitadas.toString(),
      gradoMarginacion: marginacion,
    };
  } catch (error: any) {
    return { exito: false, error: error.message || "Error al calcular SCINCE" };
  }
}

export async function getDenueData(lat: number, lng: number, radio: number = 500) {
  try {
    if (!lat || !lng) throw new Error("Faltan coordenadas");
    const token = process.env.INEGI_DENUE_TOKEN || "dbf9098a-165e-4938-a5fc-841bd476e357";
    const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/${lat},${lng}/${radio}/${token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error de la API de INEGI: ${res.status}`);
    
    const data = await res.json();
    if (!Array.isArray(data)) return { exito: true, total: 0, resumen: "No se encontraron negocios." };
    const negocios = data.map((n: any) => `${n.Nombre} (${n.Clase_actividad})`);
    const topNegocios = negocios.slice(0, 8).join(" | ");
    return { exito: true, total: data.length, resumen: data.length > 0 ? `${topNegocios}${data.length > 8 ? `... y ${data.length - 8} más` : ""}` : "Ninguno." };
  } catch (error: any) {
    return { exito: false, error: error.message || "Error interno del servidor al consultar DENUE." };
  }
}

// Función táctica para resolver Captchas de imagen usando 2Captcha
async function solveImageCaptchaLocal(base64Image: string, apiKey: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("key", apiKey);
  formData.append("method", "base64");
  formData.append("body", base64Image);
  formData.append("json", "1");

  const inRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: formData });
  const inData = await inRes.json();
  if (inData.status !== 1) throw new Error("Error enviando CAPTCHA: " + inData.request);

  const captchaId = inData.request;

  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
    const resData = await resRes.json();
    
    if (resData.status === 1) return resData.request;
    if (resData.request !== "CAPCHA_NOT_READY") throw new Error("Error de 2Captcha: " + resData.request);
  }
  throw new Error("Timeout: 2Captcha tardó demasiado en resolver la imagen.");
}

export async function getDatosGobMxData(
  datasetUrl: string,
  lat: number,
  lng: number,
  radio: number = 1000
): Promise<{ exito: boolean; data?: DatosGobMxResult; error?: string }> {
  try {
    if (!datasetUrl || !lat || !lng) {
      throw new Error("Faltan URL del dataset o coordenadas");
    }
    // Basic URL validation
    if (!datasetUrl.includes("datos.gob.mx/dataset/")) {
      throw new Error("La URL no parece ser un dataset válido de datos.gob.mx");
    }

    const result = await searchDatosGobMx(datasetUrl, lat, lng, radio);
    return { exito: true, data: result };
  } catch (error: any) {
    console.error("[osintActions.getDatosGobMxData] Error:", error);
    return { exito: false, error: error.message || "Error al consultar datos.gob.mx" };
  }
}

export async function getTelegramOsintData(queryTelegram: string) {
  try {
    if (!queryTelegram) throw new Error("Falta la consulta de Telegram OSINT.");

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

    const prompt = `
Eres un analista experto en Inteligencia de Fuentes Abiertas (OSINT) y minería de datos adscrito a CEIPOL.
Se ha solicitado un barrido de inteligencia con los siguientes parámetros/entidades extraídos en campo (y expandidos por IA):
"${queryTelegram}"

Genera un resumen analítico táctico estructurado (OSINT Summary) que describa las posibles implicaciones de riesgo o vínculos de estas entidades con actividades ilícitas (narcotráfico, extorsión, halconeo, mercado negro, etc.) basándote en patrones de criminología ambiental.
Estructura tu respuesta en un solo párrafo contundente o en 3 viñetas cortas. NO menciones que eres una IA. Escribe el reporte directamente como un hallazgo de inteligencia táctica listo para inyectarse en un dictamen.`;

    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } });
    const osintSummary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "No se detectaron patrones anómalos en el análisis OSINT de estos conceptos.";
    return { success: true, osintSummary: osintSummary.trim() };
  } catch (error: any) {
    console.error("[osintActions.getTelegramOsintData] Error:", error);
    return { success: false, error: "Error interno del servidor al ejecutar el barrido OSINT." };
  }
}

export async function getRnpdnoData(estado: string, municipio: string) {
  try {
    // Intenta usar la URL de ngrok si está configurada, si no, usa localhost directo.
    const NGROK_URL = process.env.ROBOT_NGROK_URL || "http://127.0.0.1:3005";
    const url = `${NGROK_URL}/rnpdno?estado=${encodeURIComponent(estado || "Aguascalientes")}&municipio=${encodeURIComponent(municipio || "Todos")}`;
    
    const res = await fetch(url, { method: "GET", cache: 'no-store' });
    
    if (!res.ok) {
      throw new Error(`Error en la conexión con el Robot (Status: ${res.status})`);
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error("[osintActions.getRnpdnoData] Error:", error);
    // Interceptar específicamente el error de servidor caído (fetch failed / ECONNREFUSED)
    if (error.message?.includes("fetch failed") || error.cause?.code === "ECONNREFUSED") {
      return { exito: false, error: "⚠️ Vercel no puede comunicarse con el Robot local. Asegúrate de encender el robot (node robot-repuve.js) y de configurar la variable ROBOT_NGROK_URL en Vercel." };
    }
    return { exito: false, error: error.message || "Error conectando al cuartel general (Robot RNPDNO)." };
  }
}