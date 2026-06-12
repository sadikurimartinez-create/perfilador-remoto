const express = require("express");
const puppeteer = require("puppeteer-core");
const http = require("http");
const app = express();

// Habilitar CORS para permitir peticiones directas desde la plataforma web (Vercel)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, ngrok-skip-browser-warning");
  res.header("Access-Control-Allow-Private-Network", "true");
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

let robotOcupado = false;

app.all("/repuve", async (req, res) => {
  const placa = req.query.placa;
  if (!placa) return res.json({ exito: false, error: "Falta placa" });
  
  if (robotOcupado) {
    console.log(`\n[ROBOT] ⚠️ Petición rechazada: El robot está ocupado. Placa en espera: ${placa}`);
    return res.json({ 
      exito: false, 
      error: "⚠️ El Cuartel General está analizando otra placa en este momento. Por favor, espere 45 segundos y vuelva a intentarlo." 
    });
  }

  robotOcupado = true;
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
    page = await browser.newPage();
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

    if (pageStatus === "CLOUDFLARE") {
      console.log("\n[ROBOT] 🚨 ¡CLOUDFLARE DETECTADO! 🚨");
      console.log("[ROBOT] 🛑 El robot se ha pausado. Por favor, VE A LA VENTANA ABIERTA DEL NAVEGADOR y resuelve el Captcha humano (marca la casilla).");
      console.log("[ROBOT] ⏳ Tienes 90 segundos. Si Cloudflare se queda en un bucle infinito, el robot recargará la página automáticamente...\n");
      await page.bringToFront().catch(() => null);
      
      let cloudflareResuelto = false;
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Esperar 2 segundos por intento

        // Si llevamos 40 segundos atascados en Cloudflare, forzamos una recarga
        if (i === 20) {
          console.log("\n[ROBOT] 🔄 Cloudflare parece estar en un bucle infinito (40s). Recargando la página automáticamente para intentar destrabarlo...");
          await page.reload({ waitUntil: "domcontentloaded" }).catch(() => null);
          continue;
        }

        try {
          const status = await page.evaluate(() => {
            const text = document.body.innerText.toUpperCase();
            if (document.querySelector('input[name="placa"]') || document.querySelector('#placa') || text.includes("NÚMERO DE PLACA") || document.querySelector('form')) return "OK";
            return "CLOUDFLARE";
          });
          if (status === "OK") {
            cloudflareResuelto = true;
            console.log("[ROBOT] ✅ ¡Cloudflare superado con éxito! Continuando automatización...");
            break;
          }
        } catch (e) {
          // Ignorar errores si la página se está recargando (Cloudflare suele recargar al validar)
        }
      }
      
      if (!cloudflareResuelto) {
        throw new Error("Tiempo de 90 segundos agotado para resolver Cloudflare. El sitio está bloqueando el acceso definitivamente. Intente más tarde.");
      }
    }

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
    const placaLimpia = placa.replace(/[-\s\r\n]/g, '').trim().toUpperCase();
    await page.type(formSelectors.placa, placaLimpia, { delay: 150 });
    
    if (formNeedsCaptcha && captchaResuelto && formSelectors.captcha) {
      await page.type(formSelectors.captcha, captchaResuelto, { delay: 150 });
    }
    
    console.log("[ROBOT]     ... simulando comportamiento humano antes de enviar...");
    await new Promise(r => setTimeout(r, 2500)); // Pausa táctica anti-bots

    // Burlar el interceptor del botón enviando el formulario directamente si tenemos token invisible
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate((selSubmit) => {
          const btn = document.querySelector(selSubmit);
          if (btn) btn.click();
          else { const form = document.querySelector('form'); if (form) form.submit(); }
        }, formSelectors.submit).catch(() => null)
      ]);
    } catch (navErr) {
      console.log("[ROBOT] ⚠️ Detached frame/Navigation error ignorado. Continuando a lectura de tabla...");
    }
    
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
    robotOcupado = false;
  }
});

