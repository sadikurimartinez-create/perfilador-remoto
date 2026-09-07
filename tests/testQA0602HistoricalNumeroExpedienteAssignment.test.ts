type StoreDoc = Record<string, any>;

const store = new Map<string, StoreDoc>();

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_firestore: unknown, ...segments: string[]) => ({ path: segments.join("/") })),
  runTransaction: jest.fn(async (_firestore: unknown, updateFunction: any) => {
    const transaction = {
      get: jest.fn(async (ref: { path: string }) => ({
        exists: () => store.has(ref.path),
        data: () => store.get(ref.path),
      })),
      set: jest.fn((ref: { path: string }, value: StoreDoc) => {
        store.set(ref.path, { ...value });
      }),
      update: jest.fn((ref: { path: string }, value: StoreDoc) => {
        store.set(ref.path, { ...(store.get(ref.path) || {}), ...value });
      }),
    };
    return updateFunction(transaction);
  }),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
}));

jest.mock("../src/lib/firebase", () => ({
  getDb: jest.fn(() => ({ kind: "mock-firestore" })),
}));

import { assignNumeroExpedienteToExistingProject } from "../src/services/historicalNumeroExpedienteAssignmentService";

const user = { perfiladorIniciales: "qa" };

describe("QA-06.02 historical numeroExpediente assignment", () => {
  beforeEach(() => {
    store.clear();
  });

  test("proyecto inexistente lanza PROJECT_NOT_FOUND", async () => {
    await expect(
      assignNumeroExpedienteToExistingProject("missing-project", user)
    ).rejects.toThrow("PROJECT_NOT_FOUND");
  });

  test("historico sin numeroExpediente recibe consecutivo nuevo y conserva ceipolId", async () => {
    store.set("projects/historical-1", {
      ceipolId: "CEIPOL/000021/18/08/2026",
      createdAt: 1720000000000,
      canonicalGeography: { geographyId: "geo-1" },
    });
    store.set("counters/projects", { count: 21 });

    const fields = await assignNumeroExpedienteToExistingProject("historical-1", user);
    const project = store.get("projects/historical-1")!;

    expect(fields.numeroExpediente).toMatch(/^\d{8}-0022-QA$/);
    expect(fields.numeroExpedienteSequence).toBe(22);
    expect(store.get("counters/projects")?.count).toBe(22);
    expect(project.ceipolId).toBe("CEIPOL/000021/18/08/2026");
    expect(project.createdAt).toBe(1720000000000);
    expect(project.canonicalGeography).toEqual({ geographyId: "geo-1" });
    expect(project.perfiladorIniciales).toBe("QA");
  });

  test("contador incrementa una sola vez y segunda llamada devuelve el mismo numero", async () => {
    store.set("projects/historical-2", {
      ceipolId: "CEIPOL/000099/18/08/2026",
    });
    store.set("counters/projects", { count: 99 });

    const first = await assignNumeroExpedienteToExistingProject("historical-2", user);
    const second = await assignNumeroExpedienteToExistingProject("historical-2", user);

    expect(second.numeroExpediente).toBe(first.numeroExpediente);
    expect(store.get("counters/projects")?.count).toBe(100);
    expect(store.get("projects/historical-2")?.ceipolId).toBe("CEIPOL/000099/18/08/2026");
  });

  test("proyecto con numeroExpediente existente devuelve el mismo sin incrementar contador", async () => {
    store.set("projects/historical-3", {
      ceipolId: "CEIPOL/000050/18/08/2026",
      numeroExpediente: "18082026-0050-PPC",
      numeroExpedienteAsignadoAt: 1787000000000,
      numeroExpedienteSequence: 50,
      perfiladorIniciales: "PPC",
      numeroExpedienteVersion: "1.0",
    });
    store.set("counters/projects", { count: 100 });

    const fields = await assignNumeroExpedienteToExistingProject("historical-3", user);

    expect(fields.numeroExpediente).toBe("18082026-0050-PPC");
    expect(fields.numeroExpedienteSequence).toBe(50);
    expect(store.get("counters/projects")?.count).toBe(100);
    expect(store.get("projects/historical-3")?.ceipolId).toBe("CEIPOL/000050/18/08/2026");
  });
});
