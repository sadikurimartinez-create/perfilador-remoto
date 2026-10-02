type StoreDoc = Record<string, any>;

const store = new Map<string, StoreDoc>();

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "fixture-session" }) }) }));
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: jest.fn(async ({ projectId }: any) => ({ allowed: true, projectId, actor: { institutionalUserId: "1", username: "fixture", role: "USER" }, policyVersion: "EXPLICIT_ACTION_GRANT_V1" })) }));
jest.mock("@/lib/db", () => ({ getPool: () => ({ query: async () => ({ rows: [{ profile: { perfiladorIniciales: "QA" } }] }) }) }));
jest.mock("@/lib/firebaseAdmin", () => ({
  getInstitutionalAdminDb: () => ({
    collection: (name: string) => ({ doc: (id = "audit-fixture") => ({ path: `${name}/${id}` }) }),
    runTransaction: async (work: any) => {
      const pending = new Map(store);
      const transaction = {
        get: async (ref: { path: string }) => ({ exists: pending.has(ref.path), data: () => pending.get(ref.path) }),
        set: (ref: { path: string }, value: StoreDoc) => pending.set(ref.path, { ...value }),
        update: (ref: { path: string }, value: StoreDoc) => pending.set(ref.path, { ...pending.get(ref.path), ...value }),
        create: (ref: { path: string }, value: StoreDoc) => pending.set(ref.path, { ...value }),
      };
      const result = await work(transaction);
      store.clear(); pending.forEach((value, key) => store.set(key, value));
      return result;
    },
  }),
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
