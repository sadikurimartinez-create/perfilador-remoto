import React, { useMemo } from "react";

type Crime = { tipoDelito?: string; lat?: number | null; lng?: number | null; [key: string]: any };
type POI = { name?: string; category?: string; lat?: number | null; lng?: number | null; [key: string]: any };

// Fórmula de Haversine para calcular distancias en metros entre dos coordenadas
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Radio de la Tierra en metros
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Ponderación de la Gravedad del Delito (Ecuación Base)
const getSeverityWeight = (crimeName: string) => {
  const name = crimeName.toLowerCase();
  if (name.includes("homicidio") || name.includes("secuestro") || name.includes("arma") || name.includes("violación")) return 5;
  if (name.includes("robo") || name.includes("asalto") || name.includes("extorsión") || name.includes("narcomenudeo")) return 4;
  if (name.includes("lesiones") || name.includes("violencia") || name.includes("amenaza")) return 3;
  return 2; // Delitos menores o daños
};

export function CrimeCharts({
  crimes = [],
  inegi,
  pois = [],
}: {
  crimes: Crime[];
  inegi?: any;
  pois?: POI[];
}) {
  
  // 1. ÍNDICE DE CRIMINALIDAD (Top 3 Delitos)
  const crimeIndexStats = useMemo(() => {
    const counts: Record<string, { count: number; weight: number }> = {};
    crimes.forEach((c) => {
      const type = c.tipoDelito || "Delito No Especificado";
      if (!counts[type]) {
        counts[type] = { count: 0, weight: getSeverityWeight(type) };
      }
      counts[type].count += 1;
    });

    const ranked = Object.entries(counts)
      .map(([name, data]) => ({
        name,
        score: data.count * data.weight,
        count: data.count,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const maxScore = Math.max(...ranked.map((r) => r.score), 1);
    return ranked.map((r) => ({ ...r, percentage: (r.score / maxScore) * 100 }));
  }, [crimes]);

  // 2. ÍNDICE DE RIESGO DE POIS Y CALLES (Top 3 Atractores)
  const riskIndexStats = useMemo(() => {
    if (!pois || pois.length === 0) return [];
    
    const ranked = pois.map((poi) => {
      let riskScore = 0;
      let associatedCrimes = 0;
      
      crimes.forEach((c) => {
        if (c.lat && c.lng && poi.lat && poi.lng) {
          const dist = getDistanceInMeters(poi.lat, poi.lng, c.lat, c.lng);
          if (dist <= 200) {
            riskScore += getSeverityWeight(c.tipoDelito || "");
            associatedCrimes += 1;
          }
        }
      });

      return {
        name: poi.name,
        category: poi.category,
        score: riskScore,
        incidents: associatedCrimes
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    const maxScore = Math.max(...ranked.map((r) => r.score), 1);
    return ranked.map((r) => ({ ...r, percentage: (r.score / maxScore) * 100 }));
  }, [crimes, pois]);

  // 3. PROYECCIÓN DE INCIDENCIA DELICTIVA (Top 3 Incrementos Proyectados)
  const projectionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    crimes.forEach((c) => {
      const type = c.tipoDelito || "Delito No Especificado";
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, currentCount]) => ({
        name,
        current: currentCount,
        projected: Math.ceil(currentCount * 1.20)
      }));
  }, [crimes]);

  if (crimes.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 text-slate-200">
      <div className="border-b border-slate-700 pb-2">
        <h3 className="text-base font-bold tracking-tight text-slate-100 uppercase flex items-center gap-2">
          <span>📊</span> Modelos Algorítmicos y Cartografía del Riesgo
        </h3>
        <p className="text-xs text-slate-400">
          Cálculos multivariables basados en severidad, proximidad espacial y proyección a 6 meses.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 shadow-inner">
          <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-4 border-b border-sky-900 pb-1">
            Top 3: Índice de Criminalidad
          </h4>
          <div className="space-y-4">
            {crimeIndexStats.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs items-end">
                  <span className="font-semibold text-slate-200 truncate pr-2">{item.name}</span>
                  <span className="text-sky-300 font-mono text-[10px]">Idx: {item.score}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-gradient-to-r from-sky-600 to-sky-400 h-2.5 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(item.percentage, 2)}%` }}
                  ></div>
                </div>
                <p className="text-[9px] text-slate-500">Volumen histórico: {item.count} incidentes</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 shadow-inner">
          <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-4 border-b border-amber-900 pb-1">
            Top 3: Riesgo en Nodos (POIs)
          </h4>
          {riskIndexStats.length > 0 && riskIndexStats[0].score > 0 ? (
            <div className="space-y-4">
              {riskIndexStats.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs items-end">
                    <span className="font-semibold text-slate-200 truncate pr-2" title={item.name}>{item.name}</span>
                    <span className="text-amber-300 font-mono text-[10px]">Idx: {item.score}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                    <div 
                      className="bg-gradient-to-r from-amber-600 to-amber-400 h-2.5 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    ></div>
                  </div>
                  <p className="text-[9px] text-slate-500 truncate">Cat: {item.category} | Afectación &lt;200m</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 italic text-center pb-4">
              No hay atractores con actividad delictiva en su periferia cercana (200m).
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 shadow-inner">
          <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-4 border-b border-red-900 pb-1">
            Proyección a 6 Meses (+20%)
          </h4>
          <div className="space-y-4">
            {projectionStats.map((item, idx) => {
              const maxVal = Math.max(item.projected, 5);
              const currentPct = (item.current / maxVal) * 100;
              const projPct = (item.projected / maxVal) * 100;
              
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] items-end">
                    <span className="font-semibold text-slate-200 truncate pr-2">{item.name}</span>
                  </div>
                  <div className="relative w-full bg-slate-800 rounded-sm h-3 border border-slate-700 flex">
                    <div 
                      className="bg-slate-500 h-full border-r border-slate-900 z-10 relative flex items-center justify-end pr-1 overflow-hidden"
                      style={{ width: `${currentPct}%` }}
                    >
                      <span className="text-[8px] font-bold text-white leading-none">{item.current}</span>
                    </div>
                    <div 
                      className="bg-red-500/80 h-full relative flex items-center justify-end pr-1 transition-all duration-1000 overflow-hidden"
                      style={{ width: `${projPct - currentPct}%` }}
                    >
                      <span className="text-[8px] font-bold text-white leading-none">{item.projected}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Actual (Gris)</span>
                    <span className="text-red-400/80">Proyectado (Rojo)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}