import {
  normalizeDenueAnalyticalRelation,
  validateDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
  type DenueHumanValidationStatus,
} from "@/utils/denueAnalyticalRelation";

export type DenueAnalyticalReviewDecision = Exclude<DenueHumanValidationStatus, "PENDING">;

export interface DenueAnalyticalReviewEvent {
  readonly eventId: string;
  readonly relationId: string;
  readonly expedienteId: string;
  readonly geographyId: string;
  readonly previousStatus: DenueHumanValidationStatus;
  readonly nextStatus: DenueHumanValidationStatus;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly rationale: string;
  readonly methodologyVersion: string;
  readonly relationFingerprint: string;
}

export interface DenueAnalyticalReviewLedger {
  readonly relationId: string;
  readonly expedienteId: string;
  readonly geographyId: string;
  readonly methodologyVersion: string;
  readonly relationFingerprint: string;
  readonly events: readonly DenueAnalyticalReviewEvent[];
}

export type DenueAnalyticalReviewReason =
  | "RELATION_BASE_INVALID"
  | "BASE_RELATION_NOT_PENDING"
  | "BASE_RELATION_NOT_INELIGIBLE"
  | "EVENT_REQUIRED"
  | "EVENT_ID_REQUIRED"
  | "RELATION_ID_MISMATCH"
  | "EXPEDIENTE_ID_MISMATCH"
  | "GEOGRAPHY_ID_MISMATCH"
  | "METHODOLOGY_VERSION_MISMATCH"
  | "RELATION_FINGERPRINT_MISMATCH"
  | "PREVIOUS_STATUS_MISMATCH"
  | "TRANSITION_NOT_ALLOWED"
  | "REVIEWED_BY_REQUIRED"
  | "REVIEWER_IDENTITY_RESERVED"
  | "REVIEWED_AT_INVALID"
  | "RATIONALE_REQUIRED"
  | "EVENT_ID_MISMATCH"
  | "LEDGER_REQUIRED"
  | "LEDGER_RELATION_ID_MISMATCH"
  | "LEDGER_EXPEDIENTE_ID_MISMATCH"
  | "LEDGER_GEOGRAPHY_ID_MISMATCH"
  | "LEDGER_METHODOLOGY_VERSION_MISMATCH"
  | "LEDGER_FINGERPRINT_MISMATCH"
  | "EVENT_ID_CONFLICT"
  | "HISTORY_INCONSISTENT"
  | "RESULTING_RELATION_INVALID";

export interface DenueAnalyticalReviewValidation {
  valid: boolean;
  reasons: DenueAnalyticalReviewReason[];
}

export type DenueAnalyticalReviewApplicationResult =
  | {
      status: "APPLIED";
      relation: DenueAnalyticalRelation;
      event: DenueAnalyticalReviewEvent;
      reasons: [];
    }
  | {
      status: "REJECTED";
      relation: null;
      event: DenueAnalyticalReviewEvent;
      reasons: DenueAnalyticalReviewReason[];
    };

export type DenueAnalyticalReviewLedgerResult =
  | {
      status: "VALID";
      ledger: DenueAnalyticalReviewLedger;
      relation: DenueAnalyticalRelation;
      reasons: [];
    }
  | {
      status: "REJECTED";
      ledger: null;
      relation: null;
      reasons: DenueAnalyticalReviewReason[];
    };

const RESERVED_REVIEWER_IDENTITIES = new Set(["SYSTEM", "AI", "AUTO", "BOT"]);

