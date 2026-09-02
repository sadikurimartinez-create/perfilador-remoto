import fs from "fs";
import path from "path";
import { logGeointEvent } from "../src/services/geoint/logGeointEvent";
import { TemporalComparisonPersistenceService } from "../src/services/geoint/temporalComparisonPersistenceService";
import { exportToWord } from "../src/lib/exportToWord";

type MockSnapshot = { exists: () => boolean; data: () => any; id?: string };

let mockTransactionQueue = Promise.resolve();
let mockFailOnSetIncludes: string | null = null;
let mockStore: Map<string, any> = new Map();
let mockTimestampCounter = 0;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getSnapshot(ref: string): MockSnapshot {
  const value = mockStore.get(ref);
  return {
    exists: () => value !== undefined,
    data: () => clone(value),
    id: ref.split("/").pop(),
  };
}

function setData(target: Map<string, any>, ref: string, data: any, options?: { merge?: boolean }) {
  if (mockFailOnSetIncludes && ref.includes(mockFailOnSetIncludes)) {
    throw new Error(`MOCK_TRANSACTION_FAILURE:${mockFailOnSetIncludes}`);
  }
  const current = target.get(ref) || {};
  target.set(ref, options?.merge ? { ...current, ...clone(data) } : clone(data));
}

function getOutboxEntries() {
  return Array.from(mockStore.entries())
    .filter(([ref]) => ref.startsWith("geoint_event_outbox/"))
    .map(([, value]) => clone(value));
}

function getLedgerEntries() {
  return Array.from(mockStore.entries())
    .filter(([ref]) => ref.startsWith("geoint_event_logs/"))
    .map(([, value]) => clone(value));
}

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db, ...segments) => segments.join("/")),
  doc: jest.fn((_db, ...segments) => segments.join("/")),
  setDoc: jest.fn(async (ref, data, options) => setData(mockStore, ref, data, options)),
  getDoc: jest.fn(async (ref) => getSnapshot(ref)),
  getDocs: jest.fn(async (collectionRef) => ({
    docs: Array.from(mockStore.entries())
      .filter(([ref]) => ref.startsWith(`${collectionRef}/`))
      .map(([ref, value]) => ({ id: ref.split("/").pop(), data: () => clone(value) })),
    forEach(callback: (doc: MockSnapshot) => void) {
      this.docs.forEach(callback);
    },
  })),
  query: jest.fn((collectionName) => collectionName),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => `mock-server-timestamp-${++mockTimestampCounter}`),
  runTransaction: jest.fn(async (_db, fn) => {
    const run = mockTransactionQueue.then(async () => {
      const staged = new Map(mockStore);
      const result = await fn({
        get: async (ref: string) => getSnapshot(ref),
        set: (ref: string, data: any, options?: { merge?: boolean }) => setData(staged, ref, data, options),
      });
      mockStore = staged;
      return result;
    });
    mockTransactionQueue = run.catch(() => undefined);
    return run;
  }),
}));

jest.mock("@/lib/firebaseServer", () => ({
  getFirebaseServerDb: jest.fn(() => ({})),
}));

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
}));

jest.mock("file-saver", () => ({
  saveAs: jest.fn(),
}));

function buildComparisonRecord(id = "cmp-2b") {
  return {
    id,
    expedienteId: "EXP-2B",
    traceabilityId: "trace-cmp-2b",
    sourceEvidenceId: "src-evidence-2b",
    evidenceA: { id: "ev-a", traceabilityId: "trace-a" },
    evidenceB: { id: "ev-b", traceabilityId: "trace-b" },
    analystValidation: {
      status: "PENDING_REVIEW",
      reviewerId: "ANALYST_2B",
    },
    updatedAt: "2026-08-28T00:00:00.000Z",
  } as any;
}

