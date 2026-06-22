"use client";

import React, { useState, useEffect } from "react";
import { PowerUpConfig, PowerUpState, PowerUpExecutionLog } from "./powerups.types";
import { POWER_UPS_CONFIG } from "./powerups.config";
import { PowerUpCard } from "./PowerUpCard";
import { PowerUpPreviewModal } from "./PowerUpPreviewModal";

interface PowerUpsModuleProps {
  onApplyPowerUp: (text: string) => void;
  isReadOnly?: boolean;
}

export function PowerUpsModule({ onApplyPowerUp, isReadOnly = false }: PowerUpsModuleProps) {
  const [selectedPu, setSelectedPu] = useState<PowerUpConfig | null>(null);
  const [hoveredPu, setHoveredPu] = useState<PowerUpConfig | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<Record<string, boolean>>({});
  
  // PowerUp states
  const [puStates, setPuStates] = useState<Record<string, PowerUpState>>({
    analizar_imagen: "idle",
    analizar_audio: "idle",
    analisis_ubicacion: "idle",
    detectar_entidades: "idle",
    buscar_inteligencia: "idle"
  });

  // Simulated running status messages for UX
  const [statusLogMsg, setStatusLogMsg] = useState<string | null>(null);

  // Execution Traceability Logs
  const [logs, setLogs] = useState<PowerUpExecutionLog[]>([]);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("perfilador_powerups_logs_v2");
      if (stored) {
        setLogs(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading PowerUp logs", e);
    }
  }, []);

  const activePuForPreview = hoveredPu || selectedPu;

  const handleCardClick = (pu: PowerUpConfig) => {
    if (isReadOnly) return;
    setSelectedPu(pu);
    setIsPreviewOpen(true);
  };

  const handleConfirmProcess = () => {
    if (!selectedPu) return;
    const puId = selectedPu.id;
    const config = selectedPu;
    setIsPreviewOpen(false);

    // Set state to running
    setPuStates(prev => ({ ...prev, [puId]: "running" }));
    setStatusLogMsg("Iniciando pipeline de geointeligencia...");

    // Stage 1: Simulating progress log transitions
    setTimeout(() => {
      setStatusLogMsg(`Analizando ${config.preview.dataToProcess.split(",")[0]}...`);
    }, 800);

    // Stage 2: Prompting API grounding
    setTimeout(() => {
      setStatusLogMsg(`Estructurando logs de trazabilidad táctica...`);
    }, 1600);

    // Stage 3: Complete process
    setTimeout(() => {
      // Apply technical text to editor
      onApplyPowerUp(config.technicalText);

      // Create traceability log entry
      const confidence = Number((0.92 + Math.random() * 0.07).toFixed(2)); // Random confidence between 92% and 99%
      const newLog: PowerUpExecutionLog = {
        analysisId: "AN-" + Math.floor(100000 + Math.random() * 900000),
        powerUpId: config.id,
        powerUpTitle: config.title,
        timestamp: new Date().toLocaleTimeString("es-MX", { hour12: false }) + " " + new Date().toLocaleDateString("es-MX"),
        inputUsed: config.preview.dataToProcess,
        outputGenerated: config.technicalText,
        confidenceScore: confidence,
        sourcesConsulted: config.tooltip.expandableOperative.sources
      };

      const updatedLogs = [newLog, ...logs];
      setLogs(updatedLogs);
      localStorage.setItem("perfilador_powerups_logs_v2", JSON.stringify(updatedLogs));

      setPuStates(prev => ({ ...prev, [puId]: "completed" }));
      setStatusLogMsg(null);
      setSelectedPu(null);

      // Reset state back to idle after a few seconds so it can be re-run
      setTimeout(() => {
        setPuStates(prev => ({ ...prev, [puId]: "idle" }));
      }, 3500);

    }, 2400);
  };

  const toggleTechnical = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTechnicalDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem("perfilador_powerups_logs_v2");
  };

  const getComplexityTag = (id: string) => {
    if (id === "analisis_ubicacion" || id === "buscar_inteligencia") return "Complejo";
    if (id === "analizar_audio") return "Avanzado";
    return "Intermedio";
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-4 shadow-2xl space-y-4">
      {/* Header section with operational focus */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-900 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
            <span className="text-amber-500 animate-pulse text-base">⚡</span>
            Asistente de Inteligencia Operativa <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded font-mono ml-1">v2.0</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Aumenta el expediente digital con capacidades tácticas avanzadas guiadas por IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsLogsDrawerOpen(!isLogsDrawerOpen)}
              className="bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1 transition-colors"
            >
              📊 Trazabilidad ({logs.length}) {isLogsDrawerOpen ? "▲" : "▼"}
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-800/80 text-[10px] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-semibold">Módulo de Explicabilidad Activo</span>
          </div>
        </div>
      </div>

      {/* Real-time processing message overlay */}
      {statusLogMsg && (
        <div className="bg-sky-950/20 border border-sky-500/20 px-3 py-2 rounded-lg flex items-center gap-2 text-[10px] text-sky-300 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
          <span className="font-mono">PROCESO IA: <strong className="text-slate-100">{statusLogMsg}</strong></span>
        </div>
      )}

      {/* Main Grid: Left is Buttons, Right is "¿Qué estás activando?" dynamic context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Buttons / Cards Container (Left pane - 7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {POWER_UPS_CONFIG.map((pu) => (
              <PowerUpCard
                key={pu.id}
                config={pu}
                state={puStates[pu.id]}
                isReadOnly={isReadOnly}
                onClick={() => handleCardClick(pu)}
                onMouseEnter={() => !isReadOnly && setHoveredPu(pu)}
                onMouseLeave={() => setHoveredPu(null)}
                onToggleTechnical={(e) => toggleTechnical(pu.id, e)}
                showTechnical={!!showTechnicalDetails[pu.id]}
              />
            ))}
          </div>

          {/* Quick "Antes de ejecutar" overlay indicator if hovering on card */}
          {hoveredPu && (
            <div className="hidden lg:block bg-slate-900/80 border border-indigo-500/20 p-2.5 rounded-lg text-[10px] text-slate-300 animate-fadeIn shadow-lg">
              <span className="text-amber-400 font-bold block mb-1">🔍 Vista Previa ("Antes de ejecutar"):</span>
              Este PowerUp añadirá la instrucción de análisis: <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded font-mono">"{hoveredPu.technicalText}"</code>
            </div>
          )}
        </div>

        {/* Sidebar Panel: "¿Qué estás activando?" (Right pane - 5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between min-h-[220px] shadow-inner relative overflow-hidden">
          {activePuForPreview ? (
            <div className="space-y-3.5 animate-fadeIn">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{activePuForPreview.icon}</span>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">¿Qué estás activando?</span>
                </div>
                <h6 className="text-xs font-bold text-slate-100">
                  {activePuForPreview.title}
                </h6>
                <p className="text-[10px] text-slate-300 mt-1 leading-relaxed bg-slate-950/40 p-2.5 rounded border border-slate-900">
                  {activePuForPreview.tooltip.visibleHuman}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-950/30 p-2 rounded border border-slate-900/60">
                  <span className="text-slate-500 block font-medium">Complejidad:</span>
                  <span className={`font-bold ${
                    getComplexityTag(activePuForPreview.id) === "Complejo" ? "text-red-400" :
                    getComplexityTag(activePuForPreview.id) === "Avanzado" ? "text-purple-400" : "text-emerald-400"
                  }`}>{getComplexityTag(activePuForPreview.id)}</span>
                </div>
                <div className="bg-slate-950/30 p-2 rounded border border-slate-900/60">
                  <span className="text-slate-500 block font-medium">Datos Procesados:</span>
                  <span className="text-slate-300 font-bold truncate block" title={activePuForPreview.preview.dataToProcess}>
                    {activePuForPreview.preview.dataToProcess}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-900/80 text-[10px]">
                <span className="text-slate-500 block font-bold mb-0.5">Impacto en el Expediente:</span>
                <p className="text-slate-300 leading-normal">
                  {activePuForPreview.fileImpact || "Enriquece la contextualización de campo vinculando datos duros con la narrativa operativa."}
                </p>
              </div>

              {/* Action Button inside right pane if clicked */}
              {!isReadOnly && selectedPu && selectedPu.id === activePuForPreview.id && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  ⚡ Configurar y Ejecutar
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full py-8 text-slate-500 space-y-2">
              <div className="text-2xl animate-pulse">🤖</div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asistente de Inteligencia</p>
                <p className="text-[10px] text-slate-500 max-w-[180px] mt-1">
                  Pasa el cursor o selecciona un PowerUp para ver su impacto operativo antes de ejecutarlo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandible log database drawer (Trazabilidad de ejecución) */}
      {isLogsDrawerOpen && logs.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1">
              <span>📋</span> Registro Histórico de Trazabilidad IA
            </span>
            <button
              type="button"
              onClick={clearLogs}
              className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase"
            >
              Borrar Historial
            </button>
          </div>
          <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="pb-1.5 font-semibold">Análisis ID</th>
                  <th className="pb-1.5 font-semibold">PowerUp</th>
                  <th className="pb-1.5 font-semibold">Timestamp</th>
                  <th className="pb-1.5 font-semibold">Input Procesado</th>
                  <th className="pb-1.5 font-semibold text-right">Confianza IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 text-slate-300">
                {logs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-950/40">
                    <td className="py-2 font-mono text-[9px] text-indigo-400">{log.analysisId}</td>
                    <td className="py-2 font-bold">{log.powerUpTitle}</td>
                    <td className="py-2 text-slate-500">{log.timestamp}</td>
                    <td className="py-2 text-slate-400 truncate max-w-[150px]" title={log.inputUsed}>{log.inputUsed}</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-400">{(log.confidenceScore * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PowerUp pre-execution preview modal */}
      {selectedPu && (
        <PowerUpPreviewModal
          config={selectedPu}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setSelectedPu(null);
          }}
          onConfirm={handleConfirmProcess}
        />
      )}
    </div>
  );
}
