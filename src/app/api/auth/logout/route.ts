import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Eliminar la cookie ceipol_session
    cookies().delete("ceipol_session");
    
    return NextResponse.json({ success: true, message: "Sesión cerrada correctamente." });
  } catch (err) {
    console.error("[api/auth/logout] Error en logout:", err);
    return NextResponse.json(
      { error: "No se pudo cerrar la sesión." },
      { status: 500 }
    );
  }
}
export async function GET() {
  // Soporte para navegación directa o redirección de cierre de sesión
  try {
    cookies().delete("ceipol_session");
    return NextResponse.json({ success: true, message: "Sesión cerrada correctamente." });
  } catch (err) {
    return NextResponse.json({ error: "No se pudo cerrar la sesión." }, { status: 500 });
  }
}
