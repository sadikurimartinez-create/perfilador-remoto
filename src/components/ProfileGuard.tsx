"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setIsProfileComplete(null);
        return;
      }

      const u = user as any;
      // Verificar campos obligatorios del expediente de analista en PostgreSQL
      const complete = !!(u.nombre && u.apellidoPaterno && u.apellidoMaterno && u.grado && u.id_empleado);
      setIsProfileComplete(complete);
    }
  }, [user, loading]);

  useEffect(() => {
    if (isProfileComplete === false && !pathname.startsWith("/perfil")) {
      router.push("/perfil");
    }
  }, [isProfileComplete, pathname, router]);

  if (loading || (user && isProfileComplete === null) || (isProfileComplete === false && !pathname.startsWith("/perfil"))) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sky-400 font-bold bg-slate-950">
        Verificando credenciales operativas...
      </div>
    );
  }

  return <>{children}</>;
}