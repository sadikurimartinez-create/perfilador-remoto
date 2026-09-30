import {
  collection,
  doc,
  getDocs,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { makeFirestoreSafe } from "@/utils/firestoreSafe";
import {
  normalizeDenueAnalyticalRelation,
  validateDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
  type DenueHumanValidation,
} from "@/utils/denueAnalyticalRelation";
import {
  createDenueAnalyticalReviewLedger,
  fingerprintDenueAnalyticalRelation,
  validateDenueAnalyticalReviewEvent,
  validateDenueAnalyticalReviewLedger,
  type DenueAnalyticalReviewEvent,
  type DenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";

const SCHEMA_VERSION = "ADR-026:DENUE_ANALYTICAL_WORKFLOW:v1";
const RELATIONS_COLLECTION = "denueAnalyticalRelations";
const REVIEW_EVENTS_COLLECTION = "denueAnalyticalReviewEvents";

interface PersistedRelationDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  relation: DenueAnalyticalRelation;
  relationFingerprint: string;
  reviewHead: DenueHumanValidation;
  reviewEventCount: number;
  latestReviewEventId: string | null;
}

export interface DenueAnalyticalWorkflowSnapshot {
  relations: DenueAnalyticalRelation[];
  reviewLedgers: DenueAnalyticalReviewLedger[];
}

export interface DenueAnalyticalWorkflowRepository {
  load(projectId: string): Promise<DenueAnalyticalWorkflowSnapshot>;
  saveRelations(projectId: string, relations: readonly DenueAnalyticalRelation[]): Promise<DenueAnalyticalWorkflowSnapshot>;
  appendReviewEvent(projectId: string, event: DenueAnalyticalReviewEvent): Promise<DenueAnalyticalWorkflowSnapshot>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertProjectId(projectId: string): void {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new Error("DENUE_ANALYTICAL_WORKFLOW_PROJECT_ID_REQUIRED");
  }
}

function canonicalRelation(relation: DenueAnalyticalRelation): DenueAnalyticalRelation {
  const validation = validateDenueAnalyticalRelation(relation);
  if (!validation.valid) {
    throw new Error(`DENUE_ANALYTICAL_RELATION_INVALID:${validation.reasons.join(",")}`);
  }
  if (relation.humanValidation.status !== "PENDING") {
    throw new Error("DENUE_ANALYTICAL_BASE_RELATION_MUST_BE_PENDING");
  }
  if (relation.publicationEligibility !== "INELIGIBLE") {
    throw new Error("DENUE_ANALYTICAL_BASE_RELATION_MUST_BE_INELIGIBLE");
  }
  return normalizeDenueAnalyticalRelation(clone(relation));
}

function canonicalRelationsForProject(
  projectId: string,
  relations: readonly DenueAnalyticalRelation[]
): DenueAnalyticalRelation[] {
  assertProjectId(projectId);
  const canonical = relations.map(canonicalRelation);
  const ids = new Set<string>();
  for (const relation of canonical) {
    if (relation.expedienteId !== projectId) {
      throw new Error("DENUE_ANALYTICAL_RELATION_PROJECT_MISMATCH");
    }
    if (ids.has(relation.relationId)) {
      throw new Error("DENUE_ANALYTICAL_RELATION_ID_DUPLICATE");
    }
    ids.add(relation.relationId);
  }
  return canonical.sort((left, right) => left.relationId.localeCompare(right.relationId));
}

function relationDocument(relation: DenueAnalyticalRelation): PersistedRelationDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    relation,
    relationFingerprint: fingerprintDenueAnalyticalRelation(relation),
    reviewHead: { ...relation.humanValidation },
    reviewEventCount: 0,
    latestReviewEventId: null,
  };
}

function decodeRelationDocument(value: unknown): PersistedRelationDocument {
  const record = value as Partial<PersistedRelationDocument> | null;
  if (!record || record.schemaVersion !== SCHEMA_VERSION || !record.relation) {
    throw new Error("DENUE_ANALYTICAL_RELATION_DOCUMENT_INVALID");
  }
  const relation = canonicalRelation(record.relation);
  const fingerprint = fingerprintDenueAnalyticalRelation(relation);
  if (record.relationFingerprint !== fingerprint) {
    throw new Error("DENUE_ANALYTICAL_RELATION_DOCUMENT_FINGERPRINT_MISMATCH");
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    relation,
    relationFingerprint: fingerprint,
    reviewHead: record.reviewHead || relation.humanValidation,
    reviewEventCount: Number.isInteger(record.reviewEventCount) ? Number(record.reviewEventCount) : 0,
    latestReviewEventId: typeof record.latestReviewEventId === "string" ? record.latestReviewEventId : null,
  };
}

