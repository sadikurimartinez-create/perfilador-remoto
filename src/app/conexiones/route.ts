import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

export const dynamic = 'force-dynamic';

// Función táctica para resolver Captchas de imagen usando 2Captcha
async function solveImageCaptcha(base64Image: string, apiKey: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("key", apiKey);
  formData.append("method", "base64");
  formData.append("body", base64Image);
  formData.append("json", "1");

  // 1. Enviar imagen a los servidores de 2Captcha
  const inRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: formData });
  const inData = await inRes.json();
  if (inData.status !== 1) throw new Error("Error enviando CAPTCHA: " + inData.request);

  const captchaId = inData.request;

  // 2. Esperar la respuesta (Polling cada 5 segundos, max 60s)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
    const resData = await resRes.json();
    
    if (resData.status === 1) return resData.request; // ¡Captcha resuelto!
    if (resData.request !== "CAPCHA_NOT_READY") throw new Error("Error de 2Captcha: " + resData.request);
  }
  throw new Error("Timeout: 2Captcha tardó demasiado en resolver la imagen.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { placa } = body;

    if (!placa) {
      return NextResponse.json({ error: "No se proporcionó una placa vehicular." }, { status: 400 });
    }

    // 🔑 TUS CREDENCIALES
    // El ID de tu perfil de MoreLogin
    const profileId = "2060114385070264320";
    // Tu API Key recién comprada en 2Captcha
    const API_KEY_2CAPTCHA = process.env.TWOCAPTCHA_API_KEY || "b57cb6e6e68ab65198220bbe3c4b6784"; 

    // 1. Llamamos a la API local de MoreLogin para encender el navegador
    const startRes = await fetch("http://127.0.0.1:40000/api/env/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env_id: profileId })
    });

    const startData = await startRes.json();

    if (startData.code !== 0 || !startData.data?.wsDetail) {
      return NextResponse.json(
        { error: "No se pudo iniciar MoreLogin. Revisa que la aplicación esté abierta y la API Local activa." }, 
        { status: 500 }
      );
    }

    // 2. Conectamos Puppeteer al navegador anti-detect que se acaba de abrir
    const browser = await puppeteer.connect({
      browserWSEndpoint: startData.data.wsDetail,
      defaultViewport: null,
    });

    const page = await browser.newPage();
    
    // 3. Navegamos al REPUVE Oficial y esperamos a que cargue
    await page.goto("https://www2.repuve.gob.mx:8443/ciudadania/", { waitUntil: "networkidle2" });
    
    // 4. Extracción de la imagen del Captcha
    // Esperamos a que aparezca la imagen del captcha en el DOM de REPUVE
    await page.waitForSelector('img[src*="captcha"]', { timeout: 10000 });
    
    const captchaBase64 = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"]') as HTMLImageElement;
      if (!img) return null;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      return canvas.toDataURL("image/jpeg").split(",")[1];
    });

    if (!captchaBase64) throw new Error("No se detectó la imagen del Captcha en la página.");

    // 5. Enviamos la imagen a 2Captcha para que la resuelvan
    const captchaResuelto = await solveImageCaptcha(captchaBase64, API_KEY_2CAPTCHA);

    // 6. Rellenar Placa y Captcha en la página
    await page.type('input[name="placa"], #placa', placa);
    await page.type('input[name="captcha"], input[name="codigo"], #captcha', captchaResuelto);

    // 7. Simular clic en el botón de búsqueda
    await page.click('button[type="submit"], input[type="submit"], .btn-primary, #btnBuscar');

    // 8. Esperar a que el gobierno nos devuelva el resultado
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(()=>null);

    // Devolvemos el resultado al Perfilador
    return NextResponse.json({
      estatus: "Consulta enviada y Captcha resuelto (" + captchaResuelto + ")",
      placa: placa
    }, { status: 200 });
  } catch (error: any) {
    console.error("[CheckAuto API] Error:", error);
    return NextResponse.json({ error: error.message || "Error interno al consultar REPUVE." }, { status: 500 });
  }
}