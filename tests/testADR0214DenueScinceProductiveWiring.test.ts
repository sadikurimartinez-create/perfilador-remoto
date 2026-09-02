const analyzeGang = jest.fn();

jest.mock("../src/modules/pandillas/pandillas.service", () => ({
  PandillasService: { analyzeGang },
}));

jest.mock("../src/lib/osintActions", () => ({
  getScinceData: jest.fn(async () => ({
    exito: true,
    poblacionTotal: "100",
    viviendasTotales: "30",
    gradoMarginacion: "Medio",
    epistemicIntegrity: {
      sourceId: "SCINCE_LOCAL_SIMULATOR",
      providerId: "SCINCE_LOCAL_SIMULATOR",
      sourceType: "SCINCE",
      acquisitionMode: "SIMULATED",
      acquisitionStatus: "ACQUIRED",
      isSimulated: true,
    },
  })),
  getDenueData: jest.fn(async () => ({
    exito: true,
    total: 1,
    resumen: "Comercio observado",
    epistemicIntegrity: {
      sourceId: "inegi-denue-api",
      providerId: "INEGI_DENUE",
      sourceType: "DENUE",
      acquisitionMode: "OBSERVED",
      acquisitionStatus: "ACQUIRED",
    },
  })),
  getTelegramOsintData: jest.fn(async () => ({
    success: false,
    epistemicIntegrity: {
      sourceId: "telegram-gemini-osint-synthesis",
      providerId: "GEMINI",
      providerName: "Google Vertex AI Gemini",
      sourceType: "TELEGRAM_CONTEXT",
      acquisitionMode: "AI_GENERATED",
      acquisitionStatus: "NOT_CONFIGURED",
      semanticRole: "SYNTHESIS",
    },
  })),
}));

describe("ADR-021.4D-2C-B productive DENUE / SCINCE wiring", () => {
  beforeEach(() => {
    analyzeGang.mockResolvedValue({
      exito: true,
      elementosFusionados: [],
      resumenEjecutivo: "Resultado",
      scoreRiesgo: 0,
      accionesSugeridas: [],
      origenDatos: "TEST",
      isAiGenerated: false,
    });
  });

  test("Pandillas returns non-null orchestration items without evidence or findings", async () => {
    const { PandillasEngine } = await import("../src/modules/pandillas/pandillas.engine");
    const result = await PandillasEngine.executeFullSweep({
      id: "gang-1",
      projectId: "exp-1",
      nombre: "Grupo",
      zonaInfluencia: "Zona",
      coordenadas: { lat: 21.88, lng: -102.29 },
      integrantes: [],
    }, "contexto");

    const scinceItem = result.sourceOrchestrationItems?.find(
      (item) => item.source.sourceType === "SCINCE"
    );
    const denueItem = result.sourceOrchestrationItems?.find(
      (item) => item.source.sourceType === "DENUE"
    );

    expect(scinceItem).toBeDefined();
    expect(denueItem).toBeDefined();
    expect(scinceItem?.eligibility).toBe("INELIGIBLE");
    expect(denueItem?.eligibility).toBe("ELIGIBLE");
    expect(result.sourceOrchestrationItems?.every((item) => !item.evidenceRef && !item.findingRef)).toBe(true);
    expect(result.externalSourceProvenance).toHaveLength(3);
    expect(result.sourceRouteClassifications).toBeDefined();
  });
});
