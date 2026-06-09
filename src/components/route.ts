import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Versión de diagnóstico para aislar el error 404.
export async function POST(req: Request) {
  try {
    // Este es un JSON de prueba para confirmar que la ruta es accesible.
    const mockData = {
      success: true,
      data: {
        eventosCriticos: [{ titulo: "PRUEBA DE CONEXIÓN EXITOSA", fuente: "Sistema de Diagnóstico", resumenTactico: "La ruta /api/osint/rss-parser ahora es accesible." }],
        totalNoticiasLeidas: 1,
        correlacionPlataforma: { conexionDenue: "OK", conexionScince: "OK", conexionHistorica: "OK" },
        conclusionOperativa: "El problema no es la ruta del archivo, sino el código que contiene. Probablemente falten variables de entorno de Google Cloud (GCP_PROJECT_ID, etc)."
      }
    };
    return NextResponse.json(mockData);
  } catch (error: any) {
    console.error("[RSS Parser API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
