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
import { CEIPOLButton } from "./ui/CEIPOLButton";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import { CEIPOLToast } from "./ui/CEIPOLToast";

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
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);

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

    <div className="bg-slate-950/70 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative mt-5 overflow-hidden">

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="text-2xl font-bold text-cyan-300">
          Consola Ejecutiva CEIPOL
        </h1>
        {isSuperAdmin && (
          <CEIPOLButton
            type="button"
            variant="primary"
            onClick={() => setToast({ type: "info", message: "Funcionalidad en desarrollo: Conexiones para el entrenamiento (Fine-Tuning) y exportación de Dataset ML." })}
            className="shadow-lg hover:shadow-purple-500/10 transition-all font-bold"
          >
            🧠 Entrenamiento de IA (ML)
          </CEIPOLButton>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CEIPOLCard variant="glass" className="p-4 shadow-md flex flex-col gap-1.5 border border-slate-900/40">
          <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
            Proyectos Activos
          </p>
          <p className="text-3xl font-extrabold text-white mt-1">
            {metrics.totalProjects}
          </p>
        </CEIPOLCard>

        <CEIPOLCard variant="glass" className="p-4 shadow-md flex flex-col gap-1.5 border border-slate-900/40">
          <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
            Hallazgos Totales
          </p>
          <p className="text-3xl font-extrabold text-fuchsia-400 mt-1">
            {metrics.totalFindings}
          </p>
        </CEIPOLCard>

        <CEIPOLCard variant="glass" className="p-4 shadow-md flex flex-col gap-1.5 border border-slate-900/40">
          <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
            Riesgo Alto
          </p>
          <p className="text-3xl font-extrabold text-red-500 mt-1">
            {metrics.highRisk}
          </p>
        </CEIPOLCard>

        <CEIPOLCard variant="glass" className="p-4 shadow-md flex flex-col gap-1.5 border border-slate-900/40">
          <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
            Riesgo Promedio
          </p>
          <p className="text-3xl font-extrabold text-amber-400 mt-1">
            {metrics.averageRisk}
          </p>
        </CEIPOLCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CEIPOLCard variant="glass" className="p-5 h-[340px] flex flex-col border border-slate-900">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
            Distribución Institucional
          </h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
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
        </CEIPOLCard>

        <CEIPOLCard variant="glass" className="p-5 h-[340px] flex flex-col border border-slate-900">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
            Comparativa de Riesgos
          </h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="categoria" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="Alto" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Medio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Bajo" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CEIPOLCard>
      </div>

      {toast && (
        <CEIPOLToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
};

export default ExecutiveDashboard;