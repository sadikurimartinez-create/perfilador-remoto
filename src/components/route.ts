import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      firebase_uid,
      nombres,
      grado,
      num_empleado,
      anio_ingreso_corp,
      fecha_ingreso_ceipol,
      adscripcion_anterior,
      grado_estudio,
      fortalezas,
      debilidades,
      equipo_oficina,
      foto_url
    } = body;

    if (!firebase_uid) {
      return NextResponse.json({ error: "Falta el ID del usuario" }, { status: 400 });
    }

    const pool = getPool();
    
    const checkRes = await pool.query(
      "SELECT id FROM usuarios_perfil WHERE firebase_uid = $1",
      [firebase_uid]
    );

    if (checkRes.rowCount && checkRes.rowCount > 0) {
      await pool.query(
        `UPDATE usuarios_perfil SET nombres = $1, grado = $2, num_empleado = $3, anio_ingreso_corp = $4, fecha_ingreso_ceipol = $5, adscripcion_anterior = $6, grado_estudio = $7, fortalezas = $8, debilidades = $9, equipo_oficina = $10, foto_url = $11, is_completo = TRUE WHERE firebase_uid = $12`,
        [nombres, grado, num_empleado, anio_ingreso_corp, fecha_ingreso_ceipol, adscripcion_anterior, grado_estudio, fortalezas, debilidades, equipo_oficina, foto_url, firebase_uid]
      );
    } else {
      await pool.query(
        `INSERT INTO usuarios_perfil (
          firebase_uid, nombres, grado, num_empleado, anio_ingreso_corp, fecha_ingreso_ceipol, adscripcion_anterior, grado_estudio, fortalezas, debilidades, equipo_oficina, foto_url, is_completo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)`,
        [firebase_uid, nombres, grado, num_empleado, anio_ingreso_corp, fecha_ingreso_ceipol, adscripcion_anterior, grado_estudio, fortalezas, debilidades, equipo_oficina, foto_url]
      );
    }

    return NextResponse.json({ success: true, message: "Perfil guardado correctamente." });
  } catch (error: any) {
    console.error("Error al guardar perfil:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
