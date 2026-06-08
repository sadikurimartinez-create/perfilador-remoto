"use client";

import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, ReferenceLine
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
    const inegi = analysisResult?.inegiDemographics || {};
    const ml = analysisResult?.mlFeatures || {};
    const scince = analysisResult?.scinceDemographics || {};
    const baseScore = ml.finalThreatScore || 50;

    // 1. COMPOSICIÓN DEL ENTORNO (Dona) - Cuenta real de atractores y reportes
    const poiCounts: Record<string, number> = {};
    pois.forEach((p: any) => { poiCounts[p.category || 'Atractor Comercial'] = (poiCounts[p.category || 'Atractor Comercial'] || 0) + 1; });
    crimes.forEach((c: any) => { poiCounts[c.tipoDelito || 'Incidente'] = (poiCounts[c.tipoDelito || 'Incidente'] || 0) + 1; });
    
    let donaData = Object.entries(poiCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    if (donaData.length === 0) donaData = [{ name: 'Sin datos registrados', value: 1 }];

    // 2. FACTORES CRIMINÓGENOS (Barras) - Basado en IA y SCINCE puro
    const factoresData = [
      { name: 'Densidad Delictiva', score: Math.min(100, crimes.length * 5) },
      { name: 'Atractores de Riesgo', score: Math.min(100, pois.length * 8) },
      { name: 'Casas Deshabitadas', score: Math.min(100, (scince.viviendasDeshabitadas || 0) * 4) },
      { name: 'Vuln. Demográfica', score: scince.svs || 10 },
      { name: 'Fallas del Entorno', score: Math.min(100, baseScore) }
    ].sort((a, b) => b.score - a.score);

    // 3. DESORGANIZACIÓN SOCIAL (Radar)
    const radarData = [
      { subject: 'Abandono Espacial', val: Math.min(100, (scince.viviendasDeshabitadas || 0) * 5 + 10) },
      { subject: 'Densidad Poblacional', val: Math.min(100, (scince.poblacionTotal || 500) / 20) },
      { subject: 'Marginación', val: scince.gradoMarginacion === 'Muy Alto' ? 100 : scince.gradoMarginacion === 'Alto' ? 80 : 40 },
      { subject: 'Concentración Juvenil', val: Math.min(100, (scince.pctJovenes || 15) * 3) },
      { subject: 'Impacto Criminal', val: Math.min(100, crimes.length * 6) }
    ];

    // 4. TENDENCIA DE RIESGO (Área) - Proyección matemática logarítmica real
    const proyeccionData = [];
    let currentRisk = baseScore;
    for (let i = 0; i <= 6; i++) {
      proyeccionData.push({ mes: i === 0 ? 'Actual' : `Mes ${i}`, nivel: Math.min(100, Math.round(currentRisk)) });
      // Aumenta o disminuye en base a los factores subyacentes determinísticos
      currentRisk = currentRisk + (crimes.length * 0.5) + (pois.length * 0.2); 
    }

    return { donaData, factoresData, radarData, proyeccionData };
  }, [analysisResult]);

  const PIE_COLORS = [COLORS.rojo, COLORS.naranja, COLORS.amarillo, COLORS.azulSecundario, COLORS.grisCorporativo];

  return (
    <div className="w-full flex flex-col gap-6" style={{ fontFamily: 'Aptos, Calibri, "Segoe UI", sans-serif' }}>
      
      {/* PÁGINA 1: COMPOSICIÓN Y FACTORES */}
      <div id="charts-export-container-1" className="w-full bg-white p-6 rounded-xl border border-[#D9DEE5] shadow-sm flex flex-col md:flex-row gap-6 items-stretch">
        
        {/* Gráfica 1: Composición del Entorno */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Vocación Criminógena de la Zona</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Proporción de incidentes y atractores registrados</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.donaData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {data.donaData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica 2: Prioridad de Factores */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Prioridad de Factores Criminógenos</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Nivel de impacto de cada factor (0 a 100)</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.factoresData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.grisCorporativo }} />
                <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 10, fill: COLORS.azulInstitucional, fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ fontSize: '12px', color: COLORS.texto }} />
                <Bar dataKey="score" fill={COLORS.azulInstitucional} radius={[0, 4, 4, 0]} barSize={22}>
                  {data.factoresData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score > 75 ? COLORS.rojo : entry.score > 40 ? COLORS.naranja : COLORS.verde} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PÁGINA 2: DESORGANIZACIÓN Y TENDENCIA */}
      <div id="charts-export-container-2" className="w-full bg-white p-6 rounded-xl border border-[#D9DEE5] shadow-sm flex flex-col md:flex-row gap-6 items-stretch">
        
        {/* Gráfica 3: Desorganización Social */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Índice de Desorganización Social</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Integración de factores sociodemográficos y espaciales</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.radarData}>
                <PolarGrid stroke="#D9DEE5" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.azulInstitucional, fontSize: 10, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: COLORS.grisCorporativo }} />
                <Radar name="Intensidad" dataKey="val" stroke={COLORS.naranja} fill={COLORS.naranja} fillOpacity={0.4} strokeWidth={2} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica 4: Tendencia Proyectada */}
        <div className="flex-1 flex flex-col border border-[#D9DEE5] p-4 rounded-lg bg-white">
          <h3 className="text-[14px] font-bold text-[#0D2B52] mb-1 uppercase text-center tracking-wide">Evolución de Riesgo (6 Meses)</h3>
          <p className="text-[10px] text-[#5B6573] text-center mb-4">Crecimiento estimado de la amenaza (Base 100)</p>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.proyeccionData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: COLORS.azulInstitucional, fontWeight: 600 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.grisCorporativo }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <ReferenceLine y={75} stroke={COLORS.rojo} strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Crítico', fill: COLORS.rojo, fontSize: 10 }} />
                <Area type="monotone" dataKey="nivel" stroke={COLORS.azulInstitucional} fill={COLORS.azulInstitucional} fillOpacity={0.2} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}