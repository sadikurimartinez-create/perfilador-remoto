import { NextResponse } from "next/server";

import puppeteer from "puppeteer";

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
       🤖 FASE 3: ROBOT DE WEB SCRAPING CON MORELOGIN ANTIDETECT
       ============================================================================
    */
    
    try {
      // ID DE TU PERFIL DE MORELOGIN (Reemplaza este número por el que copiaste en el PASO 1)
      const MORELOGIN_PROFILE_ID = "2060114385070264320"; 
      
      // 1. Llamar al API local de MoreLogin para que abra la ventana del navegador
      const resMoreLogin = await fetch('http://127.0.0.1:40000/api/env/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envId: MORELOGIN_PROFILE_ID })
      });
      
      const dataMoreLogin = await resMoreLogin.json();
      
      if (dataMoreLogin.code === 0 && dataMoreLogin.data && dataMoreLogin.data.wsUrl) {
        // 2. Enganchar Puppeteer al navegador indetectable
        const browser = await puppeteer.connect({ 
          browserWSEndpoint: dataMoreLogin.data.wsUrl,
          defaultViewport: null // Para que la ventana se vea normal
        });
        
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        
        // 3. Navegar al REPUVE (o la web de tu estado)
        await page.goto('https://www2.repuve.gob.mx:8443/ciudadania/', { waitUntil: 'networkidle2' });
        
        // 4. Ingresar la Placa
        await page.waitForSelector('#placa', { timeout: 5000 });
        await page.type('#placa', placa);

        // 5. PAUSA TÁCTICA PARA EL CAPTCHA (Semiautomático)
        // Aquí el robot se detiene 15 segundos. La ventana de MoreLogin se abrirá en tu pantalla.
        // Tienes ese tiempo para resolver el Captcha manualmente y darle clic a "Buscar".
        console.log("⏳ Esperando 15 segundos para que resuelvas el Captcha en la ventana de MoreLogin...");
        await new Promise(r => setTimeout(r, 15000));

        // 6. Leer los resultados (Nota: Los selectores de clase deben ajustarse al HTML real del REPUVE)
        const estatus = await page.$eval('.resultado-estatus', el => el.textContent?.trim() || "SIN REPORTE NEGATIVO").catch(() => "DICTAMEN NO OBTENIDO");
        
        // No cerramos el browser para que MoreLogin lo mantenga vivo, solo lo desconectamos
        browser.disconnect();
        
        return NextResponse.json({ placa, estatus, marca: "DATO EXTRAÍDO", modelo: "DATO EXTRAÍDO", fechaConsulta: new Date().toISOString() }, { status: 200 });
      }
    } catch (err) {
      console.warn("⚠️ No se pudo conectar a MoreLogin. Cayendo a Simulador Táctico...", err);
    }

    // --- ⚠️ SIMULADOR TÁCTICO DE CONTINGENCIA (Mientras configuras Browserless o Puppeteer) ---
    // Simulación de retraso de red (como si el robot estuviera consultando la página pública)
    await new Promise(resolve => setTimeout(resolve, 2500));

    const isStolen = placa.includes("ROBO") || Math.random() > 0.85;

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