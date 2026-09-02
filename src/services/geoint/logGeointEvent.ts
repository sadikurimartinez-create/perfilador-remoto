import { GeointEventType } from "@/types/geointEventLog";

type GeointEventRuntime = {
  window?: {
    document?: unknown;
    location?: { protocol?: string };
    fetch?: unknown;
  };
};

export function resolveGeointEventTransport(
  runtime: GeointEventRuntime = globalThis as GeointEventRuntime
): "BROWSER_API" | "SERVER_OUTBOX" {
  const browserWindow = runtime.window;
  const protocol = browserWindow?.location?.protocol;
  return browserWindow?.document
    && typeof browserWindow.fetch === "function"
    && (protocol === "http:" || protocol === "https:")
    ? "BROWSER_API"
    : "SERVER_OUTBOX";
}

/**
 * Emite eventos GEOINT de forma confiable mediante Outbox.
 * ADR-019.19 FASE 2B: el adapter conserva la firma legacy, pero deja
 * de escribir directamente en el Event Ledger para consumidores productivos.
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
  if (resolveGeointEventTransport() === "BROWSER_API") {
    const response = await window.fetch("/api/geoint/events/outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        expedienteId,
        traceabilityId,
        actor,
        source,
        status,
        entityType,
        entityId,
        metadata,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`[GeointEventOutbox] Emision fallida (${response.status}): ${detail}`);
    }

    return;
  }

  const { GeointEventOutboxService } = await import("./geointEventOutboxService");
  await GeointEventOutboxService.enqueueEvent(
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
}
