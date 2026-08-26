import { GeointEventOutboxService } from "../src/services/geoint/geointEventOutboxService";
import { GeointOutboxDispatcher } from "../src/services/geoint/geointOutboxDispatcher";
import { GeointEventLogService } from "../src/services/geoint/geointEventLogService";

// Simulación de Firestore en memoria
let mockDb: any = { outbox: new Map(), logs: new Map(), fingerprints: new Map() };

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn((db, col, id) => id),
  setDoc: jest.fn(async (ref, data) => { mockDb[ref.split('_')[0]].set(ref, data); }),
  getDoc: jest.fn(async (ref) => ({ exists: () => mockDb.outbox.has(ref), data: () => mockDb.outbox.get(ref) })),
  getDocs: jest.fn(async () => ({ docs: Array.from(mockDb.outbox.values()).map(d => ({ data: () => d })) })),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => "timestamp"),
  runTransaction: jest.fn(async (db, fn) => await fn({
    get: async (ref: any) => ({ exists: () => mockDb.outbox.has(ref), data: () => mockDb.outbox.get(ref) }),
    set: (ref: any, data: any) => mockDb.outbox.set(ref, data)
  }))
}));

describe("ADR-019.19 FASE 2: CERTIFICACIÓN OUTBOX REAL", () => {
  beforeEach(() => {
    mockDb = { outbox: new Map(), logs: new Map(), fingerprints: new Map() };
    jest.clearAllMocks();
  });

  test("CASO 1: Creación real de Outbox Entry", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent("TEST", "EXP1", "TR1", "USR", "SRC", "INIT", "ENT", "ID1");
    expect(entry.status).toBe("CREATED");
    expect(entry.retryCount).toBe(0);
    expect(mockDb.outbox.size).toBe(1);
  });

  test("CASO 2: Procesamiento exitoso", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent("TEST", "EXP1", "TR1", "USR", "SRC", "INIT", "ENT", "ID1");
    const result = await GeointOutboxDispatcher.dispatchPending();
    expect(result.success).toBe(1);
    const processed = Array.from(mockDb.outbox.values()).find((e: any) => e.outboxId === entry.outboxId);
    expect(processed.status).toBe("COMPLETED");
  });

  test("CASO 3: Fallo controlado y reintento", async () => {
    const entry = await GeointEventOutboxService.enqueueEvent("TEST", "EXP1", "TR1", "USR", "SRC", "INIT", "ENT", "ID1", { shouldFailForTest: true });
    await GeointOutboxDispatcher.dispatchPending();
    const processed = Array.from(mockDb.outbox.values()).find((e: any) => e.outboxId === entry.outboxId);
    expect(processed.retryCount).toBe(1);
    expect(processed.status).toBe("QUEUED");
  });

  test("CASO 4: Protección contra duplicidad", async () => {
    await GeointEventOutboxService.enqueueEvent("TEST", "EXP1", "TR1", "USR", "SRC", "INIT", "ENT", "ID1");
    await GeointEventOutboxService.enqueueEvent("TEST", "EXP1", "TR1", "USR", "SRC", "INIT", "ENT", "ID1");
    expect(mockDb.outbox.size).toBe(1);
  });
});
