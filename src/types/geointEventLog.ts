/**
 * ADR-019.17 — Gobernanza de Registro de Eventos GEOINT (Event Log)
 * Estructura de auditoría y trazabilidad unificada para eventos del ciclo de vida GEOINT.
 */

export type GeointEventType =
  | "GEOINT_SWEEP_STARTED"
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
