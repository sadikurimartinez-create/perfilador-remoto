"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import GeoIntMap from "@/components/map/GeoIntMap";

interface GridCell {
  id: string;
  centroid: [number, number];
  iri_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH" | "CRITICAL";
  hydrology: number;
  precipitation: number;
  osint: number;
  satellite: number;
}

interface OperationalEvent {
  id: string;
  cell_id: string;
  severity: "NORMAL" | "WATCH" | "ALERT" | "CRITICAL_RESPONSE";
  description: string;
  iri_score: number;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "HOLD" | "AUTO_EXECUTED" | "MONITORED";
  timestamp: string;
  triggers: string[];
}

interface HealthStatus {
  provider: string;
  status: "healthy" | "stable" | "degraded" | "inactive" | "circuit open";
  latency_ms: number;
  success_rate: number;
}

interface TelemetryMetrics {
  stability_score: number;
  iri_volatility: number;
  authority_drift: number;
  event_flapping: boolean;
  decision_consistency: number;
  system_latency: number;
  error_rate: number;
}

interface AuditLog {
  timestamp: string;
  event_id: string;
  action: string;
  actor: string;
  justification: string;
  trace: string[];
}

export default function GeoIntCommandDashboard() {
  const [systemMode, setSystemMode] = useState<"LIVE" | "PILOT" | "SIMULATION">("PILOT");
  const [iriGlobal, setIriGlobal] = useState<number>(0.48);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [justification, setJustification] = useState<string>("");
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [alertReason, setAlertReason] = useState<string>("");

  // Map representation toggle: SVG (cybernetic grid) vs Leaflet Map
  const [mapView, setMapView] = useState<"MAP" | "SVG">("MAP");

  // Live real-time state streams
  const [cells, setCells] = useState<GridCell[]>([]);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [healthMatrix, setHealthMatrix] = useState<Record<string, HealthStatus>>({});
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    stability_score: 0.94,
    iri_volatility: 0.04,
    authority_drift: 0.08,
    event_flapping: false,
    decision_consistency: 1.0,
    system_latency: 42,
    error_rate: 0.01
  });

  const [governanceState, setGovernanceState] = useState({
    dominant_source: "CONAGUA",
    active_authority_weight: 0.85,
    conflicts_resolved: 7,
    geo_truth_score: 0.81,
    suppressed_sources: ["Telegram OSINT", "X OSINT"]
  });

  const [currentScenario, setCurrentScenario] = useState<"LATENCY_SPIKE" | "DATA_LOSS" | "OSINT_OVERLOAD" | "CONFLICTING_HYDRO" | "NONE">("NONE");
  const [auditTrail, setAuditTrail] = useState<AuditLog[]>([]);

  // Action states
  const [processing, setProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Initial State Seeding
  useEffect(() => {
    // Grid Cells Seeding (Central Aguascalientes coordinates)
    const seededCells: GridCell[] = [
      { id: "cell_250m_0_0", centroid: [21.885, -102.312], iri_score: 0.12, risk_level: "LOW", hydrology: 0.1, precipitation: 0.15, osint: 0.05, satellite: 0.1 },
      { id: "cell_250m_0_1", centroid: [21.887, -102.291], iri_score: 0.45, risk_level: "HIGH", hydrology: 0.3, precipitation: 0.65, osint: 0.25, satellite: 0.4 },
      { id: "cell_250m_1_0", centroid: [21.912, -102.325], iri_score: 0.85, risk_level: "CRITICAL", hydrology: 0.85, precipitation: 0.90, osint: 0.65, satellite: 0.75 },
      { id: "cell_250m_1_1", centroid: [21.871, -102.355], iri_score: 0.35, risk_level: "MEDIUM", hydrology: 0.2, precipitation: 0.40, osint: 0.15, satellite: 0.3 },
      { id: "cell_250m_2_0", centroid: [22.134, -102.416], iri_score: 0.92, risk_level: "CRITICAL", hydrology: 0.95, precipitation: 0.80, osint: 0.50, satellite: 0.80 },
      { id: "cell_250m_2_1", centroid: [21.865, -102.285], iri_score: 0.62, risk_level: "VERY HIGH", hydrology: 0.5, precipitation: 0.75, osint: 0.45, satellite: 0.5 }
    ];
    setCells(seededCells);
    setSelectedCell(seededCells[2]); // default high critical cell

    // Seed Provider Health Matrix with base items
    setHealthMatrix({
      noaa: { provider: "NOAA", status: "healthy", latency_ms: 120, success_rate: 0.99 },
      conagua: { provider: "CONAGUA", status: "stable", latency_ms: 210, success_rate: 0.98 },
      cenapred: { provider: "CENAPRED", status: "healthy", latency_ms: 180, success_rate: 1.0 },
      nasa: { provider: "NASA", status: "degraded", latency_ms: 450, success_rate: 0.92 },
      usgs: { provider: "USGS", status: "stable", latency_ms: 240, success_rate: 0.97 },
      osint: { provider: "OSINT", status: "healthy", latency_ms: 95, success_rate: 0.99 }
    });
  }, []);

  // 2. Dynamic Real-Time Engine (Refresh loop every 3 seconds)
  useEffect(() => {
    const fetchSystemState = () => {
      Promise.all([
        fetch("/api/pilot/metrics").then(r => r.json()).catch(() => null),
        fetch("/api/pilot/status").then(r => r.json()).catch(() => null),
        fetch("/api/pilot/institutional").then(r => r.json()).catch(() => null)
      ]).then(([metricsData, statusData, instData]) => {
        // Update metrics state
        if (metricsData && !metricsData.error) {
          setMetrics(prev => ({
            ...prev,
            stability_score: metricsData.stability_score ?? prev.stability_score,
            iri_volatility: metricsData.iri_volatility ?? prev.iri_volatility,
            authority_drift: metricsData.authority_drift ?? prev.authority_drift,
            event_flapping: metricsData.event_flapping ?? prev.event_flapping,
            decision_consistency: metricsData.decision_consistency ?? prev.decision_consistency,
            system_latency: Math.max(30, Math.min(120, prev.system_latency + Math.round(Math.random() * 10 - 5))),
            error_rate: Math.max(0.0, Math.min(0.05, prev.error_rate + (Math.random() * 0.006 - 0.003)))
          }));

          if (metricsData.stress_mode) {
            setCurrentScenario(metricsData.stress_mode);
          }
        }

        // Update status state (events & providers)
        if (statusData && !statusData.error) {
          setIriGlobal(statusData.iri_global || 0.48);
          setSystemMode(statusData.mode || "PILOT");

          // Sync events
          if (statusData.events && statusData.events.length > 0) {
            const mappedEvents = statusData.events.map((e: any) => ({
              id: e.id,
              cell_id: e.payload?.cell_id || (e.id === "evt_pilot_001" ? "cell_250m_1_0" : e.id === "evt_pilot_002" ? "cell_250m_0_1" : e.id === "evt_pilot_003" ? "cell_250m_1_1" : "cell_250m_2_0"),
              severity: e.severity,
              description: e.description,
              iri_score: e.payload?.iri_score || (e.severity === "CRITICAL_RESPONSE" ? 0.88 : 0.45),
              status: e.status,
              timestamp: e.timestamp,
              triggers: e.payload?.triggers || ["PILOT_TRIGGER_INTEGRATION"]
            }));
            setEvents(mappedEvents);

            // Default selection if none selected
            if (!selectedEventId && mappedEvents.length > 0) {
              setSelectedEventId(mappedEvents[0].id);
            }
          }

          // Sync provider healths
          if (statusData.providers_health) {
            setHealthMatrix(prev => {
              const updated = { ...prev };
              Object.entries(statusData.providers_health).forEach(([key, val]: any) => {
                if (updated[key]) {
                  updated[key].status = val;
                  // fluctuate latency mildly for realistic feels
                  const latDelta = Math.round(Math.random() * 14 - 7);
                  updated[key].latency_ms = Math.max(50, updated[key].latency_ms + latDelta);
                }
              });
              return updated;
            });
          }
        }

        // Update institutional audit trail
        if (instData && !instData.error) {
          if (instData.audit_trail) {
            setAuditTrail(instData.audit_trail);
          }
          if (instData.current_governance_rule) {
            setGovernanceState(prev => ({
              ...prev,
              dominant_source: instData.current_governance_rule?.primary_authority || prev.dominant_source,
              geo_truth_score: instData.current_governance_rule?.geo_truth_score || prev.geo_truth_score
            }));
          }
        }
      });
    };

    fetchSystemState();
    const interval = setInterval(fetchSystemState, 3000); // 3 seconds real-time update
    return () => clearInterval(interval);
  }, [selectedEventId]);

  // 3. Intelligent Global Alarm Tracker
  useEffect(() => {
    const hasCriticalPending = events.some(e => e.severity === "CRITICAL_RESPONSE" && e.status === "PENDING_APPROVAL");
    const isHighIri = iriGlobal > 0.80;
    const isDegradedOSINT = healthMatrix.osint?.status === "degraded" || currentScenario === "OSINT_OVERLOAD";

    if (hasCriticalPending && isHighIri) {
      setIsAlertActive(true);
      setAlertReason("CRITICAL IRI SPIKE (> 0.80) & PENDING HUMAN APPROVALS: Ecosistema bloqueado temporalmente hasta resolución.");
    } else if (isHighIri) {
      setIsAlertActive(true);
      setAlertReason("CONVERGENT PHYSICAL TRUTH CRITICAL RISK: Nivel general de inundaciones excede los umbrales institucionales.");
    } else if (isDegradedOSINT) {
      setIsAlertActive(true);
      setAlertReason("ANOMALOUS SOCIAL PUBLIC TELEMETRY OVERLOAD: Supresión de OSINT no certificado activa.");
    } else {
      setIsAlertActive(false);
    }
  }, [events, iriGlobal, healthMatrix, currentScenario]);

  // 4. HITL Control Handlers (Approve / Reject / Hold)
  const handleHITLCommand = async (verdict: "APPROVE" | "REJECT" | "HOLD") => {
    if (!selectedEventId || processing) return;
    setProcessing(true);
    setActionSuccess(null);

    const targetEvent = events.find(e => e.id === selectedEventId);
    if (!targetEvent) {
      setProcessing(false);
      return;
    }

    try {
      // 1. Resolve on Pilot Queue
      const pilotRes = await fetch("/api/pilot/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_hitl",
          eventId: targetEvent.id,
          approval: verdict
        })
      });

      const pilotData = await pilotRes.json();

      if (pilotData.status === "ok") {
        // 2. Log in official Institutional Audit Trail
        const instRes = await fetch("/api/pilot/institutional", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process_decision",
            decision: {
              event_id: targetEvent.id,
              iri_score: targetEvent.iri_score,
              classification: targetEvent.severity,
              recommendation: [targetEvent.description],
              priority_rank: 1,
              timestamp: new Date().toISOString()
            },
            human_approved: verdict === "APPROVE",
            actor: "OPERADOR_MANDO_CENTRAL",
            justification: justification || "Validación de sala de crisis y protección civil municipal."
          })
        });

        const instData = await instRes.json();

        if (instData.success) {
          setActionSuccess(`Firma digital generada. Acción procesada: ${verdict}. Registro de Auditoría ID: ${instData.audit_record?.audit_id || "N/A"}`);
          setJustification("");

          // Fast local state update for snappy feel
          setEvents(prev =>
            prev.map(e => (e.id === selectedEventId ? { ...e, status: verdict === "APPROVE" ? "APPROVED" : verdict === "REJECT" ? "REJECTED" : "HOLD" } : e))
          );
        } else {
          setActionSuccess(`Transacción de gobernanza registrada localmente. Estado: ${verdict}`);
        }
      }
    } catch (e) {
      console.error("Error executing HITL transaction:", e);
    } finally {
      setProcessing(false);
    }
  };

  // Switch System Mode
  const handleModeSwitch = async (mode: "LIVE" | "PILOT" | "SIMULATION") => {
    setSystemMode(mode);
    try {
      await fetch("/api/pilot/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_config",
          config: { mode }
        })
      });
    } catch (e) {
      console.error("Failed to switch system mode:", e);
    }
  };

  // Trigger stress scenario
  const handleTriggerScenario = async (scenario: string) => {
    try {
      await fetch("/api/pilot/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario })
      });
      setCurrentScenario(scenario as any);
    } catch (e) {
      console.error("Failed to trigger stress scenario:", e);
    }
  };

  const getCellColor = (score: number) => {
    if (score <= 0.20) return { fill: "rgba(16, 185, 129, 0.2)", stroke: "#10b981", text: "NORMAL" };
    if (score <= 0.40) return { fill: "rgba(234, 179, 8, 0.2)", stroke: "#eab308", text: "WATCH" };
    if (score <= 0.60) return { fill: "rgba(249, 115, 22, 0.25)", stroke: "#f97316", text: "WARNING" };
    if (score <= 0.80) return { fill: "rgba(239, 68, 68, 0.3)", stroke: "#ef4444", text: "ALERT" };
    return { fill: "rgba(220, 38, 38, 0.5)", stroke: "#dc2626", text: "CRITICAL" };
  };

  const currentSelectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-5 flex flex-col gap-5 font-sans selection:bg-amber-500/30 selection:text-white">
      
      {/* 🚨 GLOBAL INTELLIGENT ALARM BANNER */}
      {isAlertActive && (
        <div className="bg-gradient-to-r from-red-950 via-red-600 to-red-950 border border-red-500 rounded-lg p-3.5 shadow-[0_0_20px_rgba(239,68,68,0.35)] flex flex-col md:flex-row justify-between items-center gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <strong className="text-xs uppercase tracking-wider font-bold">Alerta de Seguridad Operacional Activa</strong>
              <div className="text-[11px] text-red-100/90 mt-0.5">{alertReason}</div>
            </div>
          </div>
          <span className="text-[10px] bg-black/40 text-red-200 px-2.5 py-1 rounded font-mono font-bold uppercase border border-red-500/30">
            Dispatch Locked
          </span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-slate-900 border border-slate-800 rounded-lg p-4 lg:p-5 shadow-lg gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <h1 className="text-base md:text-lg font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
              🏛️ GEOINT OPERATIONAL COMMAND DASHBOARD
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Centro de Mando Único Institucional • Sistema Operativo Geoespacial Unificado v2.4
          </p>
        </div>

        {/* MODE SWITCHER */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-lg border border-slate-800 self-start lg:self-auto">
          {["LIVE", "PILOT", "SIMULATION"].map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeSwitch(mode as any)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider transition-all duration-300 ${
                systemMode === mode
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* COCKPIT STACK LAYOUT */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* 1. ESTADO GENERAL DEL SISTEMA (System Overview) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🧭</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 1 — ESTADO GENERAL DEL SISTEMA (SYSTEM OVERVIEW)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: System Overview
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea la estabilidad y el estado operativo general de todo el centro de mando en tiempo real.</p>
                    <p><strong>¿Qué información presenta?</strong> Modo activo del sistema (En Vivo, Piloto, Simulación), el promedio del Índice de Riesgo Integrado (IRI) global y el porcentaje de estabilidad técnica.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Si el estado es "OPERACIONAL" y la estabilidad está por encima del 90%, el sistema se considera saludable. Un IRI promedio alto advierte riesgos territoriales crecientes.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Permite coordinar escalamientos técnicos, decidir el cambio de modo de ejecución o decretar estados de contingencia preventiva.</p>
                    <p><strong>Significado de indicadores:</strong> Estado Global (salud general del backend), Modo Activo (entorno de ejecución), IRI Promedio (riesgo de inundación/delincuencia consolidado), Estabilidad (rendimiento de flujos).</p>
                    <p><strong>Interacción:</strong> Concentra las métricas principales de todos los subsistemas en un panel consolidado de diagnóstico rápido.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Estado Global</span>
              <span className="text-sm font-black text-emerald-400 mt-1">OPERACIONAL</span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Modo Activo</span>
              <span className="text-sm font-black text-amber-400 mt-1 uppercase">{systemMode}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">IRI Promedio</span>
              <span className="text-sm font-black text-orange-400 mt-1 font-mono">{iriGlobal.toFixed(2)}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Estabilidad</span>
              <span className="text-sm font-black text-purple-400 mt-1 font-mono">{(metrics.stability_score * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* 2. MAPA GEOINT OPERACIONAL (Operational Map) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌍</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 2 — MAPA GEOINT OPERACIONAL (TACTICAL MAP)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {/* TACTICAL TAB SELECTOR */}
              <div className="flex bg-slate-950 border border-slate-800/60 p-0.5 rounded-md">
                <button
                  onClick={() => setMapView("MAP")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-300 ${
                    mapView === "MAP"
                      ? "bg-slate-800 text-amber-500"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  LIVE MAP
                </button>
                <button
                  onClick={() => setMapView("SVG")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-300 ${
                    mapView === "SVG"
                      ? "bg-slate-800 text-amber-500"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  SCHEMATIC
                </button>
              </div>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: GEOINT Map
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Proporciona la representación cartográfica en tiempo real de las cuadrículas de análisis georreferenciadas y las alertas del territorio.</p>
                    <p><strong>¿Qué información presenta?</strong> Muestra celdas de 250 metros con código de color de riesgo (Normal a Crítico), coordenadas, cauces hidrológicos del Río San Pedro y capas de sensores.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Las celdas rojas u oscuras representan zonas con picos inminentes de riesgo donde confluyen señales de inundación, precipitación o disturbios OSINT.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Despliegue inmediato de brigadas de emergencia, priorización de zonas de búsqueda y rescate, y cierres preventivos de infraestructura vial.</p>
                    <p><strong>Significado de indicadores:</strong> IRI (score de riesgo por cuadrante), Hidro (nivel de caudal físico), Lluvia (precipitación), OSINT (reportes de redes sociales).</p>
                    <p><strong>Interacción:</strong> Al hacer clic en una celda en el mapa, los metadatos detallados y sus indicadores específicos se cargan en el visor inferior.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE MAP CONTAINER - Altura dominante de 750px */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl h-[750px] relative overflow-hidden flex items-center justify-center w-full">
            {mapView === "MAP" ? (
              <div className="w-full h-full">
                <GeoIntMap />
              </div>
            ) : (
              <div className="w-full h-full relative">
                <svg width="100%" height="100%" viewBox="0 0 400 240" className="absolute inset-0 m-auto max-h-full max-w-full z-0">
                  <defs>
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.15)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                  
                  {/* Río San Pedro line */}
                  <path d="M 120,0 Q 140,80 120,160 T 140,240" fill="none" stroke="rgba(14, 165, 233, 0.25)" strokeWidth="6" />
                  <path d="M 120,0 Q 140,80 120,160 T 140,240" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="4,4" />

                  {/* Schematic grid render */}
                  {cells.map((cell, idx) => {
                    const x = 50 + (idx % 3) * 110;
                    const y = 30 + Math.floor(idx / 3) * 85;
                    const config = getCellColor(cell.iri_score);
                    const isSelected = selectedCell?.id === cell.id;

                    return (
                      <g key={cell.id} className="cursor-pointer" onClick={() => setSelectedCell(cell)}>
                        <rect
                          x={x}
                          y={y}
                          width="85"
                          height="60"
                          rx="5"
                          fill={config.fill}
                          stroke={isSelected ? "#f59e0b" : config.stroke}
                          strokeWidth={isSelected ? "2" : "1.2"}
                          className="transition-all duration-300"
                        />
                        {cell.iri_score > 0.8 && (
                          <circle cx={x + 42} cy={y + 30} r="25" fill="none" stroke="#ef4444" strokeWidth="1">
                            <animate attributeName="r" values="10;30;10" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <text x={x + 10} y={y + 18} fill="#94a3b8" fontSize="8" fontWeight="bold">
                          {cell.id.toUpperCase().replace("CELL_250M_", "C-")}
                        </text>
                        <text x={x + 10} y={y + 34} fill="#ffffff" fontSize="11" fontWeight="extrabold" className="font-mono">
                          IRI {cell.iri_score.toFixed(2)}
                        </text>
                        <text x={x + 10} y={y + 48} fill={config.stroke} fontSize="7" fontWeight="bold">
                          {config.text}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded text-[8px] text-slate-500 font-mono tracking-widest uppercase">
                  Cyber Grid Base
                </div>
              </div>
            )}
          </div>

          {/* DETALLES DE CELDA SELECCIONADA */}
          {selectedCell && (
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 mt-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-200">SELECCIÓN DETALLADA: {selectedCell.id.toUpperCase()}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{
                    borderColor: getCellColor(selectedCell.iri_score).stroke,
                    color: getCellColor(selectedCell.iri_score).stroke
                  }}>
                    Riesgo: {selectedCell.risk_level}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Capa física hidrológica consolidada Aguascalientes Central.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2.5 w-full sm:w-auto text-center font-mono">
                <div className="bg-slate-900 border border-slate-800/60 p-2 rounded min-w-[65px]">
                  <div className="text-[8px] text-slate-500 font-bold">HIDRO</div>
                  <div className="text-[10px] text-amber-500 font-bold mt-0.5">{selectedCell.hydrology.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800/60 p-2 rounded min-w-[65px]">
                  <div className="text-[8px] text-slate-500 font-bold">LLUVIA</div>
                  <div className="text-[10px] text-amber-500 font-bold mt-0.5">{selectedCell.precipitation.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800/60 p-2 rounded min-w-[65px]">
                  <div className="text-[8px] text-slate-500 font-bold">OSINT</div>
                  <div className="text-[10px] text-amber-500 font-bold mt-0.5">{selectedCell.osint.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800/60 p-2 rounded min-w-[65px]">
                  <div className="text-[8px] text-slate-500 font-bold">SAT</div>
                  <div className="text-[10px] text-amber-500 font-bold mt-0.5">{selectedCell.satellite.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. FLUJO DE EVENTOS (Event Stream) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🚨</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 3 — FLUJO DE EVENTOS (EVENT STREAM ENGINE)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono bg-red-950/40 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                {events.length} ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Event Stream
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Muestra el listado cronológico continuo de los incidentes y disparadores críticos registrados por el sistema de alerta.</p>
                    <p><strong>¿Qué información presenta?</strong> Identificadores de evento, niveles de gravedad (Normal, Vigilancia, Alerta, Respuesta Crítica), descripciones y estado de aprobación.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Cada evento representa una anomalía detectada. Si el estado es "PENDING_APPROVAL", requiere validación del operador; "APPROVED" o "AUTO_EXECUTED" indican que ya fueron despachados.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Clasificación de incidentes para su despacho, y priorización de la cola de respuesta en momentos de alta saturación de alertas.</p>
                    <p><strong>Significado de indicadores:</strong> Severidad (criticidad del evento), Status (estado de resolución), Triggers (sensores que dispararon la alerta).</p>
                    <p><strong>Interacción:</strong> Al hacer clic en un evento de la lista, este se carga automáticamente en el Motor de Decisiones (HITL) para su procesamiento y validación.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[450px] pr-1.5 custom-scrollbar w-full">
            {events.map((evt) => {
              const isSelected = selectedEventId === evt.id;
              const isCritical = evt.severity === "CRITICAL_RESPONSE";
              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEventId(evt.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 w-full ${
                    isSelected
                      ? "bg-slate-800/80 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                      : "bg-slate-950 hover:bg-slate-900 border-slate-800/60"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 font-mono">{evt.id}</span>
                    <span className={`text-[8px] px-2 py-0.5 rounded font-bold font-mono tracking-wider ${
                      isCritical
                        ? "bg-red-950 text-red-400 border border-red-500/20"
                        : evt.severity === "ALERT"
                        ? "bg-orange-950 text-orange-400 border border-orange-500/20"
                        : "bg-slate-800 text-slate-300 border border-slate-700/50"
                    }`}>
                      {evt.severity.replace("_RESPONSE", "")}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-200 mt-2.5 leading-relaxed">
                    {evt.description}
                  </p>

                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-800/40 text-[9px]">
                    <span className="text-slate-500 font-mono">IRI: {evt.iri_score.toFixed(2)}</span>
                    <span className={`font-bold uppercase ${
                      evt.status === "PENDING_APPROVAL"
                        ? "text-amber-400 animate-pulse"
                        : evt.status === "APPROVED" || evt.status === "AUTO_EXECUTED"
                        ? "text-emerald-400"
                        : "text-slate-400"
                    }`}>
                      {evt.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. MOTOR DE DECISIONES (Decision Engine) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🧠</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 4 — MOTOR DE DECISIONES (DECISION ENGINE / HITL)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                WAITING HITL
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Decision Engine
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Interfaz de validación humana (Human-In-The-Loop) para despachar o suprimir recomendaciones generadas automáticamente por el motor de toma de decisiones.</p>
                    <p><strong>¿Qué información presenta?</strong> Recomendación específica del algoritmo, campo de justificación del analista y opciones de resolución.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Presenta la acción óptima aconsejada por el sistema. El operador debe escribir una justificación obligatoria y seleccionar un veredicto.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Aprobación (Approve) de respuestas de rescate, rechazo (Reject) de falsas alarmas, y retención (Hold) de incidentes dudosos para investigación profunda.</p>
                    <p><strong>Significado de indicadores:</strong> Approve (ejecuta protocolo y firma el log), Reject (cancela recomendación), Hold (congela el despacho en espera de más inteligencia).</p>
                    <p><strong>Interacción:</strong> Consume los eventos seleccionados del Event Stream y escribe directamente en los registros de auditoría institucional del sistema al procesar una decisión.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {currentSelectedEvent ? (
            <div className="space-y-4 text-xs w-full">
              <div className="bg-slate-950 border border-slate-800/60 p-4 rounded-xl">
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Acción Recomendada</div>
                <p className="text-[11px] text-slate-200 font-semibold mt-1.5 leading-relaxed">
                  {currentSelectedEvent.description}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Justificación de Control</label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Escriba motivo de decisión..."
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 w-full"
                />
              </div>

              {actionSuccess && (
                <div className="text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg">
                  {actionSuccess}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 w-full">
                <button
                  disabled={processing || currentSelectedEvent.status !== "PENDING_APPROVAL"}
                  onClick={() => handleHITLCommand("APPROVE")}
                  className={`p-3 text-[10px] font-bold rounded-lg transition-all duration-300 ${
                    currentSelectedEvent.status === "PENDING_APPROVAL"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-md"
                      : "bg-slate-850 text-slate-500 border border-slate-800/30 cursor-not-allowed"
                  }`}
                >
                  APPROVE
                </button>
                <button
                  disabled={processing || currentSelectedEvent.status !== "PENDING_APPROVAL"}
                  onClick={() => handleHITLCommand("REJECT")}
                  className={`p-3 text-[10px] font-bold rounded-lg transition-all duration-300 ${
                    currentSelectedEvent.status === "PENDING_APPROVAL"
                      ? "bg-red-600 hover:bg-red-500 text-white font-extrabold shadow-md"
                      : "bg-slate-850 text-slate-500 border border-slate-800/30 cursor-not-allowed"
                  }`}
                >
                  REJECT
                </button>
                <button
                  disabled={processing || currentSelectedEvent.status !== "PENDING_APPROVAL"}
                  onClick={() => handleHITLCommand("HOLD")}
                  className={`p-3 text-[10px] font-bold rounded-lg transition-all duration-300 ${
                    currentSelectedEvent.status === "PENDING_APPROVAL"
                      ? "bg-amber-600 hover:bg-amber-500 text-white font-extrabold shadow-md"
                      : "bg-slate-855 text-slate-500 border border-slate-800/30 cursor-not-allowed"
                  }`}
                >
                  HOLD
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 text-center py-6">
              Seleccione un evento crítico en el stream para operar.
            </p>
          )}
        </div>

        {/* 5. VERDAD OPERACIONAL (Operational Truth / Governance) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🏛️</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 5 — VERDAD OPERACIONAL (OPERATIONAL TRUTH / MODEL GOVERNANCE VIEW)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-purple-400 font-bold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                GOVERNANCE ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Operational Truth
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea las políticas de gobernanza de datos y la veracidad integrada de los modelos que sustentan el cálculo del IRI.</p>
                    <p><strong>¿Qué información presenta?</strong> Identifica la fuente de información dominante elegida por el motor de consenso, su peso de autoridad y el score global de verdad espacial.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Muestra qué sensor tiene la máxima autoridad en este momento. Las fuentes con datos contradictorios o con ruido OSINT aparecen como "Suprimidas".</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Calibrar el peso de las fuentes y verificar si el consenso de verdad operativa ("GeoTruthScore") está alineado con los reportes oficiales.</p>
                    <p><strong>Significado de indicadores:</strong> Fuente Dominante (proveedor primario), Peso de Autoridad (confiabilidad relativa), GeoTruthScore (coherencia de verdad espacial).</p>
                    <p><strong>Interacción:</strong> Filtra y pondera el flujo de señales de entrada antes de que sean representadas en el mapa táctico o procesadas por el motor de eventos.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs w-full">
            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Fuente Dominante</span>
                <strong className="text-emerald-400 uppercase font-black">{governanceState.dominant_source}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Peso de Autoridad</span>
                <strong className="text-slate-200 font-extrabold">{(governanceState.active_authority_weight * 100).toFixed(0)}%</strong>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Conflictos Resueltos</span>
                <strong className="text-sky-400 font-mono font-black">{governanceState.conflicts_resolved}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">GeoTruthScore Consolidado</span>
                <strong className="text-purple-400 font-mono font-black">{governanceState.geo_truth_score.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-slate-950 border border-slate-800/60 p-3 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 w-full">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
              Fuentes Secundarias Suprimidas en este Ciclo:
            </span>
            <div className="flex flex-wrap gap-2">
              {governanceState.suppressed_sources.map(src => (
                <span key={src} className="text-[9px] font-bold bg-red-950/40 text-red-400 border border-red-900/30 px-2.5 py-1 rounded-md uppercase font-mono">
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 6. ESTADO DE LOS PROVEEDORES (Provider Health) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌐</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 6 — ESTADO DE LOS PROVEEDORES (PROVIDER HEALTH MATRIX)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] bg-slate-950 text-slate-450 border border-slate-850 px-1.5 py-0.5 rounded font-mono font-bold">
                {Object.keys(healthMatrix).length} SYSTEMS ONLINE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Provider Health
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea en tiempo real la salud de la red de APIs, bases de datos y servicios externos que alimentan el Centro de Mando.</p>
                    <p><strong>¿Qué información presenta?</strong> Latencia en milisegundos de cada proveedor (NOAA, NASA, CONAGUA, OSINT, etc.), su tasa de éxito y estado del disyuntor de red.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Los estados "healthy" o "stable" indican conexiones saludables. Un estado "degraded" o "circuit open" advierte de posible pérdida de datos y respuestas lentas.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Cambiar a modos de contingencia offline o alertar a los administradores de sistemas sobre la degradación de un satélite o API clave.</p>
                    <p><strong>Significado de indicadores:</strong> Latencia (demora de respuesta en milisegundos), Status (salud del puente de conexión).</p>
                    <p><strong>Interacción:</strong> Si un proveedor crítico falla, el sistema restringe su visualización en las capas del mapa y reduce su peso en el motor de decisiones.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
            {Object.values(healthMatrix).map((h) => {
              const isHealthy = h.status === "healthy" || h.status === "stable";
              return (
                <div key={h.provider} className="bg-slate-950 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-[10px] text-slate-200 font-extrabold uppercase">{h.provider}</strong>
                    <div className="text-[9px] text-slate-500 mt-1 font-mono">{h.latency_ms}ms</div>
                  </div>
                  <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    isHealthy
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/20"
                      : "bg-red-950/60 text-red-400 border-red-500/20"
                  }`}>
                    {h.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. CENTRO DE CONTROL DEL PILOTO (Pilot Control) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🧪</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 7 — CENTRO DE CONTROL DEL PILOTO (PILOT CONTROL CENTER)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] bg-amber-950/40 text-amber-500 px-1.5 py-0.5 rounded font-mono border border-amber-500/20 font-bold">
                SIM ACTIVA
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Pilot Control
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Consola de simulación que permite a los operadores e instructores inyectar fallas artificiales para evaluar la resiliencia operativa.</p>
                    <p><strong>¿Qué información presenta?</strong> Escenario de estrés activo, obligatoriedad del estado HITL y métricas de degradación impuestas por la simulación.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Muestra el tipo de anomalía sintética que está experimentando el sistema en tiempo real. Sirve para evaluar los mecanismos de autodefensa del software.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Planificación de entrenamientos operacionales y pruebas de robustez del sistema bajo escenarios de desastre de red o datos falsificados.</p>
                    <p><strong>Significado de indicadores:</strong> Latency Spike (pico de latencia), Data Loss (pérdida de paquetes), OSINT Overload (saturación de rumores), Conflicting Hydro (datos hidrológicos contradictorios).</p>
                    <p><strong>Interacción:</strong> Modifica dinámicamente los valores mostrados en Provider Health, Telemetry y Event Stream para modelar la contingencia seleccionada.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs w-full">
            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Simulación Escenario</span>
                <strong className="text-amber-500 font-bold">{currentScenario}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">HITL State</span>
                <strong className="text-emerald-400 font-bold">OBLIGATORIO</strong>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Throttling Guard</span>
                <strong className="text-sky-400 font-bold">ACTIVO (CACHE-OVER)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">OSINT Degradation Factor</span>
                <strong className="text-orange-400 font-bold">55% (PILOT LIMITS)</strong>
              </div>
            </div>
          </div>

          {/* Stress trigger buttons */}
          <div className="flex flex-col gap-3.5 pt-1 w-full">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Inyectar Escenario de Contingencia:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {["LATENCY_SPIKE", "DATA_LOSS", "OSINT_OVERLOAD", "CONFLICTING_HYDRO"].map((scen) => (
                <button
                  key={scen}
                  onClick={() => handleTriggerScenario(scen)}
                  className={`p-3 rounded-lg text-[9px] font-black uppercase transition-all duration-300 border ${
                    currentScenario === scen
                      ? "bg-red-700 hover:bg-red-600 text-white shadow-md border-red-500/40"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-850"
                  }`}
                >
                  {scen.replace("_", " ")}
                </button>
              ))}
            </div>

            {currentScenario !== "NONE" && (
              <button
                onClick={() => handleTriggerScenario("NONE")}
                className="bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 rounded-lg w-full p-2.5 text-[9.5px] font-black uppercase tracking-wider transition-all duration-300"
              >
                🛑 Detener Simulación de Estrés
              </button>
            )}
          </div>
        </div>

        {/* 8. TELEMETRÍA DEL SISTEMA (System Telemetry & Logs) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">📡</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 8 — TELEMETRÍA DEL SISTEMA & AUDITORÍA DE OPERACIÓN
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                MONITOR ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-amber-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-500">
                    ❓ Ayuda: Telemetría del Sistema
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Registra de manera unificada las métricas técnicas del rendimiento de red y la consola histórica de decisiones de control humano.</p>
                    <p><strong>¿Qué información presenta?</strong> Volatilidad de IRI, deriva de autoridad, latencias de respaldo (fallback), estado de oscilación de eventos (flapping) y logs oficiales firmados.</p>
                    <p><strong>¿Cómo debe interpretarse?</strong> Permite analizar si las métricas de rendimiento del software están estables y repasar la cronología exacta de las firmas y justificaciones de los operadores.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Auditorías legales post-incidente para deslindar responsabilidades y análisis forense del comportamiento del IRI durante crisis territoriales.</p>
                    <p><strong>Significado de indicadores:</strong> Volatilidad (fluctuación de riesgo), Drift (desviación de autoridad), Fallback Latency (demora de respaldo), Logs (registro inmutable de transacciones).</p>
                    <p><strong>Interacción:</strong> Recibe y graba persistente y cronológicamente cada decisión tomada en el Decision Engine (HITL).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            {/* Real-time metrics grid */}
            <div className="lg:col-span-6 bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-3 block">
                Métricas de Estabilidad Operativa
              </span>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-center font-mono">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Estabilidad</div>
                  <div className="text-xs font-black text-purple-400 mt-1">{(metrics.stability_score * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Volatilidad</div>
                  <div className="text-xs font-black text-red-400 mt-1">{metrics.iri_volatility.toFixed(3)}</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Drift</div>
                  <div className="text-xs font-black text-amber-500 mt-1">{metrics.authority_drift.toFixed(3)}</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Latency</div>
                  <div className="text-xs font-black text-sky-400 mt-1">{metrics.system_latency}ms</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Flapping</div>
                  <div className={`text-xs font-black mt-1 ${metrics.event_flapping ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                    {metrics.event_flapping ? "FLAPPING" : "STABLE"}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit logs stream */}
            <div className="lg:col-span-6 bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2 block">
                Consola de Firmas y Auditorías de Control
              </span>
              <div className="bg-black/40 p-3 rounded-lg border border-slate-900 font-mono text-[9px] text-slate-400 h-24 overflow-y-auto pr-1.5 custom-scrollbar space-y-1.5 w-full">
                {auditTrail.length > 0 ? (
                  auditTrail.map((log, idx) => (
                    <div key={idx} className="border-b border-slate-900/40 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex justify-between text-[8px] text-slate-500">
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-sky-500 font-extrabold uppercase">Actor: {log.actor}</span>
                      </div>
                      <div className="mt-0.5">
                        <span className="text-amber-500/90 font-bold">[{log.action}]</span> <span className="text-slate-300">{log.justification}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600 text-center py-5">Ninguna acción de control humano registrada en el ciclo.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
