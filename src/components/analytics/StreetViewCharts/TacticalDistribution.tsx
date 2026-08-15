"use client";

import * as React from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "../ChartContainer";
import { useAnalyticsFilter } from "../AnalyticsFilterContext";

interface TacticalDistributionProps {
  findings: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  RUTA_ACCESO: "#3b82f6",     // Azul
  RUTA_ESCAPE: "#f97316",     // Naranja
  PUNTO_ACECHO: "#64748b",    // Gris
  GRAFITI: "#a855f7",         // Morado
};

export function TacticalDistribution({ findings = [] }: TacticalDistributionProps) {
  const { setCategoryFilter, filterState } = useAnalyticsFilter();

  const chartData = React.useMemo(() => {
    const counts: Record<string, number> = {
      RUTA_ACCESO: 0,
      RUTA_ESCAPE: 0,
      PUNTO_ACECHO: 0,
      GRAFITI: 0,
    };

    findings.forEach((f) => {
      const cat = f.categoria || "RUTA_ACCESO";
      if (cat in counts) {
        counts[cat]++;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [findings]);

  const hasData = findings.length > 0;

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const cat = data.activePayload[0].payload.name;
      // Toggle de filtro al hacer clic
      if (filterState.categoriaSeleccionada === cat) {
        setCategoryFilter(null);
      } else {
        setCategoryFilter(cat);
      }
    }
  };

  return (
    <ChartContainer
      title="Categorías Tácticas Street View"
      question="¿Qué categorías fueron identificadas?"
      description="Haga clic en cualquier barra táctica para filtrar las evidencias correspondientes de forma interactiva sobre el mapa."
      hasData={hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          onClick={handleClick}
          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
        >
          <XAxis
            dataKey="name"
            stroke="#475569"
            fontSize={8}
            tickFormatter={(tick) => tick.replace("_", " ")}
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
          <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer">
            {chartData.map((entry, index) => {
              const cat = entry.name;
              const isSelected = filterState.categoriaSeleccionada === cat;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[cat] || "#64748b"}
                  stroke={isSelected ? "#38bdf8" : undefined}
                  strokeWidth={isSelected ? 2 : 0}
                  fillOpacity={isSelected ? 1.0 : 0.8}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
