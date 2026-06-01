const express = require("express");
const puppeteer = require("puppeteer-core");
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

const MORELOGIN_API = "http://127.0.0.1:40000";
const PROFILE_ID = "2060114385070264320"; // Tu perfil de MoreLogin
const API_KEY_2CAPTCHA = "b57cb6e6e68ab65198220bbe3c4b6784"; 

app.all("/repuve", async (req, res) => {
  const placa = req.query.placa;
  if (!placa) return res.json({ exito: false, error: "Falta placa" });
  
  console.log(`[ROBOT] Iniciando búsqueda de placa: ${placa}`);
  try {
    let startRes;
    try {
      startRes = await fetch(`${MORELOGIN_API}/api/env/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env_id: PROFILE_ID }),
      });
    } catch (e) {
      throw new Error(`MoreLogin no responde en el puerto 40000. Verifica que la "API Local" esté activada en la configuración de la app.`);
    }

    const startData = await startRes.json();
    
    if (startData.code !== 0) throw new Error(`Error de MoreLogin: ${startData.msg || "Código " + startData.code}`);

    const browser = await puppeteer.connect({ browserWSEndpoint: startData.data.wsDetail, defaultViewport: null });
    const page = await browser.newPage();
    await page.goto("https://www2.repuve.gob.mx:8443/ciudadania/", { waitUntil: "domcontentloaded", timeout: 45000 });
    
    await page.waitForSelector('img[src*="captcha"]', { timeout: 10000 });
    const captchaBase64 = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"]');
      if (!img) return null;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d"); ctx?.drawImage(img, 0, 0);
      return canvas.toDataURL("image/jpeg").split(",")[1];
    });

    console.log("[ROBOT] Resolviendo Captcha...");
    const formData = new URLSearchParams();
    formData.append("key", API_KEY_2CAPTCHA); formData.append("method", "base64");
    formData.append("body", captchaBase64); formData.append("json", "1");
    
    const inRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: formData });
    const captchaId = (await inRes.json()).request;
    
    let captchaResuelto = "";
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resRes = await fetch(`https://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${captchaId}&json=1`);
      const resData = await resRes.json();
      if (resData.status === 1) { captchaResuelto = resData.request; break; }
    }

    await page.type('input[name="placa"]', placa);
    await page.type('input[name="captcha"]', captchaResuelto);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]').catch(() => null)
    ]);
    
    await browser.disconnect();
    
    res.json({ exito: true, estatus: "Consulta completada y Captcha resuelto (" + captchaResuelto + ")", placa });
  } catch (error) {
    console.error("[ROBOT] Error:", error.message);
    res.json({ exito: false, error: error.message });
  }
});

app.listen(3005, () => console.log("🤖 Servidor Robot local ejecutándose en el puerto 3005"));