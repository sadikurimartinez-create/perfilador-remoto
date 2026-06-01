"use server";
import puppeteer from "puppeteer-core";

// Ping silencioso para la telemetría (Centro de Conexiones)
export async function pingOsint() {
  return { status: "ok" };
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

export async function checkAutoPlaca(placa: string) {
  console.log(`\n[REPUVE] 🚀 Iniciando barrido para placa: ${placa}`);
  try {
    if (!placa) return { exito: false, error: "No se proporcionó una placa vehicular." };

    const profileId = "2060114385070264320";
    const API_KEY_2CAPTCHA = process.env.TWOCAPTCHA_API_KEY || "b57cb6e6e68ab65198220bbe3c4b6784"; 

    // Limpiamos la URL por si se copió con espacios accidentales o barras al final en Vercel
    const moreLoginApi = (process.env.MORELOGIN_API_URL || "http://127.0.0.1:40000").trim().replace(/\/$/, "");

    console.log(`[REPUVE] 📡 Contactando API de MoreLogin en: ${moreLoginApi}`);
    const startRes = await fetch(`${moreLoginApi}/api/env/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env_id: profileId }),
      cache: "no-store"
    });

    const startData = await startRes.json();
    if (startData.code !== 0 || !startData.data?.wsDetail) {
      console.error("[REPUVE] ❌ Error al iniciar MoreLogin:", startData);
      return { exito: false, error: "No se pudo iniciar MoreLogin. Revisa que la aplicación esté abierta y la API Local activa." };
    }

    console.log("[REPUVE] 🔗 Conectando a MoreLogin...");
    const browser = await puppeteer.connect({
      browserWSEndpoint: startData.data.wsDetail,
      defaultViewport: null,
    });

    console.log("[REPUVE] 🌐 Abriendo la página del Gobierno...");
    const page = await browser.newPage();
    
    // Se cambia a domcontentloaded para que no se trabe si la página del gobierno es lenta
    await page.goto("https://www2.repuve.gob.mx:8443/ciudadania/", { waitUntil: "domcontentloaded", timeout: 45000 });
    
    console.log("[REPUVE] 📸 Buscando imagen del Captcha...");
    await page.waitForSelector('img[src*="captcha"]', { timeout: 10000 });
    
    const captchaBase64 = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"]') as HTMLImageElement;
      if (!img) return null;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d"); ctx?.drawImage(img, 0, 0);
      return canvas.toDataURL("image/jpeg").split(",")[1];
    });

    if (!captchaBase64) throw new Error("No se detectó la imagen del Captcha.");
    
    console.log("[REPUVE] 🤖 Imagen extraída. Enviando a la IA de 2Captcha...");
    const captchaResuelto = await solveImageCaptchaLocal(captchaBase64, API_KEY_2CAPTCHA);
    
    console.log("[REPUVE] ✅ Captcha resuelto:", captchaResuelto);

    // 6. Rellenar Placa y Captcha
    console.log("[REPUVE] ⌨️ Escribiendo placa y captcha en el formulario...");
    await page.type('input[name="placa"], #placa', placa);
    await page.type('input[name="captcha"], input[name="codigo"], #captcha', captchaResuelto);

    // 7. Simular clic en el botón de búsqueda y esperar a que cargue el resultado
    console.log("[REPUVE] 🖱️ Haciendo clic en Buscar...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"], input[type="submit"], .btn-primary, #btnBuscar').catch(() => null)
    ]);

    console.log("[REPUVE] 🎉 Proceso completado con éxito. Desconectando robot...");
    await browser.disconnect(); // Liberamos la conexión para que no consuma memoria

    return { exito: true, estatus: "Consulta enviada y Captcha resuelto (" + captchaResuelto + ")", placa };
  } catch (error: any) {
    console.error("[CheckAuto API] Error:", error);
    return { exito: false, error: error.message || "Error interno." };
  }
}