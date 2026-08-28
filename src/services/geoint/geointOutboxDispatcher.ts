import { GeointEventOutboxService } from "./geointEventOutboxService";
import { GeointEventLogService } from "./geointEventLogService";

export interface GeointOutboxDispatchResult {
  candidates: number;
  processed: number;
  completed: number;
  retryable: number;
  failedTerminal: number;
  skipped: number;
  success: number;
  failed: number;
}

export class GeointOutboxDispatcher {
  private static MAX_RETRIES = 3;

  /**
   * Escanea y procesa entradas pendientes con control de concurrencia simple.
   */
  static async dispatchPending(): Promise<GeointOutboxDispatchResult> {
    const pending = await GeointEventOutboxService.getPendingEntries(50);
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let retryableCount = 0;
    let failedTerminalCount = 0;
    let skippedCount = 0;

    for (const entry of pending) {
      const claim = await GeointEventOutboxService.claimEntry(
        entry.outboxId,
        this.MAX_RETRIES
      );

      if (!claim.claimed || !claim.entry) {
        skippedCount++;
        continue;
      }

      const claimedEntry = claim.entry;
      processedCount++;

      try {
        if (claimedEntry.payload.metadata?.shouldFailForTest) {
          throw new Error("PROV_ERROR: Proveedor externo falló intencionalmente.");
        }

        const ledgerExists = await GeointEventOutboxService.ledgerEventExists(claimedEntry.eventId);
        if (!ledgerExists) {
          await GeointEventLogService.persistGeointEvent({
            eventId: claimedEntry.eventId,
            eventType: claimedEntry.payload.eventType as any,
            timestamp: new Date().toISOString(),
            expedienteId: claimedEntry.payload.expedienteId,
            traceabilityId: claimedEntry.payload.traceabilityId,
            actor: claimedEntry.payload.actor,
            source: claimedEntry.payload.source,
            status: "COMPLETED",
            payload: {
              entityType: claimedEntry.payload.entityType,
              entityId: claimedEntry.payload.entityId,
              ...claimedEntry.payload.metadata,
            },
          });
        }

        await GeointEventOutboxService.markCompleted(claimedEntry.outboxId);

        successCount++;
      } catch (err: any) {
        const failureStatus = await GeointEventOutboxService.markFailure(claimedEntry, err, this.MAX_RETRIES);
        if (failureStatus === "FAILED") {
          failedTerminalCount++;
        } else {
          retryableCount++;
        }
        failedCount++;
      }
    }

    return {
      candidates: pending.length,
      processed: processedCount,
      completed: successCount,
      retryable: retryableCount,
      failedTerminal: failedTerminalCount,
      skipped: skippedCount,
      success: successCount,
      failed: failedCount,
    };
  }
}
