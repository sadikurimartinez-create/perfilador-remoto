"use server";

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