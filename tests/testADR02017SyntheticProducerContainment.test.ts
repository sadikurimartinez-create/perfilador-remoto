import { evaluateIntelligenceEligibility } from "../src/utils/syntheticIntelligenceFirewall";

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

describe("ADR-020.17 Fase 2 - Synthetic producer containment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGcpProjectId = "test-project";
    mockGcpLocation = "us-central1";
    mockGeminiModel = "gemini-test";
    delete (global as any).fetch;
  });

  test("SCINCE simulated output is SIMULATED and not reportable", async () => {
    const { getScinceData } = await import("../src/lib/osintActions");

    const result = await getScinceData(21.8818, -102.2916);
    const eligibility = evaluateIntelligenceEligibility(result);

    expect(result.exito).toBe(true);
    expect(result.epistemicIntegrity.acquisitionMode).toBe("SIMULATED");
    expect(result.epistemicIntegrity.isSimulated).toBe(true);
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("Telegram Gemini output is AI_GENERATED and pending review, never OBSERVED by generation alone", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ content: { parts: [{ text: "Resumen OSINT generado para revision humana." }] } }],
      },
    });
    const { getTelegramOsintData } = await import("../src/lib/osintActions");

    const result = await getTelegramOsintData("consulta telegram");
    const eligibility = evaluateIntelligenceEligibility(result);

    expect(result.success).toBe(true);
    expect(result.epistemicIntegrity.acquisitionMode).toBe("AI_GENERATED");
    expect(result.epistemicIntegrity.acquisitionMode).not.toBe("OBSERVED");
    expect(result.epistemicIntegrity.validationStatus).toBe("PENDING_REVIEW");
    expect(eligibility.eligibleForHumanReview).toBe(true);
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("VALIDATION_NOT_APPROVED:PENDING_REVIEW");
  });

  test("connectivity-only producer is diagnostic and not reportable", async () => {
    const { pingOsint } = await import("../src/lib/osintActions");

    const result = await pingOsint();
    const eligibility = evaluateIntelligenceEligibility(result);

    expect(result.status).toBe("ok");
    expect(result.epistemicIntegrity.acquisitionMode).toBe("CONNECTIVITY_ONLY");
    expect(result.epistemicIntegrity.isConnectivityOnly).toBe(true);
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("CONNECTIVITY_ONLY_NOT_REPORTABLE");
  });

  test("not configured Telegram provider returns NOT_CONFIGURED without fabricated content", async () => {
    mockGcpProjectId = "";
    const { getTelegramOsintData } = await import("../src/lib/osintActions");

    const result = await getTelegramOsintData("consulta telegram");

    expect(result.success).toBe(false);
    expect(result.osintSummary).toBeUndefined();
    expect(result.epistemicIntegrity.acquisitionStatus).toBe("NOT_CONFIGURED");
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  test("no DENUE data remains NO_DATA without synthetic fallback", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 500);
    const eligibility = evaluateIntelligenceEligibility(result);

    expect(result.exito).toBe(true);
    expect(result.total).toBe(0);
    expect(result.epistemicIntegrity.acquisitionMode).toBe("OBSERVED");
    expect(result.epistemicIntegrity.acquisitionStatus).toBe("NO_DATA");
    expect(result.resumen).not.toMatch(/simulad|generad|fallback/i);
    expect(eligibility.eligibleForReport).toBe(false);
  });

  test("DENUE successful API acquisition is OBSERVED source fact and can pass when analyst-approved", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ Nombre: "Tienda Alfa", Clase_actividad: "Comercio al por menor" }],
    });
    const { getDenueData } = await import("../src/lib/osintActions");

    const result = await getDenueData(21.8818, -102.2916, 500);
    const approvedEligibility = evaluateIntelligenceEligibility({
      ...result,
      epistemicIntegrity: {
        ...result.epistemicIntegrity,
        validationStatus: "APPROVED",
      },
    });

    expect(result.exito).toBe(true);
    expect(result.total).toBe(1);
    expect(result.epistemicIntegrity.acquisitionMode).toBe("OBSERVED");
    expect(result.epistemicIntegrity.semanticRole).toBe("SOURCE_FACT");
    expect(approvedEligibility.eligibleForReport).toBe(true);
  });

  test("firewall blocks MOCK, SIMULATED, and CONNECTIVITY_ONLY even when approved", () => {
    const modes = ["MOCK", "SIMULATED", "CONNECTIVITY_ONLY"] as const;

    for (const acquisitionMode of modes) {
      const eligibility = evaluateIntelligenceEligibility({
        epistemicIntegrity: {
          acquisitionMode,
          acquisitionStatus: "ACQUIRED",
          validationStatus: "APPROVED",
          semanticRole: "DIAGNOSTIC",
          isSimulated: acquisitionMode === "SIMULATED",
          isConnectivityOnly: acquisitionMode === "CONNECTIVITY_ONLY",
        },
      });

      expect(eligibility.eligibleForReport).toBe(false);
      expect(eligibility.blockingReasons).toContain(`ACQUISITION_MODE_NOT_REPORTABLE:${acquisitionMode}`);
    }
  });
});
