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
  /**
   * Intentos de procesamiento iniciados. Campo opcional para compatibilidad
   * con documentos historicos ADR-019.19 creados antes de FASE 2A.
   */
  attempts?: number;
  claimId?: string | null;
  claimedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  retryCount: number;
  createdAt: string;
  processedAt: string | null;
  errorMessage?: string | null;
}

export type GeointOutboxClaimReason =
  | "CLAIMED"
  | "NOT_FOUND"
  | "ALREADY_PROCESSING"
  | "TERMINAL"
  | "MAX_ATTEMPTS_EXHAUSTED"
  | "NOT_ELIGIBLE";

export interface GeointOutboxClaimResult {
  claimed: boolean;
  reason: GeointOutboxClaimReason;
  entry?: GeointEventOutboxEntry;
}