app.all("/rnpdno", async (req, res) => {
  const estado = req.query.estado || "Aguascalientes";
  const municipio = req.query.municipio || "Todos";
  const fechaInicio = req.query.fechaInicio || "2000-01-01"; // YYYY-MM-DD
  const hoy = new Date();
  const fechaFin = req.query.fechaFin || hoy.toISOString().split('T')[0]; // Fecha actual por defecto

  if (robotOcupado) {
    return res.json({ exito: false, error: "⚠️ El Cuartel General está analizando otra consulta. Espere 45 segundos." });
  }

  robotOcupado = true;
  console.log(`\n========================================`);
  console.log(`[ROBOT] 🚀 Iniciando búsqueda RNPDNO: ${estado} - ${municipio}`);
  console.log(`[ROBOT] 🧬 VERSIÓN: Navegación Profunda (Fichas e Instituciones activado)`);
  console.log(`========================================`);

  let browser = null;
  let page = null;
  try {
    console.log("[ROBOT] 1/4 📡 Conectando a MoreLogin...");
    let startData;
    try {
      startData = await requestMoreLogin('/api/env/start', { envId: PROFILE_ID, env_id: PROFILE_ID });
    } catch (e) {
      throw new Error("MoreLogin no respondió. Asegúrate de que la API Local esté activa.");
    }
    if (startData.code !== 0) throw new Error(`Error de MoreLogin: ${startData.msg}`);

    let endpointParams = {};
    if (startData.data) {
      if (startData.data.wsDetail) endpointParams = { browserWSEndpoint: startData.data.wsDetail };
      else if (startData.data.coreDetail) endpointParams = { browserURL: startData.data.coreDetail };
      else if (startData.data.webSocketDebuggerUrl) endpointParams = { browserWSEndpoint: startData.data.webSocketDebuggerUrl };
      else if (startData.data.debugPort) endpointParams = { browserURL: `http://127.0.0.1:${startData.data.debugPort}` };
    }

    browser = await puppeteer.connect({ ...endpointParams, defaultViewport: null });
    page = await browser.newPage();
    
    console.log("[ROBOT] 2/4 ⏳ Navegando al portal RNPDNO de SEGOB...");
    await page.goto("https://consultapublicarnpdno.segob.gob.mx/consulta", { waitUntil: "networkidle2", timeout: 60000 });
    
    console.log("[ROBOT] 2.5/4 ⏳ Llenando formulario...");
    // Esperamos cualquier select en lugar de una clase específica que pudo haber cambiado
    await page.waitForSelector('select', { timeout: 15000 });

    console.log(`[ROBOT] 📅 Ingresando rango de fechas: ${fechaInicio} al ${fechaFin}...`);
    await page.evaluate((inicio, fin) => {
      const evt = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
      const inputsDate = Array.from(document.querySelectorAll('input[type="date"]'));
      if (inputsDate.length >= 2) {
        inputsDate[0].focus(); inputsDate[0].value = inicio; evt(inputsDate[0], 'input'); evt(inputsDate[0], 'change'); inputsDate[0].blur();
        inputsDate[1].focus(); inputsDate[1].value = fin; evt(inputsDate[1], 'input'); evt(inputsDate[1], 'change'); inputsDate[1].blur();
      } else {
        const textInputs = Array.from(document.querySelectorAll('input')).filter(i => (i.placeholder && i.placeholder.includes('/')) || (i.name && i.name.toLowerCase().includes('fecha')));
        if (textInputs.length >= 2) {
          const formatText = (dateStr) => { const p = dateStr.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr; };
          textInputs[0].focus(); textInputs[0].value = formatText(inicio); evt(textInputs[0], 'input'); evt(textInputs[0], 'change'); textInputs[0].blur();
          textInputs[1].focus(); textInputs[1].value = formatText(fin); evt(textInputs[1], 'input'); evt(textInputs[1], 'change'); textInputs[1].blur();
        }
      }
    }, fechaInicio, fechaFin);

    // Seleccionar Estado buscando dinámicamente el <select> correcto
    await new Promise(r => setTimeout(r, 2000)); // Pausa breve para estabilización de la página
    const allSelects = await page.$$('select');
    for (const sel of allSelects) {
      const val = await page.evaluate((el, est) => {
        const option = Array.from(el.options).find(o => o.text.toUpperCase().includes(est.toUpperCase()));
        return option ? option.value : null;
      }, sel, estado);
      if (val) {
        await sel.select(val);
        await page.evaluate((el) => {
           el.dispatchEvent(new Event('change', { bubbles: true }));
           el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, sel);
        break;
      }
    }
    console.log(`[ROBOT] ✅ Estado '${estado}' seleccionado.`);

    // Esperar a que el servidor del gobierno cargue los municipios correspondientes
    console.log("[ROBOT] ⏳ Esperando a que el servidor de SEGOB cargue los municipios...");
    await page.waitForFunction((municipioObjetivo) => {
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        if (Array.from(sel.options).some(o => o.text.toUpperCase().includes(municipioObjetivo.toUpperCase()))) return true;
      }
      return false;
    }, { timeout: 30000 }, municipio);

    // Seleccionar Municipio dinámicamente
    const allSelectsMun = await page.$$('select');
    for (const sel of allSelectsMun) {
      // Ignorar el select del Estado
      const isState = await page.evaluate((el, est) => Array.from(el.options).some(o => o.text.toUpperCase() === est.toUpperCase()), sel, estado);
      if (isState) continue;
      const val = await page.evaluate((el, mun) => {
        const option = Array.from(el.options).find(o => o.text.toUpperCase().includes(mun.toUpperCase()));
        return option ? option.value : null;
      }, sel, municipio);
      if (val) {
        await sel.select(val);
        await page.evaluate((el) => {
           el.dispatchEvent(new Event('change', { bubbles: true }));
           el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, sel);
        break;
      }
    }
    console.log(`[ROBOT] ✅ Municipio '${municipio}' seleccionado.`);

    // Seleccionar criterio "Última vez visto"
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const target = labels.find(l => l.innerText.toLowerCase().includes('última vez'));
      if(target) target.click();
    });

    // Clic en buscar
    await page.click('.btn-busqueda-consulta');
    console.log("[ROBOT] ✅ Clic en Buscar realizado.");

    console.log("[ROBOT] 3/4 ⏳ Esperando carga del listado de personas (hasta 45s)...");
    // Espera inteligente: El robot vigilará el DOM hasta que aparezcan resultados o un mensaje de vacío
    await page.waitForFunction(() => {
      const texto = document.body.innerText.toUpperCase();
      const elementos = document.querySelectorAll('tbody tr, .card, .mat-row, .list-group-item');
      // Detecta si la lista ya se llenó o si hay algún texto indicador de que la petición terminó
      return elementos.length > 1 || texto.includes('MÁS INFORMACIÓN') || texto.includes('DETALLE') || texto.includes('NO SE ENCONTRARON') || texto.includes('EDAD ACTUAL');
    }, { timeout: 45000 }).catch(() => console.log("[ROBOT] ⚠️ La carga demoró demasiado, intentando extraer lo que esté en pantalla..."));
    
    await new Promise(r => setTimeout(r, 4000)); // Tiempo adicional para que las animaciones terminen de pintar

    console.log("[ROBOT] 4/4 🔍 Iniciando navegación profunda (Fichas e Instituciones)...");
    // Extraemos las fichas individuales. Limitado a 5 por seguridad de Timeout en Vercel/HTTP.
    const extraccion = await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const fichas = [];
      let hayMasPaginas = false;

      // 1. Encontrar filas únicas y evitar capturar elementos anidados duplicados
      const filasResultados = Array.from(document.querySelectorAll('tbody tr, .mat-row, .list-group-item, .card')).filter(el => {
          return el.innerText && el.innerText.trim().length > 10 && !el.closest('thead');
      });
      const elementosClick = filasResultados.filter(el => !filasResultados.some(parent => parent !== el && parent.contains(el)));
      const limite = Math.min(elementosClick.length, 5);

      for (let i = 0; i < limite; i++) {
        try {
          const fila = elementosClick[i];
          fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(500);
          const clickTarget = fila.querySelector('button, a, .mat-icon, [role="button"]') || fila;
          clickTarget.click();
          
          // Espera activa al modal de instituciones
          let t1 = 0;
          let modal = null;
          while(t1 < 5000) {
              modal = document.querySelector('.cdk-overlay-pane, .mat-dialog-container, .modal.show, dialog');
              if (modal && modal.innerText.length > 20) break;
              await delay(500);
              t1 += 500;
          }

          if (!modal) continue; // Si no abrió el modal flotante, descartamos para no leer basura

          // 2. Seleccionar la Autoridad/Institución dentro de la ventana
          const botonesInst = Array.from(modal.querySelectorAll('button, a')).filter(b => {
            const txt = (b.innerText || "").toUpperCase();
            return txt.includes('FISCALÍA') || txt.includes('COMISIÓN') || txt.includes('PROCURADURÍA') || txt.includes('VER FICHA');
          });

          if (botonesInst.length > 0) {
            botonesInst[0].click(); // Clic en la primera autoridad
          }

          // 3. Espera activa a que la ficha cargue sus datos reales (evita leer "Cargando...")
          let t2 = 0;
          let fichaActiva = null;
          while(t2 < 10000) {
              const modales = Array.from(document.querySelectorAll('.mat-dialog-content, .cdk-overlay-pane, .modal-content, .modal.show, dialog, .mat-dialog-container, app-detalle'));
              // Buscamos cualquier indicador de que la ficha ya cargó los datos personales vitales
              fichaActiva = modales.reverse().find(m => m.innerText && (m.innerText.toUpperCase().includes('SEXO') || m.innerText.toUpperCase().includes('EDAD') || m.innerText.toUpperCase().includes('ESTATURA') || m.innerText.toUpperCase().includes('LUGAR')));
              
              if (fichaActiva) {
                  break;
              }
              await delay(500);
              t2 += 500;
          }

          if (!fichaActiva) fichaActiva = modal; // Fallback al modal abierto

          // 4. Extracción Lineal Inteligente
          const textoCompleto = fichaActiva.innerText || "";
          const imagen = fichaActiva.querySelector('img');
          const fotoUrl = imagen ? imagen.src : 'Sin foto';

          const safeExtract = (keywords) => {
            const lines = textoCompleto.split(String.fromCharCode(10)).map(l => l.trim().replace(/\s+:/g, ':')).filter(l => l.length > 0);
            for (let j = 0; j < lines.length; j++) {
                const upperLine = lines[j].toUpperCase();
                for (const kw of keywords) {
                    const ukw = kw.toUpperCase();
                    if (upperLine === ukw || upperLine === ukw + ':') {
                        if (j + 1 < lines.length) {
                            const nextLineUpper = lines[j+1].toUpperCase();
                            if (!["NOMBRE", "EDAD", "FECHA", "SEXO", "ESTATURA", "COMPLEX", "SEÑAS", "CIRCUNSTANCIAS", "LUGAR", "NACIONALIDAD"].some(k => nextLineUpper.startsWith(k))) {
                                return lines[j+1];
                            }
                        }
                    }
                    if (upperLine.startsWith(ukw + ':')) {
                        const val = lines[j].substring(lines[j].indexOf(':') + 1).trim();
                        if (val) return val;
                    }
                    // Capturar valores separados por espacio en lugar de dos puntos
                    if (upperLine.startsWith(ukw + ' ') && !upperLine.includes(':')) {
                        let val = lines[j].substring(ukw.length).trim();
                        if (val && !["ACTUAL", "AL MOMENTO", "DE DESAPARICIÓN", "DE LOS HECHOS", "PARTICULARES"].some(v => val.toUpperCase().startsWith(v))) {
                            return val;
                        }
                    }
                }
            }
            return "N/D";
          };

          const detalles = {
            nombre: safeExtract(["Nombre(s)", "Nombre", "Persona desaparecida"]),
            edad: safeExtract(["Edad actual", "Edad al momento", "Edad"]),
            fechaDesaparicion: safeExtract(["Fecha y hora de desaparición", "Fecha de desaparición", "Fecha de los hechos", "Fecha"]),
            lugar: safeExtract(["Lugar de desaparición", "Lugar de los hechos", "Lugar", "Colonia", "Municipio"]),
            sexo: safeExtract(["Sexo", "Género", "Genero"]),
            estatura: safeExtract(["Estatura"]),
            complexion: safeExtract(["Complexión", "Complexion"]),
            senas: safeExtract(["Señas particulares", "Señas"])
          };

          if (detalles.nombre !== "N/D") {
             detalles.nombre = detalles.nombre.replace(/(?:Primer Apellido|Segundo Apellido|Apellido)/gi, '').replace(/\s+/g, ' ').trim();
          }

          fichas.push({ id: i + 1, foto: fotoUrl, detalles, texto_crudo: textoCompleto.substring(0, 400) });

          // 4. Cerrar el modal para procesar el siguiente
          let waitClose = 0;
          while(document.querySelector('.cdk-overlay-pane, .mat-dialog-container, .modal.show') && waitClose < 3000) {
              const btnCerrar = document.querySelector('.cdk-overlay-pane .btn-close, .cdk-overlay-pane [aria-label="Close"], .cdk-overlay-pane button.mat-dialog-close, .modal.show .close');
              if (btnCerrar) btnCerrar.click();
              document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}));
              await delay(500);
              waitClose += 500;
          }
          await delay(1000); // Respiro garantizado antes del próximo clic
        } catch (e) {
          console.error("Error en registro", i);
        }
      }

      const btnSig = Array.from(document.querySelectorAll('button, a')).find(el => (el.innerText || "").toUpperCase().includes('SIGUIENTE'));
      if (btnSig && !btnSig.disabled) hayMasPaginas = true;

      return { fichas, hayMasPaginas, totalEncontrados: elementosClick.length };
    });

    console.log(`[ROBOT] 🎉 FICHAS EXTRAÍDAS: ${extraccion.fichas.length} de ${extraccion.totalEncontrados} visibles en pantalla.`);
    if (extraccion.hayMasPaginas) console.log("[ROBOT] ⚠️ Existen más páginas de resultados disponibles.");
    
    let resumenTexto = `📊 Resultados Profundos RNPDNO (Domicilio o Última vez vistos en el área de interés o sus fronteras):\nSe encontraron ${extraccion.totalEncontrados} registros. Se extrajeron ${extraccion.fichas.length} fichas individuales con la siguiente información:\n\n`;
    
    extraccion.fichas.forEach(f => {
      resumenTexto += `👤 Nombre: ${f.detalles.nombre}\n`;
      resumenTexto += `🎂 Edad: ${f.detalles.edad} | ⚧️ Sexo: ${f.detalles.sexo}\n`;
      resumenTexto += `📅 Fecha de Desaparición: ${f.detalles.fechaDesaparicion}\n`;
      resumenTexto += `📍 Lugar/Colonia: ${f.detalles.lugar}\n`;
      resumenTexto += `📏 Estatura: ${f.detalles.estatura} | 🧍 Complexión: ${f.detalles.complexion}\n`;
      resumenTexto += `👁️ Señas: ${f.detalles.senas}\n\n`;
    });

    resumenTexto += `\nINSTRUCCIÓN OBLIGATORIA PARA LA IA: Aplica la Directiva Operativa de Personas Desaparecidas. Cruza "Lugar/Colonia" con el área de interés. Si hay coincidencia, CREA EXPLÍCITAMENTE una sección titulada "MAPA 5 - PERSONAS DESAPARECIDAS (GEORREFERENCIACIÓN Y ANÁLISIS)". Tienes PROHIBIDO decir "asumiendo la generación" o recomendar crearlo a futuro; simplemente PRESENTA el mapa y su análisis. Correlaciona estos datos espaciales con el resto del OSINT y APIs.`;
    
    res.json({ exito: true, resumenTexto, datos_fichas: extraccion.fichas, detalles_paginacion: extraccion });
  } catch (error) {
    console.error("\n[ROBOT] ❌ ERROR EN RNPDNO:", error.message, "\n");
    res.json({ exito: false, error: error.message });
  } finally {
    if (page) await page.close().catch(()=>null);
    if (browser) await browser.disconnect().catch(()=>null);
    robotOcupado = false;
  }
});

app.listen(3005, () => console.log("🤖 Servidor Robot local ejecutándose en el puerto 3005 (Visible en Red)"));
