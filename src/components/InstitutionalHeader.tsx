"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function InstitutionalHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-[98%] 2xl:max-w-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Image
            src="/logos/logo-ceipol.png"
            alt="Centro Estatal de Estudios y Política Criminal"
            width={56}
            height={56}
            className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            unoptimized
          />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center min-w-0 px-2">
          <Link href="/">
            <h1 className="text-sm font-bold tracking-tight text-slate-100 sm:text-lg hover:text-sky-400 transition-colors">
            PERFILADOR REMOTO v2.4
            </h1>
          </Link>
          <p className="hidden md:block text-[10px] font-medium text-slate-300 sm:text-xs mt-0.5">
            CENTRO DE ESTUDIOS EN SEGURIDAD PÚBLICA Y POLÍTICA CRIMINAL
          </p>
          <p className="hidden sm:block text-[10px] text-slate-400 sm:text-xs">
            SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 sm:gap-x-4">
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-3 border-r border-slate-700/50 pr-2 sm:pr-4">
              {(user as any).fotografia ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={(user as any).fotografia} alt="Usuario" className="h-7 w-7 sm:h-9 sm:w-9 rounded-full object-cover border border-slate-500 shadow-sm" />
              ) : (
                <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xs sm:text-sm shadow-sm">👤</div>
              )}
              <div className="hidden md:flex flex-col">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 uppercase leading-tight truncate max-w-[120px]">
                  {(user as any).name || (user as any).username}
                </span>
                <span className="text-[9px] text-sky-400 font-semibold uppercase leading-tight">
                  {(user as any).role === "SUPER_ADMIN" ? "S-ADMIN" : (user as any).role || "USER"}
                </span>
              </div>
            </div>
          )}
          {user && (
            <Link
              href="/"
              className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors"
            >
              Lobby
            </Link>
          )}
          {user && (
            <Link
              href="/perfil"
              className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors"
            >
              Mi Perfil
            </Link>
          )}
          {user && (
            <Link
              href="/pandillas"
              className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors"
            >
              Pandillas
            </Link>
          )}
          {user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
            <Link
              href="/admin"
              className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-sky-300 transition-colors"
            >
              Administración
            </Link>
          )}
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors"
            >
              Salir
            </button>
          )}
          <div className="hidden xs:block flex-shrink-0">
            <Image
              src="/logos/logo-ssp.png"
              alt="Secretaría de Seguridad Pública - Policía Estatal"
              width={42}
              height={42}
              className="h-9 w-9 object-contain sm:h-14 sm:w-14"
              unoptimized
            />
          </div>
        </div>
      </div>
    </header>
  );
}
