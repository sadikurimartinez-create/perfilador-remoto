"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function IncidenciaUpdateAdminPage() {

  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);

  const [result, setResult] = useState<any>(null);

  const [error, setError] = useState("");



  async function handleUpload() {

    if (!selectedFile) {
      setError("Seleccione un archivo CSV.");
      return;
    }

    try {

      setUploading(true);
      setError("");
      setResult(null);


      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );


      const response = await fetch(
        "/api/upload-csv",
        {
          method: "POST",
          body: formData
        }
      );


      const data = await response.json();


      if (!response.ok) {

        throw new Error(
          data.error || "Error procesando CSV"
        );

      }


      setResult(data);


    } catch (err:any) {

      setError(err.message);

    } finally {

      setUploading(false);

    }

  }

  useEffect(() => {

    async function validateAccess() {

      try {

        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          setAuthorized(false);
          return;
        }

        const data = await response.json();

        const role = data?.role;

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

            <div className="space-y-5">

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Seleccionar archivo CSV de incidencia delictiva
                </label>

                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    setSelectedFile(
                      e.target.files?.[0] || null
                    )
                  }
                  className="block w-full text-sm text-slate-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:bg-sky-600 file:text-white"
                />

              </div>


              {selectedFile && (

                <div className="text-sm text-slate-400">
                  Archivo seleccionado:
                  <span className="ml-2 text-sky-400">
                    {selectedFile.name}
                  </span>
                </div>

              )}


              <button

                onClick={handleUpload}

                disabled={uploading}

                className="px-5 py-2 rounded bg-sky-600
                hover:bg-sky-500 disabled:opacity-50"

              >

                {uploading
                  ? "Procesando..."
                  : "Procesar actualización"}

              </button>


              {error && (

                <div className="text-red-400 text-sm">
                  {error}
                </div>

              )}

            </div>

          </div>


        </section>



        <section className="card border border-slate-800 p-6">

          <h2 className="text-xl font-semibold mb-4">
            Estado de procesamiento
          </h2>


          {result ? (

            <div className="space-y-5">

              <div className="grid grid-cols-3 gap-4">

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Registros recibidos
                  </div>
                  <div className="text-2xl font-bold">
                    {result.received}
                  </div>
                </div>

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Validados
                  </div>
                  <div className="text-2xl font-bold">
                    {result.validated}
                  </div>
                </div>

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Nuevos registros
                  </div>
                  <div className="text-2xl font-bold">
                    {result.inserted}
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-3 gap-4">

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Duplicados
                  </div>
                  <div className="text-2xl font-bold">
                    {result.duplicates}
                  </div>
                </div>

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Rechazados
                  </div>
                  <div className="text-2xl font-bold">
                    {result.rejected}
                  </div>
                </div>

                <div className="p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Estado BD
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {result.persistenceConfirmation}
                  </div>
                </div>

              </div>

            </div>

          ) : (

            <div className="text-slate-500">
              Esperando procesamiento de archivo CSV.
            </div>

          )}


        </section>



      </div>

    </main>

  );

}



