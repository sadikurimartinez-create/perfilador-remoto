import fs from "node:fs";
import path from "node:path";
import { POST } from "../src/app/api/pandillas/route";
import { PandillasService } from "../src/modules/pandillas/pandillas.service";
import { PandillasSweepError } from "../src/modules/pandillas/pandillas.sweepStatus";

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
}));

jest.mock("@/lib/geminiEnv", () => ({
  GCP_PROJECT_ID: "test-project",
  GCP_LOCATION: "us-central1",
  GEMINI_MODEL: "gemini-test",
  GCP_CLIENT_EMAIL: "",
  GCP_PRIVATE_KEY: "",
}));

jest.mock("@google-cloud/vertexai", () => ({
  VertexAI: jest.fn(),
}));

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(async () => {
    throw new Error("xlsx unavailable in focal test");
  }),
}));

const originalFetch = global.fetch;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalNextPublicGeminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const gang: any = {
  nombre: "Clica Norte",
  zonaInfluencia: "Centro",
  antagonicas: [],
  integrantes: [],
  grafitiInfo: {},
  archivosAnexos: [],
};

const providerPayload = {
  ficha: {
    nombre: "Clica Norte",
    zona: "Centro",
    integrantes: [],
    estructuraJerarquica: "Celular",
    descripcionEstructura: "Sin expansión confirmada.",
    nivelRiesgo: "Medio",
    resumenInteligencia: "Resultado gobernado.",
    crossCheckJuridico: "Sin imputación automática.",
  },
  mapa: {
    geolocalizacion: [],
    areasCalientes: [],
    expansionTerritorial: "Contenida",
  },
  grafo: {
    nodos: [{ id: "CLICA_NORTE", label: "Clica Norte", tipo: "pandilla", grupo: "Clica Norte", risk: "Medio" }],
    enlaces: [],
  },
  alertas: [],
};

function mockResponse(status: number, body: any): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERROR",
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
  } as any;
}

function readPandillasUiSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/modules/pandillas/pandillas.ui.tsx"), "utf8");
}

function targetedSweepBlock() {
  const source = readPandillasUiSource();
  return source.slice(source.indexOf("const handleExecuteTargetedSweep = async"), source.indexOf("const handleResetForm ="));
}