describe("ADR-019.19 FASE 2B: Integracion productiva con Outbox", () => {
  beforeEach(() => {
    mockStore = new Map();
    mockTransactionQueue = Promise.resolve();
    mockFailOnSetIncludes = null;
    mockTimestampCounter = 0;
    jest.clearAllMocks();
  });

  test("TEST 1 - TEMPORAL COMPARISON SUCCESS: persiste comparacion y Outbox", async () => {
    await TemporalComparisonPersistenceService.saveTemporalComparison("EXP-2B", buildComparisonRecord());

    expect(mockStore.has("projects/EXP-2B/geoint_temporal_comparisons/cmp-2b")).toBe(true);
    expect(mockStore.has("geoint_temporal_comparisons/cmp-2b")).toBe(true);
    expect(getOutboxEntries()).toHaveLength(1);
    expect(getOutboxEntries()[0].payload.eventType).toBe("TEMPORAL_COMPARISON_CREATED");
  });

  test("TEST 2 - TEMPORAL COMPARISON ATOMIC FAILURE: no deja comparacion parcial ni Outbox huerfano", async () => {
    mockFailOnSetIncludes = "geoint_event_outbox";

    await expect(
      TemporalComparisonPersistenceService.saveTemporalComparison("EXP-2B", buildComparisonRecord())
    ).rejects.toThrow("MOCK_TRANSACTION_FAILURE");

    expect(mockStore.has("projects/EXP-2B/geoint_temporal_comparisons/cmp-2b")).toBe(false);
    expect(mockStore.has("geoint_temporal_comparisons/cmp-2b")).toBe(false);
    expect(getOutboxEntries()).toHaveLength(0);
  });

  test("TEST 3 - TEMPORAL COMPARISON IDEMPOTENCY: retry equivalente no duplica Outbox ni cambia eventId", async () => {
    const record = buildComparisonRecord();

    await TemporalComparisonPersistenceService.saveTemporalComparison("EXP-2B", record);
    const first = getOutboxEntries()[0];
    await TemporalComparisonPersistenceService.saveTemporalComparison("EXP-2B", record);
    const second = getOutboxEntries()[0];

    expect(getOutboxEntries()).toHaveLength(1);
    expect(second.eventId).toBe(first.eventId);
  });

  test("TEST 4 - SWEEP EVENT: una accion logica de sweep encola un Outbox logico", async () => {
    await logGeointEvent(
      "GEOINT_SWEEP_STARTED",
      "EXP-SWEEP",
      "trace-sweep-start-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA",
      "ANALYST",
      "GeointControlledSweepEngine",
      "INITIATED",
      "SWEEP_SESSION",
      "sweep-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA",
      { radiusMeters: 100 }
    );

    expect(getOutboxEntries()).toHaveLength(1);
    expect(getOutboxEntries()[0].payload.eventType).toBe("GEOINT_SWEEP_STARTED");
  });

  test("TEST 5 - SWEEP DUPLICATE CALL: dos emisiones equivalentes producen 1 Outbox logico", async () => {
    await Promise.all([
      logGeointEvent("GEOINT_SWEEP_STARTED", "EXP-SWEEP", "trace-sweep-start-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA", "ANALYST", "GeointControlledSweepEngine", "INITIATED", "SWEEP_SESSION", "sweep-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA"),
      logGeointEvent("GEOINT_SWEEP_STARTED", "EXP-SWEEP", "trace-sweep-start-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA", "ANALYST", "GeointControlledSweepEngine", "INITIATED", "SWEEP_SESSION", "sweep-EXP-SWEEP-21.88530--102.29160-100-MULTICAPA"),
    ]);

    expect(getOutboxEntries()).toHaveLength(1);
  });

  test("TEST 6 - NO EVENT ON MOUNT: importar el componente no emite Outbox", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/geoint/GeointControlledSweepEngine.tsx"),
      "utf8"
    );
    expect(source).toContain("onClick={handleExecuteControlledSweep}");
    expect(source).not.toMatch(/useEffect\s*\([^)]*logGeointEvent/s);
    expect(getOutboxEntries()).toHaveLength(0);
  });

  test("TEST 7 - WORD EXPORT EVENT: exportacion valida encola evento logico", async () => {
    await exportToWord(
      {
        projectId: "EXP-WORD",
        projectName: "Proyecto Word",
        streetViewAnalysis: [{ findingId: "find-word", traceabilityId: "trace-word", imageReference: "/img.jpg" }],
      },
      "Proyecto Word",
      "REP-WORD-001",
      { name: "Analyst Word" }
    ).catch(() => undefined);

    expect(getOutboxEntries()).toHaveLength(1);
    expect(getOutboxEntries()[0].payload.eventType).toBe("REPORT_CONSUMED");
  });

  test("TEST 8 - WORD EXPORT DUPLICATE: retry equivalente no duplica evento logico", async () => {
    const buildWordPayload = () => ({
      projectId: "EXP-WORD",
      projectName: "Proyecto Word",
      streetViewAnalysis: [{ findingId: "find-word", traceabilityId: "trace-word", imageReference: "/img.jpg" }],
    });

    await exportToWord(buildWordPayload(), "Proyecto Word", "REP-WORD-001", { name: "Analyst Word" }).catch(() => undefined);
    await exportToWord(buildWordPayload(), "Proyecto Word", "REP-WORD-001", { name: "Analyst Word" }).catch(() => undefined);

    expect(getOutboxEntries()).toHaveLength(1);
  });

  test("TEST 9 - NO DIRECT LEDGER WRITE: consumidores migrados no escriben directo a geoint_event_logs", () => {
    const root = process.cwd();
    const files = [
      "src/services/geoint/temporalComparisonPersistenceService.ts",
      "src/modules/geoint/GeointControlledSweepEngine.tsx",
      "src/lib/exportToWord.ts",
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/GeointEventLogService|createAndPersistEvent|persistGeointEvent|geoint_event_logs/);
    }
    expect(getLedgerEntries()).toHaveLength(0);
  });
});
