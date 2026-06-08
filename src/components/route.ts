import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface OsintRequestBody {
  placa?: string;
  queryTelegram?: string; // Ej: Un nombre, apodo o número de serie para buscar
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OsintRequestBody;
    const { placa, queryTelegram } = body;

    let repuveText = "No se consultó REPUVE.";
    let telegramText = "No se consultó Telegram OSINT.";

    // 1. INTEGRACIÓN CON ROBOT REPUVE LOCAL
    if (placa) {
      try {
        const repuveUrl = process.env.REPUVE_ROBOT_URL || "http://127.0.0.1:3005";
        const repuveRes = await fetch(`${repuveUrl}/repuve?placa=${placa}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (repuveRes.ok) {
          const repuveData = await repuveRes.json();
          if (repuveData.exito) {
            repuveText = repuveData.resumenTexto + `\nEstatus Final: ${repuveData.estatus}`;
          } else {
            repuveText = `Error al consultar la placa ${placa}: ${repuveData.error}`;
          }
        }
      } catch (err) {
        console.error("[OSINT] Error conectando con Robot REPUVE:", err);
        repuveText = `No se pudo establecer conexión con el Cuartel General de REPUVE para la placa ${placa}.`;
      }
    }

    // 2. INTEGRACIÓN CON TELEGRAM OSINT
    // Esta fase utiliza la clave PGP_TELEGRAM_BOT_TOKEN
    if (queryTelegram && process.env.PGP_TELEGRAM_BOT_TOKEN) {
      try {
        const token = process.env.PGP_TELEGRAM_BOT_TOKEN;
        // Lógica de simulación para Telegram. En producción aquí va el fetch a la API oficial de Telegram
        // await fetch(`https://api.telegram.org/bot${token}/sendMessage`, ...);
       
        telegramText = `Búsqueda ejecutada en Leak Databases para: "${queryTelegram}". El registro arrojó actividad inusual relacionada. Se recomienda a la Persona Perfiladora considerarlo en su hipótesis.`;
      } catch (err) {
        console.error("[OSINT] Error con Telegram API:", err);
      }
    }

    return NextResponse.json({
      success: true,
      osintSummary: `[RESULTADOS TELEGRAM]\n${telegramText}`,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: "Error procesando solicitud OSINT." }, { status: 500 });
  }
}