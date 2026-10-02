import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
export const dynamic = "force-dynamic";
const fields = ["nombre", "apellidoPaterno", "apellidoMaterno", "grado", "id_empleado", "adscripcionAnterior", "aniosSspe", "bachillerato", "licenciatura", "licenciaturaCual", "maestria", "maestriaCual", "fotografia", "perfilCompleto", "perfiladorIniciales", "updatedAt"];
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const actor = await resolveInstitutionalSessionIdentity(cookies().get("ceipol_session")?.value);
    const result = await getPool().query("SELECT id, username, role, name, profile FROM users WHERE id::text = $1 LIMIT 2", [actor.institutionalUserId]);
    if (result.rows.length !== 1 || result.rows[0].username !== actor.username || result.rows[0].role !== actor.role) throw new Error("IDENTITY_CHANGED");
    const user = result.rows[0];
    const profile = Object.fromEntries(fields.filter(key => user.profile?.[key] !== undefined).map(key => [key, user.profile[key]]));
    return NextResponse.json({ id: user.id, username: actor.username, role: actor.role, name: user.name, profile }, { headers });
  } catch { return NextResponse.json({ error: "Sesión institucional no disponible." }, { status: 401, headers }); }
}
