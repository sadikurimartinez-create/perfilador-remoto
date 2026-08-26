export interface GeointEventOutboxEntry {
  outboxId: string;
  eventId: string;
  fingerprint: string;
  payload: {
    eventType: string;
    expedienteId: string;
    traceabilityId: string;
    actor: string;
    source: string;
    status: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, any>;
  };
  status: "CREATED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";
  retryCount: number;
  createdAt: string;
  processedAt: string | null;
  errorMessage?: string | null;
}
