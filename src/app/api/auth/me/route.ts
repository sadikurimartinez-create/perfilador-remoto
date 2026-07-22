import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/utils/authCrypto";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("ceipol_session");
    
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    
    const payload = verifySession(sessionCookie.value);
    if (!payload || !payload.username) {
      return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    }
    
    // Obtener los datos frescos de PostgreSQL para garantizar que sea el repositorio unificado
    const pool = getPool();
    const { rows } = await pool.query(
      `
      SELECT id, username, role, name, profile
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
      [payload.username]
    );
    
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 401 });
    }
    
    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      profile: user.profile || {}
    });
  } catch (err) {
    console.error("[api/auth/me] Error obteniendo sesión actual:", err);
    return NextResponse.json(
      { error: "Error de servidor al validar sesión." },
      { status: 500 }
    );
  }
}
