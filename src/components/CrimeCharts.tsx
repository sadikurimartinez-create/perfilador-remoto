"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell
} from "recharts";

type CrimeChartsProps = {
  crimes: Array<{
    lat: number;
    lng: number;
    tipoDelito: string;
    rangoHorario: string | null;
  }>;
};

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#6366f1", "#ec4899"];

export function CrimeCharts({ crimes }: CrimeChartsProps) {
  const { byType, byTime } = useMemo(() => {
    const typeMap = new Map<string, number>();
    const timeMap = new Map<string, number>();

    crimes.forEach((c) => {
      const t = c.tipoDelito || "Desconocido";
      typeMap.set(t, (typeMap.get(t) || 0) + 1);

      const r = c.rangoHorario || "Sin registro";
      timeMap.set(r, (timeMap.get(r) || 0) + 1);
    });

    const byTypeArr = Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // Top 7 para no saturar

    const byTimeArr = Array.from(timeMap.entries())
      .map(([name, value]) => ({ name, value }));

    return { byType: byTypeArr, byTime: byTimeArr };
  }, [crimes]);

  if (!crimes || crimes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-[350px]">
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col shadow-inner">
        <h4 className="text-xs font-bold text-sky-400 text-center mb-2 tracking-widest">
          CRONOCRIMINOGRAMA (Horarios Críticos)
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={byTime}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Radar name="Delitos" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col shadow-inner">
        <h4 className="text-xs font-bold text-sky-400 text-center mb-2 tracking-widest">
          TIPOLOGÍA DELICTIVA (Top 7 Delitos)
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}