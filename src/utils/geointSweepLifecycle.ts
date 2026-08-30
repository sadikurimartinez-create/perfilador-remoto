import type { CanonicalHumanValidationStatus } from "@/utils/humanValidationPolicy";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";

export type GeointSweepLifecycleStatus =
  | "IDLE"
  | "REQUESTED"
  | "RUNNING"
  | "COLLECTING"
  | "ANALYZING"
  | "VALIDATING"
  | "CERTIFIED"
  | "ARCHIVED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type GeointSweepAnalysisStatus =
  | "UNANALYZED"
  | "ANALYZING"
  | "READY_FOR_HUMAN_REVIEW";

export type GeointSweepValidationSource = "ADR_020_24_HUMAN_ACTION" | null;

export interface GeointSweepTransitionHistoryEntry {
  fromStatus: GeointSweepLifecycleStatus | null;
  toStatus: GeointSweepLifecycleStatus;
  at: string;
  reason?: string | null;
}

export interface GeointSweepLifecycleRecord {
  sweepId: string;
  expedienteId: string;
  status: GeointSweepLifecycleStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  attempt: number;
  correlationId?: string | null;
  traceabilityId?: string | null;
  previousStatus?: GeointSweepLifecycleStatus | null;
  failureReason?: string | null;
  retryPolicy?: {
    allowRetry: boolean;
    maxAttempts?: number;
  };
  aiQualityScore?: number | null;
  analysisStatus?: GeointSweepAnalysisStatus;
  humanValidationStatus?: CanonicalHumanValidationStatus;
  validationSource?: GeointSweepValidationSource;
  validatedAt?: string | null;
  validatedBy?: any | null;
  outputEvidenceIds?: string[];
  outputFindingIds?: string[];
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
  transitionHistory: GeointSweepTransitionHistoryEntry[];
}

export interface GeointSweepTransitionOptions {
  now?: string;
  expectedVersion?: number;
  reason?: string | null;
  retryPolicy?: {
    allowRetry: boolean;
    maxAttempts?: number;
  };
  validationSatisfied?: boolean;
}

const ALLOWED_TRANSITIONS: Record<GeointSweepLifecycleStatus, GeointSweepLifecycleStatus[]> = {
  IDLE: ["REQUESTED"],
  REQUESTED: ["RUNNING", "FAILED", "CANCELLED", "EXPIRED"],
  RUNNING: ["COLLECTING", "FAILED", "CANCELLED", "EXPIRED"],
  COLLECTING: ["ANALYZING", "FAILED", "CANCELLED", "EXPIRED"],
  ANALYZING: ["VALIDATING", "FAILED", "CANCELLED", "EXPIRED"],
  VALIDATING: ["CERTIFIED", "FAILED", "CANCELLED", "EXPIRED"],
  CERTIFIED: ["ARCHIVED"],
  ARCHIVED: [],
  FAILED: ["REQUESTED"],
  CANCELLED: [],
  EXPIRED: [],
};

const TERMINAL_NON_PROGRESSING = new Set<GeointSweepLifecycleStatus>([
  "ARCHIVED",
  "CANCELLED",
  "EXPIRED",
]);

function isoNow() {
  return new Date().toISOString();
}

function hasRealTraceabilityId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertVersion(record: GeointSweepLifecycleRecord, expectedVersion?: number) {
  if (typeof expectedVersion === "number" && record.version !== expectedVersion) {
    throw new Error(`GEOINT_SWEEP_VERSION_CONFLICT:${record.version}:EXPECTED_${expectedVersion}`);
  }
}

function retryAllowed(record: GeointSweepLifecycleRecord, options: GeointSweepTransitionOptions): boolean {
  const policy = options.retryPolicy || record.retryPolicy;
  if (!policy?.allowRetry) return false;
  if (typeof policy.maxAttempts === "number" && record.attempt >= policy.maxAttempts) return false;
  return true;
}

export function canTransitionGeointSweep(
  fromStatus: GeointSweepLifecycleStatus,
  toStatus: GeointSweepLifecycleStatus,
  options: Pick<GeointSweepTransitionOptions, "validationSatisfied" | "retryPolicy"> = {},
  currentAttempt = 0
): { allowed: boolean; reason?: string } {
  if (TERMINAL_NON_PROGRESSING.has(fromStatus)) {
    return { allowed: false, reason: `TERMINAL_STATE:${fromStatus}` };
  }

  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    return { allowed: false, reason: `INVALID_TRANSITION:${fromStatus}->${toStatus}` };
  }

  if (fromStatus === "FAILED" && toStatus === "REQUESTED") {
    if (!options.retryPolicy?.allowRetry) return { allowed: false, reason: "FAILED_RETRY_NOT_ALLOWED" };
    if (typeof options.retryPolicy.maxAttempts === "number" && currentAttempt >= options.retryPolicy.maxAttempts) {
      return { allowed: false, reason: "FAILED_RETRY_MAX_ATTEMPTS_REACHED" };
    }
  }

  if (toStatus === "CERTIFIED" && options.validationSatisfied !== true) {
    return { allowed: false, reason: "CERTIFIED_REQUIRES_HUMAN_VALIDATION" };
  }

  return { allowed: true };
}

