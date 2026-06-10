export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { estado, municipio } = body;
    
    // Intenta usar la URL de ngrok si está configurada, si no, usa localhost directo.
    const NGROK_URL = process.env.ROBOT_NGROK_URL || "http://127.0.0.1:3005";
    const url = `${NGROK_URL}/rnpdno?estado=${encodeURIComponent(estado || "Aguascalientes")}&municipio=${encodeURIComponent(municipio || "Todos")}`;
    
    const res = await fetch(url, { method: "GET" });
    
    if (!res.ok) {
      throw new Error(`Error en la conexión con el Robot (Status: ${res.status})`);
    }

    const data = await res.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("[api/rnpdno] Error:", error);
    return NextResponse.json({ exito: false, error: error.message || "Error conectando al cuartel general (Robot RNPDNO)." }, { status: 500 });
  }
}