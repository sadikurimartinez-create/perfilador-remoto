import React, { useState, useEffect } from 'react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { useAuth } from "@/context/AuthContext";

import { calculateExecutiveMetrics }
  from '../utils/executiveMetrics';

interface Props {
  projects: any[];
}

const ExecutiveDashboard: React.FC<Props> = ({
  projects,
}) => {

  const { user } = useAuth();
  const isSuperAdmin = (user as any)?.role === "SUPERADMIN" || (user as any)?.role === "SUPER_ADMIN";

  const [wmsTelemetry, setWmsTelemetry] = useState<any>(null);

  useEffect(() => {
    fetch('/api/providers/telemetry')
      .then(res => res.json())
      .then(data => setWmsTelemetry(data))
      .catch(err => console.error("Error fetching telemetry:", err));
  }, []);

  const metrics =
    calculateExecutiveMetrics(
      projects || []
    );

  const pieData = [
    {
      name: 'Alto',
      value: metrics.highRisk,
    },
    {
      name: 'Medio',
      value: metrics.mediumRisk,
    },
    {
      name: 'Bajo',
      value: metrics.lowRisk,
    },
  ];

  const barData = [
    {
      categoria: 'Hallazgos',
      Alto: metrics.highRisk,
      Medio: metrics.mediumRisk,
      Bajo: metrics.lowRisk,
    },
  ];

  return (

    <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mt-5">

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="text-2xl font-bold text-cyan-300">
          Consola Ejecutiva CEIPOL
        </h1>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => alert("Funcionalidad en desarrollo: Conexiones para el entrenamiento (Fine-Tuning) y exportación de Dataset ML.")}
            className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors border border-purple-500"
          >
            🧠 Entrenamiento de IA (ML)
          </button>
        )}
      </div>

      {/* WMS TELEMETRY CARD */}
      {wmsTelemetry && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider">🗺️ Telemetría INEGI WMS (GAIA)</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Estado en tiempo real del catálogo geoespacial y capas de soporte</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wmsTelemetry.health?.isHealthy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
              {wmsTelemetry.health?.isHealthy ? '🟢 ACTIVO & CONECTADO' : '⚠️ DEGRADADO / CATÁLOGO CACHÉ'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Consultas Totales</p>
              <p className="text-xl font-extrabold text-white mt-1">{wmsTelemetry.telemetry?.totalQueries || 0}</p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Cache Hits</p>
              <p className="text-xl font-extrabold text-sky-400 mt-1">
                {wmsTelemetry.telemetry?.cacheHits || 0}
                <span className="text-[10px] text-slate-500 font-normal ml-1.5 font-sans">
                  ({wmsTelemetry.telemetry?.totalQueries ? Math.round((wmsTelemetry.telemetry.cacheHits / wmsTelemetry.telemetry.totalQueries) * 100) : 0}%)
                </span>
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Latencia Promedio</p>
              <p className="text-xl font-extrabold text-teal-400 mt-1">
                {wmsTelemetry.telemetry?.totalQueries ? Math.round(wmsTelemetry.telemetry.latencySum / wmsTelemetry.telemetry.totalQueries) : 0} ms
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Errores de Enlace</p>
              <p className={`text-xl font-extrabold mt-1 ${wmsTelemetry.telemetry?.errorsCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {wmsTelemetry.telemetry?.errorsCount || 0}
              </p>
            </div>
          </div>

          {wmsTelemetry.telemetry?.mostUsedLayers && Object.keys(wmsTelemetry.telemetry.mostUsedLayers).length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/40">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Capas más Solicitadas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(wmsTelemetry.telemetry.mostUsedLayers).map(([layer, count]: any) => (
                  <span key={layer} className="px-2 py-1 bg-slate-950/60 border border-slate-850 rounded text-[10px] text-slate-300 font-mono">
                    {layer}: <strong className="text-cyan-400">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6">

        <div className="bg-slate-800 rounded-lg p-4">

          <p className="text-xs text-slate-400">
            Proyectos Activos
          </p>

          <p className="text-3xl font-bold text-white">
            {metrics.totalProjects}
          </p>

        </div>

        <div className="bg-slate-800 rounded-lg p-4">

          <p className="text-xs text-slate-400">
            Hallazgos Totales
          </p>

          <p className="text-3xl font-bold text-fuchsia-300">
            {metrics.totalFindings}
          </p>

        </div>

        <div className="bg-slate-800 rounded-lg p-4">

          <p className="text-xs text-slate-400">
            Riesgo Alto
          </p>

          <p className="text-3xl font-bold text-red-400">
            {metrics.highRisk}
          </p>

        </div>

        <div className="bg-slate-800 rounded-lg p-4">

          <p className="text-xs text-slate-400">
            Riesgo Promedio
          </p>

          <p className="text-3xl font-bold text-amber-300">
            {metrics.averageRisk}
          </p>

        </div>

      </div>

      <div className="flex flex-col gap-6">

        <div className="bg-slate-800 rounded-lg p-4 h-96">

          <h2 className="text-sm font-semibold text-slate-200 mb-3">
            Distribución Institucional
          </h2>

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <PieChart>

              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={120}
                label
              >

                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
                <Cell fill="#10b981" />

              </Pie>

              <Tooltip />

            </PieChart>

          </ResponsiveContainer>

        </div>

        <div className="bg-slate-800 rounded-lg p-4 h-96">

          <h2 className="text-sm font-semibold text-slate-200 mb-3">
            Comparativa de Riesgos
          </h2>

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart data={barData}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis dataKey="categoria" />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="Alto"
                fill="#ef4444"
              />

              <Bar
                dataKey="Medio"
                fill="#f59e0b"
              />

              <Bar
                dataKey="Bajo"
                fill="#10b981"
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </div>

    </div>
  );
};

export default ExecutiveDashboard;