function currentRelationFromDocument(document: PersistedRelationDocument): DenueAnalyticalRelation {
  return normalizeDenueAnalyticalRelation({
    ...document.relation,
    humanValidation: { ...document.reviewHead },
    publicationEligibility: "INELIGIBLE",
  });
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hydrateDenueAnalyticalWorkflow(
  projectId: string,
  relations: readonly DenueAnalyticalRelation[],
  events: readonly DenueAnalyticalReviewEvent[]
): DenueAnalyticalWorkflowSnapshot {
  const baseRelations = canonicalRelationsForProject(projectId, relations);
  const relationIds = new Set(baseRelations.map((relation) => relation.relationId));
  const eventsByRelation = new Map<string, DenueAnalyticalReviewEvent[]>();

  for (const event of clone(events)) {
    if (event.expedienteId !== projectId || !relationIds.has(event.relationId)) {
      throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_ORPHANED");
    }
    const relationEvents = eventsByRelation.get(event.relationId) || [];
    relationEvents.push(event);
    eventsByRelation.set(event.relationId, relationEvents);
  }

  const currentRelations: DenueAnalyticalRelation[] = [];
  const reviewLedgers: DenueAnalyticalReviewLedger[] = [];
  for (const baseRelation of baseRelations) {
    const emptyLedger = createDenueAnalyticalReviewLedger(baseRelation);
    if (emptyLedger.status !== "VALID") {
      throw new Error(`DENUE_ANALYTICAL_LEDGER_BASE_INVALID:${emptyLedger.reasons.join(",")}`);
    }
    const validated = validateDenueAnalyticalReviewLedger(baseRelation, {
      ...emptyLedger.ledger,
      events: eventsByRelation.get(baseRelation.relationId) || [],
    });
    if (validated.status !== "VALID") {
      throw new Error(`DENUE_ANALYTICAL_LEDGER_INVALID:${validated.reasons.join(",")}`);
    }
    currentRelations.push(clone(validated.relation));
    reviewLedgers.push(clone(validated.ledger));
  }

  return {
    relations: currentRelations,
    reviewLedgers,
  };
}

function relationCollection(db: Firestore, projectId: string) {
  return collection(db, "projects", projectId, RELATIONS_COLLECTION);
}

function relationRef(db: Firestore, projectId: string, relationId: string) {
  return doc(db, "projects", projectId, RELATIONS_COLLECTION, relationId);
}

function reviewEventCollection(db: Firestore, projectId: string) {
  return collection(db, "projects", projectId, REVIEW_EVENTS_COLLECTION);
}

function reviewEventRef(db: Firestore, projectId: string, eventId: string) {
  return doc(db, "projects", projectId, REVIEW_EVENTS_COLLECTION, eventId);
}

export class FirestoreDenueAnalyticalWorkflowRepository implements DenueAnalyticalWorkflowRepository {
  constructor(private readonly db: Firestore = getDb()) {}

  async load(projectId: string): Promise<DenueAnalyticalWorkflowSnapshot> {
    assertProjectId(projectId);
    const [relationSnapshot, eventSnapshot] = await Promise.all([
      getDocs(relationCollection(this.db, projectId)),
      getDocs(reviewEventCollection(this.db, projectId)),
    ]);
    const relations = relationSnapshot.docs.map((snapshot) => {
      const document = decodeRelationDocument(snapshot.data());
      if (snapshot.id !== document.relation.relationId) {
        throw new Error("DENUE_ANALYTICAL_RELATION_DOCUMENT_ID_MISMATCH");
      }
      return document.relation;
    });
    const events = eventSnapshot.docs.map((snapshot) => {
      const event = snapshot.data() as DenueAnalyticalReviewEvent;
      if (snapshot.id !== event.eventId) {
        throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_DOCUMENT_ID_MISMATCH");
      }
      return event;
    });
    return hydrateDenueAnalyticalWorkflow(projectId, relations, events);
  }

  async saveRelations(
    projectId: string,
    relations: readonly DenueAnalyticalRelation[]
  ): Promise<DenueAnalyticalWorkflowSnapshot> {
    const canonical = canonicalRelationsForProject(projectId, relations);
    await runTransaction(this.db, async (transaction) => {
      const refs = canonical.map((relation) => relationRef(this.db, projectId, relation.relationId));
      const snapshots = await Promise.all(refs.map((reference) => transaction.get(reference)));
      snapshots.forEach((snapshot, index) => {
        const next = relationDocument(canonical[index]);
        if (snapshot.exists()) {
          const existing = decodeRelationDocument(snapshot.data());
          if (!sameValue(existing.relation, next.relation)) {
            throw new Error("DENUE_ANALYTICAL_RELATION_IMMUTABLE_CONFLICT");
          }
          return;
        }
        transaction.set(refs[index], makeFirestoreSafe(next));
      });
    });
    return this.load(projectId);
  }

  async appendReviewEvent(
    projectId: string,
    event: DenueAnalyticalReviewEvent
  ): Promise<DenueAnalyticalWorkflowSnapshot> {
    assertProjectId(projectId);
    if (event.expedienteId !== projectId) {
      throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_PROJECT_MISMATCH");
    }
    const baseRef = relationRef(this.db, projectId, event.relationId);
    const eventRef = reviewEventRef(this.db, projectId, event.eventId);

    await runTransaction(this.db, async (transaction) => {
      const [baseSnapshot, existingEventSnapshot] = await Promise.all([
        transaction.get(baseRef),
        transaction.get(eventRef),
      ]);
      if (!baseSnapshot.exists()) {
        throw new Error("DENUE_ANALYTICAL_REVIEW_RELATION_NOT_FOUND");
      }
      if (existingEventSnapshot.exists()) {
        if (!sameValue(existingEventSnapshot.data(), event)) {
          throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_ID_CONFLICT");
        }
        return;
      }

      const persisted = decodeRelationDocument(baseSnapshot.data());
      const currentRelation = currentRelationFromDocument(persisted);
      const validation = validateDenueAnalyticalReviewEvent(currentRelation, event);
      if (!validation.valid) {
        throw new Error(`DENUE_ANALYTICAL_REVIEW_EVENT_INVALID:${validation.reasons.join(",")}`);
      }
      const nextHead: DenueHumanValidation = {
        status: event.nextStatus,
        validatedBy: event.reviewedBy,
        validatedAt: event.reviewedAt,
        rationale: event.rationale,
      };
      transaction.set(eventRef, makeFirestoreSafe(clone(event)));
      transaction.update(baseRef, makeFirestoreSafe({
        reviewHead: nextHead,
        reviewEventCount: persisted.reviewEventCount + 1,
        latestReviewEventId: event.eventId,
      }));
    });
    return this.load(projectId);
  }
}

export class InMemoryDenueAnalyticalWorkflowRepository implements DenueAnalyticalWorkflowRepository {
  private readonly relations = new Map<string, Map<string, PersistedRelationDocument>>();
  private readonly events = new Map<string, Map<string, DenueAnalyticalReviewEvent>>();

  async load(projectId: string): Promise<DenueAnalyticalWorkflowSnapshot> {
    assertProjectId(projectId);
    const relations = Array.from(this.relations.get(projectId)?.values() || []).map((item) => item.relation);
    const events = Array.from(this.events.get(projectId)?.values() || []);
    return hydrateDenueAnalyticalWorkflow(projectId, relations, events);
  }

  async saveRelations(
    projectId: string,
    relations: readonly DenueAnalyticalRelation[]
  ): Promise<DenueAnalyticalWorkflowSnapshot> {
    const canonical = canonicalRelationsForProject(projectId, relations);
    const projectRelations = this.relations.get(projectId) || new Map<string, PersistedRelationDocument>();
    for (const relation of canonical) {
      const next = relationDocument(relation);
      const existing = projectRelations.get(relation.relationId);
      if (existing && !sameValue(existing.relation, next.relation)) {
        throw new Error("DENUE_ANALYTICAL_RELATION_IMMUTABLE_CONFLICT");
      }
      if (!existing) projectRelations.set(relation.relationId, clone(next));
    }
    this.relations.set(projectId, projectRelations);
    return this.load(projectId);
  }

  async appendReviewEvent(
    projectId: string,
    event: DenueAnalyticalReviewEvent
  ): Promise<DenueAnalyticalWorkflowSnapshot> {
    assertProjectId(projectId);
    if (event.expedienteId !== projectId) {
      throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_PROJECT_MISMATCH");
    }
    const persisted = this.relations.get(projectId)?.get(event.relationId);
    if (!persisted) throw new Error("DENUE_ANALYTICAL_REVIEW_RELATION_NOT_FOUND");
    const projectEvents = this.events.get(projectId) || new Map<string, DenueAnalyticalReviewEvent>();
    const existing = projectEvents.get(event.eventId);
    if (existing) {
      if (!sameValue(existing, event)) throw new Error("DENUE_ANALYTICAL_REVIEW_EVENT_ID_CONFLICT");
      return this.load(projectId);
    }
    const currentRelation = currentRelationFromDocument(persisted);
    const validation = validateDenueAnalyticalReviewEvent(currentRelation, event);
    if (!validation.valid) {
      throw new Error(`DENUE_ANALYTICAL_REVIEW_EVENT_INVALID:${validation.reasons.join(",")}`);
    }
    projectEvents.set(event.eventId, clone(event));
    this.events.set(projectId, projectEvents);
    persisted.reviewHead = {
      status: event.nextStatus,
      validatedBy: event.reviewedBy,
      validatedAt: event.reviewedAt,
      rationale: event.rationale,
    };
    persisted.reviewEventCount += 1;
    persisted.latestReviewEventId = event.eventId;
    return this.load(projectId);
  }
}

let defaultRepository: DenueAnalyticalWorkflowRepository | null = null;

function repository(): DenueAnalyticalWorkflowRepository {
  if (!defaultRepository) defaultRepository = new FirestoreDenueAnalyticalWorkflowRepository();
  return defaultRepository;
}

export function loadDenueAnalyticalWorkflow(projectId: string) {
  return repository().load(projectId);
}

export function saveDenueAnalyticalRelations(projectId: string, relations: readonly DenueAnalyticalRelation[]) {
  return repository().saveRelations(projectId, relations);
}

export function appendDenueAnalyticalReviewEvent(projectId: string, event: DenueAnalyticalReviewEvent) {
  return repository().appendReviewEvent(projectId, event);
}
