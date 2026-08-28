import fs from "fs";
import path from "path";
import { GeointEventOutboxService } from "../src/services/geoint/geointEventOutboxService";
import { GeointOutboxDispatcher } from "../src/services/geoint/geointOutboxDispatcher";
import { GeointEventLogService } from "../src/services/geoint/geointEventLogService";
import { POST as dispatchOutbox } from "../src/app/api/geoint/events/outbox/dispatch/route";
import { GeointEventOutboxEntry } from "../src/types/geointEventOutbox";

type MockCollection = "geoint_event_outbox" | "geoint_event_logs" | "geoint_event_fingerprints";

let mockTimestampCounter = 0;
let mockTransactionQueue = Promise.resolve();
let mockSessionPayload: any = { username: "admin", role: "ADMIN" };
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

async function enqueueOperationalEvent(id: string, metadata: Record<string, any> = {}) {
  return GeointEventOutboxService.enqueueEvent(
    "TEMPORAL_COMPARISON_CREATED",
    `EXP-${id}`,
    `TRACE-${id}`,
    "ANALYST",
    "ADR-019.19-2C",
    "INITIATED",
    "TEMPORAL_COMPARISON",
    `CMP-${id}`,
    metadata
  );
}

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => ({ value: "signed-session" })),
  })),
}));

jest.mock("@/utils/authCrypto", () => ({
  verifySession: jest.fn(() => mockSessionPayload),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status || 200,
      async json() {
        return body;
      },
    }),
  },
}));

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

describe("ADR-019.19 FASE 2C: Dispatcher operacional y recuperacion", () => {
  beforeEach(() => {
    mockTimestampCounter = 0;
    mockTransactionQueue = Promise.resolve();
    mockSessionPayload = { username: "admin", role: "ADMIN" };
    mockDb = {
      geoint_event_outbox: new Map(),
      geoint_event_logs: new Map(),
      geoint_event_fingerprints: new Map(),
    };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("TEST 1 - EJECUCION OPERACIONAL: endpoint protegido procesa Outbox pendiente", async () => {
    await enqueueOperationalEvent("OPERATIONAL");

    const response = await dispatchOutbox();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("DISPATCH_COMPLETED");
    expect(body.result.candidates).toBe(1);
    expect(body.result.processed).toBe(1);
    expect(body.result.completed).toBe(1);
    expect(body.result.retryable).toBe(0);
    expect(body.result.failedTerminal).toBe(0);
    expect(body.result.skipped).toBe(0);
    expect(mockDb.geoint_event_logs.size).toBe(1);
    expect(getOnlyOutboxEntry().status).toBe("COMPLETED");
  });

  test("TEST 2 - CONCURRENCIA OPERACIONAL: doble ejecucion no duplica Ledger", async () => {
    await enqueueOperationalEvent("CONCURRENT");
    const persistSpy = jest.spyOn(GeointEventLogService, "persistGeointEvent");

    await Promise.all([dispatchOutbox(), dispatchOutbox()]);

    expect(mockDb.geoint_event_logs.size).toBe(1);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(getOnlyOutboxEntry().status).toBe("COMPLETED");
  });

  test("TEST 3 - RECUPERACION: QUEUED se recupera en ejecucion posterior", async () => {
    await enqueueOperationalEvent("RECOVERY", { shouldFailForTest: true });

    const first = await GeointOutboxDispatcher.dispatchPending();
    expect(first.retryable).toBe(1);
    expect(getOnlyOutboxEntry().status).toBe("QUEUED");

    const queued = getOnlyOutboxEntry();
    queued.payload.metadata = {};
    mockDb.geoint_event_outbox.set(queued.outboxId, queued);

    const second = await GeointOutboxDispatcher.dispatchPending();

    expect(second.completed).toBe(1);
    expect(mockDb.geoint_event_logs.size).toBe(1);
    expect(getOnlyOutboxEntry().status).toBe("COMPLETED");
  });

  test("TEST 4 - FAILED TERMINAL: no se procesa automaticamente", async () => {
    await enqueueOperationalEvent("FAILED", { shouldFailForTest: true });

    await GeointOutboxDispatcher.dispatchPending();
    await GeointOutboxDispatcher.dispatchPending();
    await GeointOutboxDispatcher.dispatchPending();
    const terminal = getOnlyOutboxEntry();
    expect(terminal.status).toBe("FAILED");

    const afterTerminal = await GeointOutboxDispatcher.dispatchPending();

    expect(afterTerminal.candidates).toBe(0);
    expect(afterTerminal.processed).toBe(0);
    expect(mockDb.geoint_event_logs.size).toBe(0);
    expect(getOnlyOutboxEntry().status).toBe("FAILED");
  });

  test("TEST 5 - COMPLETED: no se reprocesa", async () => {
    await enqueueOperationalEvent("COMPLETED");
    await GeointOutboxDispatcher.dispatchPending();
    const persistSpy = jest.spyOn(GeointEventLogService, "persistGeointEvent");

    const second = await GeointOutboxDispatcher.dispatchPending();

    expect(second.candidates).toBe(0);
    expect(second.processed).toBe(0);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(mockDb.geoint_event_logs.size).toBe(1);
  });

  test("TEST 6 - SIN PENDIENTES: ejecucion vacia es segura y observable", async () => {
    const response = await dispatchOutbox();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result).toMatchObject({
      candidates: 0,
      processed: 0,
      completed: 0,
      retryable: 0,
      failedTerminal: 0,
      skipped: 0,
    });
    expect(mockDb.geoint_event_logs.size).toBe(0);
  });

  test("TEST 7 - INDEPENDENCIA UI: expediente y componentes no invocan dispatcher", () => {
    const root = process.cwd();
    const inspectedFiles = [
      "src/app/project/[id]/page.tsx",
      "src/context/ProjectContext.tsx",
      "src/modules/geoint/GeointControlledSweepEngine.tsx",
    ];

    for (const file of inspectedFiles) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/GeointOutboxDispatcher|dispatchPending\s*\(/);
    }

    expect(getOutboxEntries()).toHaveLength(0);
    expect(mockDb.geoint_event_logs.size).toBe(0);
  });

  test("TEST 8 - SEGURIDAD: la ejecucion publica sin rol admin queda bloqueada", async () => {
    mockSessionPayload = { username: "analyst", role: "USER" };

    await enqueueOperationalEvent("SECURITY");
    const response = await dispatchOutbox();

    expect(response.status).toBe(403);
    expect(getOnlyOutboxEntry().status).toBe("CREATED");
    expect(mockDb.geoint_event_logs.size).toBe(0);
  });
});
