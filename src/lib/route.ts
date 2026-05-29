import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng } = body;

    if (lat == null || lng == null) {
      return NextResponse.json({ error: "Se requieren coordenadas válidas (lat, lng)." }, { status: 400 });
    }

    // Generamos datos demográficos tácticos locales simulados basados en las coordenadas,
    // respondiendo a la estructura que espera la interfaz (SCINCE OSINT)
    const seed = Math.floor(Math.abs(lat * lng * 10000));
    
    const poblacionTotal = 150 + (seed % 300);
    const viviendasTotales = Math.floor(poblacionTotal / 3.5);
    // Cálculo dinámico de abandono de vivienda (5% a 20%)
    const viviendasDeshabitadas = Math.floor(viviendasTotales * (0.05 + ((seed % 15) / 100)));
    
    const marginacionScore = seed % 100;
    let gradoMarginacion = "Medio";
    if (marginacionScore > 80) gradoMarginacion = "Muy Alto";
    else if (marginacionScore > 60) gradoMarginacion = "Alto";
    else if (marginacionScore < 20) gradoMarginacion = "Bajo";

    return NextResponse.json({
      coordenadas: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      poblacionTotal,
      viviendasTotales,
      viviendasDeshabitadas,
      gradoMarginacion
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}