export function createGeointSweepLifecycleRecord(input: {
  sweepId: string;
  expedienteId: string;
  now?: string;
  correlationId?: string | null;
  traceabilityId?: string | null;
  outputEvidenceIds?: string[];
  outputFindingIds?: string[];
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
}): GeointSweepLifecycleRecord {
  const now = input.now || isoNow();
  const traceabilityId = hasRealTraceabilityId(input.traceabilityId) ? input.traceabilityId : null;
  const record: GeointSweepLifecycleRecord = {
    sweepId: input.sweepId,
    expedienteId: input.expedienteId,
    status: "REQUESTED",
    version: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attempt: 0,
    correlationId: input.correlationId ?? null,
    traceabilityId,
    analysisStatus: "UNANALYZED",
    humanValidationStatus: "UNREVIEWED",
    validationSource: null,
    validatedAt: null,
    validatedBy: null,
    outputEvidenceIds: input.outputEvidenceIds || [],
    outputFindingIds: input.outputFindingIds || [],
    lineage: input.lineage || [],
    lineageStatus: input.lineageStatus,
    transitionHistory: [{ fromStatus: null, toStatus: "REQUESTED", at: now, reason: "HUMAN_REQUEST" }],
  };
  return record;
}

export function transitionGeointSweepLifecycle(
  record: GeointSweepLifecycleRecord,
  toStatus: GeointSweepLifecycleStatus,
  options: GeointSweepTransitionOptions = {}
): GeointSweepLifecycleRecord {
  assertVersion(record, options.expectedVersion);

  const guard = canTransitionGeointSweep(
    record.status,
    toStatus,
    {
      validationSatisfied: options.validationSatisfied,
      retryPolicy: options.retryPolicy || record.retryPolicy,
    },
    record.attempt
  );
  if (!guard.allowed) {
    throw new Error(guard.reason || `INVALID_TRANSITION:${record.status}->${toStatus}`);
  }

  if (record.status === "FAILED" && toStatus === "REQUESTED" && !retryAllowed(record, options)) {
    throw new Error("FAILED_RETRY_NOT_ALLOWED");
  }

  const now = options.now || isoNow();
  const nextAttempt = record.status === "FAILED" && toStatus === "REQUESTED" ? record.attempt + 1 : record.attempt;
  return {
    ...record,
    status: toStatus,
    version: record.version + 1,
    updatedAt: now,
    startedAt: toStatus === "RUNNING" && !record.startedAt ? now : record.startedAt ?? null,
    completedAt: toStatus === "CERTIFIED" || toStatus === "ARCHIVED" ? now : record.completedAt ?? null,
    failedAt: toStatus === "FAILED" ? now : record.failedAt ?? null,
    attempt: nextAttempt,
    previousStatus: record.status,
    failureReason: toStatus === "FAILED" ? options.reason ?? "SWEEP_FAILED" : record.failureReason ?? null,
    retryPolicy: options.retryPolicy || record.retryPolicy,
    transitionHistory: [
      ...record.transitionHistory,
      { fromStatus: record.status, toStatus, at: now, reason: options.reason ?? null },
    ],
  };
}

export function createHumanTriggeredRunningSweepLifecycle(input: Parameters<typeof createGeointSweepLifecycleRecord>[0]) {
  const requested = createGeointSweepLifecycleRecord(input);
  return transitionGeointSweepLifecycle(requested, "RUNNING", {
    now: input.now,
    expectedVersion: requested.version,
    reason: "HUMAN_TRIGGERED_START",
  });
}

export function markGeointSweepReadyForHumanReview(
  record: GeointSweepLifecycleRecord,
  input: { aiQualityScore: number; now?: string; expectedVersion?: number }
): GeointSweepLifecycleRecord {
  const validating = transitionGeointSweepLifecycle(record, "VALIDATING", {
    now: input.now,
    expectedVersion: input.expectedVersion,
    reason: "AI_ANALYSIS_READY_FOR_HUMAN_REVIEW",
  });
  return {
    ...validating,
    aiQualityScore: input.aiQualityScore,
    analysisStatus: "READY_FOR_HUMAN_REVIEW",
    humanValidationStatus: "PENDING_REVIEW",
  };
}

export function certifyGeointSweepWithHumanApproval(
  record: GeointSweepLifecycleRecord,
  input: {
    validatedAt?: string;
    validatedBy?: any | null;
    expectedVersion?: number;
  } = {}
): GeointSweepLifecycleRecord {
  const validatedAt = input.validatedAt || isoNow();
  const certified = transitionGeointSweepLifecycle(record, "CERTIFIED", {
    now: validatedAt,
    expectedVersion: input.expectedVersion,
    validationSatisfied: true,
    reason: "ADR_020_24_HUMAN_APPROVAL",
  });
  return {
    ...certified,
    humanValidationStatus: "APPROVED",
    validationSource: "ADR_020_24_HUMAN_ACTION",
    validatedAt,
    validatedBy: input.validatedBy ?? null,
  };
}

export function rejectGeointSweepWithHumanDecision(
  record: GeointSweepLifecycleRecord,
  input: {
    reason: string;
    validatedAt?: string;
    validatedBy?: any | null;
    expectedVersion?: number;
  }
): GeointSweepLifecycleRecord {
  const failedAt = input.validatedAt || isoNow();
  const failed = transitionGeointSweepLifecycle(record, "FAILED", {
    now: failedAt,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
  return {
    ...failed,
    humanValidationStatus: "REJECTED",
    validationSource: "ADR_020_24_HUMAN_ACTION",
    validatedAt: failedAt,
    validatedBy: input.validatedBy ?? null,
  };
}

export function rehydrateGeointSweepLifecycleRecord(record: GeointSweepLifecycleRecord): GeointSweepLifecycleRecord {
  return {
    ...record,
    traceabilityId: hasRealTraceabilityId(record.traceabilityId) ? record.traceabilityId : null,
    correlationId: record.correlationId ?? null,
    transitionHistory: Array.isArray(record.transitionHistory) ? record.transitionHistory : [],
  };
}
