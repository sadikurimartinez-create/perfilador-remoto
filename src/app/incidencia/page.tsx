"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IncidentRecord = {
  incidentType: string | null;
  date: string | null;
  time: string | null;
  municipality: string | null;
  neighborhood: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
  sourceFile: string;
};

type IncidenceResponse = {
  success: boolean;
  dataset?: string;
  files?: number;
  totalRecords?: number;
  records?: IncidentRecord[];
  error?: string;
};

export default function CrimeIncidencePage() {
  const [data, setData] = useState<IncidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipality, setMunicipality] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetch("/api/incidencia/analytics")
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch((error) => setData({ success: false, error: String(error) }))
      .finally(() => setLoading(false));
  }, []);

  const records = data?.records ?? [];

  const municipalities = useMemo(() =>
    Array.from(new Set(records.map((record) => record.municipality).filter(Boolean)))
      .sort() as string[],
    [records]
  );

  const neighborhoods = useMemo(() =>
    Array.from(new Set(records
      .filter((record) => !municipality || record.municipality === municipality)
      .map((record) => record.neighborhood)
      .filter(Boolean)))
      .sort() as string[],
    [records, municipality]
  );

  const streets = useMemo(() =>
    Array.from(new Set(records
      .filter((record) => !municipality || record.municipality === municipality)
      .filter((record) => !neighborhood || record.neighborhood === neighborhood)
      .map((record) => record.street)
      .filter(Boolean)))
      .sort() as string[],
    [records, municipality, neighborhood]
  );

  const incidentTypes = useMemo(() =>
    Array.from(new Set(records.map((record) => record.incidentType).filter(Boolean)))
      .sort() as string[],
    [records]
  );

  const filtered = useMemo(() => records.filter((record) => {
    if (municipality && record.municipality !== municipality) return false;
    if (neighborhood && record.neighborhood !== neighborhood) return false;
    if (street && record.street !== street) return false;
    if (incidentType && record.incidentType !== incidentType) return false;
    if (startDate && record.date && record.date < startDate) return false;
    if (endDate && record.date && record.date > endDate) return false;
    return true;
  }), [records, municipality, neighborhood, street, incidentType, startDate, endDate]);

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div>
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Volver al Lobby
        </Link>
        <h1 className="mt-2 text-2xl font-black text-slate-100">Incidencia Delictiva</h1>
        <p className="mt-1 text-sm text-slate-400">
          Módulo institucional independiente de análisis de incidencia delictiva.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-300">
          Cargando dataset institucional de Incidencia Delictiva...
        </div>
      )}

      {!loading && data && !data.success && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-300">
          No fue posible cargar el dataset: {data.error}
        </div>
      )}

      {!loading && data?.success && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Registros</div>
              <div className="text-2xl font-black text-slate-100">{data.totalRecords ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Archivos fuente</div>
              <div className="text-2xl font-black text-slate-100">{data.files ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Resultado filtrado</div>
              <div className="text-2xl font-black text-slate-100">{filtered.length}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4">Selección analítica</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={municipality} onChange={(e) => { setMunicipality(e.target.value); setNeighborhood(""); setStreet(""); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todo el Estado</option>
                {municipalities.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={neighborhood} onChange={(e) => { setNeighborhood(e.target.value); setStreet(""); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todas las colonias</option>
                {neighborhoods.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={street} onChange={(e) => setStreet(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todas las calles</option>
                {streets.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todos los delitos</option>
                {incidentTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-bold text-slate-200">
              Registros seleccionados
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-2">Delito</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Municipio</th>
                    <th className="p-2">Colonia</th>
                    <th className="p-2">Calle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {filtered.slice(0, 200).map((record, index) => (
                    <tr key={`${record.sourceFile}-${index}`} className="text-slate-300">
                      <td className="p-2">{record.incidentType ?? "Sin dato"}</td>
                      <td className="p-2">{record.date ?? "Sin dato"}</td>
                      <td className="p-2">{record.municipality ?? "Sin dato"}</td>
                      <td className="p-2">{record.neighborhood ?? "Sin dato"}</td>
                      <td className="p-2">{record.street ?? "Sin dato"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
