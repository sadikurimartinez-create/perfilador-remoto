import { GeointEventOutboxService } from "../src/services/geoint/geointEventOutboxService";
import { GeointOutboxDispatcher } from "../src/services/geoint/geointOutboxDispatcher";
import { GeointEventLogService } from "../src/services/geoint/geointEventLogService";
import { GeointEventOutboxEntry } from "../src/types/geointEventOutbox";

type MockCollection = "geoint_event_outbox" | "geoint_event_logs" | "geoint_event_fingerprints";

let mockTimestampCounter = 0;
let mockTransactionQueue = Promise.resolve();
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

function getOutboxEntries(): GeointEventOutboxEntry[] {
  return Array.from(mockDb.geoint_event_outbox.values()).map(clone);
}

function getOnlyOutboxEntry(): GeointEventOutboxEntry {
  const entries = getOutboxEntries();
  expect(entries).toHaveLength(1);
  return entries[0];
}

jest.mock("firebase/firestore", () => {
  const getSnapshot = async (ref: string) => {
    const { collectionName, id } = parseRef(ref);
    const value = mockDb[collectionName].get(id);
    return {
      exists: () => value !== undefined,
      data: () => clone(value),
    };
  };

  const setData = (ref: string, data: any, options?: { merge?: boolean }) => {
    const { collectionName, id } = parseRef(ref);
    const current = mockDb[collectionName].get(id) || {};
    mockDb[collectionName].set(id, options?.merge ? { ...current, ...clone(data) } : clone(data));
  };

  return {
    collection: jest.fn((_db, collectionName) => collectionName),
    doc: jest.fn((_db, collectionName, id) => `${collectionName}/${id}`),
    setDoc: jest.fn(async (ref, data, options) => setData(ref, data, options)),
    getDoc: jest.fn(getSnapshot),
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
    runTransaction: jest.fn(async (_db, fn) => {
      const run = mockTransactionQueue.then(() =>
        fn({
          get: getSnapshot,
          set: setData,
        })
      );
      mockTransactionQueue = run.catch(() => undefined);
      return run;
    }),
  };
});

jest.mock("@/lib/firebaseServer", () => ({
  getFirebaseServerDb: jest.fn(() => ({})),
}));

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
}));

