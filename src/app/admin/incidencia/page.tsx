"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function IncidenciaUpdateAdminPage() {

  const [authorized, setAuthorized] = useState<boolean | null>(null);


  useEffect(() => {

    async function validateAccess() {

      try {

        const response = await fetch("/api/auth/session");

        if (!response.ok) {
          setAuthorized(false);
          return;
        }

        const data = await response.json();

        const role = data?.user?.role;

        setAuthorized(
          role === "SUPER_ADMIN" ||
          role === "ADMIN"
        );


      } catch {

        setAuthorized(false);

      }

    }


    validateAccess();

  }, []);



  if (authorized === null) {

    return (

      <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">

        <div className="text-sm text-slate-400">
          Validando permisos...
        </div>

      </main>

    );

  }



  if (!authorized) {

    return (

      <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">

        <div className="card p-6 max-w-md text-center">

          <h1 className="text-xl font-bold mb-3">
            Acceso restringido
          </h1>

          <p className="text-slate-400">
            Se requieren permisos de ADMINISTRADOR o SUPER_ADMIN.
          </p>

          <Link
            href="/admin"
            className="inline-block mt-5 text-sky-400"
          >
            Regresar administración
          </Link>

        </div>

      </main>

    );

  }



  return (

    <main className="min-h-screen bg-slate-950 text-slate-200 p-8">

      <div className="max-w-5xl mx-auto space-y-6">


        <div>

          <Link
            href="/admin"
            className="text-xs text-slate-400 hover:text-sky-400"
          >
            ← Administración
          </Link>


          <h1 className="text-3xl font-bold mt-4">
            Actualización de Incidencia Delictiva
          </h1>


          <p className="text-slate-400 mt-2">
            Consola institucional para incorporación,
            validación y actualización del histórico
            de incidencia delictiva.
          </p>

        </div>



        <section className="card border border-slate-800 p-6">

          <h2 className="text-xl font-semibold mb-4">
            Carga de archivo CSV
          </h2>


          <div className="border border-dashed border-slate-700 rounded-lg p-8 text-center">

            <p className="text-slate-400">
              Módulo de carga pendiente de conexión con
              el motor ADR-022.
            </p>

          </div>


        </section>



        <section className="card border border-slate-800 p-6">

          <h2 className="text-xl font-semibold mb-4">
            Estado de procesamiento
          </h2>


          <div className="grid grid-cols-3 gap-4">


            <div className="p-4 rounded border border-slate-800">
              <div className="text-sm text-slate-400">
                Nuevos registros
              </div>
              <div className="text-2xl font-bold">
                -
              </div>
            </div>


            <div className="p-4 rounded border border-slate-800">
              <div className="text-sm text-slate-400">
                Duplicados
              </div>
              <div className="text-2xl font-bold">
                -
              </div>
            </div>


            <div className="p-4 rounded border border-slate-800">
              <div className="text-sm text-slate-400">
                Errores
              </div>
              <div className="text-2xl font-bold">
                -
              </div>
            </div>


          </div>


        </section>



      </div>

    </main>

  );

}
