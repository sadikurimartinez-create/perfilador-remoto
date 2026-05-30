import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Faltan las coordenadas (lat, lng) para consultar SCINCE." },
        { status: 400 }
      );
    }

    // TODO: Aquí debes realizar la petición real HTTP (fetch) a los servidores de INEGI SCINCE 
    // utilizando la variable 'token' y las coordenadas (lat, lng).
    
    // Simulador de datos demográficos basados en la coordenada (para tener variabilidad)
    // hasta que se implemente un geocodificador inverso hacia AGEB/Manzana.
    const seed = Math.abs(Math.sin(lat * lng)) * 10000;
    const poblacion = Math.floor(100 + (seed % 400));
    const viviendas = Math.floor(poblacion / 3.5);
    const deshabitadas = Math.floor((seed % 15));
    const marginacion = (seed % 100) > 80 ? "Alto" : (seed % 100) > 40 ? "Medio" : "Bajo";

    const data = {
      coordenadas: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      poblacionTotal: poblacion.toString(), 
      viviendasTotales: viviendas.toString(),
      viviendasDeshabitadas: deshabitadas.toString(),
      gradoMarginacion: marginacion,
    };

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("[API SCINCE] Error al procesar la solicitud:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar INEGI SCINCE." },
      { status: 500 }
    );
  }
}