describe("ADR-019.19 FASE 2A: Hardening del GEOINT Event Outbox", () => {
  beforeEach(() => {
    mockTimestampCounter = 0;
    mockTransactionQueue = Promise.resolve();
    mockDb = {
      geoint_event_outbox: new Map(),
      geoint_event_logs: new Map(),
      geoint_event_fingerprints: new Map(),
    };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("TEST 1 - ENQUEUE NORMAL: 1 solicitud produce 1 Outbox Entry", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP1",
      "TR1",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID1"
    );

    expect(entry.status).toBe("CREATED");
    expect(entry.retryCount).toBe(0);
    expect(entry.attempts).toBe(0);
    expect(mockDb.geoint_event_outbox.size).toBe(1);
    expect(mockDb.geoint_event_fingerprints.size).toBe(1);
  });

  test("TEST 2 - ENQUEUE IDEMPOTENTE: N solicitudes equivalentes producen 1 Outbox Entry", async () => {
    const requests = Array.from({ length: 5 }).map(() =>
      GeointEventOutboxService.enqueueEvent(
        "TEMPORAL_COMPARISON_CREATED",
        "EXP2",
        "TR2",
        "USR",
        "SRC",
        "INIT",
        "ENT",
        "ID2"
      )
    );

    const entries = await Promise.all(requests);
    expect(new Set(entries.map((entry) => entry.outboxId)).size).toBe(1);
    expect(new Set(entries.map((entry) => entry.eventId)).size).toBe(1);
    expect(mockDb.geoint_event_outbox.size).toBe(1);
  });

  test("TEST 3 - CLAIM UNICO: 2 dispatchers concurrentes no obtienen el mismo claim", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP3",
      "TR3",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID3"
    );

    const [first, second] = await Promise.all([
      GeointEventOutboxService.claimEntry(entry.outboxId, 3, "claim-a"),
      GeointEventOutboxService.claimEntry(entry.outboxId, 3, "claim-b"),
    ]);

    expect([first.claimed, second.claimed].filter(Boolean)).toHaveLength(1);
    expect(getOnlyOutboxEntry().status).toBe("PROCESSING");
    expect(getOnlyOutboxEntry().attempts).toBe(1);
  });

  test("TEST 4 - COMPLETED: CREATED pasa por PROCESSING y termina COMPLETED", async () => {
    await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP4",
      "TR4",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID4"
    );

    const result = await GeointOutboxDispatcher.dispatchPending();
    const entry = getOnlyOutboxEntry();

    expect(result.success).toBe(1);
    expect(entry.status).toBe("COMPLETED");
    expect(entry.attempts).toBe(1);
    expect(entry.completedAt).toBeTruthy();
    expect(mockDb.geoint_event_logs.size).toBe(1);
  });

  test("TEST 5 - RETRY: fallo recuperable vuelve a QUEUED para nuevo intento", async () => {
    await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP5",
      "TR5",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID5",
      { shouldFailForTest: true }
    );

    const result = await GeointOutboxDispatcher.dispatchPending();
    const entry = getOnlyOutboxEntry();

    expect(result.failed).toBe(1);
    expect(entry.status).toBe("QUEUED");
    expect(entry.attempts).toBe(1);
    expect(entry.retryCount).toBe(1);
    expect(entry.lastError).toContain("PROV_ERROR");
  });

  test("TEST 6 - MAX RETRIES: FAILED terminal no vuelve a procesarse", async () => {
    await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP6",
      "TR6",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID6",
      { shouldFailForTest: true }
    );

    await GeointOutboxDispatcher.dispatchPending();
    await GeointOutboxDispatcher.dispatchPending();
    await GeointOutboxDispatcher.dispatchPending();

    const failedEntry = getOnlyOutboxEntry();
    expect(failedEntry.status).toBe("FAILED");
    expect(failedEntry.attempts).toBe(3);
    expect(failedEntry.retryCount).toBe(3);

    const afterTerminal = await GeointOutboxDispatcher.dispatchPending();
    expect(afterTerminal.processed).toBe(0);
    expect(getOnlyOutboxEntry().status).toBe("FAILED");
  });

  test("TEST 7 - POST-LEDGER FAILURE: retry no duplica ni corrompe timestamp original", async () => {
    await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP7",
      "TR7",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID7"
    );

    const persistSpy = jest.spyOn(GeointEventLogService, "persistGeointEvent");
    const originalMarkCompleted = GeointEventOutboxService.markCompleted;
    jest
      .spyOn(GeointEventOutboxService, "markCompleted")
      .mockRejectedValueOnce(new Error("POST_LEDGER_FAILURE"))
      .mockImplementation(originalMarkCompleted);

    await GeointOutboxDispatcher.dispatchPending();

    const ledgerEntry = Array.from(mockDb.geoint_event_logs.values())[0];
    const originalTimestamp = ledgerEntry.timestamp;
    expect(getOnlyOutboxEntry().status).toBe("QUEUED");

    await GeointOutboxDispatcher.dispatchPending();

    expect(mockDb.geoint_event_logs.size).toBe(1);
    expect(Array.from(mockDb.geoint_event_logs.values())[0].timestamp).toBe(originalTimestamp);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(getOnlyOutboxEntry().status).toBe("COMPLETED");
  });

  test("TEST 8 - DOBLE DISPATCHER: dispatchPending concurrente produce una sola persistencia logica", async () => {
    await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP8",
      "TR8",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID8"
    );

    const persistSpy = jest.spyOn(GeointEventLogService, "persistGeointEvent");
    await Promise.all([
      GeointOutboxDispatcher.dispatchPending(),
      GeointOutboxDispatcher.dispatchPending(),
    ]);

    expect(mockDb.geoint_event_logs.size).toBe(1);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(getOnlyOutboxEntry().status).toBe("COMPLETED");
  });

  test("TEST 9 - COMPATIBILIDAD: documento historico sin nuevos campos procesa defensivamente", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent(
      "TEMPORAL_COMPARISON_CREATED",
      "EXP9",
      "TR9",
      "USR",
      "SRC",
      "INIT",
      "ENT",
      "ID9"
    );
    const stored = mockDb.geoint_event_outbox.get(entry.outboxId)!;
    delete stored.attempts;
    delete stored.claimId;
    delete stored.claimedAt;
    delete stored.completedAt;
    delete stored.failedAt;
    delete stored.lastError;
    delete stored.errorMessage;
    mockDb.geoint_event_outbox.set(entry.outboxId, stored);

    const result = await GeointOutboxDispatcher.dispatchPending();
    const processed = getOnlyOutboxEntry();

    expect(result.success).toBe(1);
    expect(processed.status).toBe("COMPLETED");
    expect(processed.attempts).toBe(1);
  });
});
