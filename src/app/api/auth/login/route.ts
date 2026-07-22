import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyPassword, signSession } from "@/utils/authCrypto";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `
      SELECT id, username, password_hash, role, name, profile
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
      [username]
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    // Validación segura utilizando bcryptjs
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    // Configurar payload de sesión segura
    const sessionPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    };

    const sessionToken = signSession(sessionPayload);

    // Establecer la cookie HttpOnly segura
    cookies().set({
      name: "ceipol_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 horas de expiración
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      profile: user.profile || {}
    });
  } catch (err) {
    console.error("[api/auth/login] Error en login:", err);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión." },
      { status: 500 }
    );
  }
}


