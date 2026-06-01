import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { municipio, estado, anio } = body;

        if (!municipio || !estado) {
            return NextResponse.json(
                { error: "Faltan parámetros: 'municipio' y 'estado' son requeridos." },
                { status: 400 }
            );
        }

        const pool = getPool();
        
        // Construimos la consulta sumando todos los meses para tener el total anual.
        // Filtramos por estado y municipio usando ILIKE para ignorar mayúsculas, minúsculas o acentos.
        let query = `
            SELECT 
                tipo_delito,
                subtipo_delito,
                (COALESCE(enero, 0) + COALESCE(febrero, 0) + COALESCE(marzo, 0) + 
                 COALESCE(abril, 0) + COALESCE(mayo, 0) + COALESCE(junio, 0) + 
                 COALESCE(julio, 0) + COALESCE(agosto, 0) + COALESCE(septiembre, 0) + 
                 COALESCE(octubre, 0) + COALESCE(noviembre, 0) + COALESCE(diciembre, 0)) as total_anual
            FROM incidencia_sesnsp_municipal
            WHERE entidad ILIKE $1 AND municipio ILIKE $2
        `;
        const params: any[] = [`%${estado}%`, `%${municipio}%`];

        // Si nos piden un año en específico, lo agregamos al filtro
        if (anio) {
            query += ` AND anio = $3`;
            params.push(anio);
        }

        // Agrupamos y ordenamos para traer los delitos que más ocurren en ese municipio
        query += ` ORDER BY total_anual DESC LIMIT 15;`; 

        const result = await pool.query(query, params);

        return NextResponse.json({
            fuente: "SESNSP - Incidencia Municipal",
            estado,
            municipio,
            anio: anio || "Histórico",
            delitos_frecuentes: result.rows
        }, { status: 200 });

    } catch (error) {
        console.error("[API SESNSP] Error consultando la base de datos:", error);
        return NextResponse.json({ error: "Error interno del servidor al consultar SESNSP." }, { status: 500 });
    }
}