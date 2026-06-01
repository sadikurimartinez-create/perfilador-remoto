export const maxDuration = 60;
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

    console.log(`[REPUVE API] Contactando Robot Local en: ${localApiUrl}/repuve?placa=${placa}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let res;
    try {
      res = await fetch(`${localApiUrl}/repuve?placa=${placa}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      throw new Error(`No se pudo conectar con Ngrok (${localApiUrl}). Asegúrate de que el túnel esté activo y la URL sea correcta.`);
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`¡El túnel Ngrok ha caducado! La URL ${localApiUrl} ya no existe o es incorrecta. Reinicia Ngrok y actualiza la variable MORELOGIN_API_URL en Vercel.`);
      }
      throw new Error(`Error en el Robot Local: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[REPUVE API] Error:", error);
    return NextResponse.json({ exito: false, error: error.message || "Error interno." });
  }
}