import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/utils/authCrypto";
import { getPool } from "@/lib/db";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { collection, query, where, getDocs } from "firebase/firestore";

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

    let pgUser = null;
    let pgError = null;
    
    // 1. Intentar consultar en PostgreSQL (Fuente Primaria de Verdad)
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `
        SELECT id, username, role, name, profile
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
        [payload.username]
      );
      pgUser = rows[0];
    } catch (err: any) {
      console.warn("[api/auth/me] PostgreSQL database query failed. Falling back to Firebase...", err.message);
      pgError = err;
    }
    
    // Si el usuario se encuentra registrado en PostgreSQL
    if (pgUser) {
      return NextResponse.json({
        id: pgUser.id,
        username: pgUser.username,
        role: pgUser.role,
        name: pgUser.name,
        profile: pgUser.profile || {}
      });
    }
    
    // 2. Fallback simétrico a Firebase Firestore (Fuente Secundaria)
    // Se ejecuta si el usuario no existe en Postgres O si la base de datos SQL está offline
    console.warn("[api/auth/me] User not found in PostgreSQL. Resolving username in Firebase Firestore:", payload.username);
    
    const db = getFirebaseServerDb();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", payload.username.trim()));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 401 });
    }
    
    const docSnap = snap.docs[0];
    const fbData = docSnap.data() as { role?: string; name?: string; [key: string]: any };
    
    return NextResponse.json({
      id: docSnap.id,
      username: payload.username,
      role: fbData.role || "USER",
      name: fbData.name || payload.username,
      profile: fbData || {}
    });

  } catch (err: any) {
    console.error("[api/auth/me] General me route handler failure:", err);
    return NextResponse.json(
      { error: "Error de servidor al validar sesión." },
      { status: 500 }
    );
  }
}
