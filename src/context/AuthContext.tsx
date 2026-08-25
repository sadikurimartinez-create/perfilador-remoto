"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

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

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        const mergedUser = {
          ...data,
          ...(data.profile || {}),
        };
        setUser(mergedUser);
        window.localStorage.setItem("perfilador.currentUser", JSON.stringify(mergedUser));
      } else {
        if (res.status === 401) {
          console.warn("[AUTH] Usuario no autenticado (401).");
        } else {
          console.warn(`[AuthContext] Backend session refresh returned status ${res.status}.`);
        }
        // Fallback resiliente: si el backend no responde o no está autenticado, pero tenemos una sesión en caché, la respetamos
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("perfilador.currentUser") : null;
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      console.warn("[AuthContext] Usuario no autenticado o sesión no disponible:", err);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("perfilador.currentUser") : null;
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, password: string) => {
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
        ...data,
        ...(data.profile || {}),
      };
      
      // REGLA DE SEGURIDAD EXPLICITA: 'perfilador.currentUser' en localStorage sirve ÚNICAMENTE como 
      // caché visual para optimizar la interfaz y renderizados resilientes del lado del cliente.
      // NUNCA concede permisos ni actúa como fuente de autorización, ya que todos los endpoints del servidor
      // y controladores de API validan de forma estricta la cookie HttpOnly segura 'ceipol_session'.
      window.localStorage.setItem("perfilador.currentUser", JSON.stringify(mergedUser));
      setUser(mergedUser);
      router.push("/");
    } catch (err: any) {
      console.error("[AuthContext] Login failed:", err);
      throw new Error(err.message || "Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
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

