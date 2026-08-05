import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyPassword, signSession } from "@/utils/authCrypto";
import { cookies } from "next/headers";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const protocol = req.headers.get("x-forwarded-proto");
    const isSecure = protocol === "https";

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

    let pgUser = null;
    let pgError = null;

    // 1. Intentar buscar el usuario en PostgreSQL
    try {
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
      pgUser = rows[0];
    } catch (err: any) {
      console.warn("[api/auth/login] PostgreSQL database pool query threw an error. Falling back to Firebase...", err.message);
      pgError = err;
    }

    // 2. Si el usuario existe en PostgreSQL, lo validamos ahí (Fuente Primaria)
    if (pgUser) {
      const passwordMatch = await verifyPassword(password, pgUser.password_hash);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Usuario o contraseña incorrectos." },
          { status: 401 }
        );
      }

      const sessionPayload = {
        id: pgUser.id,
        username: pgUser.username,
        role: pgUser.role,
        name: pgUser.name
      };

      const sessionToken = signSession(sessionPayload);

      // Seteamos la cookie HttpOnly segura del backend
      cookies().set({
        name: "ceipol_session",
        value: sessionToken,
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 horas de expiración
      });

      return NextResponse.json({
        id: pgUser.id,
        username: pgUser.username,
        role: pgUser.role,
        name: pgUser.name,
        profile: pgUser.profile || {}
      });
    }

    // 3. Fallback controlado a Firebase Firestore (Fuente Secundaria)
    // Se activa si el usuario no existe en PostgreSQL OR si PostgreSQL está caído/inaccesible
    console.warn("[api/auth/login] Activating secure server-side Firebase fallback query...");
    const db = getFirebaseServerDb();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username.trim()));
    const snap = await getDocs(q);

    // Bootstrap controlado del administrador (SOLO permitido en modo desarrollo)
    if (snap.empty && username.trim() === "admin" && password === "Admin2026!") {
      if ((process.env.NODE_ENV as string) === "development") {
        console.log("[api/auth/login] Bootstrapping admin user in Firebase development environment.");
        const newDocRef = await addDoc(usersRef, {
          username: "admin",
          passwordHash: "Admin2026!",
          role: "SUPER_ADMIN",
          name: "Super Administrador",
          createdAt: Date.now()
        });

        const sessionPayload = {
          id: newDocRef.id,
          username: "admin",
          role: "SUPER_ADMIN",
          name: "Super Administrador"
        };

        const sessionToken = signSession(sessionPayload);

        cookies().set({
          name: "ceipol_session",
          value: sessionToken,
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 2,
        });

        return NextResponse.json({
          id: newDocRef.id,
          username: "admin",
          role: "SUPER_ADMIN",
          name: "Super Administrador",
          profile: {}
        });
      } else {
        console.warn("[api/auth/login] Admin bootstrap block: automatic bootstrapping is strictly disabled in production.");
        return NextResponse.json(
          { error: "Usuario o contraseña incorrectos." },
          { status: 401 }
        );
      }
    }

    // Si no se encuentra el usuario en Firestore
    if (snap.empty) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data() as { passwordHash?: string; role?: string; name?: string; [key: string]: any };

    // Validación de contraseña en Firebase
    if (data.passwordHash !== password) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: docSnap.id,
      username: username.trim(),
      role: data.role || "USER",
      name: data.name || username.trim()
    };

    const sessionToken = signSession(sessionPayload);

    // Escribimos siempre la cookie de sesión HttpOnly
    cookies().set({
      name: "ceipol_session",
      value: sessionToken,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    });

    return NextResponse.json({
      id: docSnap.id,
      username: username.trim(),
      role: data.role || "USER",
      name: data.name || username.trim(),
      profile: data
    });

  } catch (err: any) {
    console.error("[api/auth/login] General login route handler failure:", err);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión por un error interno." },
      { status: 500 }
    );
  }
}
