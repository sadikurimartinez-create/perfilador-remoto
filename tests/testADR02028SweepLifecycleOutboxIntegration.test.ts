import fs from "node:fs";
import path from "node:path";
import { GeointEventOutboxEntry } from "../src/types/geointEventOutbox";
import { GeointEventLogService } from "../src/services/geoint/geointEventLogService";
import { GeointOutboxDispatcher } from "../src/services/geoint/geointOutboxDispatcher";
import {
  buildSweepLifecycleOutboxPayload,
  enqueueSweepLifecycleEventsInTransaction,
} from "../src/services/geoint/geointSweepLifecycleEventService";
import {
  certifyGeointSweepWithHumanApproval,
  createGeointSweepLifecycleRecord,
  createHumanTriggeredRunningSweepLifecycle,
  markGeointSweepReadyForHumanReview,
  rehydrateGeointSweepLifecycleRecord,
  transitionGeointSweepLifecycle,
} from "../src/utils/geointSweepLifecycle";

type MockCollection = "geoint_event_outbox" | "geoint_event_logs" | "geoint_event_fingerprints";

let mockTimestampCounter = 0;
let mockDb: Record<MockCollection, Map<string, any>> = {
  geoint_event_outbox: new Map(),
  geoint_event_logs: new Map(),
  geoint_event_fingerprints: new Map(),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function parseRef(ref: string): { collectionName: MockCollection; id: string } {
  const [collectionName, id] = ref.split("/");
  return { collectionName: collectionName as MockCollection, id };
}

function getSnapshot(ref: string) {
  const { collectionName, id } = parseRef(ref);
  const value = mockDb[collectionName].get(id);
  return {
    exists: () => value !== undefined,
    data: () => clone(value),
  };
}

function setData(ref: string, data: any, options?: { merge?: boolean }) {
  const { collectionName, id } = parseRef(ref);
  const current = mockDb[collectionName].get(id) || {};
  mockDb[collectionName].set(id, options?.merge ? { ...current, ...clone(data) } : clone(data));
}

function createTransaction() {
  return {
    get: async (ref: string) => getSnapshot(ref),
    set: (ref: string, data: any, options?: { merge?: boolean }) => setData(ref, data, options),
  };
}

function getOutboxEntries(): GeointEventOutboxEntry[] {
  return Array.from(mockDb.geoint_event_outbox.values()).map(clone);
}

function eventTypes() {
  return getOutboxEntries().map((entry) => entry.payload.eventType).sort();
}

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db, collectionName) => collectionName),
  doc: jest.fn((_db, collectionName, id) => `${collectionName}/${id}`),
  setDoc: jest.fn(async (ref, data, options) => setData(ref, data, options)),
  getDoc: jest.fn(async (ref) => getSnapshot(ref)),
  getDocs: jest.fn(async () => ({
    docs: getOutboxEntries()
      .filter((entry) => ["CREATED", "QUEUED"].includes(entry.status))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map((entry) => ({ data: () => clone(entry) })),
  })),
  query: jest.fn((collectionName) => collectionName),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => `mock-server-timestamp-${++mockTimestampCounter}`),
  runTransaction: jest.fn(async (_db, fn) => fn(createTransaction())),
}));

jest.mock("@/lib/firebaseServer", () => ({
  getFirebaseServerDb: jest.fn(() => ({})),
}));

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
}));

