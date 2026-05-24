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
  Cell,
  ComposedChart,
  Line,
  Legend
} from "recharts";

type CrimeChartsProps = {
  crimes: Array<{
    lat: number;
    lng: number;
    tipoDelito: string;
    rangoHorario: string | null;
  }>;
  inegi?: {
    exito?: boolean;
    municipioNombre: string;
    poblacionTotal: string;
  };
};

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#6366f1", "#ec4899"];

export function CrimeCharts({ crimes, inegi }: CrimeChartsProps) {
  const { byType, byTime, correlationData } = useMemo(() => {
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

    // Data para la tercera gráfica (Correlación de Gravedad vs Frecuencia)
    const correlation = byTypeArr.map((d) => {
      const isHighImpact = ["homicidio", "secuestro", "violencia", "lesiones", "robo", "asalto", "arma", "extorsion", "feminicidio"].some(kw => d.name.toLowerCase().includes(kw));
      return {
        name: d.name,
        Frecuencia: d.value,
        Gravedad: isHighImpact ? parseFloat((d.value * 2.5).toFixed(1)) : parseFloat((d.value * 0.8).toFixed(1)),
      };
    });

    return { byType: byTypeArr, byTime: byTimeArr, correlationData: correlation };
  }, [crimes]);

  if (!crimes || crimes.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col shadow-inner min-h-[350px]">
        <h4 className="text-xs font-bold text-sky-400 text-center mb-2 tracking-widest">
          CRONOCRIMINOGRAMA (Horarios Críticos)
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={byTime}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Radar name="Delitos" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col shadow-inner min-h-[350px]">
        <h4 className="text-xs font-bold text-sky-400 text-center mb-2 tracking-widest">
          TIPOLOGÍA DELICTIVA (Top 7 Delitos)
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col shadow-inner relative overflow-hidden min-h-[400px]">
        {inegi && inegi.exito && (
          <div className="absolute top-0 right-0 bg-emerald-900/80 text-emerald-200 text-[9px] px-2 py-1 rounded-bl-lg font-mono border-b border-l border-emerald-700/50 z-10">
            INEGI: {inegi.municipioNombre.toUpperCase()} ({inegi.poblacionTotal} HAB)
          </div>
        )}
        <h4 className="text-xs font-bold text-sky-400 text-center mb-4 mt-2 tracking-widest">
          CORRELACIÓN FRECUENCIA VS GRAVEDAD
        </h4>
        <div className="flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={correlationData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 8 }} angle={-45} textAnchor="end" height={60} interval={0} />
              <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#ef4444", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              <Bar yAxisId="left" dataKey="Frecuencia" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="Gravedad" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: "#ef4444" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}