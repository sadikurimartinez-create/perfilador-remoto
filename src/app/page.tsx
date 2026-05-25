"use client";

import Link from "next/link";
import { ProjectList } from "@/components/ProjectList";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    const checkProfile = async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "users", String((user as any).id)));
        if (snap.exists()) {
          const data = snap.data();
          if (!data.nombre || !data.apellidoPaterno || !data.apellidoMaterno || !data.grado || !data.id_empleado) {
            setProfileIncomplete(true);
          } else {
            setProfileIncomplete(false);
          }
        } else {
          setProfileIncomplete(true);
        }
      } catch (err) {
        console.error("Error verificando perfil:", err);
        setProfileIncomplete(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkProfile();
  }, [user]);

  useEffect(() => {
    if (profileIncomplete) {
      router.push("/perfil");
    }
  }, [profileIncomplete, router]);

  if (isChecking || profileIncomplete) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400 text-sm animate-pulse">Verificando acceso al sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">
          Mis Expedientes
        </h1>
        <Link
          href="/conexiones"
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700 transition-colors"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Centro de Conexiones
        </Link>
      </div>
      <ProjectList />
    </div>
  );
}
