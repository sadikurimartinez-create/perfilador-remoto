import React from 'react';

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