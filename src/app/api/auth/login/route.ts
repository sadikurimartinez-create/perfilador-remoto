import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyPassword, signSession } from "@/utils/authCrypto";
import { institutionalFirebaseIdentity } from "@/utils/institutionalFirebaseIdentity";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    const { username, password } = await req.json();
    if (typeof username !== "string" || !username.trim() || username.length > 200 || typeof password !== "string" || !password || password.length > 1024)
      return NextResponse.json({ error: "Usuario y contraseña son obligatorios." }, { status: 400 });
    const result = await getPool().query("SELECT id, username, password_hash, role, name, profile FROM users WHERE username = $1 LIMIT 2", [username.trim()]);
    if (result.rows.length !== 1 || !(await verifyPassword(password, result.rows[0].password_hash)))
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    const user = result.rows[0];
    const identity = institutionalFirebaseIdentity(user);
    const payload = { id: user.id, username: user.username, role: identity.claims.role, name: user.name };
    cookies().set({ name: "ceipol_session", value: signSession(payload), httpOnly: true,
      secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
      sameSite: "lax", path: "/", maxAge: 7200 });
    return NextResponse.json({ ...payload, profile: user.profile || {} }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Autenticación institucional no disponible." }, { status: 503 }); }
}
