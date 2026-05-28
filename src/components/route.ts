import { NextResponse } from "next/server";

// Si decides instalar puppeteer localmente, descomenta esta línea:
// import puppeteer from "puppeteer";

// ⚠️ Para producción en Vercel, necesitarás un servicio en la nube como Browserless.io o ScrapingBee
// porque Vercel no soporta navegadores completos dentro de sus funciones Serverless.

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { placa } = body;

    if (!placa) {
      return NextResponse.json({ error: "La placa o NIV es requerida." }, { status: 400 });
    }

    /* ============================================================================
       🤖 FASE 3: ROBOT DE WEB SCRAPING CON PUPPETEER (CÓDIGO BASE)
       Para activarlo localmente: npm install puppeteer
       ============================================================================
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // 1. Navegar a la base de datos (Ejemplo: página pública de REPUVE)
    await page.goto('https://www2.repuve.gob.mx:8443/ciudadania/');
    
    // 2. Ingresar la Placa
    await page.waitForSelector('#placa', { timeout: 5000 });
    await page.type('#placa', placa);

    // 3. Resolución de CAPTCHA (Requiere API de 2Captcha o AntiCaptcha)
    // const captchaImage = await page.$eval('#captchaImg', el => el.src);
    // const token = await resolverCaptchaExterno(captchaImage, 'TU_API_KEY_2CAPTCHA');
    // await page.type('#captchaInput', token);

    // 4. Ejecutar búsqueda y esperar resultados
    await page.click('#btnConsultar');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // 5. Extraer el dictamen (Los selectores exactos dependen de la web de gobierno)
    const estatus = await page.$eval('.resultado-estatus', el => el.textContent?.trim() || "SIN REPORTE");
    const marca = await page.$eval('.resultado-marca', el => el.textContent?.trim() || "VEHÍCULO SOSPECHOSO");
    const modelo = await page.$eval('.resultado-modelo', el => el.textContent?.trim() || "NO ESPECIFICADO");
    
    await browser.close();

    return NextResponse.json({ placa, estatus, marca, modelo, fechaConsulta: new Date().toISOString() }, { status: 200 });
    */

    // --- ⚠️ SIMULADOR TÁCTICO DE CONTINGENCIA (Mientras configuras Browserless o Puppeteer) ---
    // Simulación de retraso de red (como si el robot estuviera consultando la página pública)
    await new Promise(resolve => setTimeout(resolve, 2500));

    const isStolen = placa.includes("ROBO") || Math.random() > 0.85; // 15% de probabilidad de robo aleatorio

    const mockResult = {
      placa: placa,
      estatus: isStolen ? "REPORTE DE ROBO VIGENTE" : "SIN REPORTE DE ROBO",
      marca: "VEHÍCULO SOSPECHOSO",
      modelo: "MODELO NO ESPECIFICADO",
      fechaConsulta: new Date().toISOString()
    };

    return NextResponse.json(mockResult, { status: 200 });
  } catch (error: any) {
    console.error("[api/checkauto] Error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la consulta vehicular." },
      { status: 500 }
    );
  }
}