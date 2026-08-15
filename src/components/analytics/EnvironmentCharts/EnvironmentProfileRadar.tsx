"use client";

import * as React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { ChartContainer } from "../ChartContainer";

interface EnvironmentProfileRadarProps {
  pois: any[];
  findings: any[];
}

export function EnvironmentProfileRadar({ pois = [], findings = [] }: EnvironmentProfileRadarProps) {
  const chartData = React.useMemo(() => {
    // Computar perfil descriptivo cualitativo basado en elementos presentes
    const numPois = pois.length;
    const numFindings = findings.length;

    const accesibilidad = Math.min(100, 20 + numPois * 4);
    const visibilidad = Math.min(100, 15 + numFindings * 12);
    const atractores = Math.min(100, 10 + numPois * 6);
    const actividadUrbana = Math.min(100, 30 + (numPois + numFindings) * 3);
    const vigilancia = Math.min(100, 5 + pois.filter(p => (p.category || "").toLowerCase().includes("vigilancia")).length * 20);

    return [
      { subject: "Accesibilidad", A: accesibilidad, fullMark: 100 },
      { subject: "Visibilidad", A: visibilidad, fullMark: 100 },
      { subject: "Atractores de Riesgo", A: atractores, fullMark: 100 },
      { subject: "Actividad Urbana", A: actividadUrbana, fullMark: 100 },
      { subject: "Sistemas Vigilancia", A: vigilancia, fullMark: 100 },
    ];
  }, [pois, findings]);

  const hasData = pois.length > 0 || findings.length > 0;

  return (
    <ChartContainer
      title="Perfil descriptivo del entorno"
      question="¿Qué características presenta el espacio?"
      description="Perfil multidimensional descriptivo de factores territoriales basado en evidencia validada."
      hasData={hasData}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#1e293b" />
          <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={9} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={8} />
          <Radar name="Perfil Entorno" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
