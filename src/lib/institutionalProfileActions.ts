"use server";
import { cookies } from "next/headers";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import { getPool } from "@/lib/db";
import { verifyPassword } from "@/utils/authCrypto";
export async function verifyInstitutionalPassword(password: string): Promise<boolean> {
 if (typeof password !== 'string' || !password || password.length > 1024) return false;
 try {
  const actor = await resolveInstitutionalSessionIdentity(cookies().get('ceipol_session')?.value);
  const result = await getPool().query('SELECT password_hash FROM users WHERE id::text = $1 LIMIT 2',[actor.institutionalUserId]);
  return result.rows.length === 1 && await verifyPassword(password,result.rows[0].password_hash);
 } catch { return false; }
}
