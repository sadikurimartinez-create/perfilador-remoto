import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-06.03E.3F.4 perfiladorIniciales profile registration", () => {
  const profilePage = source("src/app/perfil/page.tsx");
  const profileRoute = source("src/app/api/auth/profile/route.ts");
  const patchRoute = profileRoute.slice(profileRoute.indexOf("export async function PATCH"));

  test("UI exposes perfiladorIniciales without hardcoded initials", () => {
    expect(profilePage).toContain("perfiladorIniciales");
    expect(profilePage).toContain("Iniciales de la persona perfiladora criminológica (PPC)");
    expect(profilePage).toContain("Registrar iniciales institucionales");
    expect(profilePage).not.toContain("SKM");
  });

  test("completed profiles keep historical fields locked and use a separate initials form", () => {
    expect(profilePage).toContain("const isLocked = !!(user as any)?.perfilCompleto");
    expect(profilePage).toContain("disabled={isLocked}");
    expect(profilePage).toContain("if (!user || isLocked) return");
    expect(profilePage).toContain("canRegisterPerfiladorIniciales");
    expect(profilePage).toContain("handleRegisterPerfiladorIniciales");
    expect(profilePage).toContain("method: \"PATCH\"");
    expect(profilePage).not.toContain("setFormData({ ...formData, perfiladorIniciales");
  });

  test("UI validates and normalizes initials before PATCH", () => {
    expect(profilePage).toContain("/^[A-ZÑ]{2,5}$/.test(normalized)");
    expect(profilePage).toContain("toLocaleUpperCase(\"es-MX\")");
    expect(profilePage).toContain("PERFILADOR_INICIALES_INVALIDAS");
    expect(profilePage).toContain("body: JSON.stringify({ perfiladorIniciales: normalized })");
  });

  test("UI refreshes user and blocks field after successful registration", () => {
    expect(profilePage).toContain("await refreshUser()");
    expect(profilePage).toContain("registeredPerfiladorIniciales");
    expect(profilePage).toContain("Registradas");
    expect(profilePage).toContain("setPerfiladorIniciales(normalized)");
  });

  test("PATCH route exists and requires valid session", () => {
    expect(profileRoute).toContain("export async function PATCH(req: Request)");
    expect(profileRoute).toContain("ceipol_session");
    expect(profileRoute).toContain("verifySession");
    expect(profileRoute).toContain("payload.username");
  });

  test("PATCH only accepts initials with the institutional regex and uppercases them", () => {
    expect(profileRoute).toContain("const PERFILADOR_INICIALES_PATTERN = /^[A-ZÑ]{2,5}$/");
    expect(profileRoute).toContain("toLocaleUpperCase(\"es-MX\")");
    expect(profileRoute).toContain("PERFILADOR_INICIALES_REQUERIDAS");
    expect(profileRoute).toContain("PERFILADOR_INICIALES_INVALIDAS");
  });

  test("PATCH preserves existingProfile and does not overwrite the full profile", () => {
    expect(patchRoute).toContain("const existingProfile = user.profile || {}");
    expect(patchRoute).toContain("const updatedProfile = {");
    expect(patchRoute).toContain("...existingProfile");
    expect(patchRoute).toContain("perfiladorIniciales: initials");
    expect(patchRoute).toContain("updatedAt: Date.now()");
    expect(patchRoute).not.toContain("perfilCompleto: true,");
    expect(patchRoute).not.toContain("SET name =");
  });

  test("PATCH blocks second registration", () => {
    expect(profileRoute).toContain("existingProfile.perfiladorIniciales");
    expect(profileRoute).toContain("PERFILADOR_INICIALES_YA_REGISTRADAS");
    expect(profileRoute).toContain("{ status: 409 }");
  });

  test("PATCH updates only the authenticated user's profile", () => {
    expect(profileRoute).toContain("UPDATE users");
    expect(profileRoute).toContain("SET profile = $1");
    expect(profileRoute).toContain("WHERE username = $2");
    expect(profileRoute).toContain("[JSON.stringify(updatedProfile), payload.username]");
  });

  test("PATCH keeps PostgreSQL as primary storage and reports it", () => {
    expect(patchRoute).toContain("const pool = getPool()");
    expect(patchRoute).toContain("SELECT profile");
    expect(patchRoute).toContain("UPDATE users");
    expect(patchRoute).toContain("storage: \"POSTGRESQL\"");
  });

  test("PATCH has Firebase fallback after PostgreSQL failure", () => {
    expect(profileRoute).toContain("getFirebaseServerDb");
    expect(profileRoute).toContain("registerPerfiladorInicialesInFirebase");
    expect(patchRoute).toContain("catch (pgErr)");
    expect(patchRoute).toContain("return await registerPerfiladorInicialesInFirebase(payload.username, initials)");
    expect(profileRoute).toContain("storage: \"FIREBASE_FALLBACK\"");
  });

  test("Firebase fallback uses authenticated username and does not create users", () => {
    expect(profileRoute).toContain("where(\"username\", \"==\", username.trim())");
    expect(profileRoute).toContain("getDocs(q)");
    expect(profileRoute).toContain("snap.empty");
    expect(profileRoute).toContain("Usuario no encontrado.");
    expect(profileRoute).not.toContain("addDoc");
  });

  test("Firebase fallback preserves existing data and writes only initials fields when profile is flat", () => {
    expect(profileRoute).toContain("const existingProfile = hasNestedProfile ? firebaseUser.profile || {} : firebaseUser");
    expect(profileRoute).toContain("...existingProfile");
    expect(profileRoute).toContain("perfiladorIniciales: initials");
    expect(profileRoute).toContain("updatedAt: Date.now()");
    expect(profileRoute).toContain("await updateDoc(docSnap.ref, {");
    expect(profileRoute).toContain("perfiladorIniciales: initials");
    expect(profileRoute).toContain("updatedAt: updatedProfile.updatedAt");
  });

  test("auth profile patch does not modify login or me routes", () => {
    const loginRoute = source("src/app/api/auth/login/route.ts");
    const meRoute = source("src/app/api/auth/me/route.ts");

    expect(loginRoute).toContain("[api/auth/login]");
    expect(loginRoute).toContain("addDoc(usersRef");
    expect(meRoute).toContain("[api/auth/me]");
    expect(meRoute).toContain("getFirebaseServerDb");
  });
});
