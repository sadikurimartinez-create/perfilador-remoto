import { GeointEventLogEntry, GeointEventType } from "@/types/geointEventLog";
import { GeointEventLogService } from "./geointEventLogService";

/**
 * Registra eventos en el log forense operativo.
 */
export async function logGeointEvent(
  eventType: GeointEventType,
  expedienteId: string,
  traceabilityId: string,
  actor: string,
  source: string,
  status: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  try {
    await GeointEventLogService.createAndPersistEvent(
      eventType,
      expedienteId,
      traceabilityId,
      actor,
      source,
      status,
      entityType,
      entityId,
      metadata
    );
  } catch (error) {
    console.error(`[GeointEventLog] Error registrando evento ${eventType}:`, error);
  }
}
