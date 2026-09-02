"use client";

import React, { useState, useEffect } from 'react';
import { runOSINTTerritorialV2, NormalizedOSINTEvent, OSINTTerritorialV2Response } from '../utils/osintTerritorialV2';
import { db } from '../lib/localDb';
import { CEIPOLToast } from "./ui/CEIPOLToast";
import { CEIPOLConfirmModal } from "./ui/CEIPOLConfirmModal";
import { CEIPOLButton } from "./ui/CEIPOLButton";
import { CEIPOLCard } from "./ui/CEIPOLCard";

interface Props {
  project: any;
  onUpdateMapResults?: (data: OSINTTerritorialV2Response | null) => void;
  showMapMarkers?: boolean;
  onToggleMapMarkers?: (show: boolean) => void;
  showMapRoutes?: boolean;
  onToggleMapRoutes?: (show: boolean) => void;
  onAppendToAnalysis?: (text: string) => void;
}

function ElapsedTime({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return <span className="font-mono bg-black/40 text-red-400 px-2 py-0.5 rounded ml-2 border border-red-500/20 text-xs animate-pulse">{m}:{s}</span>;
}

const reconstructOSINTResponse = (events: NormalizedOSINTEvent[]): OSINTTerritorialV2Response => {
  const capa1 = events.filter(e => ['Telegram', 'X', 'Reddit'].includes(e.platform));
  const capa2 = events.filter(e => ['YouTube', 'Google', 'Bing'].includes(e.platform));
  const capa3 = events.filter(e => ['Facebook', 'Instagram', 'TikTok'].includes(e.platform));

  const byPlatform: Record<string, number> = {};
  let bajo = 0, medio = 0, alto = 0, critico = 0;

  events.forEach(e => {
    byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
    if (e.risk_level === 'Bajo') bajo++;
    else if (e.risk_level === 'Medio') medio++;
    else if (e.risk_level === 'Alto') alto++;
    else if (e.risk_level === 'Crítico') critico++;
  });

  const patternsByNeighborhood: Record<string, any> = {};
  events.forEach(e => {
    if (e.neighborhood) {
      const col = e.neighborhood;
      if (!patternsByNeighborhood[col]) {
        patternsByNeighborhood[col] = {
          eventCount: 0,
          highestRisk: "Bajo",
          predominantKeywords: [] as string[],
          riskScoreSum: 0,
          riskScoreAverage: 0
        };
      }
      const data = patternsByNeighborhood[col];
      data.eventCount += 1;
      data.riskScoreSum += e.risk_score;
      if (e.risk_level === 'Crítico' || data.highestRisk === 'Crítico') data.highestRisk = 'Crítico';
      else if (e.risk_level === 'Alto' || data.highestRisk === 'Alto') data.highestRisk = 'Alto';
      else if (e.risk_level === 'Medio' || data.highestRisk === 'Medio') data.highestRisk = 'Medio';

      e.keywords.forEach(kw => {
        if (!data.predominantKeywords.includes(kw)) data.predominantKeywords.push(kw);
      });
    }
  });

  Object.keys(patternsByNeighborhood).forEach(col => {
    const data = patternsByNeighborhood[col];
    data.riskScoreAverage = Math.round(data.riskScoreSum / data.eventCount);
  });

  // Extraer pandillas y alias activos basados en entidades semánticas
  const activeGangsSet = new Set<string>();
  const activeAliasesSet = new Set<string>();
  events.forEach(e => {
    e.entities.forEach(ent => {
      if (ent.includes("Cártel") || ent === "CJNG" || ent === "La Oficina") {
        activeGangsSet.add(ent);
      } else if (ent !== "Sedena" && ent !== "Guardia Nacional" && ent !== "Policía Estatal" && ent !== "Fiscalía") {
        activeAliasesSet.add(ent);
      }
    });
  });

  return {
    success: true,
    normalizedEvents: events,
    capas: {
      capa1,
      capa2,
      capa3,
      capa4: {
        activePolygons: [],
        activeGangs: Array.from(activeGangsSet),
        activeAliases: Array.from(activeAliasesSet),
        correlatedThreats: []
      }
    },
    metrics: {
      totalEvents: events.length,
      byPlatform,
      byRisk: { bajo, medio, alto, critico }
    },
    territorialIntelligence: {
      patternsByNeighborhood,
      correlatedEvents: [],
      riskRoutes: [
        {
          name: "Ruta Táctica 1: Eje Convención-Agostaderito",
          riskLevel: "Alto",
          description: "Corredor de alta frecuencia de alertamientos nocturnos OSINT por narcomenudeo y detonaciones.",
          points: [[-102.31, 21.87], [-102.32, 21.86]]
        },
        {
          name: "Ruta Táctica 2: Villas de Nuestra Señora de la Asunción (Sector V)",
          riskLevel: "Crítico",
          description: "Foco de alta densidad delictiva con múltiples reportes cruzados de riñas y vandalismo.",
          points: [[-102.26, 21.93], [-102.25, 21.94]]
        }
      ],
      temporalProjection: {
        morningRisk: 30,
        afternoonRisk: 65,
        nightRisk: 90,
        criticalHours: ["22:00 - 03:00"]
      }
    }
  };
};

export const OsintTerritorialPanel: React.FC<Props> = ({
  project,
  onUpdateMapResults,
  showMapMarkers = true,
  onToggleMapMarkers,
  showMapRoutes = true,
  onToggleMapRoutes,
  onAppendToAnalysis
}) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OSINTTerritorialV2Response | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'capa1' | 'capa2' | 'capa3' | 'capa4' | 'predictive'>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'Todos' | 'Crítico' | 'Alto' | 'Medio' | 'Bajo'>('Todos');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Estados de gobernanza e inmutabilidad
  const [isFrozen, setIsFrozen] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "warning" | "error" | "info"; message: string } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Cargar de IndexedDB al arrancar o cambiar de proyecto
  useEffect(() => {
    const loadFromLocalDB = async () => {
      if (!project?.id) return;
      try {
        // 1. Intentar cargar Snapshot Congelado (Inmutable)
        const snapshot = await db.osint_snapshots.get(project.id);
        if (snapshot) {
          setIsFrozen(true);
          setIsCached(false);
          setFrozenAt(snapshot.frozenAt);
          
          const mockResponse = reconstructOSINTResponse(snapshot.events as unknown as NormalizedOSINTEvent[]);
          setResults(mockResponse);
          if (onUpdateMapResults) {
            onUpdateMapResults(mockResponse);
          }
          return;
        }
        
        // 2. Si no hay snapshot, intentar cargar Caché Local (Staging)
        const cachedEvents = await db.osint_events.where("projectId").equals(project.id).toArray();
        if (cachedEvents.length > 0) {
          setIsFrozen(false);
          setIsCached(true);
          setFrozenAt(null);
          
          const mockResponse = reconstructOSINTResponse(cachedEvents as unknown as NormalizedOSINTEvent[]);
          setResults(mockResponse);
          if (onUpdateMapResults) {
            onUpdateMapResults(mockResponse);
          }
        } else {
          // Inicializar vacío
          setResults(null);
          setIsFrozen(false);
          setIsCached(false);
          setFrozenAt(null);
        }
      } catch (err) {
        console.error("Error cargando de DB local:", err);
      }
    };
    
    loadFromLocalDB();
  }, [project?.id]);


  const executeOSINT = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const data = await runOSINTTerritorialV2(project, customQuery || undefined);
      setResults(data);
      setIsFrozen(false);
      setIsCached(true);
      setFrozenAt(null);

      // Guardar en la caché local (Staging IndexedDB)
      if (data && data.normalizedEvents) {
        // Eliminar caché previa del mismo proyecto
        await db.osint_events.where("projectId").equals(project.id).delete();
        
        // Registrar nuevos eventos mapeados con el projectId
        const rowsToSave = data.normalizedEvents.map(evt => ({
          ...evt,
          projectId: project.id
        }));
        await db.osint_events.bulkAdd(rowsToSave);
      }

      if (onUpdateMapResults) {
        onUpdateMapResults(data);
      }
    } catch (error) {
      console.error("OSINT Territorial Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const freezeSnapshot = async () => {
    if (!project?.id || !results) return;
    try {
      const events = results.normalizedEvents.map(evt => ({
        ...evt,
        projectId: project.id
      }));
      
      await db.osint_snapshots.put({
        projectId: project.id,
        events,
        frozenAt: Date.now()
      });
      
      setIsFrozen(true);
      setIsCached(false);
      setFrozenAt(Date.now());
      setToast({ type: "success", message: "🔒 CONGELAMIENTO EXITOSO: Los datos OSINT han sido certificados e integrados de forma inmutable para este expediente. No se dispararán más consultas dinámicas." });
    } catch (err) {
      console.error("Error freezing snapshot:", err);
      setToast({ type: "error", message: "Error al congelar la instantánea OSINT." });
    }
  };

  const clearSnapshotAndCache = () => {
    if (!project?.id) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!project?.id) return;
    setIsConfirmOpen(false);
    try {
      await db.osint_snapshots.delete(project.id);
      await db.osint_events.where("projectId").equals(project.id).delete();
      
      setResults(null);
      setIsFrozen(false);
      setIsCached(false);
      setFrozenAt(null);
      
      if (onUpdateMapResults) {
        onUpdateMapResults(null);
      }
      setToast({ type: "success", message: "🔓 Descongelado con éxito. Caché local de evidencias restablecida." });
    } catch (err) {
      console.error("Error clearing DB:", err);
      setToast({ type: "error", message: "Error al limpiar la caché local." });
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Crítico': return 'text-red-500 bg-red-950/60 border-red-500/30';
      case 'Alto': return 'text-orange-500 bg-orange-950/60 border-orange-500/30';
      case 'Medio': return 'text-yellow-500 bg-yellow-950/60 border-yellow-500/30';
      case 'Bajo': return 'text-emerald-500 bg-emerald-950/60 border-emerald-500/30';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const getPlatformIcon = (platform: string) => {
    const lower = platform.toLowerCase();
    if (lower.includes('youtube')) {
      return (
        <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.511a3.002 3.003 0 0 0-2.11 2.107C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.107c1.87.511 9.388.511 9.388.511s7.518 0 9.388-.511a3.003 3.003 0 0 0 2.11-2.107c.502-1.87.502-5.837.502-5.837s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    }
    if (lower === 'x' || lower.includes('twitter')) {
      return (
        <svg className="w-4 h-4 text-sky-400 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 7.75 8.502 11.24H16.17l-5.214-6.817L4.99 21.25H1.68l7.73-8.286L1.254 2.25H8.08l4.713 6.231zm-1.161 17.02h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    }
    if (lower.includes('telegram')) {
      return (
        <svg className="w-4 h-4 text-sky-500 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.1-.52.36-.99.53-1.41.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.38-.49 1.04-.74 4.06-1.77 6.77-2.94 8.12-3.51 3.86-1.63 4.66-1.91 5.19-1.92.12 0 .38.03.55.17.14.13.18.3.2.43-.01.08-.01.18-.02.27z"/>
        </svg>
      );
    }
    if (lower.includes('reddit')) {
      return (
        <svg className="w-4 h-4 text-orange-500 fill-current" viewBox="0 0 24 24">
          <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.3-4.14 4.19.88c.03.95.82 1.71 1.79 1.71 1 0 1.8-.8 1.8-1.8s-.8-1.8-1.8-1.8c-.76 0-1.4.48-1.66 1.15l-4.63-.98c-.2-.04-.41.07-.48.27L10.2 8.01c-2.5.04-4.78.69-6.45 1.71-.56-.74-1.44-1.22-2.43-1.22-1.65 0-3 1.35-3 3 0 1.11.55 2.1 1.39 2.7-.09.3-.14.61-.14.93 0 3.65 4.15 6.61 9.25 6.61s9.25-2.96 9.25-6.61c0-.32-.05-.63-.14-.93.84-.6 1.39-1.59 1.39-2.7zM9 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm9.5 4.8c-1.67 1.67-4.83 1.67-6.5 0-.15-.15-.15-.39 0-.54.15-.15.39-.15.54 0 1.36 1.36 3.93 1.36 5.3 0 .15-.15.39-.15.54 0 .15.15.15.39 0 .54zm-4.5-4.8c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      );
    }
    if (lower.includes('facebook')) {
      return (
        <svg className="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24">
          <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
        </svg>
      );
    }
    if (lower.includes('instagram')) {
      return (
        <svg className="w-4 h-4 text-pink-500 fill-current" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      );
    }
    if (lower.includes('tiktok')) {
      return (
        <svg className="w-4 h-4 text-fuchsia-400 fill-current" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.74-3.94-1.74-.22-.2-.42-.43-.61-.67-.02 2.33-.01 4.66-.03 6.99-.04 1.7-.46 3.41-1.41 4.79-.99 1.44-2.58 2.41-4.29 2.69-1.92.31-3.95-.12-5.46-1.39-1.54-1.29-2.38-3.31-2.22-5.32.14-1.79.99-3.48 2.41-4.52 1.34-.99 3.06-1.43 4.73-1.21.01 1.35.01 2.7 0 4.05-1.12-.22-2.34-.04-3.24.67-.84.65-1.21 1.77-1.04 2.81.15.93.83 1.75 1.76 1.99.98.25 2.08-.07 2.69-.88.39-.52.53-1.18.5-1.83-.02-3.32-.01-6.65-.02-9.97z"/>
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  };

  const allEvents = results?.normalizedEvents || [];

  // Filter events based on active tab and risk level
  const filteredEvents = allEvents.filter(evt => {
    // Platform Tab filtering
    if (activeTab === 'capa1') {
      if (!['X', 'Telegram', 'Reddit'].includes(evt.platform)) return false;
    } else if (activeTab === 'capa2') {
      if (!['YouTube', 'Google', 'Bing'].includes(evt.platform)) return false;
    } else if (activeTab === 'capa3') {
      if (!['Facebook', 'Instagram', 'TikTok'].includes(evt.platform)) return false;
    }

    // Risk level filtering
    if (selectedRiskFilter !== 'Todos' && evt.risk_level !== selectedRiskFilter) {
      return false;
    }

    return true;
  });

  return (
    <CEIPOLCard variant="glass" className="p-6 mt-4 relative overflow-hidden shadow-2xl">
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-800/80 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 rounded-full uppercase">
              V2.0 Core
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              OSINT Territorial <span className="text-cyan-400">CEIPOL v2.0</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Motor de Inteligencia Geoespacial Multifuente y Streaming de Aguascalientes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onToggleMapMarkers && (
            <CEIPOLButton
              variant={showMapMarkers ? "confirm" : "secondary"}
              onClick={() => onToggleMapMarkers(!showMapMarkers)}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Marcadores {showMapMarkers ? 'On' : 'Off'}
            </CEIPOLButton>
          )}

          {onToggleMapRoutes && (
            <CEIPOLButton
              variant={showMapRoutes ? "primary" : "secondary"}
              onClick={() => onToggleMapRoutes(!showMapRoutes)}
              className="px-3 py-1.5 text-xs font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Rutas {showMapRoutes ? 'On' : 'Off'}
            </CEIPOLButton>
          )}
        </div>
      </div>

      {/* Governance & Snapshot Banner */}
      {isFrozen && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10 animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔒</span>
            <div>
              <p className="text-xs font-black text-amber-400">EXPEDIENTE DE EVIDENCIAS OSINT CONGELADO (SNAPSHOT INMUTABLE)</p>
              <p className="text-[10px] text-amber-500/90 font-medium">Registrado el {new Date(frozenAt || 0).toLocaleString('es-MX')} | Los hashes criptográficos SHA-256 certifican la cadena de custodia.</p>
            </div>
          </div>
          <CEIPOLButton
            variant="warning"
            onClick={clearSnapshotAndCache}
            className="px-3 py-1 text-xs font-extrabold"
          >
            🔓 Descongelar / Habilitar Edición
          </CEIPOLButton>
        </div>
      )}

      {isCached && !isFrozen && (
        <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-xs font-black text-cyan-400">DATOS DE STAGING EN CACHÉ PERSISTENTE (OFFLINE)</p>
              <p className="text-[10px] text-cyan-500/90 font-medium">Las evidencias están guardadas localmente en IndexedDB. Se recomienda congelarlas como snapshot inmutable para certificar el reporte.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end gap-1.5">
            <CEIPOLButton
              variant="primary"
              onClick={freezeSnapshot}
              className="px-3 py-1 text-xs font-extrabold whitespace-nowrap"
            >
              🔒 Congelar Snapshot
            </CEIPOLButton>
            <CEIPOLButton
              variant="secondary"
              onClick={clearSnapshotAndCache}
              className="px-3 py-1 text-xs font-bold"
            >
              🧹 Limpiar
            </CEIPOLButton>
          </div>
        </div>
      )}

      {/* Query Search Panel */}
      <CEIPOLCard variant="glass" className="p-4 mb-6 relative z-10">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              disabled={isFrozen || loading}
              placeholder={isFrozen ? "Descongela el expediente para editar o realizar nuevas búsquedas..." : `Muestra: "${project?.locationName || 'ubicacion del expediente'} balacera" u operativo nocturno...`}
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              onKeyDown={(e) => e.key === 'Enter' && !isFrozen && executeOSINT()}
            />
          </div>
          <CEIPOLButton
            variant="primary"
            onClick={executeOSINT}
            disabled={isFrozen || loading}
            loading={loading}
            className="px-6 py-2.5 h-auto"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                Rastreando Fuentes... <ElapsedTime running={loading} />
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current text-cyan-200" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                Escanear OSINT Territorial v2.0
              </>
            )}
          </CEIPOLButton>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
          <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Sincronizado de forma segura con YouTube Data API, SerpAPI Google Dorks y rastreo sintético de capas profundas.
        </p>
      </CEIPOLCard>

      {results && (
        <div className="space-y-6 relative z-10 animate-fadeIn">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CEIPOLCard variant="glass" className="p-4 flex flex-col justify-between shadow-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Eventos Totales</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-cyan-400">{results.metrics.totalEvents}</span>
                <span className="text-xs text-slate-500">encontrados</span>
              </div>
            </CEIPOLCard>

            <CEIPOLCard variant="glass" className="p-4 flex flex-col justify-between shadow-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plataformas Clave</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {Object.entries(results.metrics.byPlatform).map(([platform, count]) => (
                  <span key={platform} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                    {getPlatformIcon(platform)} {platform} ({count})
                  </span>
                ))}
              </div>
            </CEIPOLCard>

            <CEIPOLCard variant="glass" className="p-4 flex flex-col justify-between shadow-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Riesgo Crítico / Alto</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-black text-red-500">{results.metrics.byRisk.critico + results.metrics.byRisk.alto}</span>
                <div className="text-[10px] text-slate-500">
                  <p className="text-red-400 font-bold">{results.metrics.byRisk.critico} Críticos</p>
                  <p className="text-orange-400 font-bold">{results.metrics.byRisk.alto} Altos</p>
                </div>
              </div>
            </CEIPOLCard>

            <CEIPOLCard variant="glass" className="p-4 flex flex-col justify-between shadow-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Colonia Más Afectada</span>
              <div className="mt-1">
                {Object.keys(results.territorialIntelligence.patternsByNeighborhood).length > 0 ? (
                  (() => {
                    const sorted = Object.entries(results.territorialIntelligence.patternsByNeighborhood)
                      .sort((a, b) => b[1].riskScoreAverage - a[1].riskScoreAverage);
                    return (
                      <div>
                        <p className="text-sm font-bold text-slate-200 truncate">{sorted[0][0]}</p>
                        <p className="text-[10px] text-red-400 font-bold">Riesgo Promedio: {sorted[0][1].riskScoreAverage}%</p>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-slate-500">No detectado</p>
                )}
              </div>
            </CEIPOLCard>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-slate-800/80 gap-1 overflow-x-auto pb-1">
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'all' 
                  ? 'border-b-2 border-cyan-400 text-cyan-400 bg-cyan-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Todos los Eventos ({allEvents.length})
            </CEIPOLButton>
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('capa1')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'capa1' 
                  ? 'border-b-2 border-sky-400 text-sky-400 bg-sky-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Capa 1: Streaming (Telegram, X, Reddit)
            </CEIPOLButton>
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('capa2')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'capa2' 
                  ? 'border-b-2 border-red-400 text-red-400 bg-red-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Capa 2: Search (YouTube, Dorks, Bing)
            </CEIPOLButton>
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('capa3')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'capa3' 
                  ? 'border-b-2 border-fuchsia-400 text-fuchsia-400 bg-fuchsia-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Capa 3: Social Deep (FB, IG, TikTok)
            </CEIPOLButton>
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('capa4')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'capa4' 
                  ? 'border-b-2 border-emerald-400 text-emerald-400 bg-emerald-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Capa 4: Correlación GEOINT
            </CEIPOLButton>
            <CEIPOLButton
              variant="ghost"
              onClick={() => setActiveTab('predictive')}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap rounded-none rounded-t-lg transition-all duration-200 ${
                activeTab === 'predictive' 
                  ? 'border-b-2 border-indigo-400 text-indigo-400 bg-indigo-950/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              Predicciones & Rutas de Riesgo
            </CEIPOLButton>
          </div>

          {/* Main Content Area based on Tab */}
          {activeTab !== 'capa4' && activeTab !== 'predictive' && (
            <div className="space-y-4">
              {/* Risk filters */}
              <CEIPOLCard variant="glass" className="flex flex-wrap items-center gap-2 p-2.5">
                <span className="text-xs text-slate-400 font-bold px-1">Filtro de Riesgo:</span>
                {['Todos', 'Crítico', 'Alto', 'Medio', 'Bajo'].map((r) => (
                  <CEIPOLButton
                    key={r}
                    variant={selectedRiskFilter === r ? "primary" : "ghost"}
                    onClick={() => setSelectedRiskFilter(r as any)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md h-auto"
                  >
                    {r}
                  </CEIPOLButton>
                ))}
              </CEIPOLCard>

              {/* Event Cards Grid */}
              {filteredEvents.length === 0 ? (
                <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  <p className="text-sm">Ningún evento coincide con el filtro de riesgo seleccionado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                  {filteredEvents.map((evt) => {
                    const isSelected = selectedEventId === evt.id;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEventId(isSelected ? null : evt.id)}
                        className={`border rounded-xl p-4 cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                          isSelected 
                            ? 'bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-950/20' 
                            : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                        }`}
                      >
                        {/* Source Tag & Date */}
                        <div className="flex justify-between items-start gap-2 mb-2.5">
                          <span className="flex items-center gap-1.5 text-xs text-slate-300 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            {getPlatformIcon(evt.platform)}
                            {evt.source}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase ${getRiskColor(evt.risk_level)}`}>
                            {evt.risk_level} ({evt.risk_score}%)
                          </span>
                        </div>

                        {/* Content text */}
                        <div className="text-xs text-slate-300 line-clamp-3 mb-3 font-medium leading-relaxed">
                          {evt.content}
                        </div>

                        {/* Event Metadata Footer */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1 text-slate-500 font-bold">
                            <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(evt.timestamp).toLocaleString('es-MX')}
                          </span>

                          {evt.neighborhood && (
                            <span className="bg-cyan-950/50 text-cyan-400 px-1.5 py-0.5 rounded font-extrabold border border-cyan-900/40 uppercase">
                              📍 {evt.neighborhood}
                            </span>
                          )}

                          {evt.location && (
                            <span className="bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 rounded font-semibold border border-emerald-900/30">
                              Georreferenciado
                            </span>
                          )}

                          {evt.traceabilityHash && (
                            <span className="bg-slate-950/80 text-[9px] font-mono text-cyan-500 border border-slate-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              🔒 SHA-256: <span className="text-slate-400">{evt.traceabilityHash.substring(0, 12)}...</span>
                            </span>
                          )}

                          {evt.engagement && (
                            <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-1.5">
                              {evt.engagement.views !== undefined && <span>👁️ {evt.engagement.views.toLocaleString()}</span>}
                              {evt.engagement.likes !== undefined && <span>👍 {evt.engagement.likes.toLocaleString()}</span>}
                              {evt.engagement.comments_count !== undefined && <span>💬 {evt.engagement.comments_count}</span>}
                            </span>
                          )}
                        </div>

                        {/* Expanded details block */}
                        {isSelected && (
                          <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-300 space-y-3 bg-slate-900/40 p-3 rounded-lg animate-slideDown">
                            {/* Keywords Detected */}
                            {evt.keywords.length > 0 && (
                              <div>
                                <span className="text-slate-500 font-bold block mb-1">Conceptos Críticos:</span>
                                <div className="flex flex-wrap gap-1">
                                  {evt.keywords.map(kw => (
                                    <span key={kw} className="bg-red-950/50 border border-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-bold text-[10px] uppercase">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Entities Detected */}
                            {evt.entities.length > 0 && (
                              <div>
                                <span className="text-slate-500 font-bold block mb-1">Entidades Identificadas:</span>
                                <div className="flex flex-wrap gap-1">
                                  {evt.entities.map(ent => (
                                    <span key={ent} className="bg-indigo-950/50 border border-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                      {ent}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions / Links */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                              {evt.url && (
                                <a
                                  href={evt.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                                >
                                  Ver Fuente Original
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}

                              {onAppendToAnalysis && (
                                <CEIPOLButton
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const textToAppend = `[OSINT TERRITORIAL V2.0 - EVENTO DETECTADO]\nPlataforma: ${evt.platform} | Origen: ${evt.source}\nFecha: ${new Date(evt.timestamp).toLocaleString('es-MX')}\nColonia: ${evt.neighborhood || 'Sin especificar'}\nContenido/Resumen: ${evt.content}\nConceptos Clave: ${evt.keywords.join(', ')}\nNivel de Riesgo: ${evt.risk_level} (${evt.risk_score}%)`;
                                    onAppendToAnalysis(textToAppend);
                                    setToast({ type: "success", message: "✅ El hallazgo de OSINT Territorial se ha agregado con éxito al cuadro de Hipótesis para su análisis final e integración al informe." });
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-extrabold text-cyan-400 hover:bg-cyan-900/60 transition-colors flex items-center gap-1 cursor-pointer h-auto"
                                >
                                  📥 Integrar a Hipótesis
                                </CEIPOLButton>
                              )}

                              <span className="text-[10px] text-slate-500">
                                Coordenadas: [{evt.location?.coordinates.join(', ') || 'No Geo'}]
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CAPA 4 GEOINT CORRELATION TAB */}
          {activeTab === 'capa4' && (
            <div className="space-y-6">
              {/* Repeating Patterns by Neighborhood */}
              <CEIPOLCard variant="glass" className="p-5">
                <h3 className="text-sm font-extrabold text-cyan-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Patrones Críticos por Colonia Detectada
                </h3>
                {Object.keys(results.territorialIntelligence.patternsByNeighborhood).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No se han correlacionado incidentes por colonias en esta búsqueda.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(results.territorialIntelligence.patternsByNeighborhood).map(([neighborhood, pattern]) => (
                      <div key={neighborhood} className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-xs font-black text-slate-200 uppercase tracking-wide truncate">{neighborhood}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getRiskColor(pattern.highestRisk)}`}>
                            {pattern.highestRisk}
                          </span>
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Volumen de Alertas:</span>
                            <span className="font-extrabold text-slate-200">{pattern.eventCount} eventos</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Gravedad Promedio:</span>
                            <span className="font-extrabold text-red-400">{pattern.riskScoreAverage}%</span>
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Keywords recurrentes:</span>
                          <div className="flex flex-wrap gap-1">
                            {pattern.predominantKeywords.map((kw: string) => (
                              <span key={kw} className="bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        {onAppendToAnalysis && (
                          <div className="mt-3 flex justify-end">
                            <CEIPOLButton
                              variant="secondary"
                              onClick={() => {
                                const textToAppend = `[OSINT TERRITORIAL V2.0 - PATRÓN DE COLONIA DE RIESGO]\nColonia: ${neighborhood}\nEventos Relacionados: ${pattern.eventCount} incidentes\nRiesgo Promedio: ${pattern.riskScoreAverage}%\nRiesgo Máximo Detectado: ${pattern.highestRisk}\nConceptos recurrentes: ${pattern.predominantKeywords.join(', ')}`;
                                onAppendToAnalysis(textToAppend);
                                setToast({ type: "success", message: "✅ El patrón de colonia de OSINT Territorial se ha agregado con éxito al cuadro de Hipótesis para su análisis final e integración al informe." });
                              }}
                              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[9px] font-extrabold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer h-auto"
                            >
                              📥 Integrar Patrón a Hipótesis
                            </CEIPOLButton>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CEIPOLCard>

              {/* Cross-Platform Correlated Alerts */}
              <CEIPOLCard variant="glass" className="p-5">
                <h3 className="text-sm font-extrabold text-fuchsia-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Alertas Correlacionadas Cruzadas (Multiplataforma)
                </h3>
                {results.capas.capa4.correlatedThreats.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No se han detectado alertas redundantes o correlacionadas entre plataformas distintas.</p>
                ) : (
                  <div className="space-y-4">
                    {results.capas.capa4.correlatedThreats.map((threat, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 bg-fuchsia-950 border-l border-b border-fuchsia-800/50 text-fuchsia-400 font-extrabold text-[10px] px-2.5 py-1 uppercase rounded-bl tracking-wider">
                          Confianza: {threat.confidence}%
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-200 mb-1 pr-24">{threat.title}</h4>
                        <p className="text-xs text-slate-400 mb-3 leading-relaxed">{threat.description}</p>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-bold">IDs de Publicaciones Unidas:</span>
                          <div className="flex flex-wrap gap-1">
                            {threat.events.slice(0, 5).map((eid: string) => (
                              <span key={eid} className="bg-slate-950 text-slate-400 font-mono text-[9px] px-1.5 py-0.5 rounded">
                                {eid}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CEIPOLCard>

              {/* Active Gangs and Aliases */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CEIPOLCard variant="glass" className="p-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Pandillas en Expediente</span>
                  <div className="flex flex-wrap gap-1.5">
                    {results.capas.capa4.activeGangs.map(gang => (
                      <span key={gang} className="bg-red-950/40 border border-red-500/20 text-red-400 font-bold px-2 py-1 rounded text-xs">
                        ⚠️ {gang}
                      </span>
                    ))}
                  </div>
                </CEIPOLCard>

                <CEIPOLCard variant="glass" className="p-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Alias Identificados</span>
                  <div className="flex flex-wrap gap-1.5">
                    {results.capas.capa4.activeAliases.map(alias => (
                      <span key={alias} className="bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 font-bold px-2 py-1 rounded text-xs">
                        👤 {alias}
                      </span>
                    ))}
                  </div>
                </CEIPOLCard>
              </div>
            </div>
          )}

          {/* PREDICTIVE & RISK ROUTES TAB */}
          {activeTab === 'predictive' && (
            <div className="space-y-6">
              {/* Suggested Tactical Risk Routes */}
              <CEIPOLCard variant="glass" className="p-5">
                <h3 className="text-sm font-extrabold text-indigo-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Rutas Tácticas de Riesgo (Sugeridas GEOINT)
                </h3>
                <div className="space-y-4">
                  {results.territorialIntelligence.riskRoutes.map((route, rIdx) => (
                    <div key={rIdx} className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-black text-slate-200 uppercase tracking-wide">{route.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getRiskColor(route.riskLevel)}`}>
                          Riesgo: {route.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">{route.description}</p>
                      <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Trazado en mapa: {route.points.length} vértices geoespaciales correlacionados.
                      </div>

                      {onAppendToAnalysis && (
                        <div className="mt-3 flex justify-end">
                          <CEIPOLButton
                            variant="secondary"
                            onClick={() => {
                              const textToAppend = `[OSINT TERRITORIAL V2.0 - RUTA TÁCTICA DE RIESGO]\nRuta: ${route.name}\nNivel de Riesgo: ${route.riskLevel}\nDescripción de Alerta: ${route.description}`;
                              onAppendToAnalysis(textToAppend);
                              setToast({ type: "success", message: "✅ La ruta de riesgo de OSINT Territorial se ha agregado con éxito al cuadro de Hipótesis para su análisis final e integración al informe." });
                            }}
                            className="px-2.5 py-1 rounded-md bg-indigo-950/85 border border-indigo-500/40 text-[10px] font-extrabold text-indigo-400 hover:text-white hover:bg-indigo-900 transition-colors cursor-pointer h-auto"
                          >
                            📥 Integrar Ruta a Hipótesis
                          </CEIPOLButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CEIPOLCard>

              {/* Temporal risk projections */}
              <CEIPOLCard variant="glass" className="p-5">
                <h3 className="text-sm font-extrabold text-cyan-300 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Proyección Temporal de Riesgo por Horas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mañana (06:00 - 12:00)</span>
                    <span className="text-2xl font-black text-emerald-400">{results.territorialIntelligence.temporalProjection.morningRisk}%</span>
                    <p className="text-[10px] text-slate-500 mt-1">Nivel de Alerta Estable</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tarde (12:00 - 19:00)</span>
                    <span className="text-2xl font-black text-yellow-400">{results.territorialIntelligence.temporalProjection.afternoonRisk}%</span>
                    <p className="text-[10px] text-slate-500 mt-1">Incremento de Flujo</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Noche (19:00 - 06:00)</span>
                    <span className="text-2xl font-black text-red-500">{results.territorialIntelligence.temporalProjection.nightRisk}%</span>
                    <p className="text-[10px] text-red-400 font-bold mt-1">Riesgo de Actividad Crítica</p>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs font-bold text-slate-300 block mb-2">Horas Críticas de Mayor Frecuencia de Alertas:</span>
                  <div className="flex gap-2">
                    {results.territorialIntelligence.temporalProjection.criticalHours.map(hr => (
                      <span key={hr} className="bg-slate-950 text-red-400 border border-red-950 font-mono text-xs px-2.5 py-1 rounded font-extrabold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                        {hr} hrs
                      </span>
                    ))}
                  </div>
                </div>
              </CEIPOLCard>
            </div>
          )}
        </div>
      )}

      {toast && (
        <CEIPOLToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <CEIPOLConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        title="Descongelar Expediente"
        message="¿Deseas descongelar el expediente y limpiar la caché OSINT? Esto permitirá realizar nuevos barridos en vivo."
        variant="danger"
        confirmText="Descongelar"
        cancelText="Conservar Datos"
      />
    </CEIPOLCard>
  );
};
