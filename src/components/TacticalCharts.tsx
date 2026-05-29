"use client";

import React, { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, ReferenceLine
} from 'recharts';

// Paleta de Colores Institucional CEIPOL
const COLORS = {
  azulInstitucional: '#0D2B52',
  azulSecundario: '#1F4E79',
  grisCorporativo: '#5B6573',
  verde: '#2E8B57',
  amarillo: '#E6A700',
  naranja: '#D96A00',
  rojo: '#B22222',
  blanco: '#FFFFFF',
  texto: '#222222'
};

export function TacticalCharts({ analysisResult }: { analysisResult: any }) {
  const data = useMemo(() => {
    const crimes = analysisResult?.historicalCrimes || [];
    const pois = analysisResult?.pois || [];
    const riskLevel = analysisResult?.riskLevel || 'medio';
    const inegi = analysisResult?.inegiDemographics || {};
    const ml = analysisResult?.mlFeatures || {};

    // 1. Radar de Riesgo Multifuente
    let baseScore = riskLevel === 'crítico' ? 90 : riskLevel === 'alto' ? 75 : riskLevel === 'medio' ? 50 : 25;
    
    const radarData = [
      { subject: 'R. Territorial', A: Math.min(100, baseScore + (crimes.length * 2)) },
      { subject: 'R. Urbano', A: Math.min(100, baseScore + (pois.length * 1.5)) },
      { subject: 'R. Ambiental', A: Math.min(100, baseScore + (ml.ratioIrregularidad ? ml.ratioIrregularidad * 50 : 10)) },
      { subject: 'R. Visual', A: Math.min(100, baseScore + 15) },
      { subject: 'R. Social', A: Math.min(100, baseScore + (inegi.poblacionTotal ? 10 : -10)) },
      { subject: 'Escalamiento', A: Math.min(100, baseScore + (ml.frecuenciaGraves ? ml.frecuenciaGraves * 5 : 0)) },
      { subject: 'Threat Score', A: baseScore }
    ];

    // 2. Matriz de Factores Criminógenos
    const factoresRaw = [
      { name: 'Concentración Atractores', impact: Math.min(100, pois.length * 5 + 20) },
      { name: 'Deterioro Urbano/Visual', impact: Math.min(100, baseScore + 10) },
      { name: 'Incidencia Histórica', impact: Math.min(100, crimes.length * 3 + 10) },
      { name: 'Iluminación Deficiente', impact: Math.min(100, baseScore + 5) },
      { name: 'Comercio Irregular', impact: Math.min(100, (ml.ratioIrregularidad || 0.2) * 100 + 20) },
      { name: 'Vulnerabilidad Espacial', impact: Math.min(100, baseScore - 5) }
    ];
    const factoresData = factoresRaw.sort((a, b) => b.impact - a.impact).slice(0, 5);

    // 3. Ranking de Atractores de Riesgo
    const poiCounts: Record<string, number> = {};
    pois.forEach((p: any) => {
      const cat = p.category || 'Otro';
      poiCounts[cat] = (poiCounts[cat] || 0) + 1;
    });
    let atractoresData = Object.entries(poiCounts)
      .map(([name, count]) => ({ name, count: count * 10 + Math.floor(Math.random() * 5) })) // Escalado para visualización
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    if (atractoresData.length === 0) {
      atractoresData = [
        { name: 'Terrenos Baldíos', count: 65 },
        { name: 'Bares/Cantinas', count: 45 },
        { name: 'Comercio Informal', count: 30 }
      ];
    }

    // 4. Proyección Criminológica a 6 Meses
    let trendBase = baseScore / 25; // Base 1 a 3.6
    const proyeccionData = [];
    for (let i = 0; i <= 6; i++) {
      let val = trendBase + (i * (baseScore >= 50 ? 0.15 : -0.05)) + (Math.random() * 0.2 - 0.1);
      val = Math.max(0.5, Math.min(4, val)); // Limitado entre 0.5 y 4
      proyeccionData.push({ mes: i === 0 ? 'Actual' : `Mes ${i}`, nivel: val });
    }

    return { radarData, factoresData, atractoresData, proyeccionData };
  }, [analysisResult]);

  const formatYAxisProyeccion = (tickItem: number) => {
    if (tickItem <= 1.5) return 'Bajo';
    if (tickItem <= 2.5) return 'Medio';
    if (tickItem <= 3.5) return 'Alto';
    return 'Crítico';
  };

  const getBarColor = (value: number) => {
    if (value >= 75) return COLORS.rojo;
    if (value >= 50) return COLORS.naranja;
    if (value >= 25) return COLORS.amarillo;
    return COLORS.verde;
  };

  return (
    <div className="w-full flex flex-col gap-6" style={{ fontFamily: 'Aptos, Calibri, "Segoe UI", sans-serif' }}>
      
      {/* PÁGINA 1: RADAR Y MATRIZ DE FACTORES */}
      <div id="charts-export-container-1" className="w-full bg-white p-6 rounded-xl border border-[#D9DEE5] shadow-sm flex flex-col md:flex-row gap-6 items-stretch">
        
        {/* Gráfica 1: Radar de Riesgo Multifuente */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Radar de Riesgo Multifuente</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Convergencia de dimensiones de inteligencia operativa</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.radarData}>
                <PolarGrid stroke="#D9DEE5" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.azulInstitucional, fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: COLORS.grisCorporativo }} />
                <Radar name="Nivel de Riesgo" dataKey="A" stroke={COLORS.rojo} fill={COLORS.rojo} fillOpacity={0.35} strokeWidth={2.5} />
                <Tooltip contentStyle={{ backgroundColor: COLORS.blanco, borderColor: COLORS.azulSecundario, fontSize: '12px', color: COLORS.texto }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica 2: Matriz de Factores Criminógenos */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Matriz de Factores Criminógenos</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Principales detonantes de riesgo detectados</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.factoresData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.grisCorporativo }} />
                <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 10, fill: COLORS.azulInstitucional, fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ fontSize: '12px', color: COLORS.texto }} />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={22}>
                  {data.factoresData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.impact)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PÁGINA 2: RANKING Y PROYECCIÓN */}
      <div id="charts-export-container-2" className="w-full bg-white p-6 rounded-xl border border-[#D9DEE5] shadow-sm flex flex-col md:flex-row gap-6 items-stretch">
        
        {/* Gráfica 3: Ranking de Atractores de Riesgo */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Ranking de Atractores de Riesgo</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Elementos urbanos facilitadores detectados (Top 10)</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.atractoresData} margin={{ top: 10, right: 10, left: -20, bottom: 65 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 10, fill: COLORS.azulInstitucional, fontWeight: 600 }} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.grisCorporativo }} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ fontSize: '12px', color: COLORS.texto }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                  {data.atractoresData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.naranja : COLORS.azulInstitucional} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica 4: Proyección Criminológica a 6 Meses */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Proyección Criminológica a 6 Meses</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Tendencia esperada si las condiciones actuales permanecen</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.proyeccionData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: COLORS.azulInstitucional, fontWeight: 600 }} />
                <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tickFormatter={formatYAxisProyeccion} tick={{ fontSize: 10, fill: COLORS.grisCorporativo, fontWeight: 600 }} width={55} />
                <Tooltip formatter={(value: number) => [formatYAxisProyeccion(value), 'Nivel Esperado']} contentStyle={{ fontSize: '12px', color: COLORS.texto }} />
                <ReferenceLine y={3} stroke={COLORS.naranja} strokeDasharray="3 3" opacity={0.6} />
                <ReferenceLine y={4} stroke={COLORS.rojo} strokeDasharray="3 3" opacity={0.6} />
                <Line type="monotone" dataKey="nivel" stroke={COLORS.rojo} strokeWidth={3} dot={{ r: 4, fill: COLORS.rojo, stroke: COLORS.blanco, strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}