import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Rich, realistic criminological connections graph for Aguascalientes (CEIPOL / CIFA alignment)
    const data = [
      { source: "Cártel de Sinaloa (CDS)", target: "Los Rodolfos / Clica Norte", type: "ORGANIZACIÓN", weight: 3 },
      { source: "Cártel Jalisco Nueva Generación (CJNG)", target: "La Oficina", type: "ORGANIZACIÓN", weight: 4 },
      { source: "La Oficina", target: "Punto de Venta Pilar Blanco", type: "UBICACIÓN", weight: 2 },
      { source: "La Oficina", target: "Distribución Villas de Nuestra Señora", type: "UBICACIÓN", weight: 3 },
      { source: "Los Rodolfos / Clica Norte", target: "Atractor Ojocaliente I", type: "UBICACIÓN", weight: 2 },
      { source: "Cártel de Sinaloa (CDS)", target: "Zona Centro Distribución", type: "UBICACIÓN", weight: 1 },
      { source: "Los Rodolfos / Clica Norte", target: "Líder: 'El Buda'", type: "PERSONA", weight: 4 },
      { source: "La Oficina", target: "Operador: 'El Gordo'", type: "PERSONA", weight: 3 },
      { source: "Cártel Jalisco Nueva Generación (CJNG)", target: "Líder Plaza: 'El Menchito'", type: "PERSONA", weight: 5 },
      
      // Additional nodes to ensure graph complexity and professional feel
      { source: "La Oficina", target: "Cártel de Sinaloa (CDS)", type: "RIVALIDAD TÁCTICA", weight: 2 },
      { source: "Los Rodolfos / Clica Norte", target: "Distribuidor: 'El Chori'", type: "PERSONA", weight: 3 },
      { source: "Distribuidor: 'El Chori'", target: "Atractor Ojocaliente I", type: "UBICACIÓN", weight: 2 },
      { source: "Líder: 'El Buda'", target: "Atractor Ojocaliente I", type: "UBICACIÓN", weight: 1 }
    ];

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[BigQuery API Mock] Error generating connections graph data:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      data: [
        { source: "Red de Respaldo", target: "Nodo de Emergencia", type: "ORGANIZACIÓN", weight: 1 }
      ]
    }, { status: 500 });
  }
}
