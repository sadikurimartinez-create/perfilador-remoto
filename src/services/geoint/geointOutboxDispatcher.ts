import { GeointEventOutboxService } from "./geointEventOutboxService";
import { GeointEventLogService } from "./geointEventLogService";
import { GeointEventOutboxEntry } from "@/types/geointEventOutbox";

export class GeointOutboxDispatcher {
  private static MAX_RETRIES = 3;

  /**
   * Escanea y procesa todas las entradas pendientes en la outbox.
   * Retorna un resumen de ejecución.
   */
  static async dispatchPending(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    const pending = await GeointEventOutboxService.getPendingEntries();
    let successCount = 0;
    let failedCount = 0;

    for (const entry of pending) {
      try {
        await GeointEventOutboxService.updateEntryStatus(entry.outboxId, "PROCESSING");

        // Simulación o ejecución de integración asíncrona con el proveedor externo
        // (Por ejemplo, llamar al proveedor o validar evidencia de Street View)
        if (entry.payload.metadata?.shouldFailForTest) {
          throw new Error("PROV_ERROR: Proveedor externo no responde o falló la red.");
        }

        // Si todo es exitoso, persistimos el evento final en el ledger principal
        await GeointEventLogService.persistGeointEvent({
          eventId: entry.eventId,
          eventType: entry.payload.eventType as any,
          timestamp: new Date().toISOString(),
          expedienteId: entry.payload.expedienteId,
          traceabilityId: entry.payload.traceabilityId,
          actor: entry.payload.actor,
          source: entry.payload.source,
          status: "COMPLETED",
          payload: {
            entityType: entry.payload.entityType,
            entityId: entry.payload.entityId,
            ...entry.payload.metadata,
          },
        });

        // Completar en outbox
        await GeointEventOutboxService.updateEntryStatus(entry.outboxId, "COMPLETED", {
          processedAt: new Date().toISOString(),
        });

        successCount++;
      } catch (err: any) {
        const nextRetry = (entry.retryCount || 0) + 1;
        const finalStatus = nextRetry >= this.MAX_RETRIES ? "FAILED" : "QUEUED";

        await GeointEventOutboxService.updateEntryStatus(entry.outboxId, finalStatus, {
          retryCount: nextRetry,
          errorMessage: err.message || String(err),
        });

        failedCount++;
      }
    }

    return {
      processed: pending.length,
      success: successCount,
      failed: failedCount,
    };
  }
}
