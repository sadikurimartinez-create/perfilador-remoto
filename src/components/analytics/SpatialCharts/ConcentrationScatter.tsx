"use client";

import * as React from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "../ChartContainer";

interface ConcentrationScatterProps {
  pois: any[];
  findings: any[];
}

export function ConcentrationScatter({ pois = [], findings = [] }: ConcentrationScatterProps) {
  const chartData = React.useMemo(() => {
    const data: any[] = [];
    
    pois.forEach((p) => {
      const lat = p.lat || 0;
      const lng = p.lng || 0;
      if (lat !== 0 && lng !== 0) {
        data.push({ x: lng, y: lat, name: p.name || "POI", type: "Punto de Interés" });
      }
    });

    findings.forEach((f) => {
      const lat = f.coordenadas?.lat || f.lat || 0;
      const lng = f.coordenadas?.lng || f.lng || 0;
      if (lat !== 0 && lng !== 0) {
        data.push({ x: lng, y: lat, name: `Hallazgo: ${f.categoria}`, type: "Hallazgo Street View" });
      }
    });

    return data;
  }, [pois, findings]);

  const hasData = chartData.length > 0;

  return (
    <ChartContainer
      title="Concentración de Evidencia Espacial"
      question="¿Cómo se distribuyen espacialmente los elementos?"
      description="Análisis de dispersión geográfica latitud / longitud de POIs y hallazgos tácticos aprobados."
      hasData={hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            type="number"
            dataKey="x"
            name="Longitud"
            stroke="#475569"
            fontSize={8}
            domain={["auto", "auto"]}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Latitud"
            stroke="#475569"
            fontSize={8}
            domain={["auto", "auto"]}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
            labelStyle={{ fontSize: "9px", fontWeight: "bold", color: "#38bdf8" }}
            itemStyle={{ fontSize: "9px", color: "#f8fafc" }}
          />
          <Scatter name="Atractores" data={chartData} fill="#06b6d4" />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
