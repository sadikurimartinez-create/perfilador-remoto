export const maxDuration = 60; // ¡AQUÍ SÍ FUNCIONAN LOS 60 SEGUNDOS!
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placa = searchParams.get("placa");

    if (!placa) {
      return NextResponse.json({ exito: false, error: "No se proporcionó una placa vehicular." }, { status: 400 });
    }

    const localApiUrl = (process.env.MORELOGIN_API_URL || "http://127.0.0.1:3005").trim().replace(/\/$/, "");

    console.log(`[REPUVE API] 📡 Contactando API Local de Scraping en: ${localApiUrl}/repuve?placa=${placa}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const res = await fetch(`${localApiUrl}/repuve?placa=${placa}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Error en API Local: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[REPUVE API] Error:", error);
    if (error.name === "AbortError") {
      return NextResponse.json({ exito: false, error: "El Robot tardó más de 55 segundos. La página del gobierno está lenta o el Captcha fue muy difícil. Intenta de nuevo." });
    }
    return NextResponse.json({ exito: false, error: error.message || "Error interno." });
  }
}