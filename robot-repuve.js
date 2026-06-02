const express = require("express");
const puppeteer = require("puppeteer-core");
const http = require("http");
const app = express();

// Habilitar CORS para permitir peticiones directas desde la plataforma web (Vercel)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, ngrok-skip-browser-warning");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const MORELOGIN_PORT = 40000; // Puerto configurado en la API Local de MoreLogin
const PROFILE_ID = "2060114385070264320"; // Tu perfil de MoreLogin
const API_KEY_2CAPTCHA = "b57cb6e6e68ab65198220bbe3c4b6784"; 

// Función de red limpia y nativa (Node 22)
async function requestMoreLogin(path, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`http://127.0.0.1:${MORELOGIN_PORT}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Timeout de 60 segundos. MoreLogin no contestó.");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

app.all("/repuve", async (req, res) => {
  const placa = req.query.placa;
  if (!placa) return res.json({ exito: false, error: "Falta placa" });
  
  console.log(`\n========================================`);
  console.log(`[ROBOT] 🚀 Iniciando búsqueda de placa: ${placa}`);
  console.log(`========================================`);
  
  let browser = null;
  let page = null;
  try {
    console.log("[ROBOT] 1/7 📡 Solicitando a MoreLogin que inicie el navegador...");
    let startData;
    try {
      // Se envían ambas variantes del ID por compatibilidad con la nueva versión de la API de MoreLogin
      startData = await requestMoreLogin('/api/env/start', { envId: PROFILE_ID, env_id: PROFILE_ID });
    } catch (e) {
      console.error("[ROBOT] 🛑 Falla de conexión interna con MoreLogin:", e.message);
      throw new Error(`MoreLogin no respondió. Asegúrate de que la API Local esté en http://localhost:${MORELOGIN_PORT} y sin verificación de seguridad.`);
    }

    if (startData.code !== 0) throw new Error(`Error de MoreLogin: ${startData.msg || "Código " + startData.code}`);

    console.log(`[ROBOT]     ... Respuesta MoreLogin:`, JSON.stringify(startData));

    // Detección inteligente del puerto de conexión sin importar la versión de MoreLogin
    let endpointParams = {};
    if (startData.data) {
      if (startData.data.wsDetail) endpointParams = { browserWSEndpoint: startData.data.wsDetail };
      else if (startData.data.coreDetail) endpointParams = { browserURL: startData.data.coreDetail };
      else if (startData.data.webSocketDebuggerUrl) endpointParams = { browserWSEndpoint: startData.data.webSocketDebuggerUrl };
      else if (startData.data.debugPort) endpointParams = { browserURL: `http://127.0.0.1:${startData.data.debugPort}` };
      else if (typeof startData.data === 'string') {
        if (startData.data.startsWith('ws')) endpointParams = { browserWSEndpoint: startData.data };
        else if (startData.data.startsWith('http')) endpointParams = { browserURL: startData.data };
        else if (startData.data.includes(':')) endpointParams = { browserURL: `http://${startData.data}` };
      }
    }

    if (!endpointParams.browserWSEndpoint && !endpointParams.browserURL) {
      throw new Error(`No se pudo determinar el puerto del navegador. Respuesta completa: ${JSON.stringify(startData)}`);
    }

    console.log(`[ROBOT] 2/7 🌐 Conectando Puppeteer con:`, endpointParams);
    browser = await puppeteer.connect({ ...endpointParams, defaultViewport: null });
    
    console.log("[ROBOT] 3/7 📑 Abriendo nueva pestaña del navegador...");
    page.on('dialog', async dialog => {
      console.log(`\n[ROBOT] ⚠️ Alerta emergente de REPUVE detectada: "${dialog.message()}"`);
      await dialog.accept().catch(() => null);
    });
    
    console.log("[ROBOT] 4/7 ⏳ Navegando al sitio de REPUVE (Esto puede tardar hasta 45s si el servidor del gobierno está lento)...");
    
    let retries = 3;
    let loaded = false;
    while (retries > 0 && !loaded) {
      try {
        await page.goto("https://www2.repuve.gob.mx:8443/ciudadania/", { waitUntil: "domcontentloaded", timeout: 60000 });
        loaded = true;
      } catch (err) {
        retries--;
        console.log(`[ROBOT] ⚠️ Error conectando a REPUVE. Reintentos restantes: ${retries}. Detalles: ${err.message}`);
        if (retries === 0) throw new Error("No se pudo conectar a REPUVE después de varios intentos. El servidor del gobierno podría estar caído.");
        await new Promise(r => setTimeout(r, 5000)); // Esperar 5s antes de reintentar
      }
    }
    
    console.log("[ROBOT] 5/7 📸 Sitio cargado. Verificando disponibilidad de REPUVE...");
    
    // Verificar si cargó el formulario o si hay una pantalla de error
    const pageStatus = await page.evaluate(() => {
      const text = document.body.innerText.toUpperCase();
      if (document.querySelector('input[name="placa"]') || document.querySelector('#placa') || text.includes("NÚMERO DE PLACA")) return "OK";
      if (text.includes("JUST A MOMENT") || text.includes("CLOUDFLARE")) return "CLOUDFLARE";
      if (text.includes("SERVICIO NO DISPONIBLE") || text.includes("MANTENIMIENTO")) return "MANTENIMIENTO";
      return "DESCONOCIDO";
    });

    if (pageStatus === "CLOUDFLARE") throw new Error("REPUVE está bloqueando el acceso con Cloudflare. Resuelve el desafío manualmente en el navegador abierto.");
    if (pageStatus === "MANTENIMIENTO") throw new Error("El portal de REPUVE se encuentra en mantenimiento o fuera de servicio en este momento.");
    if (pageStatus === "DESCONOCIDO") {
      const pageTitle = await page.title();
      throw new Error(`La página cargó, pero no se encontró el formulario. Título: "${pageTitle}". Verifica la ventana abierta para ver qué pasó.`);
    }

    console.log("[ROBOT]     ... Formulario detectado. Verificando si el gobierno pide Captcha...");
    await new Promise(r => setTimeout(r, 2000)); // Dar tiempo a la imagen a renderizarse por completo

    const formNeedsCaptcha = await page.evaluate(() => {
      const hasInput = !!document.querySelector('input[name*="captcha" i], input[id*="captcha" i]');
      const hasIframe = !!document.querySelector('iframe[src*="recaptcha"]');
      const hasImage = !!document.querySelector('img[src*="captcha" i], img[alt*="captcha" i]');
      return hasInput || hasIframe || hasImage;
    });

    let captchaResuelto = "";
    let invisibleTokenInyectado = false;
    if (formNeedsCaptcha) {
      console.log("[ROBOT]     ... Captcha detectado en el sitio. Intentando extraer imagen...");
      const captchaBase64 = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const img = imgs.find(i => i.src.toLowerCase().includes('captcha')) || imgs.find(i => i.alt && i.alt.toLowerCase().includes('captcha'));
        if (!img) return null;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 150; 
        canvas.height = img.naturalHeight || img.height || 50;
        const ctx = canvas.getContext("2d"); ctx?.drawImage(img, 0, 0);
        return canvas.toDataURL("image/jpeg").split(",")[1];
      });

      if (!captchaBase64 || captchaBase64 === "data:,") {
        console.log("[ROBOT] ⚠️ No se encontró la imagen clásica del Captcha. Buscando llave oculta de reCaptcha invisible...");
        
        const sitekey = await page.evaluate(() => {
          const el = document.querySelector('[data-sitekey]');
          if (el) return el.getAttribute('data-sitekey');
          
          const iframe = document.querySelector('iframe[src*="sitekey="], iframe[src*="k="]');
          if (iframe) {
            const match = iframe.src.match(/sitekey=([^&]+)/);
            if (match) return match[1];
            const matchK = iframe.src.match(/k=([^&]+)/);
            if (matchK) return matchK[1];
          }
          
          const script = document.querySelector('script[src*="render="]');
          if (script) {
            const matchRender = script.src.match(/render=([^&]+)/);
            if (matchRender) return matchRender[1];
          }
          return null;
        });

        if (sitekey) {
          console.log(`[ROBOT] 6/7 🤖 reCaptcha invisible detectado (Sitekey: ${sitekey.substring(0,8)}...). Solicitando token a la IA...`);
          const pageUrl = encodeURIComponent(await page.url());
          const inRes = await fetch(`https://2captcha.com/in.php?key=${API_KEY_2CAPTCHA}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${pageUrl}&invisible=1&json=1`);
          const inData = await inRes.json();
          
          if (inData.status === 1) {
            const captchaId = inData.request;
            let token = "";
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 5000));
              console.log(`[ROBOT]     ... esperando token invisible de IA (intento ${i+1}/15)`);
              const resRes = await fetch(`https://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${captchaId}&json=1`);
              const resData = await resRes.json();
              if (resData.status === 1) { token = resData.request; break; }
            }
            
            if (token) {
              invisibleTokenInyectado = true;
              console.log(`[ROBOT]     ✅ Token invisible obtenido. Inyectando en la página...`);
              await page.evaluate((t) => {
                let textArea = document.getElementById('g-recaptcha-response');
                if (!textArea) {
                  textArea = document.createElement('textarea');
                  textArea.id = 'g-recaptcha-response';
                  textArea.name = 'g-recaptcha-response';
                  textArea.style.display = 'none';
                  document.body.appendChild(textArea);
                }
                textArea.value = t;
                textArea.innerHTML = t;
                
                // HACK MAESTRO CORREGIDO: Secuestrar el validador de Google sin romper la página
                window.grecaptcha = {
                  ready: function(cb) { if(typeof cb === 'function') cb(); },
                  execute: function() {
                    const cbElement = document.querySelector('[data-callback]');
                    if (cbElement) {
                      const cbName = cbElement.getAttribute('data-callback');
                      if (typeof window[cbName] === 'function') window[cbName](t);
                    }
                    return Promise.resolve(t);
                  },
                  getResponse: function() { return t; },
                  render: function() { return 0; },
                  reset: function() {}
                };
              }, token);
            } else {
              console.log("[ROBOT] ⚠️ La IA tardó demasiado en obtener el token invisible. Se intentará continuar.");
            }
          } else {
            console.log(`[ROBOT] ⚠️ Error al solicitar token a 2Captcha: ${inData.request}`);
          }
        } else {
          console.log("[ROBOT] ⚠️ No se detectó llave de reCaptcha. Se intentará buscar sin código...");
          await new Promise(r => setTimeout(r, 3000)); // Pausa por si la página sigue cargando
        }
      } else {
        console.log("[ROBOT] 6/7 🤖 Enviando Captcha a la IA (2Captcha) para resolverlo...");
        const formData = new URLSearchParams();
        formData.append("key", API_KEY_2CAPTCHA); formData.append("method", "base64");
        formData.append("body", captchaBase64); formData.append("json", "1");
        
        const inRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: formData });
        const captchaId = (await inRes.json()).request;
        
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 5000));
          console.log(`[ROBOT]     ... esperando respuesta de IA (intento ${i+1}/12)`);
          const resRes = await fetch(`https://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${captchaId}&json=1`);
          const resData = await resRes.json();
          if (resData.status === 1) { captchaResuelto = resData.request; break; }
        }
        if(!captchaResuelto) throw new Error("La IA tardó demasiado en resolver el Captcha.");
        console.log(`[ROBOT]     ✅ Captcha resuelto con éxito: ${captchaResuelto}`);
      }
    } else {
      console.log("[ROBOT] 6/7 🤖 ¡REPUVE no pidió Captcha! Saltando paso de Inteligencia Artificial...");
    }

    console.log("[ROBOT] 7/7 ⌨️ Escribiendo datos y buscando...");
    
    // Detección dinámica e inteligente de los elementos del formulario
    const formSelectors = await page.evaluate(() => {
      const result = { placa: null, captcha: null, submit: null };
      const inputs = Array.from(document.querySelectorAll('input'));
      
      const inputPlaca = inputs.find(i => 
        (i.name && i.name.toLowerCase().includes('placa')) || 
        (i.id && i.id.toLowerCase().includes('placa')) ||
        (i.placeholder && i.placeholder.toLowerCase().includes('placa'))
      );
      if (inputPlaca) { inputPlaca.id = 'robot-placa'; result.placa = '#robot-placa'; }
      
      const inputCaptcha = inputs.find(i => 
        (i.name && i.name.toLowerCase().includes('captcha')) || 
        (i.id && i.id.toLowerCase().includes('captcha')) ||
        (i.placeholder && i.placeholder.toLowerCase().includes('captcha'))
      );
      if (inputCaptcha) { inputCaptcha.id = 'robot-captcha'; result.captcha = '#robot-captcha'; }
      
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
      const btnSubmit = btns.find(b => {
        const text = (b.innerText || b.value || "").toUpperCase();
        return text.includes('BUSCAR') || text.includes('CONSULTAR') || b.type === 'submit';
      });
      if (btnSubmit) { btnSubmit.id = 'robot-submit'; result.submit = '#robot-submit'; }
      
      return result;
    });

    if (!formSelectors.placa) throw new Error("No se encontró la caja para ingresar la placa. El gobierno modificó fuertemente el formulario.");

    // Limpiamos la placa de saltos de línea ocultos que provocan un "Enter" accidental prematuro
    const placaLimpia = placa.replace(/[\r\n]/g, '').trim();
    await page.type(formSelectors.placa, placaLimpia, { delay: 150 });
    
    if (formNeedsCaptcha && captchaResuelto && formSelectors.captcha) {
      await page.type(formSelectors.captcha, captchaResuelto, { delay: 150 });
    }
    
    console.log("[ROBOT]     ... simulando comportamiento humano antes de enviar...");
    await new Promise(r => setTimeout(r, 2500)); // Pausa táctica anti-bots

    // Burlar el interceptor del botón enviando el formulario directamente si tenemos token invisible
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
      page.evaluate((selSubmit) => {
        const btn = document.querySelector(selSubmit);
        if (btn) btn.click();
        else { const form = document.querySelector('form'); if (form) form.submit(); }
      }, formSelectors.submit).catch(() => page.keyboard.press('Enter').catch(() => null))
    ]);
    
    console.log("[ROBOT] 🔍 Analizando el resultado arrojado por el gobierno...");
    await new Promise(r => setTimeout(r, 4000)); // Pausa ampliada para asegurar que la tabla cargue
    
    const analisis = await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const textoGlobal = document.body.innerText.toUpperCase();
      let estatus = "❓ ESTATUS NO DETERMINADO (Revisar plataforma oficial manualmente)";
      
      if (textoGlobal.includes("CON REPORTE DE ROBO") || textoGlobal.includes("ROBADO")) estatus = "⚠️ CON REPORTE DE ROBO (ALERTA CRÍTICA)";
      else if (textoGlobal.includes("SIN REPORTE DE ROBO") || textoGlobal.includes("NO CUENTA CON REPORTE")) estatus = "✅ SIN REPORTE DE ROBO";
      else if (textoGlobal.includes("RECUPERADO")) estatus = "🔄 VEHÍCULO RECUPERADO";
      else if (textoGlobal.includes("NO SE HA ENCONTRADO INFORMACIÓN") || textoGlobal.includes("NO SE ENCONTRARON REGISTROS") || textoGlobal.includes("SIN REGISTROS")) estatus = "❌ PLACA NO ENCONTRADA EN REPUVE";
      else if (textoGlobal.includes("RECAPTCHA NO FUE SUPERADO") || textoGlobal.includes("TEXTO DE LA IMAGEN NO COINCIDE") || textoGlobal.includes("VERIFIQUE EL CAPTCHA")) estatus = "⚠️ ERROR DE CAPTCHA: El gobierno bloqueó la consulta. (Reintentar en unos minutos)";
      else if (textoGlobal.includes("INGRESE SÓLO UN CRITERIO")) estatus = "⚠️ ERROR: El formulario no avanzó (posible página saturada)";

      // Extraer Marca, Modelo, Año y NIV buscando en las celdas de la tabla
      const datos = { marca: "N/A", modelo: "N/A", anio: "N/A", niv: "N/A" };
      const elementos = Array.from(document.querySelectorAll('td, th, span, div, p, b, strong'));
      
      for (let i = 0; i < elementos.length; i++) {
        const textoElemento = (elementos[i].innerText || "").toUpperCase().trim();
        let textoSiguiente = elementos[i + 1] ? (elementos[i + 1].innerText || "").toUpperCase().trim() : "";
        textoSiguiente = textoSiguiente.split('\n')[0]; // Limpiar saltos de línea

        if (textoElemento === "MARCA:" || textoElemento === "MARCA") datos.marca = textoSiguiente || "N/A";
        if (textoElemento === "MODELO:" || textoElemento === "MODELO") datos.modelo = textoSiguiente || "N/A";
        if (textoElemento === "AÑO MODELO:" || textoElemento === "AÑO:") datos.anio = textoSiguiente || "N/A";
        if (textoElemento === "NIV:" || textoElemento === "NIV" || textoElemento === "NÚMERO DE IDENTIFICACIÓN VEHICULAR (NIV):") datos.niv = textoSiguiente || "N/A";
      }

      // --- NAVEGACIÓN Y EXTRACCIÓN DE PESTAÑAS (FGJ, OCRA, USA/CAN, Avisos) ---
      const pestanas = { fgj: "N/A", ocra: "N/A", usa_can: "N/A", avisos: "N/A" };
      
      const clickAndReadTab = async (keywords) => {
        const tabs = Array.from(document.querySelectorAll('li, a, button, div, span'));
        // Buscar elementos cortos (pestañas) que coincidan con las palabras clave
        const target = tabs.find(t => keywords.some(kw => (t.innerText || "").toUpperCase().includes(kw)) && (t.innerText || "").length < 30);
        
        if (target) {
          target.click();
          await delay(1500); // Esperar 1.5s a que la pestaña revele su información
          const text = document.body.innerText.toUpperCase();
          if (text.includes("CON REPORTE DE ROBO") || text.includes("ROBADO")) return "⚠️ CON REPORTE DE ROBO";
          if (text.includes("SIN REPORTE DE ROBO") || text.includes("NO CUENTA CON REPORTE")) return "✅ SIN REPORTE DE ROBO";
          if (text.includes("RECUPERADO")) return "🔄 RECUPERADO";
          return "✅ SIN REPORTE / LIMPIO"; // Si no lanza alerta de robo, asumimos que está limpio
        }
        return "Pestaña no encontrada";
      };

      pestanas.fgj = await clickAndReadTab(["PGJ", "FGJ", "PROCURADURÍA", "FISCALÍA"]);
      pestanas.ocra = await clickAndReadTab(["OCRA"]);
      pestanas.usa_can = await clickAndReadTab(["USA", "CAN", "ESTADOS UNIDOS", "CANADÁ"]);
      pestanas.avisos = await clickAndReadTab(["AVISOS MINISTERIALES", "AVISOS", "JUDICIALES"]);

      // Corrección de estatus general si la tabla principal no tiene la palabra exacta pero las instituciones confirman
      if (estatus.includes("ESTATUS NO DETERMINADO")) {
        if (pestanas.fgj.includes("SIN REPORTE") || pestanas.ocra.includes("SIN REPORTE")) {
          estatus = "✅ SIN REPORTE DE ROBO (Verificado en instituciones)";
        } else if (pestanas.fgj.includes("CON REPORTE") || pestanas.ocra.includes("CON REPORTE") || pestanas.usa_can.includes("CON REPORTE")) {
          estatus = "⚠️ CON REPORTE DE ROBO (ALERTA CRÍTICA)";
        }
      }

      return { estatus, datos, pestanas, textoMuestra: textoGlobal.substring(0, 200).replace(/\n/g, ' ') };
    });

    console.log(`[ROBOT] 🎉 RESULTADO FINAL PARA ${placa}: ${analisis.estatus}`);
    if (analisis.datos.marca !== "N/A" || analisis.datos.niv !== "N/A") {
      console.log(`[ROBOT] 🚗 DATOS DEL VEHÍCULO: Marca: ${analisis.datos.marca} | Modelo: ${analisis.datos.modelo} | Año: ${analisis.datos.anio} | NIV: ${analisis.datos.niv}`);
      console.log(`[ROBOT] 📁 REPORTE POR INSTITUCIÓN:`);
      console.log(`        - FGJ/PGJ: ${analisis.pestanas.fgj}`);
      console.log(`        - OCRA: ${analisis.pestanas.ocra}`);
      console.log(`        - Robo USA/CAN: ${analisis.pestanas.usa_can}`);
      console.log(`        - Avisos Min/Jud: ${analisis.pestanas.avisos}`);
    } else {
      console.log(`[ROBOT] ⚠️ No se encontraron detalles del vehículo. Fragmento de la pantalla: "${analisis.textoMuestra}"`);
    }
    console.log("");
    
    // Generar un resumen en texto plano ideal para inyectar en la Hipótesis del frontend
    const resumenFormateado = `🚗 DATOS DEL VEHÍCULO: Marca: ${analisis.datos.marca} | Modelo: ${analisis.datos.modelo} | Año: ${analisis.datos.anio} | NIV: ${analisis.datos.niv}\n📁 REPORTE POR INSTITUCIÓN:\n        - FGJ/PGJ: ${analisis.pestanas.fgj}\n        - OCRA: ${analisis.pestanas.ocra}\n        - Robo USA/CAN: ${analisis.pestanas.usa_can}\n        - Avisos Min/Jud: ${analisis.pestanas.avisos}`;

    res.json({ 
      exito: true, 
      estatus: analisis.estatus, 
      placa, 
      vehiculo: analisis.datos, 
      instituciones: analisis.pestanas,
      resumenTexto: resumenFormateado
    });
  } catch (error) {
    console.error("\n[ROBOT] ❌ ERROR EN EL PROCESO:", error.message, "\n");
    res.json({ exito: false, error: error.message });
  } finally {
    if (page) {
      console.log("[ROBOT] 🧹 Cerrando pestaña de búsqueda...");
      await page.close().catch(()=>null);
    }
    if (browser) {
      console.log("[ROBOT] 🧹 Desconectando navegador...\n");
      await browser.disconnect().catch(()=>null);
    }
  }
});

app.listen(3005, () => console.log("🤖 Servidor Robot local ejecutándose en el puerto 3005"));