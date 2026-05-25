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
    async function checkProfile() {
      if (!user) {
        setIsProfileComplete(null);
        return;
      }
      try {
        // Toma el ID o username que tu AuthContext provea
        const uid = (user as any).uid || (user as any).id || (user as any).username;
        const res = await fetch(`/api/profile/status?uid=${uid}`);
        if (res.ok) {
          const data = await res.json();
          setIsProfileComplete(data.isComplete);
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