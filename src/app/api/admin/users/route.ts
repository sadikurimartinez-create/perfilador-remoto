import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { getPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/utils/authCrypto";
export const dynamic = "force-dynamic";
async function actor() { return resolveInstitutionalSessionIdentity(cookies().get("ceipol_session")?.value); }
function origin(req: Request) { return req.headers.get("origin") === new URL(req.url).origin && req.headers.get("sec-fetch-site") !== "cross-site"; }
const denied = () => NextResponse.json({ error: "INSTITUTIONAL_USER_OPERATION_DENIED" }, { status: 403 });
export async function GET() {
  try {
    const user = await actor(); if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return denied();
    const result = await getPool().query("SELECT id, username, role, name, created_at FROM users ORDER BY created_at DESC");
    return NextResponse.json(result.rows, { headers: { "Cache-Control": "no-store" } });
  } catch { return denied(); }
}
export async function POST(req: Request) {
  if (!origin(req)) return denied();
  let client: any;
  try {
    const user = await actor(); if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return denied();
    const body = await req.json(); const role = body.role || "USER";
    if (!["USER", "ADMIN"].includes(role) || (role === "ADMIN" && user.role !== "SUPER_ADMIN")) return denied();
    if (typeof body.username !== "string" || !body.username.trim() || body.username.length > 200 || typeof body.name !== "string" || !body.name.trim() || body.name.length > 500 || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 1024)
      return NextResponse.json({ error: "USER_INPUT_INVALID" }, { status: 400 });
    const hash = await hashPassword(body.password);
    client = await getPool().connect(); await client.query("BEGIN");
    // Serialize administrative creation so the existing two-admin limit is atomic.
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    if (role === "ADMIN") { const count = await client.query("SELECT COUNT(*)::integer AS count FROM users WHERE role = 'ADMIN'"); if (count.rows[0].count >= 2) throw new Error("ADMIN_LIMIT"); }
    await client.query("INSERT INTO users (username, password_hash, role, name) VALUES ($1, $2, $3, $4)", [body.username.trim(), hash, role, body.name.trim()]);
    await client.query("COMMIT"); return NextResponse.json({ ok: true });
  } catch { if (client) await client.query("ROLLBACK"); return NextResponse.json({ error: "USER_CREATION_REJECTED" }, { status: 409 }); }
  finally { client?.release(); }
}
export async function DELETE(req: Request) {
  if (!origin(req)) return denied();
  try {
    const user = await actor(); if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return denied();
    const body = await req.json();
    if (typeof body.id !== "string" || body.id === user.institutionalUserId) return denied();
    const result = await getPool().query("DELETE FROM users WHERE id::text = $1 AND role = 'USER' RETURNING id", [body.id]);
    if (result.rows.length !== 1) return denied();
    return NextResponse.json({ ok: true });
  } catch { return denied(); }
}
export async function PATCH(req: Request) {
  if (!origin(req)) return denied();
  try {
    const user = await actor(); const body = await req.json();
    if (typeof body.currentPassword !== "string" || body.currentPassword.length > 1024 || typeof body.newPassword !== "string" || body.newPassword.length < 12 || body.newPassword.length > 1024) return denied();
    const result = await getPool().query("SELECT password_hash FROM users WHERE id::text = $1", [user.institutionalUserId]);
    if (result.rows.length !== 1 || !(await verifyPassword(body.currentPassword, result.rows[0].password_hash))) return denied();
    const hash = await hashPassword(body.newPassword);
    const updated = await getPool().query("UPDATE users SET password_hash = $1 WHERE id::text = $2 AND password_hash = $3 RETURNING id", [hash, user.institutionalUserId, result.rows[0].password_hash]);
    if (updated.rows.length !== 1) return denied();
    return NextResponse.json({ ok: true });
  } catch { return denied(); }
}
