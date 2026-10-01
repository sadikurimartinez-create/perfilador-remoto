"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { connectInstitutionalFirebase, disconnectInstitutionalFirebase } from "@/services/institutionalFirebaseClientBridge";

type AuthUser = {
  id: number | string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  name: string;
  fotografia?: string;
  perfilCompleto?: boolean;
  profile?: any;
  [key: string]: any;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser?: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const authOperation = useRef(0);

  const refreshUser = async () => {
    const operation = ++authOperation.current;
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        const mergedUser = {
          ...(data.profile || {}),
          ...data,
        };
        if (operation !== authOperation.current) return;
        await connectInstitutionalFirebase();
        if (operation !== authOperation.current) return;
        setUser(mergedUser);
        window.localStorage.setItem("perfilador.currentUser", JSON.stringify(mergedUser));
      } else {
        if (operation !== authOperation.current) return;
        await disconnectInstitutionalFirebase();
        if (res.status === 401) {
          console.warn("[AUTH] Usuario no autenticado (401).");
        } else {
          console.warn(`[AuthContext] Backend session refresh returned status ${res.status}.`);
        }
        window.localStorage.removeItem("perfilador.currentUser");
        setUser(null);
      }
    } catch (err) {
      if (operation !== authOperation.current) return;
      await disconnectInstitutionalFirebase();
      console.warn("[AuthContext] Usuario no autenticado o sesión no disponible:", err);
      window.localStorage.removeItem("perfilador.currentUser");
      setUser(null);
    } finally {
      if (operation === authOperation.current) setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      ++authOperation.current;
      void disconnectInstitutionalFirebase().finally(() => {
        setUser(null);
        window.localStorage.removeItem("perfilador.currentUser");
        router.push("/login");
      });
    }, 2 * 60 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [user, router]);

  const login = async (username: string, password: string) => {
    const operation = ++authOperation.current;
    setLoading(true);
    try {
      // Toda la autenticación está unificada del lado del servidor (/api/auth/login).
      // El backend se encarga de consultar PostgreSQL y, si es necesario, realizar el fallback a Firebase.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Usuario o contraseña incorrectos");
      }

      const data = await res.json();
      const mergedUser = {
        ...(data.profile || {}),
        ...data,
      };
      
      // REGLA DE SEGURIDAD EXPLICITA: 'perfilador.currentUser' en localStorage sirve ÚNICAMENTE como 
      // caché visual para optimizar la interfaz y renderizados resilientes del lado del cliente.
      // NUNCA concede permisos ni actúa como fuente de autorización, ya que todos los endpoints del servidor
      // y controladores de API validan de forma estricta la cookie HttpOnly segura 'ceipol_session'.
      if (operation !== authOperation.current) return;
      await connectInstitutionalFirebase();
      if (operation !== authOperation.current) return;
      window.localStorage.setItem("perfilador.currentUser", JSON.stringify(mergedUser));
      setUser(mergedUser);
      router.push("/");
    } catch (err: any) {
      if (operation === authOperation.current) {
        await disconnectInstitutionalFirebase();
        setUser(null);
        window.localStorage.removeItem("perfilador.currentUser");
      }
      console.error("[AuthContext] Login failed:", err);
      throw new Error(err.message || "Usuario o contraseña incorrectos");
    } finally {
      if (operation === authOperation.current) setLoading(false);
    }
  };

  const logout = async () => {
    ++authOperation.current;
    setLoading(true);
    // Invalidate pending Firebase sign-in immediately, before waiting for the API.
    const firebaseLogout = disconnectInstitutionalFirebase();
    try {
      await Promise.all([firebaseLogout, fetch("/api/auth/logout", { method: "POST" })]);
    } catch (err) {
      console.error("Error on api logout call:", err);
    } finally {
      window.localStorage.removeItem("perfilador.currentUser");
      setUser(null);
      setLoading(false);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

