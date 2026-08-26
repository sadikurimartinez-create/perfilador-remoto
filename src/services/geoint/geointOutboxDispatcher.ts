import { GeointEventOutboxService } from "./geointEventOutboxService";
import { GeointEventLogService } from "./geointEventLogService";
import { GeointEventOutboxEntry } from "@/types/geointEventOutbox";

export class GeointOutboxDispatcher {
  private static MAX_RETRIES = 3;

  /**
   * Escanea y procesa entradas pendientes con control de concurrencia simple.
   */
  static async dispatchPending(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    // Usamos el límite definido en el servicio tras la FASE 2.2
    const pending = await GeointEventOutboxService.getPendingEntries(50);
    let successCount = 0;
    let failedCount = 0;

    for (const entry of pending) {
      // Protección: Si el estado ya es PROCESSING, omitir para evitar colisiones
      if (entry.status === "PROCESSING") continue;

      try {
        // Transición atómica a PROCESSING
        await GeointEventOutboxService.updateEntryStatus(entry.outboxId, "PROCESSING");

        if (entry.payload.metadata?.shouldFailForTest) {
          throw new Error("PROV_ERROR: Proveedor externo falló intencionalmente.");
        }

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

        // Transición final: COMPLETADO
        await GeointEventOutboxService.updateEntryStatus(entry.outboxId, "COMPLETED", {
          processedAt: new Date().toISOString(),
        });

        successCount++;
      } catch (err: any) {
        const nextRetry = (entry.retryCount || 0) + 1;
        const finalStatus = nextRetry >= this.MAX_RETRIES ? "FAILED" : "QUEUED";

        // Transición a FALLIDO o RE-ENCOLADO
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
