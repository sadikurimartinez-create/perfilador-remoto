import { GeointEventOutboxService, type GeointOutboxEventPayload } from "@/services/geoint/geointEventOutboxService";
import type {
  GeointSweepLifecycleRecord,
  GeointSweepLifecycleStatus,
  GeointSweepTransitionHistoryEntry,
} from "@/utils/geointSweepLifecycle";
import type { GeointEventType } from "@/types/geointEventLog";

const TRACEABILITY_UNAVAILABLE = "UNAVAILABLE";

const STATUS_EVENT_TYPES: Partial<Record<GeointSweepLifecycleStatus, GeointEventType>> = {
  REQUESTED: "GEOINT_SWEEP_REQUESTED",
  RUNNING: "GEOINT_SWEEP_STARTED",
  COLLECTING: "GEOINT_SWEEP_COLLECTING",
  ANALYZING: "GEOINT_SWEEP_ANALYZING",
  VALIDATING: "GEOINT_SWEEP_VALIDATING",
  CERTIFIED: "GEOINT_SWEEP_CERTIFIED",
  FAILED: "GEOINT_SWEEP_FAILED",
  CANCELLED: "GEOINT_SWEEP_CANCELLED",
  EXPIRED: "GEOINT_SWEEP_EXPIRED",
};

export function getSweepLifecycleEventType(
  transition: GeointSweepTransitionHistoryEntry
): GeointEventType | null {
  if (transition.fromStatus === "FAILED" && transition.toStatus === "REQUESTED") {
    return "GEOINT_SWEEP_RETRIED";
  }
  return STATUS_EVENT_TYPES[transition.toStatus] || null;
}

function resolveTraceabilityId(record: GeointSweepLifecycleRecord): string {
  return typeof record.traceabilityId === "string" && record.traceabilityId.trim()
    ? record.traceabilityId
    : TRACEABILITY_UNAVAILABLE;
}

function buildEventStatus(eventType: GeointEventType): string {
  if (eventType === "GEOINT_SWEEP_CERTIFIED") return "CERTIFIED";
  if (eventType === "GEOINT_SWEEP_FAILED") return "FAILED";
  if (eventType === "GEOINT_SWEEP_CANCELLED") return "CANCELLED";
  if (eventType === "GEOINT_SWEEP_EXPIRED") return "EXPIRED";
  return "RECORDED";
}

export function buildSweepLifecycleOutboxPayload(input: {
  record: GeointSweepLifecycleRecord;
  transition: GeointSweepTransitionHistoryEntry;
  actor: string;
  source?: string;
}): GeointOutboxEventPayload | null {
  const eventType = getSweepLifecycleEventType(input.transition);
  if (!eventType) return null;

  const metadata: Record<string, any> = {
    sweepId: input.record.sweepId,
    expedienteId: input.record.expedienteId,
    fromStatus: input.transition.fromStatus,
    toStatus: input.transition.toStatus,
    previousStatus: input.record.previousStatus ?? input.transition.fromStatus ?? null,
    attempt: input.record.attempt,
    transitionReason: input.transition.reason ?? null,
  };

  if (input.record.failureReason) metadata.failureReason = input.record.failureReason;
  if (input.record.correlationId) metadata.correlationId = input.record.correlationId;
  if (input.record.outputEvidenceIds?.length) metadata.outputEvidenceIds = input.record.outputEvidenceIds;
  if (input.record.outputFindingIds?.length) metadata.outputFindingIds = input.record.outputFindingIds;
  if (input.record.lineageStatus) metadata.lineageStatus = input.record.lineageStatus;

  return {
    eventType,
    expedienteId: input.record.expedienteId,
    traceabilityId: resolveTraceabilityId(input.record),
    actor: input.actor || "UNAVAILABLE",
    source: input.source || "ProjectContext",
    status: buildEventStatus(eventType),
    entityType: "GEOINT_SWEEP",
    entityId: input.record.sweepId,
    metadata,
  };
}

export async function enqueueSweepLifecycleEventsInTransaction(
  transaction: {
    get: (ref: any) => Promise<{ exists: () => boolean; data: () => any }>;
    set: (ref: any, data: any, options?: any) => void;
  },
  db: any,
  record: GeointSweepLifecycleRecord,
  options: { actor: string; source?: string }
) {
  const enqueued = [];
  for (const transition of record.transitionHistory || []) {
    const payload = buildSweepLifecycleOutboxPayload({
      record,
      transition,
      actor: options.actor,
      source: options.source,
    });
    if (!payload) continue;
    enqueued.push(await GeointEventOutboxService.enqueueEventInTransaction(transaction, db, payload));
  }
  return enqueued;
}
