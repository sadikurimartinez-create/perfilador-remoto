import React, { useState, useEffect } from "react";

// Structure definition matches our backend models
interface CommandOperation {
  operation_id: string;
  decision_id: string;
  action_id: string;
  state: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "CANCELLED";
  approver?: string;
  timestamp: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata: {
    event_id: string;
    classification: string;
    ops_score: number;
    target_authority: string;
    action_type: string;
    payload: any;
    automatic_dispatch?: boolean;
    notes?: string;
    description?: string;
    rejection_reason?: string;
    execution_mode?: string;
    execution_details?: string;
  };
}

interface SystemHealth {
  state: "OPERATIONAL" | "DEGRADED" | "ALERT" | "EMERGENCY";
  active_events_count: number;
  pending_approvals_count: number;
  provider_latency_ms: number;
  stream_status: "CONNECTED" | "DISCONNECTED" | "BUFFERING";
  timestamp: string;
}

export default function GeoCommandDashboard() {
  // Mock UI operations matching the orchestrator pre-populated data
  const [operations, setOperations] = useState<CommandOperation[]>([
    {
      operation_id: "OP-001",
      decision_id: "DEC-001",
      action_id: "ACT-EVT-MOCK-001-ALERT-001",
      state: "PENDING_APPROVAL",
      timestamp: new Date().toISOString(),
      risk_level: "CRITICAL",
      metadata: {
        event_id: "EVT-MOCK-001",
        classification: "CRITICAL_RESPONSE",
        ops_score: 0.85,
        target_authority: "CIVIL_PROTECTION",
        action_type: "ALERT_INSTITUTIONAL",
        payload: {
          alert_header: "🚨 ALERTA ROJA - EVACUACIÓN GEOINT",
          urgency: "IMMEDIATE",
          instructions: [
            "INICIAR EVACUACIÓN INMEDIATA de sectores habitacionales bajos expuestos",
            "Desplegar brigadas de rescate acuático y personal de primera respuesta"
          ]
        },
        notes: "Requires mandatory Human-in-the-Loop (HITL) approval prior to execution simulation."
      }
    },
    {
      operation_id: "OP-002",
      decision_id: "DEC-002",
      action_id: "ACT-EVT-MOCK-002-RES-002",
      state: "PENDING_APPROVAL",
      timestamp: new Date().toISOString(),
      risk_level: "HIGH",
      metadata: {
        event_id: "EVT-MOCK-002",
        classification: "RESPOND",
        ops_score: 0.55,
        target_authority: "STATE_AUTHORITY",
        action_type: "ALERT_INSTITUTIONAL",
        payload: {
          alert_header: "⚠️ BOLETÍN DE EMERGENCIA ESTATAL",
          urgency: "HIGH",
          recommendations: [
            "Habilitar refugios temporales y emitir boletines de emergencia civil",
            "Establecer perímetros de desvío vial y cerrar accesos a pasos subterráneos"
          ]
        },
        notes: "Requires validation (configured as high risk respond approval)."
      }
    },
    {
      operation_id: "OP-003",
      decision_id: "DEC-003",
      action_id: "ACT-EVT-MOCK-003-PREV-003",
      state: "EXECUTED",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      risk_level: "MEDIUM",
      metadata: {
        event_id: "EVT-MOCK-003",
        classification: "PREVENT",
        ops_score: 0.38,
        target_authority: "MUNICIPAL_AUTHORITY",
        action_type: "ALERT_INSTITUTIONAL",
        automatic_dispatch: true,
        payload: {
          alert_header: "📡 ORDEN DE PREVENCIÓN MUNICIPAL",
          urgency: "MEDIUM",
          clearing_instructions: ["Desplegar cuadrillas de desazolve de alcantarillado"]
        },
        execution_mode: "DRY_RUN",
        execution_details: "Dry-run execution simulated successfully for MUNICIPAL_AUTHORITY."
      }
    }
  ]);

  const [selectedOpId, setSelectedOpId] = useState<string>("OP-001");
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    state: "EMERGENCY", // Starts in emergency since OP-001 is CRITICAL PENDING
    active_events_count: 3,
    pending_approvals_count: 2,
    provider_latency_ms: 42,
    stream_status: "CONNECTED",
    timestamp: new Date().toISOString()
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([
    {
      timestamp: new Date(Date.now() - 300000).toISOString(),
      operation_id: "OP-003",
      action_id: "ACT-EVT-MOCK-003-PREV-003",
      event: "AUTOMATIC_DISPATCH",
      details: "Automatic dispatch completed. Action dry-run simulated for MUNICIPAL_AUTHORITY.",
      status: "SUCCESS"
    }
  ]);

  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Sync health metrics dynamically
  useEffect(() => {
    const pending = operations.filter(o => o.state === "PENDING_APPROVAL");
    const hasCritical = pending.some(o => o.risk_level === "CRITICAL");
    const hasHigh = pending.some(o => o.risk_level === "HIGH");

    let currentState: SystemHealth["state"] = "OPERATIONAL";
    if (hasCritical) {
      currentState = "EMERGENCY";
    } else if (hasHigh) {
      currentState = "ALERT";
    }

    setSystemHealth(prev => ({
      ...prev,
      state: currentState,
      pending_approvals_count: pending.length,
      timestamp: new Date().toISOString()
    }));
  }, [operations]);

  // Handles click on APPROVE, REJECT, or HOLD
  const handleHITLAction = async (verdict: "APPROVE" | "REJECT" | "HOLD") => {
    if (processing) return;
    setProcessing(true);

    const targetOp = operations.find(o => o.operation_id === selectedOpId);
    if (!targetOp) {
      setProcessing(false);
      return;
    }

    if (verdict === "HOLD") {
      setSelectedHoldId(selectedOpId);
      setProcessing(false);
      return;
    }

    try {
      // Simulate endpoint POST response
      const isApproved = verdict === "APPROVE";
      const mode = "dry_run"; // Security compliance default

      const responseState = isApproved ? "EXECUTED" : "REJECTED";
      const timestampStr = new Date().toISOString();

      // Simulate a small network delay of 400ms for premium UX feels
      await new Promise(resolve => setTimeout(resolve, 400));

      // Update operations state
      setOperations(prev =>
        prev.map(o => {
          if (o.operation_id === selectedOpId) {
            return {
              ...o,
              state: responseState,
              approver: "OPERATOR-INT-UI",
              timestamp: timestampStr,
              metadata: {
                ...o.metadata,
                execution_mode: "DRY_RUN",
                execution_details: isApproved
                  ? `Dry-run execution simulated successfully for ${o.metadata.target_authority}.`
                  : undefined,
                rejection_reason: !isApproved ? "Operator human-in-the-loop manual override rejection." : undefined
              }
            };
          }
          return o;
        })
      );

      // Add audit log
      const newAudit = {
        timestamp: timestampStr,
        operation_id: selectedOpId,
        action_id: targetOp.action_id,
        event: isApproved ? "MANUAL_APPROVAL" : "MANUAL_REJECTION",
        details: isApproved
          ? `Operator manual approval. Dry-run simulation dispatched for ${targetOp.metadata.target_authority}.`
          : `Operator manual override rejection. Action execution withheld.`,
        status: "SUCCESS"
      };

      setAuditLogs(prev => [newAudit, ...prev]);

      // Calculate feedback telemetry if approved
      if (isApproved) {
        const ops = targetOp.metadata.ops_score;
        const groundTruth = Math.min(1.0, Math.max(0.0, ops + (Math.random() * 0.08 - 0.04)));
        const variance = groundTruth - ops;
        const precision = (1 - Math.abs(variance)) * 100;
        
        let suggestions = "OPS parameters are optimal for this cell layout.";
        if (Math.abs(variance) > 0.02) {
          suggestions = variance > 0
            ? "⚠️ UNDERESTIMATION: Suggest increasing PopulationImpact weight from 0.30 to 0.33 to compensate for density."
            : "🔍 OVERESTIMATION: Suggest reducing AccessibilityRisk weight from 0.10 to 0.08.";
        }

        setFeedbackData({
          operation_id: selectedOpId,
          ops_estimated_score: ops,
          simulated_ground_truth_iri: Number(groundTruth.toFixed(3)),
          variance: Number(variance.toFixed(4)),
          precision: Number(precision.toFixed(2)),
          tuning_advice: suggestions
        });
      } else {
        setFeedbackData(null);
      }

      // Remove hold if it was held
      if (selectedHoldId === selectedOpId) {
        setSelectedHoldId(null);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const selectedOp = operations.find(o => o.operation_id === selectedOpId);

  // Status badges colors helper
  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL": return { bg: "#4a0e17", text: "#ff6b8b", border: "#7c1c2b" };
      case "HIGH": return { bg: "#4a320e", text: "#ffd166", border: "#7c551c" };
      case "MEDIUM": return { bg: "#0e4a29", text: "#06d6a0", border: "#1c7c4c" };
      default: return { bg: "#1e293b", text: "#94a3b8", border: "#334155" };
    }
  };

  const getSystemStateColor = (state: string) => {
    switch (state) {
      case "EMERGENCY": return "#ef4444";
      case "ALERT": return "#f59e0b";
      case "DEGRADED": return "#3b82f6";
      default: return "#10b981";
    }
  };

  return (
    <div style={{
      backgroundColor: "#0b0f19",
      color: "#f8fafc",
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      {/* Header Panel */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #1e293b",
        paddingBottom: "16px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: getSystemStateColor(systemHealth.state),
              display: "inline-block",
              boxShadow: `0 0 10px ${getSystemStateColor(systemHealth.state)}`
            }} />
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.5px" }}>
              SISTEMA DE COMANDO GEOINT
            </h1>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Centro de Control Operativo e Integración de Decisiones Institucionales (HITL)
          </p>
        </div>

        {/* System State Panel */}
        <div style={{
          display: "flex",
          gap: "16px",
          backgroundColor: "#111827",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "1px solid #1f2937"
        }}>
          <div style={{ textAlign: "center", borderRight: "1px solid #1f2937", paddingRight: "16px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>ESTADO GLOBAL</div>
            <div style={{
              fontSize: "14px",
              fontWeight: 700,
              color: getSystemStateColor(systemHealth.state),
              marginTop: "4px"
            }}>
              {systemHealth.state}
            </div>
          </div>
          <div style={{ textAlign: "center", borderRight: "1px solid #1f2937", paddingRight: "16px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>APROBACIONES</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffd166", marginTop: "4px" }}>
              {systemHealth.pending_approvals_count} PENDIENTES
            </div>
          </div>
          <div style={{ textAlign: "center", borderRight: "1px solid #1f2937", paddingRight: "16px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>SENSORES LATENCIA</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#06d6a0", marginTop: "4px" }}>
              {systemHealth.provider_latency_ms}ms
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>STREAMING</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#3b82f6", marginTop: "4px" }}>
              {systemHealth.stream_status}
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Workspace */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "380px 1fr",
        gap: "24px",
        alignItems: "stretch"
      }}>
        {/* Left Column: Event & Operations List */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          backgroundColor: "#111827",
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #1f2937"
        }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#94a3b8" }}>
            COLA DE DECISIONES Y ACCIONES
          </h2>
          
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "650px",
            overflowY: "auto"
          }}>
            {operations.map(op => {
              const colors = getRiskColor(op.risk_level);
              const isSelected = op.operation_id === selectedOpId;
              const isHeld = selectedHoldId === op.operation_id;

              return (
                <div
                  key={op.operation_id}
                  onClick={() => setSelectedOpId(op.operation_id)}
                  style={{
                    backgroundColor: isSelected ? "#1e293b" : "#1f2937",
                    border: `1px solid ${isSelected ? "#3b82f6" : "#2d3748"}`,
                    padding: "12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    transform: isSelected ? "scale(1.01)" : "none",
                    boxShadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.15)" : "none"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
                      {op.operation_id} • {op.decision_id}
                    </span>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`
                    }}>
                      {op.risk_level}
                    </span>
                  </div>

                  <h3 style={{ margin: "8px 0 4px 0", fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>
                    {op.metadata.description || op.metadata.payload?.alert_header || "Operación de Riesgo Pluvial"}
                  </h3>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      OPS Score: <strong style={{ color: "#f8fafc" }}>{op.metadata.ops_score.toFixed(2)}</strong>
                    </span>
                    
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: op.state === "PENDING_APPROVAL" ? (isHeld ? "#f59e0b" : "#f59e0b") : op.state === "EXECUTED" ? "#10b981" : op.state === "REJECTED" ? "#ef4444" : "#94a3b8"
                    }}>
                      {isHeld && op.state === "PENDING_APPROVAL" ? "HOLD / ESPERA" : op.state}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Control Center Details */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}>
          {selectedOp ? (
            <>
              {/* Event & Decision Panels */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px"
              }}>
                {/* Event Panel */}
                <div style={{
                  backgroundColor: "#111827",
                  padding: "20px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "18px" }}>🌧️</span>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#94a3b8" }}>
                      MONITOREO DE EVENTO FISICO
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                    <div><strong>ID del Evento:</strong> <span style={{ color: "#3b82f6" }}>{selectedOp.metadata.event_id}</span></div>
                    <div><strong>Ubicación Geográfica:</strong> <span style={{ color: "#94a3b8" }}>Aguascalientes (Polígono de Celda 250m)</span></div>
                    <div><strong>Nivel de Peligro:</strong> <span style={{
                      fontWeight: 700,
                      color: getRiskColor(selectedOp.risk_level).text
                    }}>{selectedOp.risk_level}</span></div>
                    <div><strong>Marcado Temporal:</strong> <span style={{ color: "#94a3b8" }}>{new Date(selectedOp.timestamp).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Decision Panel */}
                <div style={{
                  backgroundColor: "#111827",
                  padding: "20px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "18px" }}>📊</span>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#94a3b8" }}>
                      MÉTRICAS DE DECISIÓN OPERATIVA
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                    <div><strong>Identificador Decisión:</strong> <span style={{ color: "#3b82f6" }}>{selectedOp.decision_id}</span></div>
                    <div><strong>Prioridad Operativa (OPS):</strong> <span style={{ color: "#ffd166", fontWeight: 700 }}>{selectedOp.metadata.ops_score.toFixed(3)}</span></div>
                    <div><strong>Clasificación Determinista:</strong> <span style={{ fontWeight: 600 }}>{selectedOp.metadata.classification}</span></div>
                    <div><strong>Protocolo Desencadenado:</strong> <span style={{ color: "#64748b", fontStyle: "italic" }}>{selectedOp.metadata.automatic_dispatch ? "Dispositivo automático controlado" : "Human-in-the-Loop supervisado"}</span></div>
                  </div>
                </div>
              </div>

              {/* Action Panel */}
              <div style={{
                backgroundColor: "#111827",
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid #1f2937"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "18px" }}>📡</span>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#94a3b8" }}>
                    PLAN DE ACCIÓN E INSTRUCCIONES INSTITUCIONALES
                  </h2>
                </div>

                <div style={{
                  backgroundColor: "#1f2937",
                  padding: "16px",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${getRiskColor(selectedOp.risk_level).border}`,
                  marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "15px" }}>{selectedOp.metadata.payload?.alert_header || "Notificación de Alerta"}</strong>
                    <span style={{ fontSize: "12px", color: "#a0aec0" }}>Canal Destino: <strong>{selectedOp.metadata.target_authority}</strong></span>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6" }}>
                    {(selectedOp.metadata.payload?.instructions || 
                      selectedOp.metadata.payload?.recommendations || 
                      selectedOp.metadata.payload?.clearing_instructions || [
                        "Monitorear acumulación pluvial y sensores hidrológicos"
                    ]).map((inst: string, i: number) => (
                      <li key={i} style={{ marginBottom: "4px" }}>{inst}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  {selectedOp.state === "EXECUTED" && (
                    <div style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>✔ Acción simulada en modo de seguridad:</span>
                      <strong>{selectedOp.metadata.execution_details}</strong>
                    </div>
                  )}
                  {selectedOp.state === "REJECTED" && (
                    <div style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>❌ Acción rechazada:</span>
                      <strong>{selectedOp.metadata.rejection_reason}</strong>
                    </div>
                  )}
                  {selectedOp.state === "PENDING_APPROVAL" && (
                    <div style={{ color: "#ffd166" }}>
                      ⏳ Esperando decisión del operador. Esta alerta no será enviada ni simulada hasta ser validada.
                    </div>
                  )}
                </div>
              </div>

              {/* Approval Panel (HITL Controls) */}
              <div style={{
                backgroundColor: "#111827",
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid #1f2937",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>TOMA DE DECISIÓN HUMANA (HITL LAYER)</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    De acuerdo con las reglas de seguridad, las acciones críticas requieren aprobación antes del despacho operativo.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    disabled={selectedOp.state !== "PENDING_APPROVAL" || processing}
                    onClick={() => handleHITLAction("REJECT")}
                    style={{
                      backgroundColor: selectedOp.state !== "PENDING_APPROVAL" ? "#1e293b" : "#ef4444",
                      color: selectedOp.state !== "PENDING_APPROVAL" ? "#475569" : "#ffffff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: selectedOp.state !== "PENDING_APPROVAL" ? "not-allowed" : "pointer",
                      transition: "opacity 0.2s"
                    }}
                  >
                    REJECT (RECHAZAR)
                  </button>

                  <button
                    disabled={selectedOp.state !== "PENDING_APPROVAL" || processing || selectedHoldId === selectedOp.operation_id}
                    onClick={() => handleHITLAction("HOLD")}
                    style={{
                      backgroundColor: selectedOp.state !== "PENDING_APPROVAL" || selectedHoldId === selectedOp.operation_id ? "#1e293b" : "#f59e0b",
                      color: selectedOp.state !== "PENDING_APPROVAL" || selectedHoldId === selectedOp.operation_id ? "#475569" : "#000000",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: selectedOp.state !== "PENDING_APPROVAL" || selectedHoldId === selectedOp.operation_id ? "not-allowed" : "pointer",
                      transition: "opacity 0.2s"
                    }}
                  >
                    {selectedHoldId === selectedOp.operation_id ? "ON HOLD" : "HOLD (RETENER)"}
                  </button>

                  <button
                    disabled={selectedOp.state !== "PENDING_APPROVAL" || processing}
                    onClick={() => handleHITLAction("APPROVE")}
                    style={{
                      backgroundColor: selectedOp.state !== "PENDING_APPROVAL" ? "#1e293b" : "#10b981",
                      color: selectedOp.state !== "PENDING_APPROVAL" ? "#475569" : "#ffffff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: selectedOp.state !== "PENDING_APPROVAL" ? "not-allowed" : "pointer",
                      transition: "opacity 0.2s"
                    }}
                  >
                    {processing ? "PROCESSING..." : "APPROVE (APROBAR)"}
                  </button>
                </div>
              </div>

              {/* Feedback Loop Telemetry & Audit logs */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px"
              }}>
                {/* Feedback Loop Panel */}
                <div style={{
                  backgroundColor: "#111827",
                  padding: "20px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "16px" }}>🔄</span>
                    <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>
                      TELEMÉTRICA DE RETROALIMENTACIÓN (FEEDBACK LOOP)
                    </h2>
                  </div>

                  {feedbackData && feedbackData.operation_id === selectedOpId ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                      <div>OPS Estimada: <strong style={{ color: "#ffd166" }}>{feedbackData.ops_estimated_score.toFixed(3)}</strong></div>
                      <div>Riesgo de Celda Real: <strong style={{ color: "#3b82f6" }}>{feedbackData.simulated_ground_truth_iri.toFixed(3)}</strong></div>
                      <div>Diferencial de Varianza: <strong>{feedbackData.variance >= 0 ? "+" : ""}{feedbackData.variance.toFixed(4)}</strong></div>
                      <div>Precisión de Predicción: <strong style={{ color: "#10b981" }}>{feedbackData.precision}%</strong></div>
                      <div style={{
                        marginTop: "8px",
                        padding: "8px",
                        backgroundColor: "#1e293b",
                        borderRadius: "4px",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        borderLeft: "3px solid #3b82f6"
                      }}>
                        {feedbackData.tuning_advice}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic", paddingTop: "12px" }}>
                      Ninguna métrica calculada. Aprueba esta acción operativa para simular la efectividad del modelo de prioridad en tiempo real.
                    </div>
                  )}
                </div>

                {/* Audit Logs panel */}
                <div style={{
                  backgroundColor: "#111827",
                  padding: "20px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>📝</span>
                    <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>
                      TRAZA DE AUDITORÍA (AUDIT LOGS)
                    </h2>
                  </div>

                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    fontSize: "12px"
                  }}>
                    {auditLogs.map((log, i) => (
                      <div key={i} style={{
                        borderBottom: "1px solid #1f2937",
                        paddingBottom: "6px",
                        color: "#94a3b8"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                          <strong>{log.event} ({log.operation_id})</strong>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div style={{ marginTop: "2px", color: "#64748b" }}>{log.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              backgroundColor: "#111827",
              padding: "40px",
              borderRadius: "10px",
              border: "1px solid #1f2937",
              textAlign: "center",
              color: "#64748b"
            }}>
              Selecciona una operación de la lista para gestionar la aprobación humana de comando.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
