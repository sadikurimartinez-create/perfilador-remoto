import { normalizeEpistemicMetadata } from "../src/utils/syntheticIntelligenceFirewall";
import fs from "fs";
import path from "path";

let mockGcpProjectId = "test-project";
let mockGcpLocation = "us-central1";
let mockGeminiModel = "gemini-test";
let mockGenerateContent = jest.fn();
let mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));

jest.mock("@/lib/geminiEnv", () => ({
  get GCP_PROJECT_ID() {
    return mockGcpProjectId;
  },
  get GCP_LOCATION() {
    return mockGcpLocation;
  },
  get GEMINI_MODEL() {
    return mockGeminiModel;
  },
  GCP_CLIENT_EMAIL: "",
  GCP_PRIVATE_KEY: "",
}));

jest.mock("@google-cloud/vertexai", () => ({
  VertexAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

jest.mock("../src/modules/pandillas/pandillas.service", () => ({
  PandillasService: {
    analyzeGang: jest.fn().mockResolvedValue({
      exito: true,
      razon: "ok",
      elementosFusionados: [],
      resumenEjecutivo: "ok",
      scoreRiesgo: 10,
      accionesSugeridas: [],
      origenDatos: "TEST",
      isAiGenerated: true,
    }),
  },
}));

describe("ADR-020.19 - External source provenance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGcpProjectId = "test-project";
    mockGcpLocation = "us-central1";
    mockGeminiModel = "gemini-test";
    process.env.INEGI_DENUE_TOKEN = "test-denue-token";
    delete (global as any).fetch;
  });

  test("TEST A DENUE without configuration returns NOT_CONFIGURED without false acquisition", async () => {
    delete process.env.INEGI_DENUE_TOKEN;
    (global as any).fetch = jest.fn();
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 500);
    const provenance = result.epistemicIntegrity;

    expect(result.exito).toBe(false);
    expect(result.total).toBeUndefined();
    expect(provenance.providerId).toBe("INEGI_DENUE");
    expect(provenance.sourceType).toBe("DENUE");
    expect(provenance.acquisitionStatus).toBe("NOT_CONFIGURED");
    expect(provenance.resultCount).toBe(0);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  test("TEST 1 DENUE observed result preserves provider, source, query, status, timestamp and result count", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ Nombre: "Tienda Alfa", Clase_actividad: "Comercio" }],
    });
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 500);
    const provenance = result.epistemicIntegrity;

    expect(result.exito).toBe(true);
    expect(provenance.providerId).toBe("INEGI_DENUE");
    expect(provenance.providerName).toBe("INEGI DENUE API Publica");
    expect(provenance.sourceType).toBe("DENUE");
    expect(provenance.acquisitionMode).toBe("OBSERVED");
    expect(provenance.acquisitionStatus).toBe("ACQUIRED");
    expect(provenance.query).toBe("21.8818,-102.2916,500");
    expect(provenance.acquiredAt).toEqual(expect.any(String));
    expect(provenance.observedAt).toEqual(expect.any(String));
    expect(provenance.rawSourceReference).toBe("denue:v1:consulta:Buscar:todos");
    expect(provenance.resultCount).toBe(1);
    expect(provenance.sourceUrl).toBe("https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar");
  });

  test("TEST 2 SCINCE simulated result preserves explicit simulator provenance", async () => {
    const { getScinceData } = await import("../src/lib/osintActions");

    const result = await getScinceData(21.8818, -102.2916);
    const provenance = result.epistemicIntegrity;

    expect(result.exito).toBe(true);
    expect(provenance.providerId).toBe("SCINCE_LOCAL_SIMULATOR");
    expect(provenance.sourceType).toBe("SCINCE");
    expect(provenance.acquisitionMode).toBe("SIMULATED");
    expect(provenance.rawSourceReference).toBe("local-simulator:scince-demographic-seed");
    expect(provenance.resultCount).toBe(1);
  });

  test("TEST 3 Telegram Gemini synthesis preserves Gemini provenance and is not Telegram observed", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ content: { parts: [{ text: "Sintesis generada para revision." }] } }],
      },
    });
    const { getTelegramOsintData } = await import("../src/lib/osintActions");

    const result = await getTelegramOsintData("pandilla colonia");
    const provenance = result.epistemicIntegrity;

    expect(result.success).toBe(true);
    expect(provenance.providerId).toBe("GEMINI");
    expect(provenance.sourceType).toBe("TELEGRAM_CONTEXT");
    expect(provenance.acquisitionMode).toBe("AI_GENERATED");
    expect(provenance.semanticRole).toBe("SYNTHESIS");
    expect(provenance.providerId).not.toBe("TELEGRAM");
    expect(provenance.acquisitionMode).not.toBe("OBSERVED");
  });

  test("TEST 4 connectivity healthcheck preserves provenance as CONNECTIVITY_ONLY", async () => {
    const { pingOsint } = await import("../src/lib/osintActions");

    const result = await pingOsint();
    const provenance = result.epistemicIntegrity;

    expect(provenance.providerId).toBe("CEIPOL_OSINT_CONNECTIVITY");
    expect(provenance.sourceType).toBe("CONNECTIVITY_HEALTHCHECK");
    expect(provenance.acquisitionMode).toBe("CONNECTIVITY_ONLY");
    expect(provenance.resultCount).toBe(0);
  });

  test("TEST 5 real source with no results preserves NO_DATA and query provenance", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 350);
    const provenance = result.epistemicIntegrity;

    expect(result.exito).toBe(true);
    expect(result.total).toBe(0);
    expect(provenance.providerId).toBe("INEGI_DENUE");
    expect(provenance.acquisitionStatus).toBe("NO_DATA");
    expect(provenance.query).toBe("21.8818,-102.2916,350");
    expect(provenance.resultCount).toBe(0);
  });

  test("TEST 6 failed acquisition remains FAILED and is not normalized to empty success", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => [],
    });
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 500);
    const provenance = result.epistemicIntegrity;

    expect(result.exito).toBe(false);
    expect(provenance.acquisitionStatus).toBe("FAILED");
    expect(provenance.resultCount).toBe(0);
  });

  test("TEST 7 legacy object without provenance is preserved without fabricated provider fields", () => {
    const normalized = normalizeEpistemicMetadata({
      status: "APPROVED_EVIDENCE",
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    expect(normalized.acquisitionMode).toBe("LEGACY");
    expect(normalized.providerId).toBeNull();
    expect(normalized.sourceId).toBeNull();
    expect(normalized.sourceType).toBeNull();
    expect(normalized.query).toBeNull();
    expect(normalized.rawSourceReference).toBeNull();
  });

  test("TEST 8 productive consumer preserves provider/source/query provenance", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ Nombre: "Tienda Beta", Clase_actividad: "Comercio" }],
    });
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ content: { parts: [{ text: "Sintesis OSINT para revision." }] } }],
      },
    });
    const { PandillasEngine } = await import("../src/modules/pandillas/pandillas.engine");

    const result = await PandillasEngine.executeFullSweep(
      {
        id: "gang-1",
        nombre: "Grupo Test",
        zonaInfluencia: "Zona Test",
        coordenadas: { lat: 21.8818, lng: -102.2916 },
      } as any,
      "contexto analitico"
    );

    expect(result.externalSourceProvenance).toHaveLength(3);
    expect(result.externalSourceProvenance?.map((p) => p.providerId)).toEqual([
      "SCINCE_LOCAL_SIMULATOR",
      "INEGI_DENUE",
      "GEMINI",
    ]);
    expect(result.externalSourceProvenance?.[1].sourceType).toBe("DENUE");
    expect(result.externalSourceProvenance?.[1].query).toBe("21.8818,-102.2916,350");
    expect(result.externalSourceProvenance?.[2].rawSourceReference).toBe("gemini:generateContent:telegram-context-synthesis");
  });

  test("TEST E DENUE source no longer depends on an embedded credential fallback", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/osintActions.ts"), "utf8");

    expect(source).not.toMatch(/INEGI_DENUE_TOKEN\s*\|\|/);
    expect(source).not.toMatch(/const\s+token\s*=.*\|\|\s*["'][0-9a-f-]{24,}["']/i);
  });
});
