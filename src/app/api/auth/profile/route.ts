import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const editable = ["nombre", "apellidoPaterno", "apellidoMaterno", "grado", "id_empleado", "adscripcionAnterior", "aniosSspe", "bachillerato", "licenciatura", "licenciaturaCual", "maestria", "maestriaCual", "fotografia"];
async function identity() { return resolveInstitutionalSessionIdentity(cookies().get("ceipol_session")?.value); }
function sameOrigin(req: Request) { return req.headers.get("origin") === new URL(req.url).origin && req.headers.get("sec-fetch-site") !== "cross-site"; }
export async function GET() {
  try {
    const actor = await identity();
    const result = await getPool().query("SELECT profile FROM users WHERE id::text = $1 LIMIT 2", [actor.institutionalUserId]);
    if (result.rows.length !== 1) throw new Error("IDENTITY_UNAVAILABLE");
    return NextResponse.json({ profile: result.rows[0].profile || {} }, { headers });
  } catch { return NextResponse.json({ error: "Perfil institucional no disponible." }, { status: 401, headers }); }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  try {
    const actor = await identity(); const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(body).length > 2000000) return NextResponse.json({ error: "PROFILE_INVALID" }, { status: 400 });
    const profile = Object.fromEntries(editable.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    for (const [key, value] of Object.entries(profile)) {
      if ((typeof value !== "string" && typeof value !== "boolean" && typeof value !== "number") || (typeof value === "string" && value.length > (key === "fotografia" ? 1800000 : 2000)))
        return NextResponse.json({ error: "PROFILE_INVALID" }, { status: 400 });
    }
    const name = [body.nombre, body.apellidoPaterno, body.apellidoMaterno].filter(value => typeof value === "string" && value.trim()).join(" ");
    const result = await getPool().query(`UPDATE users SET name = $1, profile = COALESCE(profile, '{}'::jsonb) || $2::jsonb
      WHERE id::text = $3 AND COALESCE(profile->>'perfilCompleto', 'false') != 'true' RETURNING profile, name`,
      [name, JSON.stringify({ ...profile, perfilCompleto: true, updatedAt: Date.now() }), actor.institutionalUserId]);
    if (result.rows.length !== 1) return NextResponse.json({ error: "PROFILE_COMPLETED_OR_UNAVAILABLE" }, { status: 409 });
    return NextResponse.json({ success: true, ...result.rows[0] }, { headers });
  } catch { return NextResponse.json({ error: "Perfil institucional no disponible." }, { status: 503, headers }); }
}
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  try {
    const actor = await identity(); const body = await req.json();
    const initials = typeof body?.perfiladorIniciales === "string" ? body.perfiladorIniciales.trim().toLocaleUpperCase("es-MX") : "";
    if (!/^[A-ZÑ]{2,5}$/.test(initials)) return NextResponse.json({ error: "PERFILADOR_INICIALES_INVALIDAS" }, { status: 400 });
    const result = await getPool().query(`UPDATE users SET profile = COALESCE(profile, '{}'::jsonb) || $1::jsonb
      WHERE id::text = $2 AND COALESCE(TRIM(profile->>'perfiladorIniciales'), '') = '' RETURNING profile`,
      [JSON.stringify({ perfiladorIniciales: initials, updatedAt: Date.now() }), actor.institutionalUserId]);
    if (result.rows.length !== 1) return NextResponse.json({ error: "PERFILADOR_INICIALES_YA_REGISTRADAS" }, { status: 409 });
    return NextResponse.json({ success: true, profile: result.rows[0].profile, storage: "POSTGRESQL" }, { headers });
  } catch { return NextResponse.json({ error: "Registro institucional no disponible." }, { status: 503, headers }); }
}
