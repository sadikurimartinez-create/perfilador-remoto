/**
 * ADR-019.17 — Gobernanza de Registro de Eventos GEOINT (Event Log)
 * Estructura de auditoría y trazabilidad unificada para eventos del ciclo de vida GEOINT.
 */

export type GeointEventType =
  | "GEOINT_SWEEP_REQUESTED"
  | "GEOINT_SWEEP_STARTED"
  | "GEOINT_SWEEP_COLLECTING"
  | "GEOINT_SWEEP_ANALYZING"
  | "GEOINT_SWEEP_VALIDATING"
  | "GEOINT_SWEEP_CERTIFIED"
  | "GEOINT_SWEEP_FAILED"
  | "GEOINT_SWEEP_CANCELLED"
  | "GEOINT_SWEEP_EXPIRED"
  | "GEOINT_SWEEP_RETRIED"
  | "PANORAMA_VALIDATED"
  | "TEMPORAL_COMPARISON_CREATED"
  | "HUMAN_APPROVED"
  | "HUMAN_REJECTED"
  | "REPORT_CONSUMED";


export interface GeointEventLogEntry {
  eventId: string;
  eventType: GeointEventType;
  timestamp: string;
  expedienteId: string;
  traceabilityId: string;
  actor: string;
  source: string;
  status: string;
  payload?: Record<string, any>;
}

export function buildGeointEventLogEntry(
  eventType: GeointEventType,
  expedienteId: string,
  traceabilityId: string,
  actor: string,
  source: string,
  status: string,
  payload?: Record<string, any>
): GeointEventLogEntry {
  return {
    eventId: `evt-geoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventType,
    timestamp: new Date().toISOString(),
    expedienteId,
    traceabilityId,
    actor,
    source,
    status,
    payload,
  };
}
