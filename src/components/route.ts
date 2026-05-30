import { NextResponse } from "next/server";

// Método GET para poder verificar fácilmente en el navegador si Vercel ya subió el archivo
export async function GET() {
  return NextResponse.json({ status: "🟢 API de INEGI DENUE conectada y en línea" }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, radio = 500 } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Faltan coordenadas (lat, lng) para consultar DENUE." },
        { status: 400 }
      );
    }

    const token = process.env.INEGI_DENUE_TOKEN || "dbf9098a-165e-4938-a5fc-841bd476e357";
    
    // API Oficial DENUE v1 de INEGI
    const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/${lat},${lng}/${radio}/${token}`;

    const res = await fetch(url);
    
    if (!res.ok) {
      return NextResponse.json(
        { error: `Error de la API de INEGI: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return NextResponse.json({ 
        total: 0, 
        resumen: "No se encontraron negocios o la API devolvió un formato no esperado." 
      }, { status: 200 });
    }

    const negocios = data.map((n: any) => `${n.Nombre} (${n.Clase_actividad})`);
    const topNegocios = negocios.slice(0, 8).join(" | ");
    
    return NextResponse.json({
      total: data.length,
      resumen: data.length > 0 ? `${topNegocios}${data.length > 8 ? `... y ${data.length - 8} más` : ""}` : "Ninguno."
    }, { status: 200 });

  } catch (error: any) {
    console.error("[API DENUE] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar DENUE." }, 
      { status: 500 }
    );
  }
}