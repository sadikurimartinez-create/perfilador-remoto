"use client";

import * as React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "../ChartContainer";

interface TemporalEvolutionChartProps {
  historicalCrimes?: any[];
}

export function TemporalEvolutionChart({ historicalCrimes = [] }: TemporalEvolutionChartProps) {
  const chartData = React.useMemo(() => {
    if (historicalCrimes.length === 0) return [];

    const dateCounts: Record<string, number> = {};
    historicalCrimes.forEach((crime) => {
      // Extraer mes/año o fecha simplificada
      const dateStr = crime.fecha || "General";
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    return Object.entries(dateCounts)
      .map(([date, count]) => ({
        date,
        Incidentes: count,
      }))
      .slice(-10); // Tomar últimos 10 períodos para visualización limpia
  }, [historicalCrimes]);

  const hasData = chartData.length > 0;

  return (
    <ChartContainer
      title="Evolución Temporal del Delito"
      question="¿Cómo evolucionan los datos en el tiempo?"
      description="Serie de tiempo interactiva sobre la intensidad de eventos de riesgo dentro de la geografía rectora."
      hasData={hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
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
          <Area type="monotone" dataKey="Incidentes" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorInc)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