const ALLOWED_TRANSITIONS: Record<DenueHumanValidationStatus, ReadonlySet<DenueHumanValidationStatus>> = {
  PENDING: new Set(["ACCEPTED", "REJECTED", "REQUIRES_REVISION"]),
  REQUIRES_REVISION: new Set(["ACCEPTED", "REJECTED", "REQUIRES_REVISION"]),
  ACCEPTED: new Set(),
  REJECTED: new Set(),
};

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function stableHash(value: string): string {
  let first = 2166136261;
  let second = 2246822507;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 3266489909);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function validIsoDate(value: unknown): value is string {
  if (!present(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function materialRelation(relation: DenueAnalyticalRelation): Omit<DenueAnalyticalRelation, "humanValidation"> {
  const normalized = normalizeDenueAnalyticalRelation(relation);
  const { humanValidation: _humanValidation, ...material } = normalized;
  return material;
}

export function fingerprintDenueAnalyticalRelation(relation: DenueAnalyticalRelation): string {
  const serialized = canonicalString(materialRelation(relation));
  return `denue-relation-fingerprint-v1:${serialized.length}:${stableHash(serialized)}`;
}

function eventIdentityMaterial(event: Omit<DenueAnalyticalReviewEvent, "eventId">): string {
  return canonicalString(event);
}

export function buildDenueAnalyticalReviewEvent(
  relation: DenueAnalyticalRelation,
  decision: {
    nextStatus: DenueAnalyticalReviewDecision;
    reviewedBy: string;
    reviewedAt: string;
    rationale: string;
  }
): DenueAnalyticalReviewEvent {
  const content: Omit<DenueAnalyticalReviewEvent, "eventId"> = {
    relationId: relation.relationId,
    expedienteId: relation.expedienteId,
    geographyId: relation.geographyId,
    previousStatus: relation.humanValidation.status,
    nextStatus: decision.nextStatus,
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    rationale: decision.rationale,
    methodologyVersion: relation.methodologyVersion,
    relationFingerprint: fingerprintDenueAnalyticalRelation(relation),
  };
  return Object.freeze({
    eventId: `denue-review-event-v1:${stableHash(eventIdentityMaterial(content))}`,
    ...content,
  });
}

export function validateDenueAnalyticalReviewTransition(
  previousStatus: DenueHumanValidationStatus,
  nextStatus: DenueHumanValidationStatus
): DenueAnalyticalReviewValidation {
  const allowed = ALLOWED_TRANSITIONS[previousStatus]?.has(nextStatus) === true;
  return { valid: allowed, reasons: allowed ? [] : ["TRANSITION_NOT_ALLOWED"] };
}

function expectedEventId(event: DenueAnalyticalReviewEvent): string {
  const { eventId: _eventId, ...content } = event;
  return `denue-review-event-v1:${stableHash(eventIdentityMaterial(content))}`;
}

export function validateDenueAnalyticalReviewEvent(
  relation: DenueAnalyticalRelation,
  event: DenueAnalyticalReviewEvent
): DenueAnalyticalReviewValidation {
  const reasons: DenueAnalyticalReviewReason[] = [];
  if (!validateDenueAnalyticalRelation(relation).valid) reasons.push("RELATION_BASE_INVALID");
  if (!event || typeof event !== "object") return { valid: false, reasons: ["EVENT_REQUIRED"] };
  if (!present(event.eventId)) reasons.push("EVENT_ID_REQUIRED");
  if (event.relationId !== relation.relationId) reasons.push("RELATION_ID_MISMATCH");
  if (event.expedienteId !== relation.expedienteId) reasons.push("EXPEDIENTE_ID_MISMATCH");
  if (event.geographyId !== relation.geographyId) reasons.push("GEOGRAPHY_ID_MISMATCH");
  if (event.methodologyVersion !== relation.methodologyVersion) reasons.push("METHODOLOGY_VERSION_MISMATCH");
  if (event.relationFingerprint !== fingerprintDenueAnalyticalRelation(relation)) reasons.push("RELATION_FINGERPRINT_MISMATCH");
  if (event.previousStatus !== relation.humanValidation.status) reasons.push("PREVIOUS_STATUS_MISMATCH");
  if (!present(event.reviewedBy)) reasons.push("REVIEWED_BY_REQUIRED");
  else if (RESERVED_REVIEWER_IDENTITIES.has(event.reviewedBy.trim().toUpperCase())) reasons.push("REVIEWER_IDENTITY_RESERVED");
  if (!validIsoDate(event.reviewedAt)) reasons.push("REVIEWED_AT_INVALID");
  if (!present(event.rationale)) reasons.push("RATIONALE_REQUIRED");
  if (present(event.eventId) && event.eventId !== expectedEventId(event)) reasons.push("EVENT_ID_MISMATCH");
  reasons.push(...validateDenueAnalyticalReviewTransition(event.previousStatus, event.nextStatus).reasons);
  const normalized = uniqueSorted(reasons);
  return { valid: normalized.length === 0, reasons: normalized };
}

export function applyDenueAnalyticalReviewEvent(
  relation: DenueAnalyticalRelation,
  event: DenueAnalyticalReviewEvent
): DenueAnalyticalReviewApplicationResult {
  const validation = validateDenueAnalyticalReviewEvent(relation, event);
  if (!validation.valid) return { status: "REJECTED", relation: null, event, reasons: validation.reasons };

  const reviewed: DenueAnalyticalRelation = normalizeDenueAnalyticalRelation({
    ...relation,
    humanValidation: {
      status: event.nextStatus,
      validatedBy: event.reviewedBy,
      validatedAt: event.reviewedAt,
      rationale: event.rationale,
    },
    publicationEligibility: "INELIGIBLE",
  });
  if (!validateDenueAnalyticalRelation(reviewed).valid) {
    return { status: "REJECTED", relation: null, event, reasons: ["RESULTING_RELATION_INVALID"] };
  }
  return { status: "APPLIED", relation: reviewed, event, reasons: [] };
}

function compareEvents(left: DenueAnalyticalReviewEvent, right: DenueAnalyticalReviewEvent): number {
  return left.reviewedAt.localeCompare(right.reviewedAt) || left.eventId.localeCompare(right.eventId);
}

function sameEvent(left: DenueAnalyticalReviewEvent, right: DenueAnalyticalReviewEvent): boolean {
  return canonicalString(left) === canonicalString(right);
}

function immutableLedger(
  relation: DenueAnalyticalRelation,
  events: DenueAnalyticalReviewEvent[]
): DenueAnalyticalReviewLedger {
  const frozenEvents = Object.freeze(events.map((event) => Object.freeze({ ...event })));
  return Object.freeze({
    relationId: relation.relationId,
    expedienteId: relation.expedienteId,
    geographyId: relation.geographyId,
    methodologyVersion: relation.methodologyVersion,
    relationFingerprint: fingerprintDenueAnalyticalRelation(relation),
    events: frozenEvents,
  });
}

export function createDenueAnalyticalReviewLedger(
  relation: DenueAnalyticalRelation
): DenueAnalyticalReviewLedgerResult {
  const validation = validateDenueAnalyticalRelation(relation);
  const reasons: DenueAnalyticalReviewReason[] = [];
  if (!validation.valid) reasons.push("RELATION_BASE_INVALID");
  if (relation.humanValidation.status !== "PENDING") reasons.push("BASE_RELATION_NOT_PENDING");
  if (relation.publicationEligibility !== "INELIGIBLE") reasons.push("BASE_RELATION_NOT_INELIGIBLE");
  if (reasons.length > 0) return { status: "REJECTED", ledger: null, relation: null, reasons: uniqueSorted(reasons) };
  return { status: "VALID", ledger: immutableLedger(relation, []), relation: normalizeDenueAnalyticalRelation(relation), reasons: [] };
}

export function validateDenueAnalyticalReviewLedger(
  baseRelation: DenueAnalyticalRelation,
  ledger: DenueAnalyticalReviewLedger
): DenueAnalyticalReviewLedgerResult {
  const base = createDenueAnalyticalReviewLedger(baseRelation);
  if (base.status === "REJECTED") return base;
  const reasons: DenueAnalyticalReviewReason[] = [];
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.events)) {
    return { status: "REJECTED", ledger: null, relation: null, reasons: ["LEDGER_REQUIRED"] };
  }
  if (ledger.relationId !== baseRelation.relationId) reasons.push("LEDGER_RELATION_ID_MISMATCH");
  if (ledger.expedienteId !== baseRelation.expedienteId) reasons.push("LEDGER_EXPEDIENTE_ID_MISMATCH");
  if (ledger.geographyId !== baseRelation.geographyId) reasons.push("LEDGER_GEOGRAPHY_ID_MISMATCH");
  if (ledger.methodologyVersion !== baseRelation.methodologyVersion) reasons.push("LEDGER_METHODOLOGY_VERSION_MISMATCH");
  if (ledger.relationFingerprint !== fingerprintDenueAnalyticalRelation(baseRelation)) reasons.push("LEDGER_FINGERPRINT_MISMATCH");

  const eventsById = new Map<string, DenueAnalyticalReviewEvent>();
  for (const event of ledger.events) {
    const existing = eventsById.get(event.eventId);
    if (!existing) eventsById.set(event.eventId, event);
    else if (!sameEvent(existing, event)) reasons.push("EVENT_ID_CONFLICT");
  }
  if (reasons.length > 0) return { status: "REJECTED", ledger: null, relation: null, reasons: uniqueSorted(reasons) };

  const events = Array.from(eventsById.values()).sort(compareEvents);
  let current = normalizeDenueAnalyticalRelation(baseRelation);
  for (const event of events) {
    const applied = applyDenueAnalyticalReviewEvent(current, event);
    if (applied.status === "REJECTED") {
      return {
        status: "REJECTED",
        ledger: null,
        relation: null,
        reasons: uniqueSorted(["HISTORY_INCONSISTENT", ...applied.reasons]),
      };
    }
    current = applied.relation;
  }
  return { status: "VALID", ledger: immutableLedger(baseRelation, events), relation: current, reasons: [] };
}

export function appendDenueAnalyticalReviewEvent(
  baseRelation: DenueAnalyticalRelation,
  ledger: DenueAnalyticalReviewLedger,
  event: DenueAnalyticalReviewEvent
): DenueAnalyticalReviewLedgerResult {
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.events)) {
    return { status: "REJECTED", ledger: null, relation: null, reasons: ["LEDGER_REQUIRED"] };
  }
  return validateDenueAnalyticalReviewLedger(baseRelation, {
    ...ledger,
    events: [...ledger.events, event],
  });
}
