"use client";

import { useState } from "react";

interface OsintPanelProps {
  onOsintDataFetched: (data: string) => void;
}

export function OsintPanel({ onOsintDataFetched }: OsintPanelProps) {
  const [placa, setPlaca] = useState("");
  const [queryTelegram, setQueryTelegram] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConsultar = async () => {
    if (!placa && !queryTelegram) {
      setError("Ingresa una placa o un término de búsqueda para Telegram.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Nota: Asegúrate de que tu archivo de la API esté guardado en src/app/api/osint/route.ts
      const res = await fetch("/api/osint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa, queryTelegram }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.osintSummary);
        // Pasamos el resultado al componente padre para que se incluya en el prompt de la IA
        onOsintDataFetched(data.osintSummary);
      } else {
        setError(data.error || "Ocurrió un error en la consulta OSINT.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor OSINT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card p-4 md:p-6 space-y-4 w-full border border-sky-900 bg-slate-900/50">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          🔍 Panel de Inteligencia OSINT y REPUVE
        </h3>
        <p className="text-sm text-slate-400">
          Consulta vehículos sospechosos u objetivos de interés. Esta información se inyectará automáticamente en el Informe Final.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Placa del vehículo (Ej. AAA123A)"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
        />
        <input
          type="text"
          placeholder="Buscar en Telegram (Apodo, serie...)"
          value={queryTelegram}
          onChange={(e) => setQueryTelegram(e.target.value)}
          className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
        />
        <button
          onClick={handleConsultar}
          disabled={loading}
          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? "Consultando..." : "Ejecutar Búsqueda"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      
      {result && (
        <div className="mt-4 p-3 bg-black/40 border border-emerald-900/50 rounded-lg whitespace-pre-wrap text-xs text-emerald-300 font-mono">
          {result}
        </div>
      )}
    </section>
  );
}