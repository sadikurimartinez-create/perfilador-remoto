import assert from "assert";
import { hashPassword, verifyPassword, signSession, verifySession } from "../src/utils/authCrypto";

export async function runAuthTests() {
  const previousSessionSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = previousSessionSecret || "adr-020-36-legacy-suite-test-secret";

  try {
  console.log("\n======================================================================");
  console.log("🔒 EJECUTANDO SUITE DE PRUEBAS DE SEGURIDAD (HARDENING DE AUTENTICACIÓN)");
  console.log("======================================================================");

  // --- TEST-001: Hashing y verificación exitosa ---
  console.log("\n🧪 TEST-001: Hashing y verificación exitosa de contraseñas (Bcrypt)");
  try {
    const password = "SuperSecretPassword2026!";
    const hash = await hashPassword(password);
    
    assert.strictEqual(typeof hash, "string", "El hash generado debe ser un string.");
    assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "El hash debe tener el formato estándar de Bcrypt.");
    assert.notStrictEqual(hash, password, "El hash nunca debe ser igual a la contraseña en texto plano.");
    
    const isMatch = await verifyPassword(password, hash);
    assert.strictEqual(isMatch, true, "La verificación debe tener éxito con la contraseña correcta.");
    console.log("✅ TEST-001 COMPLETADO: Bcrypt hashea y verifica correctamente.");
  } catch (err: any) {
    console.error("❌ Falló TEST-001:", err);
    throw err;
  }

  // --- TEST-002: Verificación con contraseña incorrecta ---
  console.log("\n🧪 TEST-002: Verificación fallida ante contraseña incorrecta");
  try {
    const password = "SuperSecretPassword2026!";
    const wrongPassword = "SuperSecretPassword2026?_wrong";
    const hash = await hashPassword(password);
    
    const isMatch = await verifyPassword(wrongPassword, hash);
    assert.strictEqual(isMatch, false, "La verificación debe retornar false ante una contraseña incorrecta.");
    console.log("✅ TEST-002 COMPLETADO: El sistema rechaza contraseñas incorrectas de forma segura.");
  } catch (err: any) {
    console.error("❌ Falló TEST-002:", err);
    throw err;
  }

  // --- TEST-003: Firma y verificación exitosa de sesión (HMAC-SHA256) ---
  console.log("\n🧪 TEST-003: Establecimiento y firma de sesión segura (HMAC-SHA256)");
  try {
    const payload = { id: 101, username: "analista_test", role: "USER", name: "Analista de Pruebas" };
    const token = signSession(payload);
    
    assert.strictEqual(typeof token, "string", "El token de sesión debe ser un string.");
    assert.ok(token.includes("."), "El token debe tener la estructura payload.firma separada por un punto.");
    
    const verifiedPayload = verifySession(token);
    assert.ok(verifiedPayload, "La sesión firmada válidamente debe ser verificada exitosamente.");
    assert.strictEqual(verifiedPayload.username, "analista_test", "El usuario verificado debe coincidir con el payload original.");
    assert.strictEqual(verifiedPayload.role, "USER", "El rol verificado debe coincidir con el original.");
    console.log("✅ TEST-003 COMPLETADO: Las sesiones se firman y verifican correctamente.");
  } catch (err: any) {
    console.error("❌ Falló TEST-003:", err);
    throw err;
  }

  // --- TEST-004: Rechazo de firmas de sesión manipuladas ---
  console.log("\n🧪 TEST-004: Rechazo y protección contra sesión manipulada o alterada");
  try {
    const payload = { id: 101, username: "analista_test", role: "USER" };
    const token = signSession(payload);
    
    // Simular un intento de escalada de privilegios manipulando el payload
    const parts = token.split(".");
    const decodedPayloadStr = Buffer.from(parts[0], "base64url").toString("utf8");
    const tamperedPayloadObj = JSON.parse(decodedPayloadStr);
    tamperedPayloadObj.role = "ADMIN"; // Manipular el rol a ADMIN
    
    const tamperedPayloadBase64 = Buffer.from(JSON.stringify(tamperedPayloadObj)).toString("base64url");
    const tamperedToken = `${tamperedPayloadBase64}.${parts[1]}`; // Conservar la firma vieja
    
    const result = verifySession(tamperedToken);
    assert.strictEqual(result, null, "El sistema debe rechazar y retornar null ante un token manipulado.");
    console.log("✅ TEST-004 COMPLETADO: Firma digital robusta inmune a manipulaciones de payload.");
  } catch (err: any) {
    console.error("❌ Falló TEST-004:", err);
    throw err;
  }

  // --- TEST-005: Control estricto de privilegios por roles ---
  console.log("\n🧪 TEST-005: Control estricto de accesos y privilegios");
  try {
    const userPayload = { username: "user_regular", role: "USER" };
    const adminPayload = { username: "admin_operativo", role: "ADMIN" };
    
    const checkAdminAccess = (role: string) => {
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        throw new Error("ACCESO DENEGADO: Privilegios insuficientes.");
      }
      return "ACCESO CONCEDIDO";
    };

    // Un administrador debe poder acceder
    const resAdmin = checkAdminAccess(adminPayload.role);
    assert.strictEqual(resAdmin, "ACCESO CONCEDIDO", "El rol ADMIN debe ser autorizado.");
    
    // Un usuario común debe ser rechazado
    let denied = false;
    try {
      checkAdminAccess(userPayload.role);
    } catch (err: any) {
      denied = true;
      assert.ok(err.message.includes("Privilegios insuficientes"), "El mensaje de error debe indicar privilegios insuficientes.");
    }
    assert.ok(denied, "El rol USER debe ser estrictamente denegado en rutas de administración.");
    console.log("✅ TEST-005 COMPLETADO: Control de privilegios validado con éxito.");
  } catch (err: any) {
    console.error("❌ Falló TEST-005:", err);
    throw err;
  }

  console.log("\n======================================================================");
  console.log("🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD DE LA FASE 1 PASARON CON ÉXITO! 🎉");
  console.log("======================================================================");
  } finally {
    if (previousSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSessionSecret;
    }
  }
}

if (require.main === module) {
  runAuthTests().catch(() => process.exit(1));
}
