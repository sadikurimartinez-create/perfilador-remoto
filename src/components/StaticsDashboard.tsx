import React from 'react';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface Props {
  iaAnalysis: any[];
}

const StatisticsDashboard: React.FC<Props> = ({
  iaAnalysis,
}) => {

  if (!iaAnalysis || iaAnalysis.length === 0) {
    return null;
  }

  const high =
    iaAnalysis.filter(
      i =>
        i.riskLevel === 'high' ||
        i.riskLevel === 'alto'
    ).length;

  const medium =
    iaAnalysis.filter(
      i =>
        i.riskLevel === 'medium' ||
        i.riskLevel === 'medio'
    ).length;

  const low =
    iaAnalysis.filter(
      i =>
        i.riskLevel === 'low' ||
        i.riskLevel === 'bajo'
    ).length;

  const pieData = [
    { name: 'Alto', value: high },
    { name: 'Medio', value: medium },
    { name: 'Bajo', value: low },
  ];

  const barData = [
    {
      categoria: 'Riesgo',
      Alto: high,
      Medio: medium,
      Bajo: low,
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-cyan-300 mb-4">
        Dashboard Criminológico
      </h2>

      <div className="flex flex-col gap-4 mb-6">

        <div className="bg-slate-800 rounded p-4">
          <p className="text-xs text-slate-400">
            Hallazgos Totales
          </p>

          <p className="text-2xl font-bold text-white">
            {iaAnalysis.length}
          </p>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <p className="text-xs text-slate-400">
            Riesgo Alto
          </p>

          <p className="text-2xl font-bold text-red-400">
            {high}
          </p>
        </div>

        <div className="bg-slate-800 rounded p-4">
          <p className="text-xs text-slate-400">
            Riesgo Medio/Bajo
          </p>

          <p className="text-2xl font-bold text-orange-300">
            {medium + low}
          </p>
        </div>

      </div>

      <div className="flex flex-col gap-6">

        <div className="bg-slate-800 rounded p-4 h-80">

          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            Distribución de Riesgo
          </h3>

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

        <div className="bg-slate-800 rounded p-4 h-80">

          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            Comparativa de Riesgos
          </h3>

          <ResponsiveContainer width="100%" height="100%">

            <BarChart data={barData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="categoria" />

              <YAxis />

              <Tooltip />

              <Bar dataKey="Alto" fill="#ef4444" />

              <Bar dataKey="Medio" fill="#f59e0b" />

              <Bar dataKey="Bajo" fill="#10b981" />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </div>

    </div>
  );
};

export default StatisticsDashboard;