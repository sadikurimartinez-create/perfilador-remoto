"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setIsProfileComplete(null);
        return;
      }

      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "users", String((user as any).id)));
        if (snap.exists()) {
          const data = snap.data();
          if (!data.nombre || !data.apellidoPaterno || !data.apellidoMaterno || !data.grado || !data.id_empleado) {
            setIsProfileComplete(false);
          } else {
            setIsProfileComplete(true);
          }
        } else {
          setIsProfileComplete(false);
        }
      } catch (error) {
        console.error("Error verificando perfil:", error);
        setIsProfileComplete(false);
      }
    }

    if (!loading) {
      checkProfile();
    }
  }, [user, loading]);

  useEffect(() => {
    if (isProfileComplete === false && !pathname.startsWith("/perfil")) {
      router.push("/perfil");
    }
  }, [isProfileComplete, pathname, router]);

  if ((user && isProfileComplete === null) || (isProfileComplete === false && !pathname.startsWith("/perfil"))) {
    return <div className="flex items-center justify-center min-h-screen text-sky-400 font-bold">Verificando credenciales operativas...</div>;
  }

  return <>{children}</>;
}