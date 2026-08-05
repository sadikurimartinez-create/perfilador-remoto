import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "ceipol_secret_unificado_2026_default_key";

/**
 * Genera un hash irreversible a partir de una contraseña utilizando bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verifica si una contraseña coincide con su hash almacenado.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    return false;
  }
}

/**
 * Firma un objeto JSON convirtiéndolo a un token seguro con firma HMAC-SHA256.
 */
export function signSession(payload: any): string {
  const data = JSON.stringify({
    ...payload,
    createdAt: Date.now()
  });
  
  const payloadBase64 = Buffer.from(data).toString("base64url");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payloadBase64);
  const signature = hmac.digest("base64url");
  
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifica y extrae el payload de un token firmado con HMAC-SHA256.
 * Retorna null si la firma es inválida.
 */
export function verifySession(token: string): any {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  
  const [payloadBase64, signature] = parts;
  
  // Recrear firma
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payloadBase64);
  const expectedSignature = hmac.digest("base64url");
  
  // Comparación en tiempo constante para evitar ataques de canal lateral
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  
  try {
    const dataStr = Buffer.from(payloadBase64, "base64url").toString("utf8");
    const payload = JSON.parse(dataStr);
    
    // Validar expiración criptográfica basada en createdAt + maxAge (2 horas)
    const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas en ms
    if (payload && payload.createdAt) {
      const elapsed = Date.now() - payload.createdAt;
      if (elapsed > SESSION_MAX_AGE_MS) {
        console.warn("[authCrypto] Token de sesión expirado por firma temporal.");
        return null;
      }
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}
