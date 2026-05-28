import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng } = body;

    if (!lat || !lng) {
      return NextResponse.json({ error: "Se requieren coordenadas (latitud y longitud)." }, { status: 400 });
    }

    // Simulación de retraso de red (Simulando conexión a los servidores de INEGI)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // DATO SIMULADO (Prueba de Concepto). 
    // En producción, esto hace fetch a la API del SCINCE con la lat/lng de la manzana.
    const mockResult = {
      coordenadas: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      poblacionTotal: Math.floor(Math.random() * 500) + 150, // 150 a 650 personas en la manzana
      viviendasTotales: Math.floor(Math.random() * 150) + 50,
      viviendasDeshabitadas: Math.floor(Math.random() * 20) + 5, // 5 a 25 casas abandonadas (Ventanas Rotas)
      gradoMarginacion: Math.random() > 0.5 ? "MEDIO" : "ALTO",
      estatus: "DATOS OBTENIDOS CON ÉXITO",
      fuente: "INEGI SCINCE (Censo de Población y Vivienda)"
    };

    return NextResponse.json(mockResult, { status: 200 });
  } catch (error: any) {
    console.error("[api/osint/scince] Error:", error);
    return NextResponse.json({ error: "Error interno al consultar INEGI SCINCE." }, { status: 500 });
  }
}