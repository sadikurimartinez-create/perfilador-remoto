import { NextResponse } from "next/server";

export const maxDuration = 60; // Configuración permitida para Vercel Pro (Da margen para resolver Cloudflare)
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const placa = body.placa;

    if (!placa) {
      return NextResponse.json({ exito: false, error: "No se proporcionó una placa vehicular." }, { status: 400 });
    }

    // Busca el NGROK_URL en las variables de entorno, o intenta localmente por defecto.
    const botUrl = (process.env.NGROK_URL || process.env.NEXT_PUBLIC_NGROK_URL || "http://127.0.0.1:3005").trim().replace(/\/$/, "");

    console.log(`[Vercel Backend] Enlazando con el Robot en: ${botUrl}/repuve?placa=${placa}`);
    
    // Damos 55 segundos de timeout para evitar exceder el límite de 60s de Vercel
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const res = await fetch(`${botUrl}/repuve?placa=${placa}`, {
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true", "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ exito: false, error: `Error en el Servidor Ngrok/Robot: Código ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Vercel Backend] Error conectando con el Robot:", error);
    return NextResponse.json({ exito: false, error: "Fallo de conexión al Robot. Verifica que Ngrok esté encendido en la PC raíz." }, { status: 500 });
  }
}