describe("P1-E Pandillas non-blocking lifecycle", () => {
  beforeEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalNextPublicGeminiApiKey;
  });

  test("TEST 1 - respuesta válida cierra como SUCCESS", async () => {
    global.fetch = jest.fn(async () => mockResponse(200, providerPayload)) as any;

    const result = await PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 100 });

    expect(result.sweepStatus).toBe("SUCCESS");
    expect(global.fetch).toHaveBeenCalledWith("/api/pandillas", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  test("TEST 2 - resultado vacío explícito cierra como EMPTY", async () => {
    global.fetch = jest.fn(async () => mockResponse(200, {
      ...providerPayload,
      grafo: { nodos: [], enlaces: [] },
      mapa: { geolocalizacion: [], areasCalientes: [] },
      alertas: [],
    })) as any;

    await expect(PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 100 }))
      .resolves.toMatchObject({ sweepStatus: "EMPTY" });
  });

  test("TEST 3 - proveedor no configurado cierra como NOT_CONFIGURED", async () => {
    global.fetch = jest.fn(async () => mockResponse(503, { error: "NOT_CONFIGURED", sweepStatus: "NOT_CONFIGURED" })) as any;

    await expect(PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 100 }))
      .rejects.toMatchObject({ sweepStatus: "NOT_CONFIGURED", httpStatus: 503 });
  });

  test("TEST 4 - petición pendiente cierra con timeout controlado", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as any;

    const pending = PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 10 });
    const assertion = expect(pending).rejects.toMatchObject({ sweepStatus: "TIMEOUT", httpStatus: 504 });
    await jest.advanceTimersByTimeAsync(10);

    await assertion;
  });

  test("TEST 5 - timeout usa AbortController y no deja fetch colgado", async () => {
    jest.useFakeTimers();
    let observedSignal: AbortSignal | null = null;
    global.fetch = jest.fn((_url, init: any) => new Promise((_resolve, reject) => {
      observedSignal = init.signal;
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as any;

    const pending = PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(PandillasSweepError);
    await jest.advanceTimersByTimeAsync(10);
    await assertion;

    expect(observedSignal?.aborted).toBe(true);
  });

  test("TEST 6 - error 500 cierra como PROVIDER_ERROR", async () => {
    global.fetch = jest.fn(async () => mockResponse(500, { error: "SERVER_ERROR" })) as any;

    await expect(PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 100 }))
      .rejects.toMatchObject({ sweepStatus: "PROVIDER_ERROR", httpStatus: 500 });
  });

  test("TEST 7 - no existe retry automático no humano", () => {
    const source = readPandillasUiSource();

    expect(source).not.toContain("setTimeout(handleExecuteTargetedSweep");
    expect(source).not.toContain("setInterval(handleExecuteTargetedSweep");
    expect(source).not.toContain(".catch(() => handleExecuteTargetedSweep");
  });

  test("TEST 8 - finally apaga loading en todos los cierres", () => {
    const source = readPandillasUiSource();

    expect(source).toMatch(/finally\s*{[\s\S]*setIsAnalyzing\(false\)/);
  });

  test("TEST 9 - el progreso simulado no oculta el mensaje final gobernado", () => {
    const source = readPandillasUiSource();

    expect(source).toContain("setAnalyzeStep(PANDILLAS_SWEEP_MESSAGES[sweepStatus as PandillasSweepStatus])");
    expect(source).toContain("setAnalyzeStep(message)");
    expect(source).not.toMatch(/finally\s*{[\s\S]*setAnalyzeStep\(""\)/);
  });

  test("TEST 10 - API distingue validación, no configurado y error de proveedor", async () => {
    const validationResponse = await POST(new Request("http://localhost/api/pandillas", {
      method: "POST",
      body: JSON.stringify({ nombre: "" }),
    }));
    expect(validationResponse.status).toBe(400);
    await expect(validationResponse.json()).resolves.toMatchObject({ sweepStatus: "VALIDATION_ERROR" });

    const notConfiguredResponse = await POST(new Request("http://localhost/api/pandillas", {
      method: "POST",
      body: JSON.stringify(gang),
    }));
    expect(notConfiguredResponse.status).toBe(503);
    await expect(notConfiguredResponse.json()).resolves.toMatchObject({ sweepStatus: "NOT_CONFIGURED", isAiGenerated: false });
  });

  test("TEST 11 - resultado válido conserva proveedor, modelo y timestamp", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    global.fetch = jest.fn(async () => mockResponse(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(providerPayload) }] } }],
    })) as any;

    const response = await POST(new Request("http://localhost/api/pandillas", {
      method: "POST",
      body: JSON.stringify(gang),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sweepStatus).toBe("SUCCESS");
    expect(body.providerProvenance).toMatchObject({
      provider: "GEMINI_REST",
      model: "gemini-test",
      source: "PANDILLAS_SWEEP_PROVIDER",
    });
    expect(typeof body.providerProvenance.generatedAt).toBe("string");
  });

  test("TEST 12 - sin proveedor no fabrica resultado ficticio", async () => {
    const response = await POST(new Request("http://localhost/api/pandillas", {
      method: "POST",
      body: JSON.stringify(gang),
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.isAiGenerated).toBe(false);
    expect(body.sweepStatus).toBe("NOT_CONFIGURED");
    expect(body.ficha).toBeUndefined();
    expect(body.grafo).toBeUndefined();
  });

  test("TEST 13 P4-B setIsAnalyzing true queda cubierto por un único try/finally posterior", () => {
    const block = targetedSweepBlock();
    const loadingIndex = block.indexOf("setIsAnalyzing(true);");
    const tryIndex = block.indexOf("try {");
    const finallyIndex = block.indexOf("finally");
    const offIndex = block.indexOf("setIsAnalyzing(false)");

    expect(loadingIndex).toBeGreaterThan(-1);
    expect(tryIndex).toBeGreaterThan(loadingIndex);
    expect(finallyIndex).toBeGreaterThan(tryIndex);
    expect(offIndex).toBeGreaterThan(finallyIndex);
    expect(block.match(/try\s*{/g)).toHaveLength(1);
    expect(block.match(/finally\s*{/g)).toHaveLength(1);
  });

  test("TEST 14 P4-B pasos visuales y delays estan dentro del try/finally", () => {
    const block = targetedSweepBlock();
    const tryIndex = block.indexOf("try {");
    const stepsIndex = block.indexOf("const steps = [");
    const delayIndex = block.indexOf("await new Promise(r => setTimeout");
    const finallyIndex = block.indexOf("finally");

    expect(stepsIndex).toBeGreaterThan(tryIndex);
    expect(delayIndex).toBeGreaterThan(stepsIndex);
    expect(delayIndex).toBeLessThan(finallyIndex);
  });

  test("TEST 15 P4-B excepciones pre-provider pasan por catch gobernado", () => {
    const block = targetedSweepBlock();
    const tryIndex = block.indexOf("try {");
    const adapterIndex = block.indexOf("const canonicalPandillasInput = adaptPandillasCanonicalInput");
    const providerIndex = block.indexOf("const result = await PandillasEngine.executeFullSweep");
    const catchIndex = block.indexOf("catch (err: any)");

    expect(adapterIndex).toBeGreaterThan(tryIndex);
    expect(adapterIndex).toBeLessThan(providerIndex);
    expect(catchIndex).toBeGreaterThan(providerIndex);
    expect(block).toContain("const status = err instanceof PandillasSweepError ? err.sweepStatus : \"PROVIDER_ERROR\";");
    expect(block).toContain("setAnalyzeStep(message);");
  });

  test("TEST 16 P4-B todos los estados terminales P1-E siguen mapeados en UI", () => {
    const block = targetedSweepBlock();
    const source = readPandillasUiSource();

    for (const status of ["SUCCESS", "EMPTY", "NOT_CONFIGURED", "TIMEOUT", "PROVIDER_ERROR", "VALIDATION_ERROR"]) {
      expect(source).toContain(`${status}:`);
    }
    expect(block).toContain("setAnalyzeStep(PANDILLAS_SWEEP_MESSAGES[sweepStatus as PandillasSweepStatus])");
    expect(block).toContain("PANDILLAS_SWEEP_MESSAGES[status as PandillasSweepStatus]");
  });

  test("TEST 17 P4-B provider nunca responde termina por timeout de servicio", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as any;

    const pending = PandillasService.analyzeGang(gang, "contexto", { timeoutMs: 10 });
    const assertion = expect(pending).rejects.toMatchObject({ sweepStatus: "TIMEOUT", httpStatus: 504 });
    await jest.advanceTimersByTimeAsync(10);

    await assertion;
  });

  test("TEST 18 P4-B no hay auto-run ni retry infinito desde mount", () => {
    const source = readPandillasUiSource();
    const effects = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];

    expect(effects.join("\n")).not.toContain("handleExecuteTargetedSweep");
    expect(source).not.toContain("while (isAnalyzing");
    expect(source).not.toContain("setInterval(");
  });
});
