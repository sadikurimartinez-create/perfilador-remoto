"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer } from "../ChartContainer";

interface AtractorsDensityChartProps {
  pois: any[];
}

export function AtractorsDensityChart({ pois = [] }: AtractorsDensityChartProps) {
  const chartData = React.useMemo(() => {
    if (pois.length === 0) return [];
    
    const counts: Record<string, number> = {};
    pois.forEach((poi) => {
      const cat = poi.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [pois]);

  const hasData = chartData.length > 0;

  return (
    <ChartContainer
      title="Densidad de Atractores de Riesgo"
      question="¿Qué elementos existen alrededor del área analizada?"
      description="Distribución de puntos de interés fácticos detectados en el radio táctico de cobertura."
      hasData={hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="name"
            stroke="#475569"
            fontSize={9}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#475569"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
            labelStyle={{ fontSize: "9px", fontWeight: "bold", color: "#38bdf8" }}
            itemStyle={{ fontSize: "9px", color: "#f8fafc" }}
          />
          <Bar dataKey="value" fill="#0284c7" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#06b6d4" : "#3b82f6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