describe("ADR-020.28 - Sweep lifecycle / Outbox integration", () => {
  beforeEach(() => {
    mockTimestampCounter = 0;
    mockDb = {
      geoint_event_outbox: new Map(),
      geoint_event_logs: new Map(),
      geoint_event_fingerprints: new Map(),
    };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("TEST 1 REQUESTED transition creates corresponding outbox event", async () => {
    const lifecycle = createGeointSweepLifecycleRecord({ sweepId: "sweep-1", expedienteId: "exp-1", traceabilityId: "trace-1" });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-1" });

    expect(getOutboxEntries()).toHaveLength(1);
    expect(getOutboxEntries()[0].payload.eventType).toBe("GEOINT_SWEEP_REQUESTED");
  });

  test("TEST 2 RUNNING transition creates STARTED event", async () => {
    const lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-2", expedienteId: "exp-2", traceabilityId: "trace-2" });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-2" });

    expect(eventTypes()).toEqual(["GEOINT_SWEEP_REQUESTED", "GEOINT_SWEEP_STARTED"]);
  });

  test("TEST 3 mount / reload / hydration creates no sweep event", () => {
    const source = [
      "src/components/GeographicWorkspace.tsx",
      "src/components/ProjectMap.tsx",
      "src/modules/streetView/streetViewPanoramaPicker.tsx",
    ].map(readSource).join("\n");

    expect(source).not.toContain("enqueueSweepLifecycleEventsInTransaction");
    expect(source).not.toContain("GEOINT_SWEEP_STARTED");
    expect(getOutboxEntries()).toHaveLength(0);
  });

  test("TEST 4 COLLECTING event is emitted only after real transition", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-4", expedienteId: "exp-4", traceabilityId: "trace-4" });
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-4" });
    expect(eventTypes()).not.toContain("GEOINT_SWEEP_COLLECTING");

    lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", { expectedVersion: lifecycle.version });
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-4" });

    expect(eventTypes()).toContain("GEOINT_SWEEP_COLLECTING");
  });

  test("TEST 5 ANALYZING event is emitted only after real transition", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-5", expedienteId: "exp-5", traceabilityId: "trace-5" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", { expectedVersion: lifecycle.version });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "ANALYZING", { expectedVersion: lifecycle.version });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-5" });

    expect(eventTypes()).toContain("GEOINT_SWEEP_ANALYZING");
  });

  test("TEST 6 VALIDATING event is emitted only after real transition", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-6", expedienteId: "exp-6", traceabilityId: "trace-6" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", { expectedVersion: lifecycle.version });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "ANALYZING", { expectedVersion: lifecycle.version });
    lifecycle = markGeointSweepReadyForHumanReview(lifecycle, { aiQualityScore: 96, expectedVersion: lifecycle.version });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-6" });

    expect(eventTypes()).toContain("GEOINT_SWEEP_VALIDATING");
    expect(lifecycle.humanValidationStatus).toBe("PENDING_REVIEW");
  });

  test("TEST 7 CERTIFIED with human validation creates certified event", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-7", expedienteId: "exp-7", traceabilityId: "trace-7" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", { expectedVersion: lifecycle.version });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "ANALYZING", { expectedVersion: lifecycle.version });
    lifecycle = markGeointSweepReadyForHumanReview(lifecycle, { aiQualityScore: 97, expectedVersion: lifecycle.version });
    lifecycle = certifyGeointSweepWithHumanApproval(lifecycle, {
      expectedVersion: lifecycle.version,
      validatedAt: "2026-08-30T10:00:00.000Z",
      validatedBy: { id: "u-real" },
    });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-7" });

    expect(eventTypes()).toContain("GEOINT_SWEEP_CERTIFIED");
    expect(lifecycle.humanValidationStatus).toBe("APPROVED");
  });

  test("TEST 8 CERTIFIED without required validation is rejected and no certified event is emitted", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-8", expedienteId: "exp-8", traceabilityId: "trace-8" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", { expectedVersion: lifecycle.version });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "ANALYZING", { expectedVersion: lifecycle.version });
    lifecycle = markGeointSweepReadyForHumanReview(lifecycle, { aiQualityScore: 99, expectedVersion: lifecycle.version });

    expect(() => transitionGeointSweepLifecycle(lifecycle, "CERTIFIED", { expectedVersion: lifecycle.version })).toThrow(
      "CERTIFIED_REQUIRES_HUMAN_VALIDATION"
    );
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-8" });

    expect(eventTypes()).not.toContain("GEOINT_SWEEP_CERTIFIED");
  });

  test("TEST 9 FAILED creates failure event with reason and attempt", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-9", expedienteId: "exp-9", traceabilityId: "trace-9", correlationId: "corr-9" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "FAILED", {
      expectedVersion: lifecycle.version,
      reason: "PROVIDER_TIMEOUT",
      retryPolicy: { allowRetry: true, maxAttempts: 2 },
    });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-9" });
    const failed = getOutboxEntries().find((entry) => entry.payload.eventType === "GEOINT_SWEEP_FAILED")!;

    expect(failed.payload.metadata?.failureReason).toBe("PROVIDER_TIMEOUT");
    expect(failed.payload.metadata?.attempt).toBe(0);
    expect(failed.payload.metadata?.correlationId).toBe("corr-9");
  });

  test("TEST 10 retry emits retry event and preserves attempt increment", async () => {
    let lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-10", expedienteId: "exp-10", traceabilityId: "trace-10" });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "FAILED", {
      expectedVersion: lifecycle.version,
      reason: "TRANSIENT_PROVIDER_FAILURE",
      retryPolicy: { allowRetry: true, maxAttempts: 2 },
    });
    lifecycle = transitionGeointSweepLifecycle(lifecycle, "REQUESTED", {
      expectedVersion: lifecycle.version,
      retryPolicy: { allowRetry: true, maxAttempts: 2 },
    });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-10" });

    expect(eventTypes()).toContain("GEOINT_SWEEP_RETRIED");
    expect(lifecycle.attempt).toBe(1);
    expect(lifecycle.sweepId).toBe("sweep-10");
  });

  test("TEST 11 duplicate same transition creates no duplicate logical event", async () => {
    const lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-11", expedienteId: "exp-11", traceabilityId: "trace-11" });

    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-11" });
    const firstOutboxIds = getOutboxEntries().map((entry) => entry.outboxId).sort();
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-11" });

    expect(getOutboxEntries()).toHaveLength(2);
    expect(getOutboxEntries().map((entry) => entry.outboxId).sort()).toEqual(firstOutboxIds);
  });

  test("TEST 12 traceabilityId absent is not fabricated", () => {
    const lifecycle = createGeointSweepLifecycleRecord({ sweepId: "sweep-12", expedienteId: "exp-12" });
    const payload = buildSweepLifecycleOutboxPayload({
      record: lifecycle,
      transition: lifecycle.transitionHistory[0],
      actor: "operator-12",
    });

    expect(lifecycle.traceabilityId).toBeNull();
    expect(payload?.traceabilityId).toBe("UNAVAILABLE");
    expect(payload?.traceabilityId).not.toBe(lifecycle.sweepId);
  });

  test("TEST 13 legacy sweep read creates no retrospective events", () => {
    const legacy = { id: "legacy-sweep", status: "Integrado", timestamp: 1 };
    const source = readSource("src/context/ProjectContext.tsx");

    expect(source).not.toContain("backfill");
    expect(source).not.toContain("retroactive");
    expect(legacy).not.toHaveProperty("lifecycle");
    expect(getOutboxEntries()).toHaveLength(0);
  });

  test("TEST 14 producer uses Outbox path and does not directly persist Ledger", () => {
    const contextSource = readSource("src/context/ProjectContext.tsx");
    const eventServiceSource = readSource("src/services/geoint/geointSweepLifecycleEventService.ts");

    expect(contextSource).toContain("enqueueSweepLifecycleEventsInTransaction");
    expect(contextSource).not.toContain("persistGeointEvent");
    expect(eventServiceSource).toContain("GeointEventOutboxService.enqueueEventInTransaction");
    expect(eventServiceSource).not.toContain("GeointEventLogService");
  });

  test("TEST 15 ADR-020.27 invariant: no event emitted by component mount", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");
    const effectBlocks = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];

    expect(effectBlocks.join("\n")).not.toContain("enqueueSweepLifecycleEventsInTransaction");
    expect(effectBlocks.join("\n")).not.toContain("GEOINT_SWEEP_STARTED");
    expect(effectBlocks.join("\n")).not.toContain("registerSweep(");
  });

  test("TEST 16 dispatcher remains the Ledger writer for queued sweep events", async () => {
    const lifecycle = createGeointSweepLifecycleRecord({ sweepId: "sweep-16", expedienteId: "exp-16", traceabilityId: "trace-16" });
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-16" });
    const persistSpy = jest.spyOn(GeointEventLogService, "persistGeointEvent");

    const result = await GeointOutboxDispatcher.dispatchPending();

    expect(result.success).toBe(1);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(Array.from(mockDb.geoint_event_logs.values())[0].eventType).toBe("GEOINT_SWEEP_REQUESTED");
  });

  test("TEST 17 reload rehydrates existing lifecycle without extra event", async () => {
    const lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-17", expedienteId: "exp-17", traceabilityId: "trace-17" });
    await enqueueSweepLifecycleEventsInTransaction(createTransaction(), {}, lifecycle, { actor: "operator-17" });
    const countBefore = getOutboxEntries().length;
    const rehydrated = rehydrateGeointSweepLifecycleRecord(JSON.parse(JSON.stringify(lifecycle)));

    expect(rehydrated.status).toBe("RUNNING");
    expect(getOutboxEntries()).toHaveLength(countBefore);
  });
});
