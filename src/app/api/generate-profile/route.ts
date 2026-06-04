import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic"; // Asegura que siempre traiga datos frescos

export async function GET() {
  try {
    const pool = getPool();
    
    // Extraemos todos los registros ordenados por el más reciente
    const { rows } = await pool.query(
      "SELECT * FROM analisis_ml_features ORDER BY fecha_analisis DESC"
    );

    if (rows.length === 0) {
      return new NextResponse("No hay datos suficientes para exportar. Genera algunos perfiles primero.", { status: 404 });
    }

    // Extraer los nombres de las columnas para los encabezados del CSV
    const headers = Object.keys(rows[0]).join(",");

    // Formatear cada fila correctamente
    const csvRows = rows.map((row) => {
      return Object.values(row)
        .map((val) => {
          if (val === null || val === undefined) return "";
          
          // Si es texto y contiene comas, comillas o saltos de línea, lo envolvemos en comillas
          const strVal = String(val);
          if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        })
        .join(",");
    });

    const csvContent = [headers, ...csvRows].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dataset_ml_perfil_remoto.csv"',
      },
    });
  } catch (error) {
    console.error("[api/export-ml] Error exportando CSV de Machine Learning:", error);
    return new NextResponse("Error interno al exportar los datos.", { status: 500 });
  }
}