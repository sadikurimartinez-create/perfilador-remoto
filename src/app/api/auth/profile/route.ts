import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/utils/authCrypto";
import { getPool } from "@/lib/db";

// GET: Recuperar el perfil del usuario autenticado
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
    
    const pool = getPool();
    const { rows } = await pool.query(
      `
      SELECT profile
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
      [payload.username]
    );
    
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }
    
    return NextResponse.json({ profile: user.profile || {} });
  } catch (err) {
    console.error("[api/auth/profile] Error en GET profile:", err);
    return NextResponse.json({ error: "Error al recuperar el perfil." }, { status: 500 });
  }
}

// POST: Actualizar o guardar el perfil del usuario en PostgreSQL
export async function POST(req: Request) {
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
    
    const profileData = await req.json();
    
    // Concatenar el nombre completo para actualizar la columna name de la tabla users
    const firstName = profileData.nombre || "";
    const paternal = profileData.apellidoPaterno || "";
    const maternal = profileData.apellidoMaterno || "";
    const fullName = [firstName, paternal, maternal].filter(Boolean).join(" ") || payload.name;
    
    // Marcar el perfil como completo en el objeto profile
    const updatedProfile = {
      ...profileData,
      perfilCompleto: true,
      updatedAt: Date.now()
    };
    
    const pool = getPool();
    await pool.query(
      `
      UPDATE users
      SET name = $1, profile = $2
      WHERE username = $3
    `,
      [fullName, JSON.stringify(updatedProfile), payload.username]
    );
    
    return NextResponse.json({
      success: true,
      message: "Perfil actualizado correctamente en el repositorio único PostgreSQL.",
      profile: updatedProfile,
      name: fullName
    });
  } catch (err) {
    console.error("[api/auth/profile] Error en POST profile:", err);
    return NextResponse.json({ error: "No se pudo actualizar el perfil." }, { status: 500 });
  }
}
