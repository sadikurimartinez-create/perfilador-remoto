"use client";

import React, { useState, useEffect } from "react";
import { proposeIntelligencePlan, IntelligencePlan } from "../utils/moiOrchestrator";
import { runUnifiedCifaScan } from "../utils/cifaEngine";
import { getAuthorizedSources, ImfoSource } from "../utils/imfoService";
import { useProject } from "@/context/ProjectContext";
import { DynamicPopup } from "./DynamicPopup";

interface Props {
  project: any;
  onAppendToAnalysis?: (text: string) => void;
  onUpdateMapResults?: (data: any) => void;
}

import { CEIPOLSectionHeader } from "./ui/CEIPOLSectionHeader";
import { CEIPOLBadge } from "./ui/CEIPOLBadge";
import { CEIPOLToast } from "./ui/CEIPOLToast";
import { CEIPOLLoader } from "./ui/CEIPOLLoader";
import { CEIPOLEmptyState } from "./ui/CEIPOLEmptyState";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import { CEIPOLButton } from "./ui/CEIPOLButton";

export const SOURCE_PLATFORM_LABELS: Record<string, string> = {
  osint_territorial: "OSINT Territorial CEIPOL v2.0",
  rss_regional: "Radar OSINT Regional (RSS)",
  google_dorks: "Google Dorks Search",
  discovery_engine: "Discovery Engine (Vertex AI)",
  telegram: "Telegram Bot, Grupos y Canales",
  x_twitter: "X (Twitter) Publicaciones",
  reddit: "Reddit Subreddits & Foros",
  youtube: "YouTube Videos y Shorts",
  drive_intelligence: "Google Drive Intelligence",
  google_maps: "Google Maps Geosearch",
  street_view: "Street View Vision Analysis",
  apis_gubernamentales: "APIs Gubernamentales (INEGI/DENUE)",
  facebook_public: "Facebook Páginas Públicas",
  instagram_public: "Instagram Public hashtags"
};

