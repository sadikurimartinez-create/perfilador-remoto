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
        setUser(null);
        window.localStorage.removeItem("perfilador.currentUser");
      }
    } catch (err) {
      console.error("Error refreshing session from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Sincronizar de inmediato contra el repositorio único PostgreSQL
    refreshUser();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Usuario o contraseña incorrectos");
      }

      const data = await res.json();
      const mergedUser = {
        ...data,
        ...(data.profile || {}),
      };
      
      window.localStorage.setItem("perfilador.currentUser", JSON.stringify(mergedUser));
      setUser(mergedUser);
      router.push("/");
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

