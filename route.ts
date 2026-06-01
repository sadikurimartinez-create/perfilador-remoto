export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const placa = body.placa;

    if (!placa) {
      return NextResponse.json({ exito: false, error: "No se proporcionó una placa." }, { status: 400 });
    }

    const localApiUrl = (process.env.MORELOGIN_API_URL || "http://127.0.0.1:3005").trim().replace(/\/$/, "");
    console.log(`[REPUVE API] Contactando Robot Local en: ${localApiUrl}/repuve?placa=${placa}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let res;
    try {
      res = await fetch(`${localApiUrl}/repuve?placa=${placa}`, {
        method: "GET",
        headers: { "ngrok-skip-browser-warning": "true" },
        cache: "no-store",
        signal: controller.signal
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({ exito: false, error: `No se pudo conectar con Ngrok (${localApiUrl}). El túnel está apagado o la URL es incorrecta.` });
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ exito: false, error: `Ngrok devolvió 404. La URL ${localApiUrl} ya caducó. Reinicia Ngrok y actualiza Vercel.` });
      }
      return NextResponse.json({ exito: false, error: `Error en el Robot Local: ${res.status}` });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[REPUVE API] Error:", error);
    return NextResponse.json({ exito: false, error: error.message || "Error interno." });
  }
}