export const CifaCeipolPanel: React.FC<Props> = ({
  project,
  onAppendToAnalysis,
  onUpdateMapResults
}) => {
  const { registerSweep } = useProject();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<IntelligencePlan | null>(null);
  const [results, setResults] = useState<any | null>(null);
  
  // PRI Form States
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [softContext, setSoftContext] = useState("");
  const [editableHypothesis, setEditableHypothesis] = useState("");
  const [editablePriority, setEditablePriority] = useState<IntelligencePlan["priority"]>("Medio");
  const [editableInvestigationType, setEditableInvestigationType] = useState("");

  // Confirmation state
  const [cifaDataConfirm, setCifaDataConfirm] = useState<string | null>(null);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "warning" | "error" | "info"; message: string } | null>(null);

  // Navigation
  const [activeTab, setActiveTab] = useState<"pri" | "coverage" | "correlation" | "chronology" | "learning">("pri");
  
  // Explicabilidad details modal
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);

  // Available sources catalog for checklist
  const [availableSources, setAvailableSources] = useState<ImfoSource[]>([]);

  useEffect(() => {
    const loadPlanAndSources = async () => {
      if (!project) return;
      
      // Propose plan automatically via MOI
      const p = await proposeIntelligencePlan(project);
      setPlan(p);
      setEditableHypothesis(p.hypothesis);
      setEditablePriority(p.priority);
      setEditableInvestigationType(p.investigationType);

      // Load sources catalog from IMFO
      const sources = await getAuthorizedSources();
      setAvailableSources(sources);

      // Auto-select all available sources by default (automatic global OSINT sweep)
      const authorizedKeys = sources.map(s => s.id || "").filter(Boolean);
      const finalSources = authorizedKeys.length > 0 ? authorizedKeys : Object.keys(SOURCE_PLATFORM_LABELS);
      setSelectedSources(finalSources);
    };

    loadPlanAndSources();
  }, [project]);

  // Execute OSINT sweep based on approved PRI
  const handleExecuteScan = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const scanData = await runUnifiedCifaScan(project, selectedSources, softContext || undefined);
      setResults(scanData);
      
      // Notify map of the new georreferenciations
      if (onUpdateMapResults && scanData.correlation?.graphData) {
        onUpdateMapResults(scanData.rawResults);
      }

      // Trigger the independent hypothesis confirmation popup
      if (scanData.correlation?.updatedHypothesis) {
        setCifaDataConfirm(scanData.correlation.updatedHypothesis);
      }
      
      // Switch to coverage tab automatically
      setActiveTab("coverage");
    } catch (err) {
      console.error("[CIFA Scan Error]:", err);
      setToast({ type: "error", message: "Ocurrió un error al ejecutar el barrido de inteligencia." });
    } finally {
      setLoading(false);
    }
  };

  const handleAppendHypothesis = async () => {
    if (!cifaDataConfirm) return;
    const text = `[HIPÓTESIS DE INTELIGENCIA FUSIÓN CIFA-CEIPOL v3.0]\nTipo de Investigación: ${editableInvestigationType}\nPrioridad: ${editablePriority}\n\n${cifaDataConfirm}\n\n* Origen y Trazabilidad: Correlacionado automáticamente de ${selectedSources.length} fuentes OSINT autorizadas.`;
    try {
      await registerSweep({
        engine: "Fusión CIFA-CEIPOL v3.0",
        source: "OSINT",
        type: "Directa",
        relevance: "Alto",
        data: text
      });
      setCifaDataConfirm(null);
      setToast({ type: "success", message: "✓ Hipótesis OSINT guardada correctamente en el expediente" });
    } catch (err: any) {
      setToast({ type: "error", message: "❌ Error al registrar el barrido: " + err.message });
    }
  };

  const getPriorityColor = (lvl: string) => {
    switch (lvl) {
      case "Crítico": return "text-red-400 bg-red-950/60 border-red-800/80";
      case "Alto": return "text-orange-400 bg-orange-950/60 border-orange-800/80";
      case "Medio": return "text-yellow-400 bg-yellow-950/60 border-yellow-800/80";
      default: return "text-emerald-400 bg-emerald-950/60 border-emerald-800/80";
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-800 mb-6 relative z-10">
        <CEIPOLSectionHeader
          icon="🛰️"
          title="Centro de Inteligencia de Fuentes Abiertas (CIFA-CEIPOL)"
          subtitle="Fusión operativa, orquestación de motores y análisis de correlación multifuente"
          className="border-none pb-0"
          actions={
            <CEIPOLBadge status="processing">Orquestador v3.0</CEIPOLBadge>
          }
        />

        {/* Tab Navigation */}
        <div className="flex flex-wrap bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
          <CEIPOLButton
            size="sm"
            variant={activeTab === "pri" ? "primary" : "secondary"}
            onClick={() => setActiveTab("pri")}
          >
            📋 Plan PRI
          </CEIPOLButton>
          <CEIPOLButton
            size="sm"
            variant={activeTab === "coverage" ? "primary" : "secondary"}
            onClick={() => {
              if (!results) { setToast({ type: "warning", message: "Debe ejecutar un barrido primero." }); return; }
              setActiveTab("coverage");
            }}
            disabled={!results}
          >
            📊 Cobertura
          </CEIPOLButton>
          <CEIPOLButton
            size="sm"
            variant={activeTab === "correlation" ? "primary" : "secondary"}
            onClick={() => {
              if (!results) { setToast({ type: "warning", message: "Debe ejecutar un barrido primero." }); return; }
              setActiveTab("correlation");
            }}
            disabled={!results}
          >
            🧠 Correlaciones
          </CEIPOLButton>
          <CEIPOLButton
            size="sm"
            variant={activeTab === "chronology" ? "primary" : "secondary"}
            onClick={() => {
              if (!results) { setToast({ type: "warning", message: "Debe ejecutar un barrido primero." }); return; }
              setActiveTab("chronology");
            }}
            disabled={!results}
          >
            ⏱️ Cronología
          </CEIPOLButton>
          <CEIPOLButton
            size="sm"
            variant={activeTab === "learning" ? "primary" : "secondary"}
            onClick={() => setActiveTab("learning")}
          >
            🤖 Aprendizaje
          </CEIPOLButton>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="relative z-10">

        {/* TAB 1: Plan de Recolección (PRI) */}
        {activeTab === "pri" && (
          <div className="space-y-6">
            {loading ? (
              <CEIPOLLoader message="Generando análisis CIFA-CEIPOL" />
            ) : !plan ? (
              <div className="text-center py-10 text-slate-500 text-sm animate-pulse">Generando plan operativo...</div>
            ) : (
              <>
                {/* Custom Soft Context query input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contexto soft de búsqueda (Parámetros/Detalles de interés):</label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Describa el contexto operacional, vehículos sospechosos, marcas de interés, alias u orientación de la investigación..."
                    value={softContext}
                    onChange={(e) => setSoftContext(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-cyan-500 placeholder-slate-600 resize-none font-sans"
                  />
                </div>

                {/* Execution Button */}
                <div className="flex justify-end gap-3 pt-2">
                  <CEIPOLButton
                    variant="primary"
                    loading={loading}
                    disabled={selectedSources.length === 0}
                    onClick={(e) => {
                      setClickCoords({ x: e.clientX, y: e.clientY });
                      void handleExecuteScan();
                    }}
                  >
                    Ejecutar Barrido Inteligente
                  </CEIPOLButton>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: Coverage Dashboard */}
        {activeTab === "coverage" && results && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CEIPOLCard variant="default" className="p-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tiempo de Ingesta</p>
                <p className="text-2xl font-black text-cyan-300 mt-1">{results.coveragePanel.totalProcessingTime}s</p>
              </CEIPOLCard>
              <CEIPOLCard variant="default" className="p-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Publicaciones</p>
                <p className="text-2xl font-black text-indigo-300 mt-1">{results.coveragePanel.publicationsAnalyzed}</p>
              </CEIPOLCard>
              <CEIPOLCard variant="default" className="p-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Documentos Drive</p>
                <p className="text-2xl font-black text-fuchsia-300 mt-1">{results.coveragePanel.documentsConsulted}</p>
              </CEIPOLCard>
              <CEIPOLCard variant="default" className="p-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hallazgos Clave</p>
                <p className="text-2xl font-black text-emerald-300 mt-1">{results.coveragePanel.findingsObtained}</p>
              </CEIPOLCard>
            </div>

            {/* Global Coverage Index Progress */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-wider">Índice Global de Cobertura OSINT:</span>
                <span className="text-lg font-black text-emerald-400">{results.coveragePanel.globalOsintCoverageIndex}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${results.coveragePanel.globalOsintCoverageIndex}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 text-[10px] text-slate-400 uppercase tracking-wider">
                <div>Cobertura de Plataforma: <span className="text-slate-200 font-bold">{results.coveragePanel.platformCoverage}%</span></div>
                <div>Cobertura Territorial Georreferenciada: <span className="text-slate-200 font-bold">{results.coveragePanel.territorialCoverage}%</span></div>
              </div>
            </div>

            {/* Sources consulted status list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Fuentes Consultadas y Estado Operativo</h4>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                {results.coveragePanel.sourcesConsulted.map((sKey: string) => (
                  <div key={sKey} className="flex justify-between items-center p-3 text-xs">
                    <span className="font-bold text-slate-200">{SOURCE_PLATFORM_LABELS[sKey] || sKey}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[9px] font-bold uppercase tracking-wider">
                      Consultado OK
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Correlations & Explicabilidad */}
        {activeTab === "correlation" && results && (
          <div className="space-y-6">

            {/* Revised Hypothesis Panel */}
            <CEIPOLCard variant="glass" className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Hipótesis Táctica Actualizada</h4>
                {onAppendToAnalysis && (
                  <CEIPOLButton
                    variant="primary"
                    size="sm"
                    onClick={handleAppendHypothesis}
                    className="py-1.5 text-[10px]"
                  >
                    ✏️ Anexar al Expediente
                  </CEIPOLButton>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                {results.correlation.updatedHypothesis}
              </p>
            </CEIPOLCard>

            {/* Correlated Entities List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Entidades Correlacionadas ({results.correlation.correlatedEntities.length})</h4>
              
              {results.correlation.correlatedEntities.length === 0 ? (
                <CEIPOLEmptyState
                  icon="🛰️"
                  title="Sin coincidencias OSINT"
                  description="No se identificaron coincidencias cruzadas entre las fuentes analizadas."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.correlation.correlatedEntities.map((ent: any) => (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntity(ent)}
                      className="bg-slate-900 border border-slate-800/60 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="px-2 py-0.5 text-[8px] font-extrabold bg-slate-950 text-slate-300 rounded border border-slate-800 uppercase tracking-wider">{ent.type}</span>
                          <p className="text-sm font-bold text-white mt-1.5 truncate">{ent.value}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ent.confidence > 80 ? "text-emerald-400 bg-emerald-950/60" : "text-amber-400 bg-amber-950/60"}`}>
                          {ent.confidence}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 line-clamp-1">{ent.reason}</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {ent.sources.map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 text-[8px] bg-slate-950 text-slate-500 rounded font-semibold">{s}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations Copilot */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-1">
                <span>🤖</span> Recomendaciones del Copiloto Investigativo
              </h4>
              <ul className="space-y-2 text-xs">
                {results.recommendations.map((rec: string, idx: number) => (
                  <li key={idx} className="flex gap-2 text-slate-300 items-start">
                    <span className="text-fuchsia-500">▶</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: Chronology */}
        {activeTab === "chronology" && results && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Línea de Tiempo Operativa Multifuente</h4>

            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-800">
              {results.correlation.chronology.map((item: any, idx: number) => (
                <div key={idx} className="relative pl-8 text-xs space-y-1">
                  <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border border-slate-950 ${
                    item.riskLevel === "Crítico" ? "bg-red-500" : item.riskLevel === "Alto" ? "bg-orange-500" : "bg-cyan-500"
                  }`} />
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">{new Date(item.date).toLocaleString("es-MX")}</span>
                    <span className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded text-[9px] font-bold border border-slate-800">{item.source}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Learning Engine */}
        {activeTab === "learning" && (
          <div className="space-y-6">
            <CEIPOLCard variant="analysis" className="p-5 space-y-4">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Índice de Utilidad y Rendimiento de Fuentes</h4>
              <p className="text-xs text-slate-400">
                El Motor de Aprendizaje registra automáticamente los tiempos de respuesta y la precisión de cada barrido para guiar futuras planificaciones.
              </p>

              <div className="divide-y divide-slate-800">
                {availableSources.map((src) => {
                  const utility = src.utilityIndex || 85;
                  const useCount = src.useCount || 0;
                  const avgTime = src.avgResponseTimeMs || 0;
                  return (
                    <div key={src.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-white">{src.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{src.platform} • {src.type}</p>
                      </div>
                      <div className="flex gap-6 text-[10px] uppercase tracking-wider text-slate-400">
                        <div>Usos: <span className="text-slate-200 font-bold">{useCount}</span></div>
                        <div>Latencia: <span className="text-slate-200 font-bold">{avgTime ? `${avgTime}ms` : "N/A"}</span></div>
                        <div className="flex items-center gap-1.5">
                          <span>Utilidad:</span>
                          <span className={`font-black ${utility > 80 ? "text-emerald-400" : "text-amber-400"}`}>{utility}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CEIPOLCard>
          </div>
        )}
      </div>

      {/* Explicabilidad Modal */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <CEIPOLButton
              variant="secondary"
              onClick={() => setSelectedEntity(null)}
              className="absolute top-3 right-3 rounded-full w-8 h-8 p-0 flex items-center justify-center"
            >
              ✕
            </CEIPOLButton>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 text-[8px] font-extrabold bg-slate-950 text-slate-300 rounded border border-slate-800 uppercase tracking-wider">{selectedEntity.type}</span>
              <h3 className="text-base font-bold text-white">{selectedEntity.value}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Razón de la Correlación (Explicabilidad):</p>
                <p className="text-xs text-slate-200 bg-slate-950 border border-slate-800/80 p-3 rounded-xl leading-relaxed">{selectedEntity.reason}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Historial de Menciones y Evidencias ({selectedEntity.occurrences.length}):</p>
                <div className="space-y-3">
                  {selectedEntity.occurrences.map((occ: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-cyan-400">{occ.source}</span>
                        <span className="text-slate-500 font-mono">{occ.date}</span>
                      </div>
                      <p className="text-slate-300 font-mono bg-slate-900/50 p-2 rounded text-[11px] leading-relaxed border border-slate-900">{occ.contextText}</p>
                      <p className="text-[9px] text-slate-500 italic">Detectado por: {occ.engine}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE HIPÓTESIS INVESTIGATIVA CIFA-CEIPOL */}
      <DynamicPopup
        open={!!cifaDataConfirm}
        anchorPosition={clickCoords}
        onClose={() => setCifaDataConfirm(null)}
        className="max-w-md w-full"
      >
        <h3 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-1.5 font-sans">
          🛰️ Confirmación de Hipótesis: CIFA-CEIPOL
        </h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed font-sans">
          Se ha realizado el barrido inteligente automático sobre todas las fuentes OSINT autorizadas disponibles. Revise la síntesis predictiva generada a partir de los parámetros tácticos analizados:
        </p>
        
        {softContext && (
          <div className="mb-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contexto Soft Analizado:</span>
            <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded text-xs text-slate-300 italic font-sans leading-relaxed">
              "{softContext}"
            </div>
          </div>
        )}

        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Síntesis de Hallazgos y Correlaciones:</span>
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs text-slate-200 leading-relaxed font-mono max-h-[160px] overflow-y-auto mb-4">
          {cifaDataConfirm}
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-4 border-t border-slate-850 pt-2 font-sans">
          <span>Fuentes: {selectedSources.length} OSINT</span>
          <span className="text-cyan-400 font-bold uppercase tracking-wider">CEIPOL FUSIÓN v3.0</span>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800 font-sans">
          <CEIPOLButton
            variant="secondary"
            onClick={() => setCifaDataConfirm(null)}
            className="px-4 py-2 text-xs font-semibold"
          >
            Cancelar
          </CEIPOLButton>
          <CEIPOLButton
            variant="primary"
            onClick={handleAppendHypothesis}
            className="px-4 py-2 text-xs font-bold shadow-md"
          >
            Confirmar y Persistir
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* TOAST DE GOBERNANZA CEIPOL */}
      {toast && (
        <CEIPOLToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
